// /frontend/src/screens/admin/sections/gestion/BloqueFeriados.jsx
// Bloque de gestión de los feriados puntuales del negocio.
// Se renderiza dentro de TabNegocio, debajo del horario de atención.
// Cobertura: plan_horario_atencion.md §4.6.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../../services/api';

// Nombres de mes para mostrar la fecha de forma legible.
const NOMBRE_MES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Devuelve la fecha de hoy en formato 'YYYY-MM-DD' (hora local del navegador).
 * Sirve como valor mínimo del <input type="date"> al agregar un feriado.
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
 * Formatea una fecha 'YYYY-MM-DD' a algo legible tipo "25 dic 2026".
 * Parsea los componentes a mano para no depender de la zona horaria
 * (new Date('YYYY-MM-DD') interpreta la fecha como UTC y puede correrla un día).
 * @param {string} iso - fecha en 'YYYY-MM-DD'
 * @returns {string} fecha legible
 */
function formatFecha(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${parseInt(dia, 10)} ${NOMBRE_MES[parseInt(mes, 10) - 1]} ${anio}`;
}

/**
 * Modal de alta de un feriado. Campo de fecha obligatorio + descripción
 * opcional. El error de "feriado ya existe" se muestra inline acá mismo.
 * @param {string} props.fecha - valor del input de fecha
 * @param {Function} props.onCambiarFecha - setter de la fecha
 * @param {string} props.descripcion - valor del input de descripción
 * @param {Function} props.onCambiarDescripcion - setter de la descripción
 * @param {Function} props.onAgregar - dispara el POST del feriado
 * @param {Function} props.onCancelar - cierra el modal sin guardar
 * @param {boolean} props.guardando - true mientras corre el POST
 * @param {string|null} props.errorInline - mensaje de error a mostrar en el modal
 * @returns {JSX.Element}
 */
function ModalAgregarFeriado({
  fecha, onCambiarFecha, descripcion, onCambiarDescripcion,
  onAgregar, onCancelar, guardando, errorInline,
}) {
  const puedeAgregar = fecha !== '' && !guardando;
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>Agregar feriado</p>
        <p style={styles.modalSubtitulo}>
          El negocio no toma turnos ese día. Los turnos ya reservados se cancelan.
        </p>

        <div style={styles.campoGrupo}>
          <label style={styles.campoLabel}>Fecha</label>
          <input
            type="date"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => onCambiarFecha(e.target.value)}
            style={styles.campoInput}
            disabled={guardando}
          />
        </div>

        <div style={styles.campoGrupo}>
          <label style={styles.campoLabel}>Descripción (opcional)</label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => onCambiarDescripcion(e.target.value)}
            placeholder="Ej: Navidad"
            style={styles.campoInput}
            disabled={guardando}
          />
        </div>

        {errorInline && <p style={styles.errorTextoInline}>{errorInline}</p>}

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnConfirmarVerde, ...(!puedeAgregar ? styles.btnDeshabilitado : {}) }}
            onPointerDown={() => puedeAgregar && onAgregar()}
            disabled={!puedeAgregar}
          >
            {guardando ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de confirmación de la cascada. Se muestra cuando el POST respondió
 * 409 porque declarar el feriado deja turnos reservados afuera.
 * @param {Object} props.delta - { turnos_cancelados }
 * @param {Function} props.onConfirmar - reenvía el POST con confirmar_cascada=true
 * @param {Function} props.onCancelar - cierra el modal sin hacer nada
 * @param {boolean} props.guardando - true mientras corre el POST confirmado
 * @returns {JSX.Element}
 */
function ModalConfirmarCascada({ delta, onConfirmar, onCancelar, guardando }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Confirmás el feriado?</p>
        <p style={styles.modalAdvertencia}>
          Declarar este feriado cancelará turnos ya reservados. No se puede deshacer.
        </p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Turnos a cancelar</span>
            <span style={{ ...styles.modalValor, color: '#c0392b' }}>{delta.turnos_cancelados}</span>
          </div>
        </div>

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnConfirmarRojo, ...(guardando ? styles.btnDeshabilitado : {}) }}
            onPointerDown={onConfirmar}
            disabled={guardando}
          >
            {guardando ? 'Aplicando...' : 'Sí, confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de confirmación de eliminación de un feriado.
 * @param {Object} props.feriado - { id, fecha, descripcion }
 * @param {Function} props.onConfirmar - dispara el DELETE
 * @param {Function} props.onCancelar - cierra el modal sin hacer nada
 * @param {boolean} props.eliminando - true mientras corre el DELETE
 * @returns {JSX.Element}
 */
function ModalConfirmarEliminar({ feriado, onConfirmar, onCancelar, eliminando }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar este feriado?</p>
        <p style={styles.modalAdvertencia}>
          {formatFecha(feriado.fecha)}{feriado.descripcion ? ` · ${feriado.descripcion}` : ''}.
          Los turnos que se cancelaron al cargarlo no se restauran.
        </p>

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={eliminando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnConfirmarRojo, ...(eliminando ? styles.btnDeshabilitado : {}) }}
            onPointerDown={onConfirmar}
            disabled={eliminando}
          >
            {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inserta un feriado en una lista ya ordenada por fecha ascendente,
 * manteniendo el orden.
 * @param {Array} lista - feriados ordenados por fecha
 * @param {Object} feriado - feriado nuevo { id, fecha, descripcion }
 * @returns {Array} nueva lista ordenada
 */
function insertarOrdenado(lista, feriado) {
  return [...lista, feriado].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Bloque de feriados. Lista los feriados futuros del negocio y permite
 * agregar (con flujo de confirmación de cascada) y eliminar feriados.
 * @returns {JSX.Element}
 */
export default function BloqueFeriados() {
  const [feriados, setFeriados]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(null);
  const [exito, setExito]         = useState(null);

  // Modal de alta + sus campos. La fecha/descripción se conservan mientras
  // dura el flujo de confirmación de cascada (recién se limpian al éxito
  // o al cancelar), porque el POST se reenvía con esos mismos valores.
  const [modalAgregar, setModalAgregar]   = useState(false);
  const [nuevaFecha, setNuevaFecha]       = useState('');
  const [nuevaDescripcion, setNuevaDesc]  = useState('');
  const [guardando, setGuardando]         = useState(false);
  const [errorModal, setErrorModal]       = useState(null);

  // Confirmación de cascada (POST devolvió 409 requiere_confirmacion).
  const [deltaConfirmar, setDeltaConf]    = useState(null);

  // Confirmación de eliminación.
  const [feriadoAEliminar, setAEliminar]  = useState(null);
  const [eliminando, setEliminando]       = useState(false);

  useEffect(() => {
    const cargarFeriados = async () => {
      try {
        const res = await apiFetch('/admin/feriados');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFeriados(data);
      } catch (err) {
        console.error('[bloqueFeriados] Error en cargarFeriados:', err.message);
        setError('No se pudieron cargar los feriados.');
      } finally {
        setCargando(false);
      }
    };
    cargarFeriados();
  }, []);

  // Abre el modal de alta limpio.
  const abrirModalAgregar = () => {
    setExito(null);
    setError(null);
    setNuevaFecha('');
    setNuevaDesc('');
    setErrorModal(null);
    setModalAgregar(true);
  };

  // Cierra el modal de alta y descarta los campos.
  const cerrarModalAgregar = () => {
    setModalAgregar(false);
    setErrorModal(null);
  };

  /**
   * Ejecuta el POST del feriado. Si confirmarCascada es false y el backend
   * responde 409 requiere_confirmacion, abre el modal de cascada. Si es true
   * (o no había impacto), inserta el feriado y muestra el resultado.
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
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      setFeriados((prev) => insertarOrdenado(prev, data.feriado));
      setModalAgregar(false);
      setDeltaConf(null);
      setNuevaFecha('');
      setNuevaDesc('');

      const canceladas = data.cascada.turnos_cancelados;
      setExito(canceladas > 0
        ? `✓ Feriado agregado · ${canceladas} turno(s) cancelado(s).`
        : '✓ Feriado agregado correctamente.');
      setTimeout(() => setExito(null), 4000);

    } catch (err) {
      console.error('[bloqueFeriados] Error en ejecutarAlta:', err.message);
      // El error se muestra donde esté el usuario: modal de alta o de cascada.
      setErrorModal(err.message || 'No se pudo agregar el feriado.');
    } finally {
      setGuardando(false);
    }
  };

  // Cancela el flujo de confirmación de cascada y descarta los campos del alta.
  const cancelarCascada = () => {
    setDeltaConf(null);
    setNuevaFecha('');
    setNuevaDesc('');
  };

  /**
   * Ejecuta el DELETE del feriado en confirmación.
   */
  const ejecutarEliminar = async () => {
    if (!feriadoAEliminar) return;
    setEliminando(true);
    setError(null);

    try {
      const res = await apiFetch(`/admin/feriados/${feriadoAEliminar.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }
      setFeriados((prev) => prev.filter((f) => f.id !== feriadoAEliminar.id));
      setAEliminar(null);
    } catch (err) {
      console.error('[bloqueFeriados] Error en ejecutarEliminar:', err.message);
      setError('No se pudo eliminar el feriado. Intentá de nuevo.');
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  if (cargando) {
    return (
      <div style={styles.card}>
        <p style={styles.cardTitulo}>Feriados</p>
        <p style={styles.estadoTexto}>Cargando feriados...</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {modalAgregar && (
        <ModalAgregarFeriado
          fecha={nuevaFecha}
          onCambiarFecha={setNuevaFecha}
          descripcion={nuevaDescripcion}
          onCambiarDescripcion={setNuevaDesc}
          onAgregar={() => ejecutarAlta(false)}
          onCancelar={cerrarModalAgregar}
          guardando={guardando}
          errorInline={errorModal}
        />
      )}

      {deltaConfirmar && (
        <ModalConfirmarCascada
          delta={deltaConfirmar}
          onConfirmar={() => ejecutarAlta(true)}
          onCancelar={cancelarCascada}
          guardando={guardando}
        />
      )}

      {feriadoAEliminar && (
        <ModalConfirmarEliminar
          feriado={feriadoAEliminar}
          onConfirmar={ejecutarEliminar}
          onCancelar={() => setAEliminar(null)}
          eliminando={eliminando}
        />
      )}

      <p style={styles.cardTitulo}>Feriados</p>
      <p style={styles.cardHint}>
        Días en que el negocio no abre. No se toman turnos esas fechas y los
        turnos ya reservados se cancelan al cargar el feriado.
      </p>

      <button style={styles.btnAgregar} onPointerDown={abrirModalAgregar}>
        + Agregar feriado
      </button>

      {error && <p style={styles.errorTextoInline}>{error}</p>}

      {exito && <p style={styles.exitoTexto}>{exito}</p>}

      {feriados.length === 0 ? (
        <p style={styles.estadoTexto}>No hay feriados cargados.</p>
      ) : (
        <div style={styles.listaFeriados}>
          {feriados.map((f) => (
            <div key={f.id} style={styles.filaFeriado}>
              <span style={styles.feriadoFecha}>{formatFecha(f.fecha)}</span>
              <span style={styles.feriadoDesc}>{f.descripcion || '—'}</span>
              <button
                style={styles.btnEliminar}
                onPointerDown={() => { setError(null); setExito(null); setAEliminar(f); }}
                title="Eliminar feriado"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardTitulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  cardHint: {
    fontSize: '13px',
    color: '#aaaaaa',
    margin: 0,
  },
  btnAgregar: {
    alignSelf: 'flex-start',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1.5px solid #b6dcc5',
    backgroundColor: '#eaf6ef',
    color: '#1a7a4a',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  listaFeriados: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filaFeriado: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 32px',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    backgroundColor: '#ffffff',
    border: '1.5px solid #eeeeee',
    borderRadius: '10px',
  },
  feriadoFecha: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333333',
  },
  feriadoDesc: {
    fontSize: '14px',
    color: '#888888',
  },
  btnEliminar: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    border: '1.5px solid #f5c6c6',
    backgroundColor: '#fff5f5',
    color: '#c0392b',
    fontSize: '18px',
    lineHeight: '1',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  estadoTexto: {
    color: '#888888',
    fontSize: '14px',
    margin: 0,
  },
  errorTextoInline: {
    color: '#c0392b',
    fontSize: '13px',
    margin: 0,
  },
  exitoTexto: {
    color: '#1a7a4a',
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
  },
  campoGrupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  campoLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  campoInput: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  // --- Modales ---
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: 0, textAlign: 'center',
  },
  modalSubtitulo: {
    fontSize: '13px', color: '#888888', textAlign: 'center', margin: 0,
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: 0,
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel: { fontSize: '13px', color: '#888888' },
  modalValor: { fontSize: '14px', color: '#111111', fontWeight: '600' },
  modalBotones: { display: 'flex', gap: '12px' },
  btnCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnConfirmarVerde: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#1a7a4a',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnConfirmarRojo: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
