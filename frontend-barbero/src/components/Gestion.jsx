// /frontend-barbero/src/components/Gestion.jsx
// Pantalla drilldown desde "Más" con dos sub-secciones:
//   - Mis Horarios: ver y editar el horario semanal habitual.
//   - Mis Suspensiones: listar, crear y eliminar suspensiones.
// Maneja el flujo de conflicto 409 (turnos afectados) con ConfirmDialog extendido.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, CalendarOff, AlertTriangle } from 'lucide-react';

import {
  getHorarios,
  putHorarios,
  getTenant,
  getSuspensiones,
  crearSuspension,
  eliminarSuspension,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtFechaHora } from '../utils/fecha.js';

import {
  TopBar,
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  Field,
  ConfirmDialog,
  StickyFooter,
} from './ui';

// Orden de días: lunes a domingo (el domingo cierra la semana).
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const NOMBRE_DIA = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gestion
 * Orquesta tabs y TopBar de drilldown.
 * @param {{id, nombre}} props.barbero
 * @param {() => void} props.onVolver - Callback al "← Volver" del TopBar.
 */
export default function Gestion({ barbero, onVolver }) {
  const [tab, setTab] = useState('horarios');

  return (
    <>
      <TopBar onVolver={onVolver} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '0 16px 24px',
      }}>
        <ScreenHeader
          eyebrow="Gestión"
          title="Mis horarios y suspensiones"
        />

        <SegmentedTabs
          activo={tab}
          opciones={[
            { id: 'horarios',     label: 'Horarios' },
            { id: 'suspensiones', label: 'Suspensiones' },
          ]}
          onChange={setTab}
        />

        {tab === 'horarios'     && <TabHorarios barbero={barbero} />}
        {tab === 'suspensiones' && <TabSuspensiones barbero={barbero} />}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SegmentedTabs — sub-componente local (uso único)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SegmentedTabs
 * Control segmentado tipo iOS. Cada opción ocupa la misma porción de ancho.
 * Si en otra pantalla aparece el mismo patrón, se promueve a /components/ui/.
 * @param {string} props.activo
 * @param {Array<{id, label}>} props.opciones
 * @param {(id: string) => void} props.onChange
 */
