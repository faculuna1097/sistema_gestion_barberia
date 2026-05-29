// /frontend/src/screens/admin/sections/gestion/BloqueFeriados.jsx
// Bloque de gestión de los feriados puntuales del negocio.
// Se renderiza dentro de TabNegocio, debajo del horario de atención.
// Cobertura: plan_horario_atencion.md §4.6.
//
// Sistema de diseño: tokens + Geist + primitivos + onClick. El alta usa el
// primitivo Modal; la confirmación de cascada 409 y el borrado usan
// ConfirmDialog. Feedback efímero con Toast.

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../../services/api';
import {
  Button,
  Field,
  Modal,
  ConfirmDialog,
  DetalleRecurso,
  InputTiempo,
  BotonIconoFila,
  Toast,
  LoadingState,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// Nombres de mes para mostrar la fecha de forma legible.
const NOMBRE_MES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * hoyISO
 * Devuelve la fecha de hoy en formato 'YYYY-MM-DD' (hora local del navegador).
 * Sirve como valor mínimo del InputTiempo type="date" al agregar un feriado.
 * Es sólo una guía de UI; el backend revalida contra la TZ de Argentina.
 * @returns {string} fecha de hoy 'YYYY-MM-DD'
 */
function hoyISO() {
  const ahora = new Date();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mm}-${dd}`;
}

/**
 * formatFecha
 * Formatea una fecha 'YYYY-MM-DD' a algo legible tipo "25 dic 2026". Parsea los
 * componentes a mano para no depender de la zona horaria (new Date('YYYY-MM-DD')
 * interpreta la fecha como UTC y puede correrla un día).
 * @param {string} iso - fecha en 'YYYY-MM-DD'
 * @returns {string} fecha legible
 */
function formatFecha(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${parseInt(dia, 10)} ${NOMBRE_MES[parseInt(mes, 10) - 1]} ${anio}`;
}

/**
 * insertarOrdenado
 * Inserta un feriado en una lista ya ordenada por fecha ascendente,
 * manteniendo el orden.
 * @param {Array} lista - feriados ordenados por fecha
 * @param {Object} feriado - feriado nuevo { id, fecha, descripcion }
 * @returns {Array} nueva lista ordenada
 */
function insertarOrdenado(lista, feriado) {
  return [...lista, feriado].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Wrapper de contenido (sin chrome de card: el panel lo aporta TabNegocio).
// Compartido entre los estados carga/error/contenido.
const CONTENT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

/**
 * EncabezadoFeriados
 * Título + hint de la card. Compartido entre los estados de carga / error /
 * contenido para no duplicar la tipografía.
 * @returns {JSX.Element}
 */
function EncabezadoFeriados() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>
        Feriados
      </span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        lineHeight: 1.5,
      }}>
        Días en que el negocio no abre. No se toman turnos esas fechas y los
        turnos ya reservados se cancelan al cargar el feriado.
      </span>
    </div>
  );
}

/**
 * BloqueFeriados
 * Lista los feriados futuros del negocio y permite agregar (con flujo de
 * confirmación de cascada) y eliminar feriados.
 * @returns {JSX.Element}
 */
