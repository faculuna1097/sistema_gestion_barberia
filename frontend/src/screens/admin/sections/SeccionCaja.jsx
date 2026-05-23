// /frontend/src/screens/admin/sections/SeccionCaja.jsx

// Sección Caja del Panel de Administrador.
// Tab 1: movimientos del día seleccionado + totales neto por canal.
// Tab 2 y Tab 3: placeholders para v1.1.

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../../services/api';
import SelectorDia from '../../../components/SelectorDia';
import BadgeFormaPago from '../../../components/BadgeFormaPago';
import BotonExportarExcel from '../../../components/BotonExportarExcel';
import TogglePill from '../../../components/TogglePill';
import { getFechaHoy } from '../../../utils/fechas';
import { formatARS, formatPago } from '../../../utils/formatos';

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
              {formatARS(movimiento.monto)}
            </span>
          </div>
        </div>
        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar}>Cancelar</button>
          <button style={styles.btnEliminarConfirm} onPointerDown={onConfirmar}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

function TabMovimientos() {
  const [fecha, setFecha]             = useState(getFechaHoy);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState(null);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null);
  const [eliminando, setEliminando]   = useState(false);
  const [soloNegocio, setSoloNegocio] = useState(false);

  useEffect(() => {
    const cargarMovimientos = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch(`/caja/movimientos-dia?fecha=${fecha}`);
        const data = await res.json();
        setMovimientos(data.movimientos || []);
      } catch (err) {
        console.error('[seccionCaja] Error en cargarMovimientos:', err.message);
        setError('No se pudieron cargar los movimientos.');
      } finally {
        setCargando(false);
      }
    };
    cargarMovimientos();
  }, [fecha]);

  const movimientosFiltrados = soloNegocio
    ? movimientos.filter(m => m.tipo !== 'corte' || Number(m.comision_valor) < 100)
    : movimientos;

  const efectivoNeto = movimientosFiltrados.reduce((acc, m) => {
    if (m.forma_pago !== 'efectivo') return acc;
    return m.tipo === 'gasto' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);

  const mercadoPagoNeto = movimientosFiltrados.reduce((acc, m) => {
    if (m.forma_pago !== 'mercado_pago') return acc;
    return m.tipo === 'gasto' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);

  const confirmarEliminar = async () => {
    const { tipo, id } = movimientoAEliminar;
    setEliminando(true);
    try {
      const res = await apiFetch(`/caja/movimientos/${tipo}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error del servidor');
      setMovimientos(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('[seccionCaja] Error en confirmarEliminar:', err.message);
    } finally {
      setEliminando(false);
      setMovimientoAEliminar(null);
    }
  };

  const exportarExcel = () => {
    const datos = movimientos.map(m => ({
      Hora:            m.hora,
      Tipo:            m.tipo === 'corte' ? 'Corte' : m.tipo === 'venta' ? 'Venta' : 'Gasto',
      Barbero:         m.barbero_nombre || '-',
      Detalle:         m.detalle,
      Monto:           m.tipo === 'gasto' ? -Number(m.monto) : Number(m.monto),
      'Forma de pago': formatPago(m.forma_pago),
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos del dia');
    XLSX.writeFile(wb, `movimientos-${fecha}.xlsx`);
  };

  if (cargando) return (
    <div style={styles.estadoCentrado}>
      <div style={styles.spinner} />
      <p style={styles.estadoTexto}>Cargando movimientos...</p>
    </div>
  );

  if (error) return <div style={styles.errorBox}>{error}</div>;

  return (
    <div>
      {movimientoAEliminar && (
        <ModalConfirmarEliminar
          movimiento={movimientoAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setMovimientoAEliminar(null)}
        />
      )}

      <div style={styles.totalesRow}>
        <div style={styles.totalCard}>
          <span style={styles.totalEmoji}>💵</span>
          <div>
            <p style={styles.totalLabel}>Efectivo neto</p>
            <p style={{ ...styles.totalMonto, color: efectivoNeto >= 0 ? '#1a7a4a' : '#c0392b' }}>
              {formatARS(efectivoNeto)}
            </p>
          </div>
        </div>
        <div style={styles.totalCard}>
          <img
            src="/mercadopago.png"
            alt="Mercado Pago"
            style={styles.mpLogo}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div>
            <p style={styles.totalLabel}>Mercado Pago neto</p>
            <p style={{ ...styles.totalMonto, color: mercadoPagoNeto >= 0 ? '#1a7a4a' : '#c0392b' }}>
              {formatARS(mercadoPagoNeto)}
            </p>
          </div>
        </div>
      </div>

      <div style={styles.accionesRow}>
        <div>
          <TogglePill
            activo={soloNegocio}
            onToggle={() => setSoloNegocio(v => !v)}
            labelOn="Solo Barberos"
          />
        </div>

        <SelectorDia value={fecha} onChange={setFecha} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BotonExportarExcel onPointerDown={exportarExcel} disabled={movimientos.length === 0} />
        </div>
      </div>

      {movimientosFiltrados.length === 0 ? (
        <div style={styles.estadoCentrado}>
          <p style={styles.estadoTexto}>No hay movimientos registrados este día.</p>
        </div>
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
              {movimientosFiltrados.map((m, i) => (
                <tr
                  key={m.id || i}
                  style={m.tipo === 'gasto'
                    ? { backgroundColor: '#fff8f8' }
                    : i % 2 === 0 ? styles.filaImpar : styles.filaPar}
                >
                  <td style={styles.td}>{m.hora}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: m.tipo === 'corte' ? '#e8f5ee' : m.tipo === 'venta' ? '#eef2ff' : '#fdecea',
                      color:           m.tipo === 'corte' ? '#1a7a4a' : m.tipo === 'venta' ? '#4338ca' : '#c0392b',
                    }}>
                      {m.tipo === 'corte' ? 'Corte' : m.tipo === 'venta' ? 'Venta' : 'Gasto'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#888888' }}>{m.barbero_nombre || '-'}</td>
                  <td style={styles.td}>{m.detalle}</td>
                  <td style={{ ...styles.td, fontWeight: '600', color: m.tipo === 'gasto' ? '#c0392b' : '#111111' }}>
                    {m.tipo === 'gasto' ? '- ' : ''}{formatARS(m.monto)}
                  </td>
                  <td style={styles.td}><BadgeFormaPago forma={m.forma_pago} /></td>
                  <td style={styles.tdAccion}>
                    <button style={styles.btnX} onPointerDown={() => setMovimientoAEliminar(m)} aria-label="Eliminar registro">
                      x
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

function TabCierre() {
  return (
    <div style={styles.estadoCentrado}>
      <p style={styles.estadoTexto}>Cierre de caja — próximamente.</p>
    </div>
  );
}

function TabHistorial() {
  return (
    <div style={styles.estadoCentrado}>
      <p style={styles.estadoTexto}>Historial de cierres — próximamente.</p>
    </div>
  );
}

export default function SeccionCaja() {
  const [tabActivo, setTabActivo] = useState('movimientos');

  const tabs = [
    { key: 'movimientos', label: 'Movimientos del dia' },
    { key: 'cierre',      label: 'Cierre de caja' },
    { key: 'historial',   label: 'Historial de cierres' },
  ];

  return (
    <div style={styles.contenedor}>
      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Caja</h2>
          <p style={styles.subtitulo}>Movimientos por dia</p>
        </div>
        <div style={styles.tabPillContenedor}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{ ...styles.tabPill, ...(tabActivo === t.key ? styles.tabPillActivo : {}) }}
              onPointerDown={() => setTabActivo(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tabActivo === 'movimientos' && <TabMovimientos />}
      {tabActivo === 'cierre'      && <TabCierre />}
      {tabActivo === 'historial'   && <TabHistorial />}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    padding: '36px 40px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },

  // Encabezado
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '28px',
  },
  titulo: {
    fontSize: '26px', fontWeight: '700', color: '#111111', margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px', color: '#888888', margin: 0,
  },

  // Tabs pill
  tabPillContenedor: {
    display: 'flex', gap: '2px',
    backgroundColor: '#f5f5f5', borderRadius: '12px', padding: '4px',
  },
  tabPill: {
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    backgroundColor: 'transparent', color: '#888888',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },
  tabPillActivo: {
    backgroundColor: '#ffffff', color: '#111111', fontWeight: '600',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  },

  // Cards de totales
  totalesRow: {
    display: 'flex', gap: '16px', marginBottom: '20px',
  },
  totalCard: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
    padding: '20px 24px', borderRadius: '16px',
    border: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  totalEmoji: { fontSize: '32px', lineHeight: 1 },
  mpLogo: { height: '50px', objectFit: 'contain' },
  totalLabel: {
    margin: '0 0 4px', fontSize: '12px', color: '#888888',
    fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  totalMonto: { margin: 0, fontSize: '26px', fontWeight: '700' },

  // Fila acciones (toggle | selector fecha | exportar)
  accionesRow: {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center', marginBottom: '16px',
  },

  // Tabla
  tablaWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', overflowX: 'auto',
  },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 20px', fontSize: '11px', fontWeight: '700',
    color: '#999999', textTransform: 'uppercase', letterSpacing: '0.06em',
    backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0',
    textAlign: 'left', whiteSpace: 'nowrap',
  },
  thAccion: {
    padding: '12px 16px', width: '48px',
    backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '14px 20px', fontSize: '14px', color: '#333333',
    borderBottom: '1px solid #f7f7f7', verticalAlign: 'middle',
  },
  tdAccion: {
    padding: '8px 12px', textAlign: 'center',
    borderBottom: '1px solid #f7f7f7', verticalAlign: 'middle',
  },
  filaImpar: { backgroundColor: '#ffffff' },
  filaPar:   { backgroundColor: '#fafafa' },

  // Badge genérico (tipo + forma de pago)
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '600',
  },

  // Botón X
  btnX: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #f5c6c6', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },

  // Estados
  estadoCentrado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 0', gap: '16px',
  },
  estadoTexto: {
    fontSize: '15px', color: '#888888', margin: 0,
  },
  errorBox: {
    padding: '16px 20px', borderRadius: '10px',
    backgroundColor: '#fdecea', color: '#c0392b',
    fontSize: '14px', marginBottom: '16px',
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid #e8e8e8', borderTopColor: '#1a7a4a',
    animation: 'spin 0.8s linear infinite',
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
  modalLabel:   { fontSize: '13px', color: '#888888' },
  modalValor:   { fontSize: '14px', color: '#111111', fontWeight: '600' },
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