function SegmentedTabs({ activo, opciones, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${opciones.length}, 1fr)`,
        gap: 4,
        background: theme.surfaceAlt,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: 4,
      }}
    >
      {opciones.map((op) => {
        const esActivo = op.id === activo;
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={esActivo}
            onClick={() => onChange(op.id)}
            style={{
              padding: '8px 12px',
              background: esActivo ? theme.surface : 'transparent',
              border: 'none',
              borderRadius: theme.radiusSm,
              boxShadow: esActivo ? theme.shadowSm : 'none',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: esActivo ? theme.weightMedium : theme.weightRegular,
              color: esActivo ? theme.ink : theme.muted,
              cursor: 'pointer',
              transition: `background ${theme.transitionFast}, color ${theme.transitionFast}`,
            }}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: Horarios
// ═══════════════════════════════════════════════════════════════════════════

/**
 * normalizarHora
 * Recorta una hora 'HH:MM:SS' o 'HH:MM' a 'HH:MM' para comparar como string.
 * Los bloques del barbero llegan del backend como 'HH:MM:SS' (campo time crudo);
 * el horario del tenant llega ya como 'HH:MM'.
 * @param {string} hora
 * @returns {string} hora en formato 'HH:MM'
 */
function normalizarHora(hora) {
  return (hora || '').slice(0, 5);
}

/**
 * bloqueFueraDeRango
 * Determina si un bloque del barbero cae fuera del horario de atención del
 * negocio: el día está cerrado, o el rango del bloque excede el horario del
 * tenant ese día. Replica client-side la validación write-time del backend
 * (validarRangoEnHorario en horarioAtencionService.js).
 * @param {{dia_semana, hora_inicio, hora_fin}} bloque
 * @param {Array<{dia_semana, hora_inicio, hora_fin}>} horarioTenant - días abiertos
 * @returns {boolean} true si el bloque está fuera del horario del negocio
 */
function bloqueFueraDeRango(bloque, horarioTenant) {
  const dia = horarioTenant.find((h) => h.dia_semana === bloque.dia_semana);
  if (!dia) return true; // el negocio no abre ese día
  return (
    normalizarHora(bloque.hora_inicio) < dia.hora_inicio ||
    normalizarHora(bloque.hora_fin) > dia.hora_fin
  );
}

/**
 * TabHorarios
 * Editor del horario semanal. Cada día puede tener N bloques (hora_inicio, hora_fin).
 * Cambios viven en state local hasta que se toca "Guardar".
 */
function TabHorarios({ barbero }) {
  const [bloques, setBloques] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo: 'ok'|'error', msg: string }
  const [horarioTenant, setHorarioTenant] = useState([]); // días abiertos del negocio

  /**
   * cargar
   * Trae el horario semanal del barbero y el horario de atención del negocio.
   */
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [data, tenant] = await Promise.all([
        getHorarios(barbero.id),
        getTenant(),
      ]);
      setBloques(data);
      setHorarioTenant(tenant.horario_atencion || []);
    } catch (err) {
      console.error('[Gestion/Horarios] Error cargando horarios:', err.message);
      setErrorCarga('No se pudo cargar el horario.');
    } finally {
      setCargando(false);
    }
  }, [barbero.id]);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * mostrarFeedback
   * Banner inline efímero (4s).
   */
  const mostrarFeedback = (tipo, msg) => {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  /**
   * agregarBloque
   * Agrega un bloque al día dado. El horario default es el rango de atención
   * del negocio ese día, para que el bloque nazca dentro de rango; si el día
   * está cerrado, cae al fallback 09:00-18:00 (el backend lo rechaza igual).
   * @param {number} dia - 0-6
   */
  const agregarBloque = (dia) => {
    const horarioDia = horarioTenant.find((h) => h.dia_semana === dia);
    setBloques((prev) => [
      ...prev,
      {
        dia_semana: dia,
        hora_inicio: horarioDia ? horarioDia.hora_inicio : '09:00',
        hora_fin: horarioDia ? horarioDia.hora_fin : '18:00',
      },
    ]);
  };

  // Cantidad de bloques fuera del horario de atención del negocio. Se recalcula
  // en vivo a medida que el barbero edita, para que el banner sea reactivo.
  const cantFueraDeRango = useMemo(
    () => bloques.filter((b) => bloqueFueraDeRango(b, horarioTenant)).length,
    [bloques, horarioTenant],
  );

  /**
   * actualizarBloque
   * Cambia hora_inicio o hora_fin de un bloque por su índice global.
   */
  const actualizarBloque = (index, campo, valor) => {
    setBloques((prev) => prev.map((b, i) => (i === index ? { ...b, [campo]: valor } : b)));
  };

  /**
   * eliminarBloque
   * Quita un bloque del array local (no impacta DB hasta guardar).
   */
  const eliminarBloque = (index) => {
    setBloques((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * guardar
   * Envía el horario completo al backend (PUT idempotente).
   */
  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = bloques.map(({ dia_semana, hora_inicio, hora_fin }) => ({
        dia_semana,
        hora_inicio,
        hora_fin,
      }));
      const resultado = await putHorarios(barbero.id, payload);
      setBloques(resultado);
      mostrarFeedback('ok', 'Horarios guardados correctamente.');
    } catch (err) {
      console.error('[Gestion/Horarios] Error guardando:', err.message);
      mostrarFeedback('error', `Error al guardar: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <EsqueletoSecciones cantidad={4} />;

  if (errorCarga) {
    return (
      <EmptyState
        glyph={<CalendarOff size={28} strokeWidth={1.5} aria-hidden="true" />}
        title="No pudimos cargar el horario"
        body={errorCarga}
        action={
          <Button variant="secondary" full={false} onClick={cargar}>
            Reintentar
          </Button>
        }
      />
    );
  }

  return (
    <>
      {feedback && <BannerFeedback feedback={feedback} />}

      {cantFueraDeRango > 0 && <BannerHorarioFueraDeRango />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ORDEN_DIAS.map((dia) => (
          <FilaDia
            key={dia}
            dia={dia}
            bloques={bloques}
            horarioTenant={horarioTenant}
            onAgregar={() => agregarBloque(dia)}
            onActualizar={actualizarBloque}
            onEliminar={eliminarBloque}
          />
        ))}
      </div>

      <StickyFooter>
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar horarios'}
        </Button>
      </StickyFooter>
    </>
  );
}

/**
 * FilaDia
 * Una fila por día con nombre + botón "+" + N bloques editables.
 * @param {Array} props.horarioTenant - días abiertos del negocio (para validar)
 */