export default function BloqueFeriados() {
  const [feriados, setFeriados]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [feedback, setFeedback]   = useState(null);    // { tone, texto } | null
  const [intento, setIntento]     = useState(0);

  // Modal de alta + sus campos. La fecha/descripción se conservan mientras dura
  // el flujo de confirmación de cascada (recién se limpian al éxito o al
  // cancelar), porque el POST se reenvía con esos mismos valores.
  const [modalAgregar, setModalAgregar]  = useState(false);
  const [nuevaFecha, setNuevaFecha]      = useState('');
  const [nuevaDescripcion, setNuevaDesc] = useState('');
  const [guardando, setGuardando]        = useState(false);
  const [errorModal, setErrorModal]      = useState(null);

  // Confirmación de cascada (POST devolvió 409 requiere_confirmacion).
  const [deltaConfirmar, setDeltaConf] = useState(null);

  // Confirmación de eliminación.
  const [feriadoAEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando]      = useState(false);

  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const cargarFeriados = async () => {
      setCargando(true);
      setErrorCarga(null);
      try {
        const res = await apiFetch('/admin/feriados');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelado) setFeriados(data);
      } catch (err) {
        console.error('[bloqueFeriados] Error en cargarFeriados:', err.message);
        if (!cancelado) setErrorCarga('No se pudieron cargar los feriados.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarFeriados();
    return () => { cancelado = true; };
  }, [intento]);

  // Abre el modal de alta limpio.
  const abrirModalAgregar = () => {
    setFeedback(null);
    setNuevaFecha('');
    setNuevaDesc('');
    setErrorModal(null);
    setModalAgregar(true);
  };

  // Cierra el modal de alta y descarta el error inline.
  const cerrarModalAgregar = () => {
    if (guardando) return;
    setModalAgregar(false);
    setErrorModal(null);
  };

  /**
   * ejecutarAlta — ejecuta el POST del feriado. Si confirmarCascada es false y
   * el backend responde 409 requiere_confirmacion, abre el modal de cascada. Si
   * es true (o no había impacto), inserta el feriado y muestra el resultado.
   * @param {boolean} confirmarCascada
   */
  const ejecutarAlta = async (confirmarCascada) => {
    setGuardando(true);
    setErrorModal(null);

    try {
      const res = await apiFetch('/admin/feriados', {
        method: 'POST',
        body: JSON.stringify({
          fecha: nuevaFecha,
          descripcion: nuevaDescripcion.trim() || null,
          confirmar_cascada: confirmarCascada,
        }),
      });

      // 409 → puede ser feriado duplicado o requerir confirmación de cascada.
      if (res.status === 409) {
        const data = await res.json();
        if (!vivoRef.current) return;
        if (data.codigo === 'feriado_ya_existe') {
          setErrorModal('Ya hay un feriado cargado en esa fecha.');
          return;
        }
        // requiere_confirmacion: cerrar el modal de alta y abrir el de cascada.
        setModalAgregar(false);
        setDeltaConf(data.delta);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      if (!vivoRef.current) return;
      setFeriados((prev) => insertarOrdenado(prev, data.feriado));
      setModalAgregar(false);
      setDeltaConf(null);
      setNuevaFecha('');
      setNuevaDesc('');

      const canceladas = data.cascada.turnos_cancelados;
      setFeedback({
        tone: 'success',
        texto: canceladas > 0
          ? `Feriado agregado · ${canceladas} turno(s) cancelado(s).`
          : 'Feriado agregado correctamente.',
      });
    } catch (err) {
      console.error('[bloqueFeriados] Error en ejecutarAlta:', err.message);
      // El error se muestra donde esté el usuario (modal de alta o de cascada).
      if (vivoRef.current) setErrorModal(err.message || 'No se pudo agregar el feriado.');
    } finally {
      if (vivoRef.current) setGuardando(false);
    }
  };

  // Cancela el flujo de confirmación de cascada y descarta los campos del alta.
  const cancelarCascada = () => {
    if (guardando) return;
    setDeltaConf(null);
    setErrorModal(null);
    setNuevaFecha('');
    setNuevaDesc('');
  };

  /**
   * ejecutarEliminar — ejecuta el DELETE del feriado en confirmación.
   */
  const ejecutarEliminar = async () => {
    if (!feriadoAEliminar) return;
    setEliminando(true);
    try {
      const res = await apiFetch(`/admin/feriados/${feriadoAEliminar.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }
      if (!vivoRef.current) return;
      setFeriados((prev) => prev.filter((f) => f.id !== feriadoAEliminar.id));
      setAEliminar(null);
    } catch (err) {
      console.error('[bloqueFeriados] Error en ejecutarEliminar:', err.message);
      if (vivoRef.current) {
        setAEliminar(null);
        setFeedback({ tone: 'danger', texto: 'No se pudo eliminar el feriado. Intentá de nuevo.' });
      }
    } finally {
      if (vivoRef.current) setEliminando(false);
    }
  };

  const puedeAgregar = nuevaFecha !== '' && !guardando;

  if (cargando) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoFeriados />
        <LoadingState />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoFeriados />
        <Toast tone="danger">{errorCarga}</Toast>
        <div>
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={CONTENT_STYLE}>
      {/* Modal de alta */}
      <Modal
        open={modalAgregar}
        onClose={cerrarModalAgregar}
        loading={guardando}
        title="Agregar feriado"
        subtitle="El negocio no toma turnos ese día. Los turnos ya reservados se cancelan."
        footer={
          <>
            <Button variant="ghost" onClick={cerrarModalAgregar} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => ejecutarAlta(false)} disabled={!puedeAgregar}>
              {guardando ? 'Agregando…' : 'Agregar'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{
              fontFamily: theme.mono,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeMicro,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: theme.muted,
            }}>
              Fecha
            </span>
            <InputTiempo
              type="date"
              value={nuevaFecha}
              min={hoyISO()}
              onChange={(v) => { setNuevaFecha(v); setErrorModal(null); }}
              ariaLabel="Fecha del feriado"
              disabled={guardando}
              full
            />
          </label>

          <Field
            label="Descripción (opcional)"
            value={nuevaDescripcion}
            onChange={setNuevaDesc}
            placeholder="Ej: Navidad"
            disabled={guardando}
          />

          {errorModal && <Toast tone="danger">{errorModal}</Toast>}
        </div>
      </Modal>

      {/* Confirmación de cascada (POST devolvió 409 requiere_confirmacion) */}
      <ConfirmDialog
        open={deltaConfirmar !== null}
        title="¿Confirmás el feriado?"
        message="Declarar este feriado cancelará turnos ya reservados. No se puede deshacer."
        confirmLabel="Sí, confirmar"
        confirmVariant="danger"
        loading={guardando}
        onConfirm={() => ejecutarAlta(true)}
        onCancel={cancelarCascada}
      >
        {deltaConfirmar && (
          <DetalleRecurso
            filas={[{
              label: 'Turnos a cancelar',
              valor: deltaConfirmar.turnos_cancelados,
              numeric: true,
              valorColor: theme.danger,
              valorWeight: theme.weightHeading,
            }]}
          />
        )}
        {errorModal && <div style={{ marginTop: 12 }}><Toast tone="danger">{errorModal}</Toast></div>}
      </ConfirmDialog>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={feriadoAEliminar !== null}
        title="¿Eliminar este feriado?"
        message={feriadoAEliminar
          ? `${formatFecha(feriadoAEliminar.fecha)}${feriadoAEliminar.descripcion ? ` · ${feriadoAEliminar.descripcion}` : ''}. Los turnos que se cancelaron al cargarlo no se restauran.`
          : ''}
        confirmLabel="Sí, eliminar"
        confirmVariant="danger"
        loading={eliminando}
        onConfirm={ejecutarEliminar}
        onCancel={() => { if (!eliminando) setAEliminar(null); }}
      />

      <EncabezadoFeriados />

      <div>
        <Button variant="secondary" onClick={abrirModalAgregar} full={false}>
          <Plus size={16} strokeWidth={2} /> Agregar feriado
        </Button>
      </div>

      {feedback && (
        <Toast
          tone={feedback.tone}
          autoDismissMs={feedback.tone === 'success' ? 4000 : undefined}
          dismissible={feedback.tone === 'danger'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.texto}
        </Toast>
      )}

      {feriados.length === 0 ? (
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          No hay feriados cargados.
        </span>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 260,
          overflowY: 'auto',
          // Espacio para que la scrollbar no tape el borde de las filas.
          paddingRight: 4,
        }}>
          {feriados.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                border: `1px solid ${theme.hairline}`,
                borderRadius: theme.radius,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{
                  fontFamily: theme.body,
                  fontWeight: theme.weightMedium,
                  fontSize: theme.sizeBody,
                  color: theme.ink,
                  minWidth: 100,
                }}>
                  {formatFecha(f.fecha)}
                </span>
                <span style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                  color: theme.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {f.descripcion || '—'}
                </span>
              </div>
              <BotonIconoFila
                tono="danger"
                ariaLabel="Eliminar feriado"
                icono={<Trash2 size={14} strokeWidth={1.75} />}
                onClick={() => { setFeedback(null); setAEliminar(f); }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
