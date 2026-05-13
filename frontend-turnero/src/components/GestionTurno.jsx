// /frontend-turnero/src/components/GestionTurno.jsx
// Pantalla 8: gestión del turno desde link del mail.
// Muestra datos del turno + permite cancelar o reprogramar.

import { useState, useEffect } from 'react';
import {
  getTurnoPorToken, cancelarTurno, reprogramarTurno, getDisponibilidad,
} from '../services/api.js';

/**
 * formatearFechaHora
 * Convierte ISO a fecha y hora legible.
 * @param {string} iso
 * @returns {string}
 */
function formatearFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * formatearHora
 * Convierte ISO a HH:mm.
 * @param {string} iso
 * @returns {string}
 */
function formatearHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * generarProximosDias
 * Array de YYYY-MM-DD para los próximos N días.
 * @param {number} cantidad
 * @returns {Array<string>}
 */
function generarProximosDias(cantidad) {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

/**
 * formatearFechaCorta
 * YYYY-MM-DD a "Mar 13/05".
 * @param {string} fechaStr
 * @returns {string}
 */
function formatearFechaCorta(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-');
  const date = new Date(Number(anio), Number(mes) - 1, Number(dia));
  const nombreDia = date.toLocaleDateString('es-AR', { weekday: 'short' });
  return `${nombreDia} ${dia}/${mes}`;
}

/**
 * GestionTurno
 * Carga un turno por token y permite ver, cancelar o reprogramar.
 * @param {string} props.token - Token de gestión del turno
 * @param {Object} props.tenant - Datos del tenant
 */
function GestionTurno({ token, tenant }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Sub-estado para reprogramación
  const [reprogramando, setReprogramando] = useState(false);
  const [fechaReprog, setFechaReprog] = useState(null);
  const [slotsReprog, setSlotsReprog] = useState([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getTurnoPorToken(token);
        setDatos(data);
        console.log('[GestionTurno] turno cargado | estado:', data.turno.estado);
      } catch (err) {
        console.error('[GestionTurno] Error:', err.message);
        setError('No se pudo cargar el turno');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [token]);

  /**
   * handleCancelar
   * Cancela el turno y actualiza el estado local.
   */
  const handleCancelar = async () => {
    if (!window.confirm('¿Estás seguro de que querés cancelar el turno?')) return;
    setProcesando(true);
    try {
      await cancelarTurno(token);
      setDatos(prev => ({ ...prev, turno: { ...prev.turno, estado: 'cancelado' } }));
      setMensaje('Turno cancelado exitosamente');
      console.log('[GestionTurno] turno cancelado');
    } catch (err) {
      console.error('[GestionTurno] Error cancelando:', err.message);
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  /**
   * handleSeleccionarFechaReprog
   * Selecciona una fecha y carga los slots disponibles para esa fecha.
   * @param {string} fecha - YYYY-MM-DD
   */
  const handleSeleccionarFechaReprog = async (fecha) => {
    setFechaReprog(fecha);
    setCargandoSlots(true);
    try {
      const data = await getDisponibilidad(datos.barbero.id, datos.servicio.id, fecha);
      setSlotsReprog(data.slots);
    } catch (err) {
      console.error('[GestionTurno] Error cargando slots:', err.message);
      setSlotsReprog([]);
    } finally {
      setCargandoSlots(false);
    }
  };

  /**
   * handleReprogramar
   * Reprograma el turno al slot elegido.
   * @param {string} nuevoInicio - ISO timestamp
   */
  const handleReprogramar = async (nuevoInicio) => {
    setProcesando(true);
    try {
      const res = await reprogramarTurno(token, nuevoInicio);
      setDatos(prev => ({
        ...prev,
        turno: { ...prev.turno, inicio: res.turno.inicio, fin: res.turno.fin },
      }));
      setReprogramando(false);
      setFechaReprog(null);
      setSlotsReprog([]);
      setMensaje('Turno reprogramado exitosamente');
      console.log('[GestionTurno] turno reprogramado');
    } catch (err) {
      console.error('[GestionTurno] Error reprogramando:', err.message);
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <p>Cargando turno...</p>;
  if (error && !datos) return <p>{error}</p>;

  const { turno, barbero, servicio, cliente } = datos;
  const esReservado = turno.estado === 'reservado';

  return (
    <div>
      <h2>Tu turno</h2>
      {mensaje && <p style={{ color: 'green' }}>{mensaje}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ textAlign: 'left' }}>
        <tbody>
          <tr><td><strong>Estado</strong></td><td>{turno.estado}</td></tr>
          <tr><td><strong>Servicio</strong></td><td>{servicio.nombre} — ${servicio.precio}</td></tr>
          <tr><td><strong>Barbero</strong></td><td>{barbero.nombre}</td></tr>
          <tr><td><strong>Fecha/hora</strong></td><td>{formatearFechaHora(turno.inicio)}</td></tr>
          <tr><td><strong>Duración</strong></td><td>{servicio.duracion_minutos} min</td></tr>
          <tr><td><strong>Cliente</strong></td><td>{cliente.nombre}</td></tr>
          <tr><td><strong>Email</strong></td><td>{cliente.email}</td></tr>
          <tr><td><strong>Teléfono</strong></td><td>{cliente.telefono}</td></tr>
        </tbody>
      </table>

      {esReservado && !reprogramando && (
        <div style={{ marginTop: 16 }}>
          <button onPointerDown={handleCancelar} disabled={procesando}>
            {procesando ? 'Procesando...' : 'Cancelar turno'}
          </button>
          {' '}
          <button onPointerDown={() => setReprogramando(true)} disabled={procesando}>
            Reprogramar
          </button>
        </div>
      )}

      {/* Mini-wizard de reprogramación */}
      {reprogramando && (
        <div style={{ marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 12 }}>
          <h3>Reprogramar turno</h3>
          <button onPointerDown={() => { setReprogramando(false); setFechaReprog(null); setSlotsReprog([]); }}>
            Cancelar reprogramación
          </button>

          <p style={{ marginTop: 8 }}>Elegí nueva fecha:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {generarProximosDias(14).map(f => (
              <button
                key={f}
                onPointerDown={() => handleSeleccionarFechaReprog(f)}
                style={{
                  padding: 6,
                  border: f === fechaReprog ? '2px solid #1a7a4a' : '1px solid #ccc',
                }}
              >
                {formatearFechaCorta(f)}
              </button>
            ))}
          </div>

          {fechaReprog && (
            <div style={{ marginTop: 8 }}>
              {cargandoSlots ? (
                <p>Cargando horarios...</p>
              ) : slotsReprog.length === 0 ? (
                <p>No hay horarios disponibles para esa fecha</p>
              ) : (
                <>
                  <p>Elegí nuevo horario:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {slotsReprog.map(slot => (
                      <button
                        key={slot}
                        onPointerDown={() => handleReprogramar(slot)}
                        disabled={procesando}
                        style={{ padding: 6, border: '1px solid #ccc' }}
                      >
                        {formatearHora(slot)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GestionTurno;
