// /frontend-barbero/src/components/CrearTurno.jsx
// Wizard de creación de turno manual (4 pasos):
//   1. Selección de servicio
//   2. Selección de fecha
//   3. Selección de horario
//   4. Datos del cliente + confirmación
// Props:
//   barbero   — { id, nombre }
//   onVolver  — callback para volver al Dashboard
//   onExito   — callback cuando el turno se crea exitosamente

import { useState, useEffect } from 'react';
import {
  getServicios,
  getDisponibilidad,
  crearTurnoAdmin,
  buscarClientes,
} from '../services/api.js';

/**
 * fechaHoyISO
 * @returns {string} 'YYYY-MM-DD' de hoy en zona local
 */
function fechaHoyISO() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

/**
 * formatearHora
 * @param {string} iso
 * @returns {string} 'HH:MM'
 */
function formatearHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function CrearTurno({ barbero, onVolver, onExito }) {
  const [paso, setPaso] = useState(0);
  const [reserva, setReserva] = useState({
    servicio: null,
    fecha: '',
    horario: null,
    nombre: '',
    telefono: '',
    email: '',
  });

  // Datos auxiliares
  const [servicios, setServicios] = useState([]);
  const [slots, setSlots] = useState([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  // Estados de carga
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  /**
   * actualizar
   * Merge parcial sobre el estado de reserva.
   * @param {Object} datos
   */
  const actualizar = (datos) => setReserva(prev => ({ ...prev, ...datos }));

  // ─── PASO 0: Selección de servicio ──────────────────────────────────────────
  useEffect(() => {
    if (paso !== 0) return;
    setCargando(true);
    async function cargar() {
      try {
        const data = await getServicios();
        setServicios(data);
        console.log('[CrearTurno] getServicios — cargados:', data.length);
      } catch (err) {
        console.error('[CrearTurno] Error cargando servicios:', err.message);
        setError('No se pudieron cargar los servicios');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [paso]);

  // ─── PASO 2: Carga de slots al entrar ───────────────────────────────────────
  useEffect(() => {
    if (paso !== 2 || !reserva.fecha || !reserva.servicio) return;
    setCargando(true);
    setSlots([]);
    async function cargar() {
      try {
        const data = await getDisponibilidad(barbero.id, reserva.servicio.id, reserva.fecha);
        setSlots(data.slots || []);
        console.log('[CrearTurno] getDisponibilidad — slots:', (data.slots || []).length);
      } catch (err) {
        console.error('[CrearTurno] Error cargando disponibilidad:', err.message);
        setError('No se pudo cargar la disponibilidad');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [paso, reserva.fecha]);

  /**
   * buscarClienteExistente
   * Busca clientes por texto para autocompletar.
   * @param {string} texto
   */
  const buscarClienteExistente = async (texto) => {
    if (texto.length < 2) {
      setResultadosBusqueda([]);
      return;
    }
    try {
      const data = await buscarClientes(texto);
      setResultadosBusqueda(data);
    } catch (err) {
      console.error('[CrearTurno] Error buscando clientes:', err.message);
    }
  };

  /**
   * seleccionarClienteExistente
   * Rellena los datos del cliente con un resultado de búsqueda.
   * @param {Object} cliente - { nombre, email, telefono }
   */
  const seleccionarClienteExistente = (cliente) => {
    actualizar({
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      email: cliente.email || '',
    });
    setResultadosBusqueda([]);
  };

  /**
   * confirmar
   * Envía el turno al backend.
   */
  const confirmar = async () => {
    if (!reserva.nombre.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const datos = {
        servicio_id: reserva.servicio.id,
        barbero_id: barbero.id,
        inicio: reserva.horario,
        nombre: reserva.nombre.trim(),
        ...(reserva.telefono.trim() ? { telefono: reserva.telefono.trim() } : {}),
        ...(reserva.email.trim() ? { email: reserva.email.trim() } : {}),
      };
      const res = await crearTurnoAdmin(datos);
      console.log('[CrearTurno] confirmar — completado | turno_id:', res.turno_id);
      setResultado(res);
    } catch (err) {
      console.error('[CrearTurno] Error al crear turno:', err.message);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Si el turno se creó exitosamente
  if (resultado) {
    return (
      <div>
        <h2>Turno creado</h2>
        <p>El turno fue creado exitosamente.</p>
        <p>ID: {resultado.turno_id}</p>
        <button onPointerDown={onExito}>Volver al inicio</button>
      </div>
    );
  }

  // ─── Render por paso ────────────────────────────────────────────────────────
  return (
    <div>
      <button onPointerDown={paso === 0 ? onVolver : () => setPaso(p => p - 1)}>
        ← Volver
      </button>
      <h2>Crear turno — Paso {paso + 1} de 4</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* PASO 0: Servicio */}
      {paso === 0 && (
        <div>
          <h3>Seleccioná el servicio</h3>
          {cargando ? (
            <p>Cargando servicios...</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {servicios.map((s) => (
                <li key={s.id} style={{ marginBottom: '8px' }}>
                  <button
                    onPointerDown={() => { actualizar({ servicio: s }); setPaso(1); }}
                    style={{ padding: '12px', width: '100%', textAlign: 'left' }}
                  >
                    {s.nombre} — ${s.precio}
                    {s.duracion_minutos && ` (${s.duracion_minutos} min)`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* PASO 1: Fecha */}
      {paso === 1 && (
        <div>
          <h3>Seleccioná la fecha</h3>
          <input
            type="date"
            value={reserva.fecha}
            min={fechaHoyISO()}
            onChange={(e) => actualizar({ fecha: e.target.value, horario: null })}
          />
          {reserva.fecha && (
            <div style={{ marginTop: '12px' }}>
              <button onPointerDown={() => setPaso(2)}>
                Continuar con {reserva.fecha}
              </button>
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Horario */}
      {paso === 2 && (
        <div>
          <h3>Seleccioná el horario — {reserva.fecha}</h3>
          {cargando ? (
            <p>Cargando horarios disponibles...</p>
          ) : slots.length === 0 ? (
            <p>No hay horarios disponibles para esta fecha.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {slots.map((slot) => (
                <button
                  key={slot}
                  onPointerDown={() => { actualizar({ horario: slot }); setPaso(3); }}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #ccc',
                    background: reserva.horario === slot ? '#1a7a4a' : '#fff',
                    color: reserva.horario === slot ? '#fff' : '#111',
                  }}
                >
                  {formatearHora(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PASO 3: Datos del cliente + confirmación */}
      {paso === 3 && (
        <div>
          <h3>Datos del cliente</h3>

          <div style={{ marginBottom: '12px' }}>
            <label>Buscar cliente existente:</label>
            <input
              type="text"
              placeholder="Nombre, email o teléfono..."
              onChange={(e) => buscarClienteExistente(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }}
            />
            {resultadosBusqueda.length > 0 && (
              <ul style={{ border: '1px solid #ccc', margin: 0, padding: 0, listStyle: 'none', maxHeight: '150px', overflow: 'auto' }}>
                {resultadosBusqueda.map((c) => (
                  <li key={c.id} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                    <span onPointerDown={() => seleccionarClienteExistente(c)}>
                      {c.nombre} {c.email ? `(${c.email})` : ''} {c.telefono ? `— ${c.telefono}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label>Nombre *</label>
            <input
              type="text"
              value={reserva.nombre}
              onChange={(e) => actualizar({ nombre: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label>Teléfono (opcional)</label>
            <input
              type="tel"
              value={reserva.telefono}
              onChange={(e) => actualizar({ telefono: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Email (opcional)</label>
            <input
              type="email"
              value={reserva.email}
              onChange={(e) => actualizar({ email: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px' }}
            />
          </div>

          <div style={{ padding: '12px', border: '1px solid #ccc', marginBottom: '12px' }}>
            <h4>Resumen</h4>
            <p>Servicio: {reserva.servicio?.nombre}</p>
            <p>Fecha: {reserva.fecha}</p>
            <p>Hora: {formatearHora(reserva.horario)}</p>
            <p>Cliente: {reserva.nombre || '—'}</p>
          </div>

          <button
            onPointerDown={confirmar}
            disabled={enviando || !reserva.nombre.trim()}
          >
            {enviando ? 'Creando...' : 'Confirmar turno'}
          </button>
        </div>
      )}
    </div>
  );
}
