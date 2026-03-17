// /frontend/src/screens/admin/sections/SeccionGastos.jsx
// Sección de gastos del panel administrador.
// Muestra todos los gastos del mes seleccionado con totales por categoría.
// Permite eliminar registros con modal de confirmación (idéntico a SeccionCaja).

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

/**
 * mesALabel — convierte 'YYYY-MM' en label legible, ej: 'Marzo 2026'
 */
const mesALabel = (mesStr) => {
  const [anio, mes] = mesStr.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} ${anio}`;
};

/**
 * getMesActual — devuelve el mes actual en formato 'YYYY-MM'
 */
const getMesActual = () =>
  new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).slice(0, 7);

/**
 * desplazarMes — suma o resta meses a un string 'YYYY-MM'
 * @param {string} mesStr - 'YYYY-MM'
 * @param {number} delta  - +1 o -1
 */
const desplazarMes = (mesStr, delta) => {
  const [anio, mes] = mesStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * formatMonto — formatea número como pesos argentinos, ej: $ 42.000
 */
const formatMonto = (valor) =>
  `$ ${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ─── Modal de confirmación de eliminación ─────────────────────────────────────
// Idéntico en estructura y estilos al de SeccionCaja.

function ModalConfirmarEliminar({ gasto, onConfirmar, onCancelar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar este gasto?</p>
        <p style={styles.modalAdvertencia}>Esta acción no se puede deshacer.</p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Fecha</span>
            <span style={styles.modalValor}>{gasto.fecha}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Categoría</span>
            <span style={styles.modalValor}>{gasto.categoria_nombre}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Descripción</span>
            <span style={styles.modalValor}>{gasto.descripcion}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Monto</span>
            <span style={{ ...styles.modalValor, color: '#c0392b', fontWeight: '700' }}>
              {formatMonto(gasto.monto)}
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

// ─── Sub-componente: badge forma de pago ──────────────────────────────────────
const BadgeFormaPago = ({ forma }) => {
  const estilos = forma === 'efectivo'
    ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
    : { backgroundColor: '#e3f2fd', color: '#1565c0' };
  return (
    <span style={{ ...styles.badge, ...estilos }}>
      {forma === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}
    </span>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeccionGastos() {
  const [mes, setMes]                           = useState(getMesActual);
  const [gastos, setGastos]                     = useState([]);
  const [totalesPorCategoria, setTotalesPorCat] = useState([]);
  const [totalGeneral, setTotalGeneral]         = useState(0);
  const [cargando, setCargando]                 = useState(false);
  const [error, setError]                       = useState(null);
  const [gastoAEliminar, setGastoAEliminar]     = useState(null);
  const [eliminando, setEliminando]             = useState(false);

  // ── Carga de datos al cambiar de mes ───────────────────────────────────────
  useEffect(() => {
    const cargarGastos = async () => {
      console.log('[SeccionGastos] Cargando gastos — mes:', mes);
      setCargando(true);
      setError(null);
      try {
        const res  = await fetch(`${API_BASE}/api/gastos/mensual?mes=${mes}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setGastos(data.gastos);
        setTotalesPorCat(data.totalesPorCategoria);
        setTotalGeneral(data.totalGeneral);
        console.log('[SeccionGastos] Datos cargados — registros:', data.gastos.length,
          '| total general:', data.totalGeneral);
      } catch (err) {
        console.error('[SeccionGastos] Error al cargar gastos:', err);
        setError('No se pudieron cargar los gastos. Intentá de nuevo.');
      } finally {
        setCargando(false);
      }
    };
    cargarGastos();
  }, [mes]);

  // ── Eliminar gasto ─────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    setEliminando(true);
    const { id } = gastoAEliminar;
    console.log('[SeccionGastos] Eliminando gasto — id:', id);
    try {
      const res = await fetch(`${API_BASE}/api/gastos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error del servidor');
      setGastos(prev => prev.filter(g => g.id !== id));
      // Recalcular totales después de eliminar
      const nuevosGastos = gastos.filter(g => g.id !== id);
      const nuevoTotal = nuevosGastos.reduce((acc, g) => acc + Number(g.monto), 0);
      setTotalGeneral(nuevoTotal);
      // Recalcular totales por categoría
      const totalesMap = {};
      nuevosGastos.forEach(g => {
        if (!totalesMap[g.categoria_nombre]) {
          totalesMap[g.categoria_nombre] = { total: 0, cantidad: 0 };
        }
        totalesMap[g.categoria_nombre].total    += Number(g.monto);
        totalesMap[g.categoria_nombre].cantidad += 1;
      });
      const nuevosTotales = Object.entries(totalesMap)
        .map(([nombre, vals]) => ({ categoria_nombre: nombre, ...vals }))
        .sort((a, b) => b.total - a.total);
      setTotalesPorCat(nuevosTotales);
      console.log('[SeccionGastos] Gasto eliminado correctamente — id:', id);
    } catch (err) {
      console.error('[SeccionGastos] Error al eliminar gasto:', err);
      alert('No se pudo eliminar el gasto. Intentá de nuevo.');
    } finally {
      setEliminando(false);
      setGastoAEliminar(null);
    }
  };

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  /**
   * exportarExcel — genera un .xlsx con dos hojas:
   *   "Gastos": tabla de movimientos del mes
   *   "Totales": resumen por categoría
   */
  const exportarExcel = () => {
    console.log('[SeccionGastos] Exportando Excel — mes:', mes, '| registros:', gastos.length);
    const wb = XLSX.utils.book_new();

    const filas = gastos.map(g => ({
      Fecha:           g.fecha,
      Categoría:       g.categoria_nombre,
      Descripción:     g.descripcion,
      Monto:           Number(g.monto),
      'Forma de pago': g.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Gastos');

    const filasTotales = totalesPorCategoria.map(t => ({
      Categoría:           t.categoria_nombre,
      'Cantidad de gastos': Number(t.cantidad),
      Total:               Number(t.total),
    }));
    filasTotales.push({
      Categoría: 'TOTAL GENERAL',
      'Cantidad de gastos': gastos.length,
      Total: totalGeneral,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTotales), 'Totales');

    XLSX.writeFile(wb, `Gastos_${mes}.xlsx`);
    console.log('[SeccionGastos] Archivo Excel generado: Gastos_' + mes + '.xlsx');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.contenedor}>

      {/* ── Modal de confirmación ── */}
      {gastoAEliminar && (
        <ModalConfirmarEliminar
          gasto={gastoAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setGastoAEliminar(null)}
        />
      )}

      {/* ── Encabezado ── */}
      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Gastos</h2>
          <p style={styles.subtitulo}>Registro mensual de egresos</p>
        </div>
        <button
          style={{
            ...styles.btnExportar,
            ...(gastos.length === 0 ? styles.btnExportarDeshabilitado : {}),
          }}
          onClick={exportarExcel}
          disabled={gastos.length === 0}
        >
          <ExcelIcon /> Exportar Excel
        </button>
      </div>

      {/* ── Selector de mes (centrado) ── */}
      <div style={styles.selectorMes}>
        <button style={styles.btnMes} onClick={() => setMes(m => desplazarMes(m, -1))}>
          ‹
        </button>
        <span style={styles.labelMes}>{mesALabel(mes)}</span>
        <button
          style={{
            ...styles.btnMes,
            ...(mes >= getMesActual() ? styles.btnMesDeshabilitado : {}),
          }}
          onClick={() => setMes(m => desplazarMes(m, +1))}
          disabled={mes >= getMesActual()}
        >
          ›
        </button>
      </div>

      {/* ── Estado: cargando ── */}
      {cargando && (
        <div style={styles.estadoCentrado}>
          <div style={styles.spinner} />
          <p style={styles.estadoTexto}>Cargando gastos...</p>
        </div>
      )}

      {/* ── Estado: error ── */}
      {!cargando && error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* ── Estado: sin datos ── */}
      {!cargando && !error && gastos.length === 0 && (
        <div style={styles.estadoCentrado}>
          <p style={styles.estadoTexto}>No hay gastos registrados en {mesALabel(mes)}.</p>
        </div>
      )}

      {/* ── Tabla de gastos ── */}
      {!cargando && !error && gastos.length > 0 && (
        <>
          <div style={styles.tablaWrapper}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={{ ...styles.th, width: '35%' }}>Descripción</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Forma de pago</th>
                  <th style={styles.thAccion}></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g, i) => (
                  <tr key={g.id} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={styles.td}>{g.fecha}</td>
                    <td style={styles.td}>
                      <span style={styles.badgeCategoria}>{g.categoria_nombre}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#444' }}>{g.descripcion}</td>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#c0392b', whiteSpace: 'nowrap' }}>
                      {formatMonto(g.monto)}
                    </td>
                    <td style={styles.td}>
                      <BadgeFormaPago forma={g.forma_pago} />
                    </td>
                    <td style={styles.tdAccion}>
                      <button
                        style={styles.btnX}
                        onPointerDown={() => setGastoAEliminar(g)}
                        disabled={eliminando}
                        aria-label="Eliminar gasto"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Tabla de totales ── */}
          <div style={styles.totalesWrapper}>
            <h3 style={styles.tituloTotales}>Resumen del mes</h3>
            <table style={styles.tablaTotales}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Categoría</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Cantidad</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {totalesPorCategoria.map((t, i) => (
                  <tr key={t.categoria_nombre} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{t.categoria_nombre}</td>
                    <td style={{ ...styles.td, textAlign: 'center', color: '#666' }}>{t.cantidad}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                      {formatMonto(t.total)}
                    </td>
                  </tr>
                ))}
                <tr style={styles.filaTotalGeneral}>
                  <td style={{ ...styles.tdTotal, textAlign: 'left' }}>Total general</td>
                  <td style={{ ...styles.tdTotal, textAlign: 'center', color: '#888', fontSize: '13px', fontWeight: '500' }}>
                    {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
                  </td>
                  <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#c0392b' }}>
                    {formatMonto(totalGeneral)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ícono Excel (inline SVG) ─────────────────────────────────────────────────
const ExcelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ marginRight: '6px' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    padding: '32px 36px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    maxWidth: '1100px',
  },

  // Encabezado
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '24px',
  },
  titulo: {
    fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px', color: '#888', margin: 0,
  },
  btnExportar: {
    display: 'flex', alignItems: 'center',
    padding: '10px 18px', borderRadius: '10px',
    border: '1.5px solid #1a7a4a', backgroundColor: '#fff',
    color: '#1a7a4a', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnExportarDeshabilitado: {
    borderColor: '#e0e0e0', color: '#bbb', cursor: 'not-allowed',
  },

  // Selector de mes — centrado
  selectorMes: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
    marginBottom: '28px',
  },
  btnMes: {
    width: '36px', height: '36px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#fff',
    fontSize: '20px', color: '#333', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },
  btnMesDeshabilitado: {
    color: '#ccc', cursor: 'not-allowed', borderColor: '#f0f0f0',
  },
  labelMes: {
    fontSize: '17px', fontWeight: '600', color: '#111',
    minWidth: '160px', textAlign: 'center',
  },

  // Tabla principal
  tablaWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', marginBottom: '32px',
    overflowX: 'auto',
  },
  tabla: {
    width: '100%', borderCollapse: 'collapse', fontSize: '14px',
  },
  th: {
    padding: '13px 16px', backgroundColor: '#fafafa',
    color: '#888', fontWeight: '600', fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'left', borderBottom: '1.5px solid #eeeeee',
    whiteSpace: 'nowrap',
  },
  thAccion: {
    padding: '13px 16px', width: '48px',
    borderBottom: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px', color: '#333',
    borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
    fontSize: '14px',
  },
  tdAccion: {
    padding: '8px 12px', textAlign: 'center',
    borderBottom: '1px solid #f0f0f0',
  },
  filaImpar: { backgroundColor: '#ffffff' },
  filaPar:   { backgroundColor: '#fafafa' },

  // Botón X — idéntico a SeccionCaja
  btnX: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #f5c6c6', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },

  // Badge categoría
  badgeCategoria: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '500',
    backgroundColor: '#f3f4f6', color: '#374151',
  },

  // Badge forma de pago
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '600',
  },

  // Tabla totales
  totalesWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', maxWidth: '520px',
  },
  tituloTotales: {
    fontSize: '15px', fontWeight: '700', color: '#111',
    margin: '0', padding: '14px 16px', backgroundColor: '#fafafa',
    borderBottom: '1.5px solid #eeeeee',
  },
  tablaTotales: {
    width: '100%', borderCollapse: 'collapse', fontSize: '14px',
  },
  filaTotalGeneral: {
    backgroundColor: '#fff8f8', borderTop: '2px solid #e8e8e8',
  },
  tdTotal: {
    padding: '14px 16px', fontWeight: '700', fontSize: '15px', color: '#111',
  },

  // Estados
  estadoCentrado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 0', gap: '16px',
  },
  estadoTexto: {
    fontSize: '15px', color: '#888', margin: 0,
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

  // Modal — idéntico a SeccionCaja
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
