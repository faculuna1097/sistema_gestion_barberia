// /frontend-turnero/src/components/SeleccionBarbero.jsx
// Pantalla 3: el cliente elige un barbero.

import { useState, useEffect } from 'react';
import { getBarberos } from '../services/api.js';

/**
 * SeleccionBarbero
 * Carga y muestra los barberos activos del tenant.
 * @param {Object|null} props.seleccionado - Barbero previamente seleccionado
 * @param {Function} props.onSeleccionar - Callback con el barbero elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionBarbero({ seleccionado, onSeleccionar, onVolver }) {
  const [barberos, setBarberos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getBarberos();
        setBarberos(data);
        console.log('[SeleccionBarbero] barberos cargados |', data.length);
      } catch (err) {
        console.error('[SeleccionBarbero] Error:', err.message);
        setError('Error al cargar barberos');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  if (cargando) return <p>Cargando barberos...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Elegí un barbero</h2>
      {barberos.length === 0 && <p>No hay barberos disponibles</p>}
      {barberos.map(b => (
        <div key={b.id} style={{ border: '1px solid #ccc', padding: 8, margin: 4 }}>
          <button onPointerDown={() => onSeleccionar(b)} style={{ width: '100%', textAlign: 'left' }}>
            {b.nombre}
          </button>
        </div>
      ))}
    </div>
  );
}

export default SeleccionBarbero;
