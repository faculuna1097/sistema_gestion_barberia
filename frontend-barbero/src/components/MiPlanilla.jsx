// /frontend-barbero/src/components/MiPlanilla.jsx
// Vista semanal de la planilla del barbero autenticado.
// Navegable por semana. Muestra detalle de cortes + resumen con comisión.

import { useState, useEffect } from 'react';
import { getPlanilla, getResumenPlanilla } from '../services/api.js';

/**
 * lunesDeEstaSemana
 * Devuelve el lunes de la semana actual en formato YYYY-MM-DD.
 * @returns {string}
 */
function lunesDeEstaSemana() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
}

/**
 * sumarSemanas
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {number} semanas
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarSemanas(fecha, semanas) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + (semanas * 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * formatearFecha
 * @param {string} fecha - 'YYYY-MM-DD' o Date ISO
 * @returns {string} 'DD/MM'
 */
function formatearFecha(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * rangoSemana
 * Devuelve el string "lunes DD/MM — domingo DD/MM" de una semana.
 * @param {string} lunes - 'YYYY-MM-DD'
 * @returns {string}
 */
function rangoSemana(lunes) {
  const d = new Date(lunes + 'T12:00:00');
  const domingo = new Date(d);
  domingo.setDate(d.getDate() + 6);
  return `${formatearFecha(lunes)} — ${formatearFecha(`${domingo.getFullYear()}-${String(domingo.getMonth() + 1).padStart(2, '0')}-${String(domingo.getDate()).padStart(2, '0')}`)}`;
}

export default function MiPlanilla() {
  const [semana, setSemana] = useState(lunesDeEstaSemana());
  const [detalle, setDetalle] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    async function cargar() {
      try {
        const [det, res] = await Promise.all([
          getPlanilla(semana),
          getResumenPlanilla(semana),
        ]);
        setDetalle(det);
        setResumen(res);
        console.log('[MiPlanilla] cargar — completado | semana:', semana);
      } catch (err) {
        console.error('[MiPlanilla] Error cargando planilla:', err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [semana]);

  // El detalle viene agrupado por barbero. Como rol=barbero, solo viene el propio.
  const miDetalle = detalle && detalle.length > 0 ? detalle[0] : null;
  const miResumen = resumen?.barberos?.length > 0 ? resumen.barberos[0] : null;

  return (
    <div>
      <h2>Mi Planilla</h2>

      {/* Navegador de semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onPointerDown={() => setSemana(sumarSemanas(semana, -1))}>← Anterior</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong>Semana {rangoSemana(semana)}</strong>
          {semana !== lunesDeEstaSemana() && (
            <button onPointerDown={() => setSemana(lunesDeEstaSemana())} style={{ marginLeft: '8px' }}>
              Esta semana
            </button>
          )}
        </div>
        <button onPointerDown={() => setSemana(sumarSemanas(semana, 1))}>Siguiente →</button>
      </div>

      {cargando ? (
        <p>Cargando planilla...</p>
      ) : (
        <>
          {/* Resumen */}
          {miResumen && (
            <div style={{ padding: '12px', border: '1px solid #ccc', marginBottom: '16px' }}>
              <h3>Resumen semanal</h3>
              <p>Cortes: <strong>{miResumen.cantidad_cortes}</strong></p>
              <p>Monto servicios: <strong>${miResumen.monto_servicios}</strong></p>
              <p>Propinas: <strong>${miResumen.propinas}</strong></p>
              <p>Total generado: <strong>${miResumen.total_generado}</strong></p>
              <p>
                Comisión ({miResumen.comision_tipo === 'porcentaje' ? `${miResumen.comision_valor}%` : `$${miResumen.comision_valor}`}):
                {' '}<strong>${miResumen.comision}</strong>
              </p>
            </div>
          )}

          {/* Detalle de cortes */}
          <h3>Detalle de cortes</h3>
          {!miDetalle || miDetalle.cortes.length === 0 ? (
            <p>No hay cortes registrados en esta semana.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Hora</th>
                  <th style={thStyle}>Servicio</th>
                  <th style={thStyle}>Monto</th>
                  <th style={thStyle}>Propina</th>
                  <th style={thStyle}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {miDetalle.cortes.map((c) => (
                  <tr key={c.corte_id}>
                    <td style={tdStyle}>{formatearFecha(new Date(c.fecha).toISOString().slice(0, 10))}</td>
                    <td style={tdStyle}>{c.hora?.slice(0, 5) || '—'}</td>
                    <td style={tdStyle}>{c.servicio_nombre}</td>
                    <td style={tdStyle}>${c.monto_servicios}</td>
                    <td style={tdStyle}>${c.propina}</td>
                    <td style={tdStyle}>{c.forma_pago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ccc' };
const tdStyle = { padding: '8px', borderBottom: '1px solid #eee' };
