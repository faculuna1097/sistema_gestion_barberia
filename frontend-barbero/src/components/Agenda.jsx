// /frontend-barbero/src/components/Agenda.jsx
// Vista de agenda tipo Google Calendar mobile.
// Timeline vertical con franjas horarias y bloques de turnos posicionados
// por hora. Selector de fecha para navegar entre días.
// Props:
//   barbero — { id, nombre }

import { useState, useEffect } from 'react';
import { getTurnos, patchEstadoTurno, cancelarTurno } from '../services/api.js';

/**
 * fechaHoyISO
 * @returns {string} 'YYYY-MM-DD'
 */
function fechaHoyISO() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

/**
 * formatearFechaLegible
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {string} ej: 'martes 13 de mayo'
 */
function formatearFechaLegible(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * sumarDias
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {number} dias
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Altura en px de cada hora en el timeline
const PX_POR_HORA = 80;
// Rango horario visible (7:00 a 22:00)
const HORA_INICIO = 7;
const HORA_FIN = 22;

/**
 * minutosDelDia
 * Extrae los minutos desde medianoche de un timestamp ISO.
 * @param {string} iso
 * @returns {number}
 */
function minutosDelDia(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// Colores por estado
const COLORES_ESTADO = {
  reservado: '#4285f4',
  completado: '#0f9d58',
  no_asistio: '#f4b400',
  cancelado: '#db4437',
};

export default function Agenda({ barbero }) {
  const [fecha, setFecha] = useState(fechaHoyISO());
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [turnoExpandido, setTurnoExpandido] = useState(null);
  const [accionando, setAccionando] = useState(null);

  /**
   * cargarTurnos
   * Carga los turnos del día seleccionado.
   */
  const cargarTurnos = async () => {
    setCargando(true);
    try {
      const data = await getTurnos({ fecha });
      setTurnos(data);
      console.log('[Agenda] cargarTurnos — completado |', fecha, '|', data.length, 'turnos');
    } catch (err) {
      console.error('[Agenda] Error cargando turnos:', err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnos();
    setTurnoExpandido(null);
  }, [fecha]);

  /**
   * cambiarEstado
   * @param {string} turnoId
   * @param {string} nuevoEstado
   */
  const cambiarEstado = async (turnoId, nuevoEstado) => {
    setAccionando(turnoId);
    try {
      await patchEstadoTurno(turnoId, nuevoEstado);
      await cargarTurnos();
    } catch (err) {
      console.error('[Agenda] Error en cambiarEstado:', err.message);
      alert('Error: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  /**
   * cancelar
   * @param {string} turnoId
   */
  const cancelar = async (turnoId) => {
    if (!confirm('¿Cancelar este turno?')) return;
    setAccionando(turnoId);
    try {
      await cancelarTurno(turnoId);
      await cargarTurnos();
    } catch (err) {
      console.error('[Agenda] Error al cancelar:', err.message);
      alert('Error: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  // Horas del timeline
  const horas = [];
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    horas.push(h);
  }

  const alturaTotal = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;

  return (
    <div>
      {/* Navegador de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onPointerDown={() => setFecha(sumarDias(fecha, -1))}>← Anterior</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong>{formatearFechaLegible(fecha)}</strong>
          {fecha !== fechaHoyISO() && (
            <button onPointerDown={() => setFecha(fechaHoyISO())} style={{ marginLeft: '8px' }}>
              Hoy
            </button>
          )}
        </div>
        <button onPointerDown={() => setFecha(sumarDias(fecha, 1))}>Siguiente →</button>
      </div>

      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        style={{ marginBottom: '12px' }}
      />

      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ position: 'relative', height: `${alturaTotal}px`, border: '1px solid #e0e0e0', overflow: 'auto' }}>
          {/* Líneas horarias */}
          {horas.map((h) => {
            const top = (h - HORA_INICIO) * PX_POR_HORA;
            return (
              <div key={h} style={{ position: 'absolute', top: `${top}px`, left: 0, right: 0 }}>
                <div style={{
                  position: 'absolute',
                  left: '4px',
                  top: '-8px',
                  fontSize: '12px',
                  color: '#888',
                  width: '44px',
                }}>
                  {String(h).padStart(2, '0')}:00
                </div>
                <div style={{
                  position: 'absolute',
                  left: '52px',
                  right: 0,
                  top: 0,
                  borderTop: '1px solid #e0e0e0',
                }} />
              </div>
            );
          })}

          {/* Indicador de hora actual (si es hoy) */}
          {fecha === fechaHoyISO() && (() => {
            const ahora = new Date();
            const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
            const topAhora = ((minutosAhora / 60) - HORA_INICIO) * PX_POR_HORA;
            if (topAhora >= 0 && topAhora <= alturaTotal) {
              return (
                <div style={{
                  position: 'absolute',
                  top: `${topAhora}px`,
                  left: '52px',
                  right: 0,
                  borderTop: '2px solid red',
                  zIndex: 2,
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '-5px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'red',
                  }} />
                </div>
              );
            }
            return null;
          })()}

          {/* Bloques de turnos */}
          {turnos
            .filter(t => t.estado !== 'cancelado')
            .map((turno) => {
              const minInicio = minutosDelDia(turno.inicio);
              const minFin = minutosDelDia(turno.fin);
              const duracion = minFin - minInicio;
              const top = ((minInicio / 60) - HORA_INICIO) * PX_POR_HORA;
              const height = (duracion / 60) * PX_POR_HORA;
              const color = COLORES_ESTADO[turno.estado] || '#999';

              return (
                <div
                  key={turno.id}
                  onPointerDown={() => setTurnoExpandido(turnoExpandido === turno.id ? null : turno.id)}
                  style={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: '56px',
                    right: '4px',
                    height: `${Math.max(height, 24)}px`,
                    backgroundColor: color,
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '13px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    zIndex: 1,
                    opacity: turno.estado === 'no_asistio' ? 0.6 : 1,
                  }}
                >
                  <strong>
                    {new Date(turno.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </strong>
                  {' '}
                  {turno.cliente_nombre || 'Sin nombre'}
                  {turno.servicio_nombre && ` — ${turno.servicio_nombre}`}
                  {' '}
                  <em>({turno.estado})</em>
                </div>
              );
            })}
        </div>
      )}

      {/* Panel de detalle del turno expandido */}
      {turnoExpandido && (() => {
        const turno = turnos.find(t => t.id === turnoExpandido);
        if (!turno) return null;
        return (
          <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #ccc' }}>
            <h4>Detalle del turno</h4>
            <p><strong>Hora:</strong> {new Date(turno.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })} — {new Date(turno.fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
            <p><strong>Cliente:</strong> {turno.cliente_nombre || 'Sin nombre'}</p>
            {turno.cliente_telefono && <p><strong>Tel:</strong> {turno.cliente_telefono}</p>}
            {turno.cliente_email && <p><strong>Email:</strong> {turno.cliente_email}</p>}
            <p><strong>Servicio:</strong> {turno.servicio_nombre || '—'}</p>
            <p><strong>Estado:</strong> {turno.estado}</p>

            {turno.estado === 'reservado' && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onPointerDown={() => cambiarEstado(turno.id, 'completado')}
                  disabled={accionando === turno.id}
                >
                  Completado
                </button>
                {' '}
                <button
                  onPointerDown={() => cambiarEstado(turno.id, 'no_asistio')}
                  disabled={accionando === turno.id}
                >
                  No asistió
                </button>
                {' '}
                <button
                  onPointerDown={() => cancelar(turno.id)}
                  disabled={accionando === turno.id}
                >
                  Cancelar
                </button>
              </div>
            )}
            <button onPointerDown={() => setTurnoExpandido(null)} style={{ marginTop: '8px' }}>
              Cerrar
            </button>
          </div>
        );
      })()}
    </div>
  );
}
