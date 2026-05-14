// /frontend-barbero/src/components/Dashboard.jsx
// Pantalla principal post-login. Muestra los turnos del día como lista
// con acciones para cambiar estado (completado, no_asistio, cancelar).
// Props:
//   barbero       — { id, nombre }
//   onCrearTurno  — callback para navegar al wizard de crear turno
//   onVerAgenda   — callback para navegar a la agenda

import { useState, useEffect } from 'react';
import { getTurnos, patchEstadoTurno, cancelarTurno } from '../services/api.js';

/**
 * fechaHoyISO
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local).
 * @returns {string}
 */
function fechaHoyISO() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * formatearHora
 * Extrae HH:MM de un timestamp ISO.
 * @param {string} iso - timestamp ISO
 * @returns {string} 'HH:MM'
 */
function formatearHora(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function Dashboard({ barbero, onCrearTurno, onVerAgenda }) {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [accionando, setAccionando] = useState(null);

  /**
   * cargarTurnos
   * Carga los turnos del día del barbero autenticado.
   */
  const cargarTurnos = async () => {
    try {
      const data = await getTurnos({ fecha: fechaHoyISO() });
      setTurnos(data);
      console.log('[Dashboard] cargarTurnos — completado |', data.length, 'turnos');
    } catch (err) {
      console.error('[Dashboard] Error cargando turnos:', err.message);
      setError('No se pudieron cargar los turnos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnos();
  }, []);

  /**
   * cambiarEstado
   * Cambia el estado de un turno y recarga la lista.
   * @param {string} turnoId
   * @param {string} nuevoEstado - 'completado' | 'no_asistio'
   */
  const cambiarEstado = async (turnoId, nuevoEstado) => {
    setAccionando(turnoId);
    try {
      await patchEstadoTurno(turnoId, nuevoEstado);
      console.log('[Dashboard] cambiarEstado — completado |', turnoId, '→', nuevoEstado);
      await cargarTurnos();
    } catch (err) {
      console.error('[Dashboard] Error en cambiarEstado:', err.message);
      alert('Error al cambiar estado: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  /**
   * cancelar
   * Cancela un turno previa confirmación y recarga la lista.
   * @param {string} turnoId
   */
  const cancelar = async (turnoId) => {
    if (!confirm('¿Cancelar este turno?')) return;
    setAccionando(turnoId);
    try {
      await cancelarTurno(turnoId);
      console.log('[Dashboard] cancelar — completado |', turnoId);
      await cargarTurnos();
    } catch (err) {
      console.error('[Dashboard] Error al cancelar:', err.message);
      alert('Error al cancelar: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  // Resumen del día
  const reservados = turnos.filter(t => t.estado === 'reservado');
  const completados = turnos.filter(t => t.estado === 'completado');
  const noAsistieron = turnos.filter(t => t.estado === 'no_asistio');
  const cancelados = turnos.filter(t => t.estado === 'cancelado');

  const proximo = reservados
    .filter(t => new Date(t.inicio) > new Date())
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];

  if (cargando) return <p>Cargando turnos del día...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h2>Hoy — {fechaHoyISO()}</h2>

      <div>
        <button onPointerDown={onCrearTurno}>+ Crear turno</button>
        {' '}
        <button onPointerDown={onVerAgenda}>Ver agenda</button>
        {' '}
        <button onPointerDown={cargarTurnos}>Actualizar</button>
      </div>

      <div>
        <p>
          <strong>Resumen:</strong>{' '}
          {reservados.length} pendientes | {completados.length} completados | {noAsistieron.length} no asistieron
          {cancelados.length > 0 && ` | ${cancelados.length} cancelados`}
        </p>
        {proximo && (
          <p>
            <strong>Próximo turno:</strong> {formatearHora(proximo.inicio)} — {proximo.cliente_nombre || 'Sin nombre'}
            {proximo.servicio_nombre && ` (${proximo.servicio_nombre})`}
          </p>
        )}
      </div>

      <h3>Turnos del día ({turnos.length})</h3>

      {turnos.length === 0 ? (
        <p>No hay turnos para hoy.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {turnos
            .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
            .map((turno) => (
              <li key={turno.id} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #ccc' }}>
                <div>
                  <strong>{formatearHora(turno.inicio)}</strong>
                  {' — '}
                  {turno.cliente_nombre || 'Sin nombre'}
                  {turno.servicio_nombre && ` | ${turno.servicio_nombre}`}
                  {' | '}
                  <em>{turno.estado}</em>
                </div>
                {turno.cliente_telefono && <div>Tel: {turno.cliente_telefono}</div>}
                {turno.cliente_email && <div>Email: {turno.cliente_email}</div>}

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
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
