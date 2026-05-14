// /frontend-barbero/src/components/Gestion.jsx
// Sección "Gestión" con dos sub-secciones por tabs:
//   - Mis Horarios: ver y editar el horario semanal habitual.
//   - Mis Suspensiones: listar, crear y eliminar suspensiones.
// Props:
//   barbero — { id, nombre }

import { useState, useEffect } from 'react';
import {
  getHorarios,
  putHorarios,
  getSuspensiones,
  crearSuspension,
  eliminarSuspension,
} from '../services/api.js';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function Gestion({ barbero }) {
  const [tab, setTab] = useState('horarios');

  return (
    <div>
      <h2>Gestión</h2>
      <div style={{ marginBottom: '16px' }}>
        <button
          onPointerDown={() => setTab('horarios')}
          style={{ fontWeight: tab === 'horarios' ? 'bold' : 'normal', marginRight: '12px' }}
        >
          Mis Horarios
        </button>
        <button
          onPointerDown={() => setTab('suspensiones')}
          style={{ fontWeight: tab === 'suspensiones' ? 'bold' : 'normal' }}
        >
          Mis Suspensiones
        </button>
      </div>

      {tab === 'horarios' && <TabHorarios barbero={barbero} />}
      {tab === 'suspensiones' && <TabSuspensiones barbero={barbero} />}
    </div>
  );
}

// ─── Tab: Horarios ────────────────────────────────────────────────────────────

/**
 * TabHorarios
 * Muestra el horario semanal del barbero y permite editarlo.
 * Cada bloque tiene dia_semana (0-6), hora_inicio y hora_fin.
 */
