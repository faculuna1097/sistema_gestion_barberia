// frontend/src/screens/admin/sections/SeccionCaja.jsx
// Sección Caja del Panel de Administrador.
// Tab 1 implementado: movimientos del día + totales neto por método de pago.
// Tab 2 y Tab 3: placeholders para construir en el próximo paso.

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────


// ─── Modal de confirmación de eliminación ─────────────────────────────────────
function ModalConfirmarEliminar({ movimiento, onConfirmar, onCancelar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar este registro?</p>
        <p style={styles.modalAdvertencia}>Esta acción no se puede deshacer.</p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Hora</span>
            <span style={styles.modalValor}>{movimiento.hora}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Detalle</span>
            <span style={styles.modalValor}>{movimiento.detalle}</span>
          </div>
          <div style={styles.modalDivider} />
          {movimiento.barbero_nombre && (
            <>
              <div style={styles.modalFila}>
                <span style={styles.modalLabel}>Barbero</span>
                <span style={styles.modalValor}>{movimiento.barbero_nombre}</span>
              </div>
              <div style={styles.modalDivider} />
            </>
          )}
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Monto</span>
            <span style={{ ...styles.modalValor, color: '#c0392b', fontWeight: '700' }}>
              $ {Number(movimiento.monto).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar}>
            Cancelar
          </button>
          <button style={styles.btnEliminarConfirm} onPointerDown={onConfirmar}>
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Movimientos del día ───────────────────────────────────────────────
function TabMovimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    console.log('[SeccionCaja] Cargando movimientos del día...');
    fetch(`${API_URL}/api/caja/movimientos-dia`)
      .then(r => r.json())
      .then(data => {
        console.log('[SeccionCaja] Movimientos cargados:', data.movimientos?.length);
        setMovimientos(data.movimientos || []);
        setCargando(false);
      })
      .catch(err => {
        console.error('[SeccionCaja] Error al cargar movimientos:', err);
        setError('No se pudieron cargar los movimientos del día.');
        setCargando(false);
      });
  }, []);

  // ── Totales neto por canal ────────────────────────────────────────────────
  const efectivoNeto = movimientos.reduce((acc, m) => {
    if (m.forma_pago !== 'efectivo') return acc;
    return m.tipo === 'gasto' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);

  const mercadoPagoNeto = movimientos.reduce((acc, m) => {
    if (m.forma_pago !== 'mercado_pago') return acc;
    return m.tipo === 'gasto' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    setEliminando(true);
    const { tipo, id } = movimientoAEliminar;
    console.log('[SeccionCaja] Eliminando movimiento — tipo:', tipo, '| id:', id);
    try {
      const res = await fetch(`${API_URL}/api/caja/movimientos/${tipo}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error del servidor');
      setMovimientos(prev => prev.filter(m => m.id !== id));
      console.log('[SeccionCaja] Movimiento eliminado correctamente — id:', id);
    } catch (err) {
      console.error('[SeccionCaja] Error al eliminar movimiento:', err);
      alert('No se pudo eliminar el registro. Intentá de nuevo.');
    } finally {
      setEliminando(false);
      setMovimientoAEliminar(null);
    }
  };

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const exportarExcel = () => {
    const datos = movimientos.map(m => ({
      Hora: m.hora,
      Tipo: m.tipo === 'corte' ? 'Corte' : m.tipo === 'venta' ? 'Venta' : 'Gasto',
      Barbero: m.barbero_nombre || '—',
      Detalle: m.detalle,
      Monto: m.tipo === 'gasto' ? -Number(m.monto) : Number(m.monto),
      'Forma de pago': m.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos del día');
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `movimientos-${fecha}.xlsx`);
    console.log('[SeccionCaja] Exportación Excel completada');
  };

  if (cargando) return <p style={styles.estadoTexto}>Cargando movimientos...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      {/* ── Modal de confirmación ─────────────────────────────────────────── */}
      {movimientoAEliminar && (
        <ModalConfirmarEliminar
          movimiento={movimientoAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setMovimientoAEliminar(null)}
        />
      )}

      {/* ── Cards de totales neto ─────────────────────────────────────────── */}
      <div style={styles.totalesRow}>
        <div style={styles.totalCard}>
          <span style={styles.totalEmoji}>💵</span>
          <div>
            <p style={styles.totalLabel}>Efectivo neto</p>
            <p style={{ ...styles.totalMonto, color: efectivoNeto >= 0 ? '#1a7a4a' : '#c0392b' }}>
              $ {efectivoNeto.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
        <div style={styles.totalCard}>
          <span style={styles.totalEmoji}>📱</span>
          <div>
            <p style={styles.totalLabel}>Mercado Pago neto</p>
            <p style={{ ...styles.totalMonto, color: mercadoPagoNeto >= 0 ? '#1a7a4a' : '#c0392b' }}>
              $ {mercadoPagoNeto.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Fila de acciones ─────────────────────────────────────────────── */}
      <div style={styles.accionesRow}>
        <button style={styles.btnExportar} onPointerDown={exportarExcel}>
          📥 Exportar Excel
        </button>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      {movimientos.length === 0 ? (
        <p style={styles.estadoTexto}>No hay movimientos registrados hoy.</p>
      ) : (
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                {['Hora', 'Tipo', 'Barbero', 'Detalle', 'Monto', 'Forma de pago', ''].map((col, i) => (
                  <th key={i} style={col === '' ? styles.thAccion : styles.th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr
                  key={m.id || i}
                  style={{
                    backgroundColor:
                      m.tipo === 'gasto' ? '#fff8f8'
                      : i % 2 === 0 ? '#ffffff' : '#fafafa',
                  }}
                >
                  <td style={styles.td}>{m.hora}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor:
                        m.tipo === 'corte' ? '#e8f5ee'
                        : m.tipo === 'venta' ? '#eef2ff'
                        : '#fdecea',
                      color:
                        m.tipo === 'corte' ? '#1a7a4a'
                        : m.tipo === 'venta' ? '#4338ca'
                        : '#c0392b',
                    }}>
                      {m.tipo === 'corte' ? 'Corte' : m.tipo === 'venta' ? 'Venta' : 'Gasto'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#888888' }}>
                    {m.barbero_nombre || '—'}
                  </td>
                  <td style={styles.td}>{m.detalle}</td>
                  <td style={{
                    ...styles.td, fontWeight: '600',
                    color: m.tipo === 'gasto' ? '#c0392b' : '#111111',
                  }}>
                    {m.tipo === 'gasto' ? '− ' : ''}
                    $ {Number(m.monto).toLocaleString('es-AR')}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badgePago,
                      ...(m.forma_pago === 'efectivo' ? styles.badgeEfectivo : styles.badgeMP),
                    }}>
                      {m.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}
                    </span>
                  </td>
                  <td style={styles.tdAccion}>
                    <button
                      style={styles.btnX}
                      onPointerDown={() => setMovimientoAEliminar(m)}
                      aria-label="Eliminar registro"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Cierre de caja (placeholder) ──────────────────────────────────────
function TabCierre() {
  return <p style={styles.estadoTexto}>Cierre de caja — próximamente.</p>;
}

// ─── Tab 3: Historial de cierres (placeholder) ────────────────────────────────
function TabHistorial() {
  return <p style={styles.estadoTexto}>Historial de cierres — próximamente.</p>;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeccionCaja() {
  const [tabActivo, setTabActivo] = useState('movimientos');

  const tabs = [
    { key: 'movimientos', label: 'Movimientos del día' },
    { key: 'cierre',      label: 'Cierre de caja' },
    { key: 'historial',   label: 'Historial de cierres' },
  ];

  return (
    <div style={styles.contenedor}>
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.key}
            style={{
              ...styles.tabBtn,
              ...(tabActivo === t.key ? styles.tabBtnActivo : {}),
            }}
            onPointerDown={() => setTabActivo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido activo ─────────────────────────────────────────────── */}
      <div style={styles.tabContenido}>
        {tabActivo === 'movimientos' && <TabMovimientos />}
        {tabActivo === 'cierre'      && <TabCierre />}
        {tabActivo === 'historial'   && <TabHistorial />}
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },

  // Tab bar
  tabBar: {
    display: 'flex', gap: '4px',
    borderBottom: '2px solid #eeeeee', marginBottom: '28px',
  },
  tabBtn: {
    padding: '12px 24px', fontSize: '15px', fontWeight: '500',
    color: '#888888', border: 'none', background: 'none', cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: '-2px',
    fontFamily: 'inherit', borderRadius: '8px 8px 0 0', transition: 'color 0.15s',
  },
  tabBtnActivo: {
    color: '#1a7a4a', borderBottom: '2px solid #1a7a4a', fontWeight: '600',
  },
  tabContenido: {},

  // Totales
  totalesRow: {
    display: 'flex', gap: '16px', marginBottom: '24px',
  },
  totalCard: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
    padding: '20px 24px', borderRadius: '16px',
    border: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  totalEmoji: { fontSize: '30px' },
  totalLabel: {
    margin: '0 0 4px', fontSize: '12px',
    color: '#888888', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  totalMonto: { margin: 0, fontSize: '26px', fontWeight: '700' },

  // Acciones
  accionesRow: {
    display: 'flex', justifyContent: 'flex-end', marginBottom: '16px',
  },
  btnExportar: {
    padding: '9px 18px', borderRadius: '10px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // Tabla
  tablaWrapper: {
    overflowX: 'auto', borderRadius: '12px', border: '1.5px solid #eeeeee',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    padding: '13px 16px', textAlign: 'left', fontSize: '11px',
    fontWeight: '600', color: '#888888',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px', color: '#333333',
    borderBottom: '1px solid #f0f0f0', fontSize: '14px',
  },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '600',
  },

  // Estados
  estadoTexto: {
    textAlign: 'center', color: '#888888', fontSize: '15px', padding: '48px 0', margin: 0,
  },
  errorTexto: {
    textAlign: 'center', color: '#c0392b', fontSize: '15px', padding: '48px 0', margin: 0,
  },

  // Badges de forma de pago
  badgePago: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  badgeEfectivo: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  badgeMP: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
// Botón X en tabla
  thAccion: {
    padding: '13px 16px', width: '48px',
    borderBottom: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  tdAccion: {
    padding: '8px 12px', textAlign: 'center',
    borderBottom: '1px solid #f0f0f0',
  },
  btnX: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #f5c6c6', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: '0 0 6px', textAlign: 'center',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center',
    margin: '0 0 24px',
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalLabel: { fontSize: '13px', color: '#888888' },
  modalValor: { fontSize: '14px', color: '#111111', fontWeight: '600' },
  modalDivider: { height: '1px', backgroundColor: '#eeeeee' },
  modalBotones: { display: 'flex', gap: '12px' },
  btnCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEliminarConfirm: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },

};