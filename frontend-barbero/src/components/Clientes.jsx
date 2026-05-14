// /frontend-barbero/src/components/Clientes.jsx
// Lista de clientes que alguna vez tuvieron un turno con el barbero autenticado.
// Muestra nombre, contacto, total de visitas y última visita.

import { useState, useEffect } from 'react';
import { getMisClientes } from '../services/api.js';

/**
 * formatearFecha
 * Convierte un ISO timestamp a fecha legible.
 * @param {string} iso
 * @returns {string} 'DD/MM/YYYY'
 */
function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getMisClientes();
        setClientes(data);
        console.log('[Clientes] cargar — completado |', data.length, 'clientes');
      } catch (err) {
        console.error('[Clientes] Error cargando clientes:', err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // Filtro local por nombre/email/teléfono
  const clientesFiltrados = filtro.trim().length > 0
    ? clientes.filter((c) => {
        const texto = filtro.toLowerCase();
        return (
          (c.nombre && c.nombre.toLowerCase().includes(texto)) ||
          (c.email && c.email.toLowerCase().includes(texto)) ||
          (c.telefono && c.telefono.includes(texto))
        );
      })
    : clientes;

  if (cargando) return <p>Cargando clientes...</p>;

  return (
    <div>
      <h2>Mis Clientes ({clientes.length})</h2>

      <input
        type="text"
        placeholder="Filtrar por nombre, email o teléfono..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
      />

      {clientesFiltrados.length === 0 ? (
        <p>No se encontraron clientes.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Teléfono</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Visitas</th>
              <th style={thStyle}>Última visita</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((c) => (
              <tr key={c.id}>
                <td style={tdStyle}>{c.nombre}</td>
                <td style={tdStyle}>{c.telefono || '—'}</td>
                <td style={tdStyle}>{c.email || '—'}</td>
                <td style={tdStyle}>{c.total_visitas}</td>
                <td style={tdStyle}>{formatearFecha(c.ultima_visita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ccc' };
const tdStyle = { padding: '8px', borderBottom: '1px solid #eee' };
