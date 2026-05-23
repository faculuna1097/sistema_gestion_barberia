// /frontend/src/screens/admin/sections/SeccionVentas.jsx

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../../services/api';
import SelectorMes from '../../../components/SelectorMes';
import BadgeFormaPago from '../../../components/BadgeFormaPago';
import BotonExportarExcel from '../../../components/BotonExportarExcel';
import { mesALabel, getMesActual } from '../../../utils/fechas';
import { formatARS } from '../../../utils/formatos';

function ModalEditarVenta({ venta, form, onChange, onGuardar, onCancelar, guardando, errorEditar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalCard, width: '480px' }}>
        <p style={styles.modalTitulo}>Editar venta</p>
        <p style={styles.modalSubtitulo}>Fecha original: {venta.fecha}</p>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Producto</label>
          <div style={styles.campoFijo}>{venta.producto_nombre}</div>
        </div>

        <div style={styles.formFila}>
          <div style={{ ...styles.formGrupo, flex: 1 }}>
            <label style={styles.formLabel}>Cantidad</label>
            <input
              type="number"
              min="1"
              style={styles.input}
              value={form.cantidad}
              onChange={e => onChange('cantidad', e.target.value)}
            />
          </div>
          <div style={{ ...styles.formGrupo, flex: 1 }}>
            <label style={styles.formLabel}>Precio unitario</label>
            <div style={styles.campoFijo}>{formatARS(form.precio_unitario)}</div>
          </div>
        </div>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Forma de pago</label>
          <select
            style={styles.select}
            value={form.forma_pago}
            onChange={e => onChange('forma_pago', e.target.value)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="mercado_pago">Mercado Pago</option>
          </select>
        </div>

        {Number(form.cantidad) > 0 && (
          <div style={styles.totalPreview}>
            <span style={styles.totalPreviewLabel}>Total calculado</span>
            <span style={styles.totalPreviewValor}>
              {formatARS(Number(form.cantidad) * Number(form.precio_unitario))}
            </span>
          </div>
        )}

        {errorEditar && (
          <div style={styles.errorModal}>{errorEditar}</div>
        )}

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnGuardar, ...(guardando ? styles.btnGuardarDeshabilitado : {}) }}
            onPointerDown={onGuardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmarEliminar({ venta, onConfirmar, onCancelar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar esta venta?</p>
        <p style={styles.modalAdvertencia}>Esta acción no se puede deshacer. El stock será restaurado.</p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Fecha</span>
            <span style={styles.modalValor}>{venta.fecha}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Producto</span>
            <span style={styles.modalValor}>{venta.producto_nombre}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Cantidad</span>
            <span style={styles.modalValor}>{venta.cantidad}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Total</span>
            <span style={{ ...styles.modalValor, color: '#1a7a4a', fontWeight: '700' }}>
              {formatARS(venta.total)}
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

export default function SeccionVentas() {
  const [mes, setMes]                           = useState(getMesActual);
  const [ventas, setVentas]                     = useState([]);
  const [totalesPorProducto, setTotalesPorProd] = useState([]);
  const [totalGeneral, setTotalGeneral]         = useState(0);
  const [cargando, setCargando]                 = useState(false);
  const [error, setError]                       = useState(null);
  const [ventaAEliminar, setVentaAEliminar]     = useState(null);
  const [eliminando, setEliminando]             = useState(false);
  const [ventaAEditar, setVentaAEditar]         = useState(null);
  const [formEditar, setFormEditar]             = useState({});
  const [guardando, setGuardando]               = useState(false);
  const [errorEditar, setErrorEditar]           = useState(null);

  useEffect(() => {
    const cargarVentas = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch(`/ventas/mensual?mes=${mes}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setVentas(data.ventas);
        setTotalesPorProd(data.totalesPorProducto);
        setTotalGeneral(data.totalGeneral);
      } catch (err) {
        console.error('[seccionVentas] Error en cargarVentas:', err.message);
        setError('No se pudieron cargar las ventas. Intentá de nuevo.');
      } finally {
        setCargando(false);
      }
    };
    cargarVentas();
  }, [mes]);

  const abrirEditar = (v) => {
    setErrorEditar(null);
    setFormEditar({
      producto_id:     v.producto_id,
      cantidad:        v.cantidad,
      precio_unitario: v.precio_unitario,
      forma_pago:      v.forma_pago,
    });
    setVentaAEditar(v);
  };

  const handleChangeForm = (campo, valor) => {
    setFormEditar(f => ({ ...f, [campo]: valor }));
  };

  const confirmarEditar = async () => {
    const { id } = ventaAEditar;
    if (Number(formEditar.cantidad) <= 0 || Number(formEditar.precio_unitario) <= 0) {
      setErrorEditar('Completá todos los campos correctamente.');
      return;
    }

    setGuardando(true);
    setErrorEditar(null);
    try {
      const res = await apiFetch(`/ventas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          producto_id:     formEditar.producto_id,
          cantidad:        Number(formEditar.cantidad),
          precio_unitario: Number(formEditar.precio_unitario),
          forma_pago:      formEditar.forma_pago,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const nuevoTotal = Number(formEditar.cantidad) * Number(formEditar.precio_unitario);

      const nuevasVentas = ventas.map(v => v.id === id ? {
        ...v,
        cantidad:        Number(formEditar.cantidad),
        precio_unitario: Number(formEditar.precio_unitario),
        total:           nuevoTotal,
        forma_pago:      formEditar.forma_pago,
      } : v);

      setVentas(nuevasVentas);

      const totalGen = nuevasVentas.reduce((acc, v) => acc + Number(v.total), 0);
      setTotalGeneral(totalGen);

      const totalesMap = {};
      nuevasVentas.forEach(v => {
        if (!totalesMap[v.producto_nombre])
          totalesMap[v.producto_nombre] = { cantidad_total: 0, monto_total: 0 };
        totalesMap[v.producto_nombre].cantidad_total += Number(v.cantidad);
        totalesMap[v.producto_nombre].monto_total    += Number(v.total);
      });
      const nuevosTotales = Object.entries(totalesMap)
        .map(([nombre, vals]) => ({ producto_nombre: nombre, ...vals }))
        .sort((a, b) => b.monto_total - a.monto_total);
      setTotalesPorProd(nuevosTotales);

      setVentaAEditar(null);
    } catch (err) {
      console.error('[seccionVentas] Error en confirmarEditar:', err.message);
      setErrorEditar(err.message || 'No se pudo editar la venta. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    const { id } = ventaAEliminar;
    setEliminando(true);
    try {
      const res = await apiFetch(`/ventas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error del servidor');
      const nuevasVentas = ventas.filter(v => v.id !== id);
      setVentas(nuevasVentas);
      const nuevoTotal = nuevasVentas.reduce((acc, v) => acc + Number(v.total), 0);
      setTotalGeneral(nuevoTotal);
      const totalesMap = {};
      nuevasVentas.forEach(v => {
        if (!totalesMap[v.producto_nombre])
          totalesMap[v.producto_nombre] = { cantidad_total: 0, monto_total: 0 };
        totalesMap[v.producto_nombre].cantidad_total += Number(v.cantidad);
        totalesMap[v.producto_nombre].monto_total    += Number(v.total);
      });
      const nuevosTotales = Object.entries(totalesMap)
        .map(([nombre, vals]) => ({ producto_nombre: nombre, ...vals }))
        .sort((a, b) => b.monto_total - a.monto_total);
      setTotalesPorProd(nuevosTotales);
    } catch (err) {
      console.error('[seccionVentas] Error en confirmarEliminar:', err.message);
    } finally {
      setEliminando(false);
      setVentaAEliminar(null);
    }
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const filas = ventas.map(v => ({
      Fecha:             v.fecha,
      Producto:          v.producto_nombre,
      Cantidad:          Number(v.cantidad),
      'Precio unitario': Number(v.precio_unitario),
      Total:             Number(v.total),
      'Forma de pago':   v.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Ventas');
    const filasTotales = totalesPorProducto.map(t => ({
      Producto:             t.producto_nombre,
      'Unidades vendidas':  Number(t.cantidad_total),
      Total:                Number(t.monto_total),
    }));
    filasTotales.push({
      Producto:            'TOTAL GENERAL',
      'Unidades vendidas': ventas.reduce((acc, v) => acc + Number(v.cantidad), 0),
      Total:               totalGeneral,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTotales), 'Totales');
    XLSX.writeFile(wb, `Ventas_${mes}.xlsx`);
  };

  return (
    <div style={styles.contenedor}>

      {ventaAEditar && (
        <ModalEditarVenta
          venta={ventaAEditar}
          form={formEditar}
          onChange={handleChangeForm}
          onGuardar={confirmarEditar}
          onCancelar={() => setVentaAEditar(null)}
          guardando={guardando}
          errorEditar={errorEditar}
        />
      )}

      {ventaAEliminar && (
        <ModalConfirmarEliminar
          venta={ventaAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setVentaAEliminar(null)}
        />
      )}

      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Ventas</h2>
          <p style={styles.subtitulo}>Productos vendidos por mes</p>
        </div>
      </div>

      <div style={styles.selectorMesWrapper}>
        <div />
        <SelectorMes value={mes} onChange={setMes} />
        <div style={{ justifySelf: 'end' }}>
          <BotonExportarExcel onPointerDown={exportarExcel} disabled={ventas.length === 0} />
        </div>
      </div>

      {cargando && (
        <div style={styles.estadoCentrado}>
          <div style={styles.spinner} />
          <p style={styles.estadoTexto}>Cargando ventas...</p>
        </div>
      )}

      {!cargando && error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {!cargando && !error && ventas.length === 0 && (
        <div style={styles.estadoCentrado}>
          <p style={styles.estadoTexto}>No hay ventas de productos registradas en {mesALabel(mes)}.</p>
        </div>
      )}

      {!cargando && !error && ventas.length > 0 && (
        <>
          <div style={styles.tablaWrapper}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Producto</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Cantidad</th>
                  <th style={styles.th}>Precio unitario</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Forma de pago</th>
                  <th style={styles.thAccion}></th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v, i) => (
                  <tr key={v.id} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={styles.td}>{v.fecha}</td>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{v.producto_nombre}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{v.cantidad}</td>
                    <td style={styles.td}>{formatARS(v.precio_unitario)}</td>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#1a7a4a', whiteSpace: 'nowrap' }}>
                      {formatARS(v.total)}
                    </td>
                    <td style={styles.td}><BadgeFormaPago forma={v.forma_pago} /></td>
                    <td style={styles.tdAccion}>
                      <div style={styles.accionBotones}>
                        <button
                          style={styles.btnEditar}
                          onPointerDown={() => abrirEditar(v)}
                          disabled={eliminando || guardando}
                          aria-label="Editar venta"
                        >✎</button>
                        <button
                          style={styles.btnX}
                          onPointerDown={() => setVentaAEliminar(v)}
                          disabled={eliminando || guardando}
                          aria-label="Eliminar venta"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={styles.filaTotalGeneral}>
                  <td colSpan={4} style={{ ...styles.tdTotal, textAlign: 'left' }}>Total del mes</td>
                  <td style={{ ...styles.tdTotal, color: '#1a7a4a' }}>{formatARS(totalGeneral)}</td>
                  <td style={styles.tdTotal} />
                  <td style={styles.tdTotal} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={styles.totalesWrapper}>
            <h3 style={styles.tituloTotales}>Resumen del mes</h3>
            <table style={styles.tablaTotales}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Producto</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Unidades</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {totalesPorProducto.map((t, i) => (
                  <tr key={t.producto_nombre} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{t.producto_nombre}</td>
                    <td style={{ ...styles.td, textAlign: 'center', color: '#666' }}>{t.cantidad_total}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                      {formatARS(t.monto_total)}
                    </td>
                  </tr>
                ))}
                <tr style={styles.filaTotalGeneral}>
                  <td style={{ ...styles.tdTotal, textAlign: 'left' }}>Total general</td>
                  <td style={{ ...styles.tdTotal, textAlign: 'center', color: '#888', fontSize: '13px', fontWeight: '500' }}>
                    {ventas.reduce((acc, v) => acc + Number(v.cantidad), 0)} unidades
                  </td>
                  <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#1a7a4a' }}>
                    {formatARS(totalGeneral)}
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

const styles = {
  contenedor: {
    padding: '32px 36px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '24px',
  },
  titulo:    { fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px' },
  subtitulo: { fontSize: '14px', color: '#888', margin: 0 },
  tablaWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', marginBottom: '32px', overflowX: 'auto',
  },
  selectorMesWrapper: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    padding: '13px 16px', backgroundColor: '#fafafa',
    color: '#888', fontWeight: '600', fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'left', borderBottom: '1.5px solid #eeeeee', whiteSpace: 'nowrap',
  },
  thAccion: {
    padding: '13px 12px', width: '80px',
    borderBottom: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px', color: '#333',
    borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle', fontSize: '14px',
  },
  tdAccion: {
    padding: '8px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
  },
  accionBotones: {
    display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
  },
  filaImpar: { backgroundColor: '#ffffff' },
  filaPar:   { backgroundColor: '#fafafa' },
  btnEditar: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #c5dcf5', backgroundColor: '#f0f6ff',
    color: '#1565c0', fontSize: '15px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  btnX: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #f5c6c6', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  totalesWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', maxWidth: '520px',
  },
  tituloTotales: {
    fontSize: '15px', fontWeight: '700', color: '#111',
    margin: '0', padding: '14px 16px', backgroundColor: '#fafafa',
    borderBottom: '1.5px solid #eeeeee',
  },
  tablaTotales:     { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  filaTotalGeneral: { backgroundColor: '#f0faf5', borderTop: '2px solid #e8e8e8' },
  tdTotal:          { padding: '14px 16px', fontWeight: '700', fontSize: '15px', color: '#111' },
  estadoCentrado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 0', gap: '16px',
  },
  estadoTexto: { fontSize: '15px', color: '#888', margin: 0 },
  errorBox: {
    padding: '16px 20px', borderRadius: '10px',
    backgroundColor: '#fdecea', color: '#c0392b',
    fontSize: '14px', marginBottom: '16px',
  },
  errorModal: {
    padding: '10px 14px', borderRadius: '8px',
    backgroundColor: '#fdecea', color: '#c0392b',
    fontSize: '13px', marginBottom: '16px', textAlign: 'center',
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid #e8e8e8', borderTopColor: '#1a7a4a',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
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
  modalSubtitulo: {
    fontSize: '13px', color: '#888', textAlign: 'center', margin: '0 0 20px',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: '0 0 24px',
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
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
  formGrupo:   { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' },
  formFila:    { display: 'flex', gap: '12px' },
  formLabel: {
    fontSize: '11px', fontWeight: '600', color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '14px',
    fontFamily: 'inherit', color: '#111', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '14px',
    fontFamily: 'inherit', color: '#111', outline: 'none',
    backgroundColor: '#fff', width: '100%', boxSizing: 'border-box',
  },
  totalPreview: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderRadius: '10px',
    backgroundColor: '#f0faf5', border: '1.5px solid #c8e6d4',
    marginBottom: '20px',
  },
  totalPreviewLabel: { fontSize: '13px', color: '#555', fontWeight: '500' },
  totalPreviewValor: { fontSize: '17px', fontWeight: '700', color: '#1a7a4a' },
  btnGuardar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#1a7a4a',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnGuardarDeshabilitado: { backgroundColor: '#a8cdb8', cursor: 'not-allowed' },
  campoFijo: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #f0f0f0', backgroundColor: '#fafafa',
    fontSize: '14px', color: '#555', fontFamily: 'inherit',
  },
};