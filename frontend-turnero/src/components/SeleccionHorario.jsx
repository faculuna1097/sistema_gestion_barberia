// /frontend-turnero/src/components/SeleccionHorario.jsx
// Pantalla 5: el cliente elige un slot disponible para el día seleccionado.

import { useState, useEffect } from 'react';
import { getDisponibilidad } from '../services/api.js';

/**
 * formatearHora
 * Convierte un ISO timestamp a formato HH:mm local.
 * @param {string} iso - ISO timestamp
 * @returns {string} 'HH:mm'
 */
function formatearHora(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * SeleccionHorario
 * Carga los slots disponibles para (barbero, servicio, fecha) y los muestra.
 * @param {string} props.barberoId
 * @param {string} props.servicioId
 * @param {string} props.fecha - 'YYYY-MM-DD'
 * @param {string|null} props.seleccionado - ISO del slot previamente elegido
 * @param {Function} props.onSeleccionar - Callback con el ISO del slot elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionHorario({ barberoId, servicioId, fecha, seleccionado, onSeleccionar, onVolver }) {
  const [slots, setSlots] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const data = await getDisponibilidad(barberoId, servicioId, fecha);
        setSlots(data.slots);
        console.log('[SeleccionHorario] slots cargados |', data.slots.length);
      } catch (err) {
        console.error('[SeleccionHorario] Error:', err.message);
        setError('Error al cargar horarios');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [barberoId, servicioId, fecha]);

  if (cargando) return <p>Cargando horarios...</p>;
  if (error) return <div><button onPointerDown={onVolver}>← Volver</button><p>{error}</p></div>;

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Elegí un horario — {fecha}</h2>
      {slots.length === 0 && <p>No hay horarios disponibles para esta fecha</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {slots.map(slot => (
          <button
            key={slot}
            onPointerDown={() => onSeleccionar(slot)}
            style={{
              padding: 8,
              border: slot === seleccionado ? '2px solid #1a7a4a' : '1px solid #ccc',
              background: slot === seleccionado ? '#e6f4ed' : 'white',
            }}
          >
            {formatearHora(slot)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SeleccionHorario;
