// /frontend-turnero/src/components/SeleccionServicio.jsx
// Pantalla 2: el cliente elige un servicio de la lista.

import { useState, useEffect } from 'react';
import { getServicios } from '../services/api.js';

/**
 * SeleccionServicio
 * Carga y muestra los servicios activos del tenant.
 * @param {Object|null} props.seleccionado - Servicio previamente seleccionado (para volver)
 * @param {Function} props.onSeleccionar - Callback con el servicio elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionServicio({ seleccionado, onSeleccionar, onVolver }) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getServicios();
        setServicios(data);
        console.log('[SeleccionServicio] servicios cargados |', data.length);
      } catch (err) {
        console.error('[SeleccionServicio] Error:', err.message);
        setError('Error al cargar servicios');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  if (cargando) return <p>Cargando servicios...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Elegí un servicio</h2>
      {servicios.length === 0 && <p>No hay servicios disponibles</p>}
      {servicios.map(s => (
        <div key={s.id} style={{ border: '1px solid #ccc', padding: 8, margin: 4 }}>
          <button onPointerDown={() => onSeleccionar(s)} style={{ width: '100%', textAlign: 'left' }}>
            <strong>{s.nombre}</strong> — ${s.precio} — {s.duracion_minutos} min
          </button>
        </div>
      ))}
    </div>
  );
}

export default SeleccionServicio;