function FilaDia({ dia, bloques, horarioTenant, onAgregar, onActualizar, onEliminar }) {
  // Mantenemos el índice GLOBAL del bloque dentro del array padre para que
  // las callbacks de update/eliminar no necesiten lookup adicional.
  const bloquesDelDia = bloques
    .map((b, i) => ({ ...b, _index: i }))
    .filter((b) => b.dia_semana === dia);

  const sinHorario = bloquesDelDia.length === 0;
  // Horario de atención del negocio para este día. Sin fila = el local cierra.
  const horarioDia = horarioTenant.find((h) => h.dia_semana === dia);
  const diaCerrado = !horarioDia;

  return (
    <Card padding={12}>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        marginBottom: 8,
      }}>
        {NOMBRE_DIA[dia]}
      </div>

      {diaCerrado ? (
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeMicro + 1,
          color: theme.muted,
        }}>
          El negocio no abre este día
        </div>
      ) : sinHorario ? (
        <button
          type="button"
          onClick={onAgregar}
          aria-label={`Agregar bloque a ${NOMBRE_DIA[dia]}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            minHeight: 44,
            background: 'transparent',
            border: `1px dashed ${theme.hairline}`,
            borderRadius: theme.radius,
            cursor: 'pointer',
            color: theme.inkSoft,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
          }}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Agregar bloque
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bloquesDelDia.map((bloque) => (
            <FilaBloque
              key={bloque._index}
              bloque={bloque}
              horarioDia={horarioDia}
              fuera={bloqueFueraDeRango(bloque, horarioTenant)}
              onActualizar={onActualizar}
              onEliminar={() => onEliminar(bloque._index)}
              onAgregar={onAgregar}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// Estilo compartido de los botones-ícono de 44×44 de una fila de bloque
// (eliminar / agregar). flexShrink:0 para que no se compriman al achicar.
const iconBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 44,
  height: 44,
  background: 'transparent',
  border: 'none',
  borderRadius: theme.radiusSm,
  cursor: 'pointer',
  color: theme.muted,
};

/**
 * FilaBloque
 * Dos time pickers inline + botón eliminar + botón agregar (suma un bloque al día).
 * @param {Object} props.horarioDia - rango del negocio ese día, o undefined si cierra
 * @param {boolean} props.fuera - true si el bloque cae fuera del horario del negocio
 * @param {() => void} props.onAgregar - Agrega un bloque nuevo a este día
 */
function FilaBloque({ bloque, horarioDia, fuera, onActualizar, onEliminar, onAgregar }) {
  // Limitar los pickers al rango del negocio. Si el día está cerrado no hay
  // límite que aplicar — el bloque ya está marcado como fuera de rango.
  const min = horarioDia ? horarioDia.hora_inicio : undefined;
  const max = horarioDia ? horarioDia.hora_fin : undefined;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <InputHora
        value={bloque.hora_inicio}
        onChange={(v) => onActualizar(bloque._index, 'hora_inicio', v)}
        min={min}
        max={max}
        invalido={fuera}
        aria="Hora de inicio"
      />
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
      }}>a</span>
      <InputHora
        value={bloque.hora_fin}
        onChange={(v) => onActualizar(bloque._index, 'hora_fin', v)}
        min={min}
        max={max}
        invalido={fuera}
        aria="Hora de fin"
      />
      <button
        type="button"
        onClick={onEliminar}
        aria-label="Eliminar bloque"
        style={iconBtnStyle}
      >
        <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onAgregar}
        aria-label="Agregar bloque"
        style={iconBtnStyle}
      >
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * InputHora
 * Input type=time mínimo, estilizado con tokens.
 * No usa Field porque acá las horas viven inline (sin label propio por input).
 * @param {string} props.min - hora mínima seleccionable ('HH:MM'), opcional
 * @param {string} props.max - hora máxima seleccionable ('HH:MM'), opcional
 * @param {boolean} props.invalido - true pinta el borde de error (fuera de rango)
 */
function InputHora({ value, onChange, min, max, invalido, aria }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      aria-label={aria}
      aria-invalid={invalido || undefined}
      style={{
        flex: 1,
        padding: '8px 10px',
        background: theme.surface,
        border: `1px solid ${invalido ? theme.danger : theme.hairline}`,
        borderRadius: theme.radiusSm,
        fontFamily: theme.body,
        fontSize: theme.sizeInput,
        color: theme.ink,
        minWidth: 0,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: Suspensiones
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TabSuspensiones
 * Lista futuras + form alta + manejo de conflicto 409 + eliminación con confirm.
 */
function TabSuspensiones({ barbero }) {
  const [suspensiones, setSuspensiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Formulario de alta.
  const [formDesde,  setFormDesde]  = useState('');
  const [formHasta,  setFormHasta]  = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState(null); // string para mostrar arriba del form

  // ConfirmDialog para conflicto 409.
  const [conflicto, setConflicto] = useState(null); // { turnos_afectados }

  // ConfirmDialog para eliminación.
  const [confirmEliminar, setConfirmEliminar] = useState(null); // { id, desde, hasta }
  const [eliminando, setEliminando] = useState(false);

  // Banner de feedback efímero.
  const [feedback, setFeedback] = useState(null);

  /**
   * cargar
   * Trae suspensiones futuras del barbero autenticado.
   */
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await getSuspensiones();
      setSuspensiones(data);
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error cargando:', err.message);
      setErrorCarga('No se pudieron cargar las suspensiones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * mostrarFeedback
   * Banner inline efímero (4s).
   */
  const mostrarFeedback = (tipo, msg) => {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  /**
   * limpiarForm
   * Resetea los campos y errores del form de alta.
   */
  const limpiarForm = () => {
    setFormDesde('');
    setFormHasta('');
    setFormMotivo('');
    setErrorForm(null);
  };

  /**
   * crear
   * POST a /api/admin/suspensiones. Si devuelve conflicto (409), abre el modal
   * con los turnos afectados y queda esperando confirmación.
   * @param {boolean} confirmarCancelacion - true tras pasar por el modal de conflicto.
   */
  const crear = async (confirmarCancelacion = false) => {
    if (!formDesde || !formHasta) {
      setErrorForm('Las fechas Desde y Hasta son obligatorias.');
      return;
    }
    if (new Date(formDesde) >= new Date(formHasta)) {
      setErrorForm('La fecha Hasta debe ser posterior a Desde.');
      return;
    }
    setErrorForm(null);
    setCreando(true);
    try {
      const datos = {
        barbero_id: barbero.id,
        desde: formDesde,
        hasta: formHasta,
        ...(formMotivo.trim() ? { motivo: formMotivo.trim() } : {}),
        ...(confirmarCancelacion ? { confirmar_cancelacion: true } : {}),
      };
      const res = await crearSuspension(datos);

      if (res.conflicto) {
        setConflicto(res);
        return;
      }

      mostrarFeedback('ok', `Suspensión creada. ${res.turnos_cancelados || 0} turnos cancelados.`);
      setConflicto(null);
      limpiarForm();
      await cargar();
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error creando:', err.message);
      mostrarFeedback('error', `Error al crear: ${err.message}`);
    } finally {
      setCreando(false);
    }
  };

  /**
   * eliminar
   * DELETE /api/admin/suspensiones/:id tras confirmar.
   */
  const eliminar = async () => {
    if (!confirmEliminar) return;
    setEliminando(true);
    try {
      await eliminarSuspension(confirmEliminar.id);
      setConfirmEliminar(null);
      mostrarFeedback('ok', 'Suspensión eliminada.');
      await cargar();
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error eliminando:', err.message);
      mostrarFeedback('error', `Error al eliminar: ${err.message}`);
      setConfirmEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      {feedback && <BannerFeedback feedback={feedback} />}

      {/* Formulario de nueva suspensión */}
      <Card padding={14}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
          marginBottom: 12,
        }}>
          Nueva suspensión
        </div>

        {errorForm && (
          <div style={{
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}`,
            borderRadius: theme.radius,
            padding: '8px 10px',
            color: theme.danger,
            fontSize: theme.sizeBody,
            marginBottom: 10,
          }}>
            {errorForm}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field
            label="Desde"
            type="datetime-local"
            value={formDesde}
            onChange={setFormDesde}
          />
          <Field
            label="Hasta"
            type="datetime-local"
            value={formHasta}
            onChange={setFormHasta}
          />
          <Field
            label="Motivo (opcional)"
            type="text"
            value={formMotivo}
            onChange={setFormMotivo}
            placeholder="Ej: vacaciones, médico, etc."
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <Button variant="primary" onClick={() => crear(false)} disabled={creando}>
            {creando ? 'Creando…' : 'Crear suspensión'}
          </Button>
        </div>
      </Card>

      {/* Lista de suspensiones */}
      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: theme.ink,
        marginTop: 8,
      }}>
        Suspensiones programadas
      </div>

      {cargando && <EsqueletoSecciones cantidad={2} />}

      {!cargando && errorCarga && (
        <EmptyState
          glyph={<CalendarOff size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No pudimos cargar la lista"
          body={errorCarga}
          action={
            <Button variant="secondary" full={false} onClick={cargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {!cargando && !errorCarga && suspensiones.length === 0 && (
        <EmptyState
          glyph={<CalendarOff size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="Sin suspensiones programadas"
          body="Cuando crees una, va a aparecer acá."
        />
      )}

      {!cargando && !errorCarga && suspensiones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suspensiones.map((s) => (
            <FilaSuspension
              key={s.id}
              suspension={s}
              onEliminar={() => setConfirmEliminar(s)}
            />
          ))}
        </div>
      )}

      {/* Modal: conflicto 409 con lista de turnos afectados */}
      <ConfirmDialog
        open={!!conflicto}
        title="Hay turnos en ese rango"
        message={
          conflicto ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                Si confirmás, se cancelan <strong>{conflicto.turnos_afectados?.length || 0}</strong> turno
                {conflicto.turnos_afectados?.length === 1 ? '' : 's'}:
              </div>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: 160,
                overflowY: 'auto',
                background: theme.surfaceAlt,
                border: `1px solid ${theme.hairlineSoft}`,
                borderRadius: theme.radiusSm,
              }}>
                {conflicto.turnos_afectados?.map((t, i) => (
                  <li key={i} style={{
                    padding: '6px 10px',
                    borderBottom: i < (conflicto.turnos_afectados.length - 1)
                      ? `1px solid ${theme.hairlineSoft}` : 'none',
                    fontSize: theme.sizeBody,
                    color: theme.inkSoft,
                  }}>
                    {fmtFechaHora(t.inicio)} · {t.cliente_nombre || 'Sin nombre'}
                  </li>
                ))}
              </ul>
            </div>
          ) : ''
        }
        confirmLabel="Confirmar y crear"
        cancelLabel="Volver"
        confirmVariant="danger"
        loading={creando}
        onConfirm={() => crear(true)}
        onCancel={() => setConflicto(null)}
      />

      {/* Modal: confirmar eliminación */}
      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar suspensión"
        message={
          confirmEliminar
            ? `La suspensión del ${fmtFechaHora(confirmEliminar.desde)} al ${fmtFechaHora(confirmEliminar.hasta)} se va a eliminar. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        confirmVariant="danger"
        loading={eliminando}
        onConfirm={eliminar}
        onCancel={() => setConfirmEliminar(null)}
      />
    </>
  );
}

/**
 * FilaSuspension
 * Card de una suspensión: rango de fechas + motivo opcional + botón eliminar.
 */
function FilaSuspension({ suspension, onEliminar }) {
  return (
    <Card padding={12}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            color: theme.ink,
          }}>
            {fmtFechaHora(suspension.desde)}
          </div>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            color: theme.muted,
            marginTop: 2,
          }}>
            hasta {fmtFechaHora(suspension.hasta)}
          </div>
          {suspension.motivo && (
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeMicro + 1,
              color: theme.inkSoft,
              marginTop: 6,
              fontStyle: 'italic',
            }}>
              "{suspension.motivo}"
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onEliminar}
          aria-label="Eliminar suspensión"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            background: 'transparent',
            border: 'none',
            borderRadius: theme.radiusSm,
            cursor: 'pointer',
            color: theme.muted,
            flexShrink: 0,
          }}
        >
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes compartidos por ambos tabs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BannerFeedback
 * Banner inline temporal (lo borra el setTimeout del padre).
 * Variant según tipo: ok=success, error=danger.
 */
function BannerFeedback({ feedback }) {
  const esOk = feedback.tipo === 'ok';
  return (
    <div
      role={esOk ? 'status' : 'alert'}
      style={{
        background: esOk ? theme.successSoft : theme.dangerSoft,
        border: `1px solid ${esOk ? theme.success : theme.danger}`,
        borderRadius: theme.radius,
        padding: '10px 12px',
        color: esOk ? theme.success : theme.danger,
        fontSize: theme.sizeBody,
      }}
    >
      {feedback.msg}
    </div>
  );
}

/**
 * BannerHorarioFueraDeRango
 * Aviso amarillo: el barbero tiene bloques fuera del horario de atención del
 * negocio (caso transición tras un cambio de horario del local). Esos bloques
 * no generan turnos disponibles hasta que los ajuste.
 */
function BannerHorarioFueraDeRango() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 8,
        background: theme.warningSoft,
        border: `1px solid ${theme.warning}`,
        borderRadius: theme.radius,
        padding: '10px 12px',
        color: theme.warning,
        fontSize: theme.sizeBody,
      }}
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <span>
        Tenés bloques de horario fuera del horario actual del negocio. Esos
        bloques no aparecerán como disponibles. Ajustalos para reflejar tu
        disponibilidad real.
      </span>
    </div>
  );
}

/**
 * EsqueletoSecciones
 * Esqueleto de cards mientras carga.
 */
function EsqueletoSecciones({ cantidad }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: cantidad }).map((_, i) => (
        <Skeleton key={i} height={80} radius={theme.radius} />
      ))}
    </div>
  );
}
