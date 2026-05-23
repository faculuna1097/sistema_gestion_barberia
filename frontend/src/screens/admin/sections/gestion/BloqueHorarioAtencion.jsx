// /frontend/src/screens/admin/sections/gestion/BloqueHorarioAtencion.jsx
// Bloque de gestión del horario semanal de atención del negocio.
// Se renderiza dentro de TabNegocio. Cobertura: plan_horario_atencion.md §3.8.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../../services/api';

// Nombres de día indexados por dia_semana (0=domingo .. 6=sábado),
// misma convención que usa el backend.
const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Horario por defecto al abrir un día que estaba cerrado.
const DEFAULT_INICIO = '10:00';
const DEFAULT_FIN    = '19:00';

/**
 * Modal de confirmación de la cascada. Se muestra cuando el PUT respondió
 * 409 porque el cambio de horario deja turnos/bloques afuera.
 * @param {Object} props.delta - { turnos_cancelados, bloques_truncados, bloques_eliminados }
 * @param {Function} props.onConfirmar - ejecuta el PUT con confirmar_cascada=true
 * @param {Function} props.onCancelar - cierra el modal sin hacer nada
 * @param {boolean} props.guardando - true mientras corre el PUT confirmado
 * @returns {JSX.Element}
 */
function ModalConfirmarCascada({ delta, onConfirmar, onCancelar, guardando }) {
  const bloques = delta.bloques_truncados + delta.bloques_eliminados;
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Confirmás el cambio de horario?</p>
        <p style={styles.modalAdvertencia}>
          Este cambio cancelará turnos ya reservados y modificará horarios de barberos.
          No se puede deshacer.
        </p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Turnos a cancelar</span>
            <span style={{ ...styles.modalValor, color: '#c0392b' }}>{delta.turnos_cancelados}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Bloques de barbero afectados</span>
            <span style={styles.modalValor}>{bloques}</span>
          </div>
        </div>

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnEliminarConfirm, ...(guardando ? styles.btnDeshabilitado : {}) }}
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
 * Normaliza la respuesta del GET (array de 7 días, los cerrados sin horas)
 * a un estado de UI donde todos los días tienen hora_inicio/hora_fin
 * (los cerrados con el default, para que el toggle a abierto tenga valores).
 * @param {Array} semana - respuesta de GET /admin/horario-atencion
 * @returns {Array} 7 objetos { dia_semana, abierto, hora_inicio, hora_fin }
 */
function normalizarSemana(semana) {
  return semana.map((d) => ({
    dia_semana: d.dia_semana,
    abierto: d.abierto,
    hora_inicio: d.hora_inicio || DEFAULT_INICIO,
    hora_fin: d.hora_fin || DEFAULT_FIN,
  }));
}

/**
 * Genera una clave string que representa el horario relevante (solo días
 * abiertos con sus horas). Sirve para detectar si hubo cambios sin que las
 * horas "fantasma" de los días cerrados cuenten como diferencia.
 * @param {Array} dias - estado de UI de los 7 días
 * @returns {string}
 */
function claveHorario(dias) {
  return dias
    .filter((d) => d.abierto)
    .map((d) => `${d.dia_semana}:${d.hora_inicio}-${d.hora_fin}`)
    .join('|');
}

/**
 * Bloque de horario de atención. Carga el horario semanal, permite editarlo
 * (toggle por día + pickers de hora) y guardarlo con el flujo de confirmación
 * de cascada del backend.
 * @returns {JSX.Element}
 */