function TabHorarios({ barbero }) {
  const [bloques, setBloques] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    setCargando(true);
    async function cargar() {
      try {
        const data = await getHorarios(barbero.id);
        setBloques(data);
        console.log('[Gestion/Horarios] cargar — completado |', data.length, 'bloques');
      } catch (err) {
        console.error('[Gestion/Horarios] Error cargando horarios:', err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  /**
   * agregarBloque
   * Agrega un bloque vacío para un día de la semana.
   * @param {number} dia - 0-6
   */
  const agregarBloque = (dia) => {
    setBloques(prev => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '18:00' }]);
  };

  /**
   * actualizarBloque
   * Actualiza un campo de un bloque existente.
   * @param {number} index
   * @param {string} campo
   * @param {string} valor
   */
  const actualizarBloque = (index, campo, valor) => {
    setBloques(prev => prev.map((b, i) => i === index ? { ...b, [campo]: valor } : b));
  };

  /**
   * eliminarBloque
   * Elimina un bloque del array local.
   * @param {number} index
   */
  const eliminarBloque = (index) => {
    setBloques(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * guardar
   * Envía el horario completo al backend.
   */
  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const payload = bloques.map(({ dia_semana, hora_inicio, hora_fin }) => ({
        dia_semana,
        hora_inicio,
        hora_fin,
      }));
      const resultado = await putHorarios(barbero.id, payload);
      setBloques(resultado);
      setMensaje('Horarios guardados correctamente');
      console.log('[Gestion/Horarios] guardar — completado');
    } catch (err) {
      console.error('[Gestion/Horarios] Error guardando:', err.message);
      setMensaje('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p>Cargando horarios...</p>;

  return (
    <div>
      <h3>Mis Horarios</h3>
      {mensaje && <p>{mensaje}</p>}

      {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
        const bloquesDelDia = bloques
          .map((b, i) => ({ ...b, _index: i }))
          .filter(b => b.dia_semana === dia);

        return (
          <div key={dia} style={{ marginBottom: '12px', padding: '8px', border: '1px solid #eee' }}>
            <strong>{DIAS_SEMANA[dia]}</strong>
            {bloquesDelDia.length === 0 && <span style={{ color: '#888', marginLeft: '8px' }}>— Sin horario</span>}
            {bloquesDelDia.map((bloque) => (
              <div key={bloque._index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="time"
                  value={bloque.hora_inicio}
                  onChange={(e) => actualizarBloque(bloque._index, 'hora_inicio', e.target.value)}
                />
                <span>a</span>
                <input
                  type="time"
                  value={bloque.hora_fin}
                  onChange={(e) => actualizarBloque(bloque._index, 'hora_fin', e.target.value)}
                />
                <button onPointerDown={() => eliminarBloque(bloque._index)}>Eliminar</button>
              </div>
            ))}
            <button
              onPointerDown={() => agregarBloque(dia)}
              style={{ marginTop: '4px', fontSize: '13px' }}
            >
              + Agregar bloque
            </button>
          </div>
        );
      })}

      <button onPointerDown={guardar} disabled={guardando} style={{ marginTop: '12px' }}>
        {guardando ? 'Guardando...' : 'Guardar horarios'}
      </button>
    </div>
  );
}

// ─── Tab: Suspensiones ────────────────────────────────────────────────────────

/**
 * TabSuspensiones
 * Lista suspensiones futuras, permite crear nuevas y eliminar existentes.
 * Maneja el flujo de 409 (turnos afectados) con confirmación.
 */
function TabSuspensiones({ barbero }) {
  const [suspensiones, setSuspensiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [eliminando, setEliminando] = useState(null);

  // Formulario de nueva suspensión
  const [formDesde, setFormDesde] = useState('');
  const [formHasta, setFormHasta] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [creando, setCreando] = useState(false);
  const [conflicto, setConflicto] = useState(null);
  const [mensajeSusp, setMensajeSusp] = useState(null);

  /**
   * cargarSuspensiones
   * Carga las suspensiones futuras del barbero.
   */
  const cargarSuspensiones = async () => {
    try {
      const data = await getSuspensiones();
      setSuspensiones(data);
      console.log('[Gestion/Suspensiones] cargar — completado |', data.length, 'suspensiones');
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error cargando:', err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSuspensiones();
  }, []);

  /**
   * crear
   * Crea una nueva suspensión. Si hay conflicto (409), muestra turnos afectados.
   * @param {boolean} confirmarCancelacion - true para forzar tras conflicto
   */
  const crear = async (confirmarCancelacion = false) => {
    if (!formDesde || !formHasta) {
      alert('Las fechas son obligatorias');
      return;
    }
    setCreando(true);
    setMensajeSusp(null);
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
        setCreando(false);
        return;
      }

      setMensajeSusp(`Suspensión creada. ${res.turnos_cancelados || 0} turnos cancelados.`);
      setConflicto(null);
      setFormDesde('');
      setFormHasta('');
      setFormMotivo('');
      await cargarSuspensiones();
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error creando:', err.message);
      setMensajeSusp('Error: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  /**
   * eliminar
   * Elimina una suspensión por su id.
   * @param {string} id
   */
  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta suspensión?')) return;
    setEliminando(id);
    try {
      await eliminarSuspension(id);
      console.log('[Gestion/Suspensiones] eliminar — completado |', id);
      await cargarSuspensiones();
    } catch (err) {
      console.error('[Gestion/Suspensiones] Error eliminando:', err.message);
      alert('Error: ' + err.message);
    } finally {
      setEliminando(null);
    }
  };

  /**
   * formatearFechaHora
   * @param {string} iso
   * @returns {string}
   */
  const formatearFechaHora = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (cargando) return <p>Cargando suspensiones...</p>;

  return (
    <div>
      <h3>Mis Suspensiones</h3>

      {/* Formulario de nueva suspensión */}
      <div style={{ padding: '12px', border: '1px solid #ccc', marginBottom: '16px' }}>
        <h4>Nueva suspensión</h4>
        <div style={{ marginBottom: '8px' }}>
          <label>Desde:</label>
          <input
            type="datetime-local"
            value={formDesde}
            onChange={(e) => setFormDesde(e.target.value)}
            style={{ display: 'block', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Hasta:</label>
          <input
            type="datetime-local"
            value={formHasta}
            onChange={(e) => setFormHasta(e.target.value)}
            style={{ display: 'block', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Motivo (opcional):</label>
          <input
            type="text"
            value={formMotivo}
            onChange={(e) => setFormMotivo(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          />
        </div>

        {/* Conflicto: turnos afectados */}
        {conflicto && (
          <div style={{ padding: '8px', border: '1px solid #f4b400', marginBottom: '8px', backgroundColor: '#fff9e6' }}>
            <p><strong>Hay {conflicto.turnos_afectados?.length || 0} turnos que serán cancelados:</strong></p>
            <ul>
              {conflicto.turnos_afectados?.map((t, i) => (
                <li key={i}>{formatearFechaHora(t.inicio)} — {t.cliente_nombre || 'Sin nombre'}</li>
              ))}
            </ul>
            <button onPointerDown={() => crear(true)} disabled={creando}>
              {creando ? 'Creando...' : 'Confirmar cancelación y crear suspensión'}
            </button>
            {' '}
            <button onPointerDown={() => setConflicto(null)}>Cancelar</button>
          </div>
        )}

        {!conflicto && (
          <button onPointerDown={() => crear(false)} disabled={creando}>
            {creando ? 'Creando...' : 'Crear suspensión'}
          </button>
        )}

        {mensajeSusp && <p style={{ marginTop: '8px' }}>{mensajeSusp}</p>}
      </div>

      {/* Lista de suspensiones */}
      {suspensiones.length === 0 ? (
        <p>No hay suspensiones programadas.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {suspensiones.map((s) => (
            <li key={s.id} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #ccc' }}>
              <div>
                <strong>{formatearFechaHora(s.desde)}</strong> — <strong>{formatearFechaHora(s.hasta)}</strong>
              </div>
              {s.motivo && <div>Motivo: {s.motivo}</div>}
              <button
                onPointerDown={() => eliminar(s.id)}
                disabled={eliminando === s.id}
                style={{ marginTop: '4px' }}
              >
                {eliminando === s.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