export default function BloqueHorarioAtencion() {
  const [dias, setDias]                 = useState([]);
  const [claveOriginal, setClaveOrig]   = useState('');
  const [cargando, setCargando]         = useState(true);
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState(null);
  const [exito, setExito]               = useState(false);
  const [cascadaResumen, setCascadaRes] = useState(null);
  const [deltaConfirmar, setDeltaConf]  = useState(null);

  useEffect(() => {
    const cargarHorario = async () => {
      try {
        const res  = await apiFetch('/admin/horario-atencion');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const norm = normalizarSemana(data);
        setDias(norm);
        setClaveOrig(claveHorario(norm));
      } catch (err) {
        console.error('[bloqueHorarioAtencion] Error en cargarHorario:', err.message);
        setError('No se pudo cargar el horario de atención.');
      } finally {
        setCargando(false);
      }
    };
    cargarHorario();
  }, []);

  // Alterna abierto/cerrado de un día. Al abrir, conserva las horas que
  // ya tuviera en el estado (default si nunca tuvo).
  const toggleDia = (diaSemana) => {
    setExito(false);
    setCascadaRes(null);
    setDias((prev) => prev.map((d) =>
      d.dia_semana === diaSemana ? { ...d, abierto: !d.abierto } : d
    ));
  };

  // Cambia una hora (inicio o fin) de un día abierto.
  const cambiarHora = (diaSemana, campo, valor) => {
    setExito(false);
    setCascadaRes(null);
    setDias((prev) => prev.map((d) =>
      d.dia_semana === diaSemana ? { ...d, [campo]: valor } : d
    ));
  };

  // Días abiertos con rango inválido (fin <= inicio). Bloquean el guardado.
  const diasInvalidos = dias.filter((d) => d.abierto && d.hora_fin <= d.hora_inicio);
  const huboCambios   = claveHorario(dias) !== claveOriginal;
  const puedeGuardar  = huboCambios && diasInvalidos.length === 0;

  /**
   * Ejecuta el PUT del horario. Si confirmarCascada es false y el backend
   * responde 409, abre el modal de confirmación. Si es true (o no había
   * impacto), aplica el cambio y muestra el resumen.
   * @param {boolean} confirmarCascada
   */
  const ejecutarGuardado = async (confirmarCascada) => {
    setGuardando(true);
    setError(null);
    setExito(false);
    setCascadaRes(null);

    const horarios = dias
      .filter((d) => d.abierto)
      .map((d) => ({ dia_semana: d.dia_semana, hora_inicio: d.hora_inicio, hora_fin: d.hora_fin }));

    try {
      const res = await apiFetch('/admin/horario-atencion', {
        method: 'PUT',
        body: JSON.stringify({ horarios, confirmar_cascada: confirmarCascada }),
      });

      // 409 → el cambio achica el horario; pedir confirmación al usuario.
      if (res.status === 409) {
        const data = await res.json();
        setDeltaConf(data.delta);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      const norm = normalizarSemana(data.horarios);
      setDias(norm);
      setClaveOrig(claveHorario(norm));
      setDeltaConf(null);

      const c = data.cascada;
      const huboCascada = c.turnos_cancelados > 0 || c.bloques_eliminados > 0 || c.bloques_truncados > 0;
      if (huboCascada) {
        setCascadaRes(c);
      } else {
        setExito(true);
        setTimeout(() => setExito(false), 3000);
      }
    } catch (err) {
      console.error('[bloqueHorarioAtencion] Error en ejecutarGuardado:', err.message);
      setError(err.message || 'No se pudo guardar el horario. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = () => {
    if (!puedeGuardar) return;
    ejecutarGuardado(false);
  };

  if (cargando) {
    return (
      <div style={styles.card}>
        <p style={styles.cardTitulo}>Horario de atención</p>
        <p style={styles.estadoTexto}>Cargando horario...</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {deltaConfirmar && (
        <ModalConfirmarCascada
          delta={deltaConfirmar}
          onConfirmar={() => ejecutarGuardado(true)}
          onCancelar={() => setDeltaConf(null)}
          guardando={guardando}
        />
      )}

      <p style={styles.cardTitulo}>Horario de atención</p>
      <p style={styles.cardHint}>
        Días y horas en que el negocio abre. Define la disponibilidad de turnos
        y el rango válido para los horarios de los barberos.
      </p>

      <div style={styles.listaDias}>
        {dias.map((d) => {
          const invalido = d.abierto && d.hora_fin <= d.hora_inicio;
          return (
            <div key={d.dia_semana} style={styles.fila}>
              <span style={styles.diaLabel}>{NOMBRE_DIA[d.dia_semana]}</span>

              <button
                style={{ ...styles.toggle, ...(d.abierto ? styles.toggleAbierto : styles.toggleCerrado) }}
                onPointerDown={() => toggleDia(d.dia_semana)}
                disabled={guardando}
              >
                {d.abierto ? 'Abierto' : 'Cerrado'}
              </button>

              {d.abierto ? (
                <div style={styles.pickers}>
                  <input
                    type="time"
                    step="1800"
                    value={d.hora_inicio}
                    onChange={(e) => cambiarHora(d.dia_semana, 'hora_inicio', e.target.value)}
                    style={{ ...styles.timeInput, ...(invalido ? styles.timeInputError : {}) }}
                    disabled={guardando}
                  />
                  <span style={styles.guion}>—</span>
                  <input
                    type="time"
                    step="1800"
                    value={d.hora_fin}
                    onChange={(e) => cambiarHora(d.dia_semana, 'hora_fin', e.target.value)}
                    style={{ ...styles.timeInput, ...(invalido ? styles.timeInputError : {}) }}
                    disabled={guardando}
                  />
                </div>
              ) : (
                <div style={styles.pickers} />
              )}
            </div>
          );
        })}
      </div>

      {diasInvalidos.length > 0 && (
        <p style={styles.errorTextoInline}>
          La hora de cierre debe ser mayor a la de apertura.
        </p>
      )}

      {error && <p style={styles.errorTextoInline}>{error}</p>}

      {exito && (
        <p style={styles.exitoTexto}>✓ Horario actualizado correctamente.</p>
      )}

      {cascadaResumen && (
        <p style={styles.exitoTexto}>
          ✓ Horario actualizado · {cascadaResumen.turnos_cancelados} turno(s) cancelado(s) ·{' '}
          {cascadaResumen.bloques_eliminados + cascadaResumen.bloques_truncados} bloque(s) de barbero actualizado(s).
        </p>
      )}

      <button
        style={{
          ...styles.btnGuardar,
          ...(!puedeGuardar || guardando ? styles.btnDeshabilitado : {}),
        }}
        onPointerDown={handleGuardar}
        disabled={!puedeGuardar || guardando}
      >
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>
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
  listaDias: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fila: {
    display: 'grid',
    gridTemplateColumns: '110px 92px 1fr',
    alignItems: 'center',
    gap: '12px',
  },
  diaLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333333',
  },
  toggle: {
    padding: '7px 0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toggleAbierto: {
    border: '1.5px solid #b6dcc5',
    backgroundColor: '#eaf6ef',
    color: '#1a7a4a',
  },
  toggleCerrado: {
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#999999',
  },
  pickers: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '38px',
  },
  timeInput: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1.5px solid #e0e0e0',
    fontSize: '14px',
    color: '#111111',
    fontFamily: 'inherit',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  timeInputError: {
    border: '1.5px solid #f5c6c6',
    backgroundColor: '#fff5f5',
  },
  guion: {
    color: '#aaaaaa',
    fontSize: '14px',
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
  btnGuardar: {
    padding: '13px 0',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
  // --- Modal de confirmación de cascada ---
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: '0 0 6px', textAlign: 'center',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: '0 0 24px',
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel:   { fontSize: '13px', color: '#888888' },
  modalValor:   { fontSize: '14px', color: '#111111', fontWeight: '600' },
  modalDivider: { height: '1px', backgroundColor: '#eeeeee' },
  modalBotones: { display: 'flex', gap: '12px' },
  btnCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEliminarConfirm: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
