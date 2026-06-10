// /frontend/src/screens/admin/sections/SeccionVentas.jsx
//
// Sección Ventas del panel de administrador.
// Lista las ventas de productos del mes seleccionado con edición y
// eliminación por fila, más una tabla de resumen por producto.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// Fondo lo da PanelAdmin (theme.surfaceAlt, D7). Loading via LoadingState (D6).
// DataTable se posterga hasta tener un caso con sort/filtros reales (deuda #20).

import { useState, useEffect } from 'react';
import { Pencil, Trash2, Package, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { mesALabel, getMesActual } from '../../../utils/fecha';
import { fmtPesos } from '../../../utils/formato';
import { cargarChunk } from '../../../utils/cargarChunk';
import {
  ScreenHeader,
  LoadingState,
  EmptyState,
  Toast,
  ConfirmDialog,
  Modal,
  Select,
  Button,
  Field,
  BotonIconoFila,
  DetalleRecurso,
  IconoAlerta,
  BadgeFormaPago,
  BotonExportarExcel,
  SelectorMes,
} from '../../../components/ui';
import { theme } from '../../../theme/tokens.js';

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * CampoFijo
 * Display de valor no editable con estética de input deshabilitado. Local —
 * único en Ventas hoy (Producto + Precio unitario en el modal de edición).
 * Promover a primitivo si aparece un segundo uso fuera de esta sección.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {ReactNode} props.children
 * @param {boolean} [props.numeric]
 */
function CampoFijo({ label, children, numeric }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</span>
      <div style={{
        padding: '12px 14px',
        background: theme.surfaceAlt,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: 15,
        color: theme.muted,
        fontVariantNumeric: numeric ? 'tabular-nums' : 'normal',
      }}>{children}</div>
    </div>
  );
}

/**
 * TablaVentas
 * Tabla densa con detalle por venta + footer "Total del mes" en theme.accent.
 *
 * @param {object} props
 * @param {Array} props.ventas
 * @param {number} props.totalGeneral
 * @param {(v: object) => void} props.onEditar
 * @param {(v: object) => void} props.onEliminar
 * @param {boolean} props.accionesDeshabilitadas
 */
function TablaVentas({ ventas, totalGeneral, onEditar, onEliminar, accionesDeshabilitadas }) {
  const columnas = [
    { label: 'Fecha',           align: 'left'   },
    { label: 'Producto',        align: 'left'   },
    { label: 'Cantidad',        align: 'center' },
    { label: 'Precio unitario', align: 'right'  },
    { label: 'Total',           align: 'right'  },
    { label: 'Forma de pago',   align: 'left'   },
    { label: '',                align: 'center', width: 88 },
  ];

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                fontWeight: theme.weightHeading,
                color: theme.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: `1px solid ${theme.hairline}`,
                textAlign: c.align,
                whiteSpace: 'nowrap',
                width: c.width,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => {
            const tdBase = {
              padding: '10px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.ink,
              borderBottom: `1px solid ${theme.hairlineSoft}`,
              verticalAlign: 'middle',
            };
            return (
              <tr key={v.id} className="om-fila-hover">
                <td style={{ ...tdBase, color: theme.muted, whiteSpace: 'nowrap' }}>{v.fecha}</td>
                <td style={{ ...tdBase, fontWeight: theme.weightMedium }}>{v.producto_nombre}</td>
                <td style={{ ...tdBase, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{v.cantidad}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPesos(v.precio_unitario)}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: theme.weightHeading, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPesos(v.total)}</td>
                <td style={tdBase}><BadgeFormaPago forma={v.forma_pago} /></td>
                <td style={{ ...tdBase, padding: '6px 8px', textAlign: 'center', width: 88 }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <BotonIconoFila
                      tono="accent"
                      icono={<Pencil size={14} strokeWidth={1.75} />}
                      ariaLabel={`Editar venta de ${v.producto_nombre}`}
                      onClick={() => onEditar(v)}
                      disabled={accionesDeshabilitadas}
                    />
                    <BotonIconoFila
                      tono="danger"
                      icono={<Trash2 size={14} strokeWidth={1.75} />}
                      ariaLabel={`Eliminar venta de ${v.producto_nombre}`}
                      onClick={() => onEliminar(v)}
                      disabled={accionesDeshabilitadas}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{
              padding: '14px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightHeading,
              color: theme.ink,
              borderTop: `2px solid ${theme.accent}`,
              textAlign: 'left',
            }}>Total del mes</td>
            <td style={{
              padding: '14px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightHeading,
              color: theme.accent,
              borderTop: `2px solid ${theme.accent}`,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>{fmtPesos(totalGeneral)}</td>
            <td colSpan={2} style={{
              borderTop: `2px solid ${theme.accent}`,
            }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * TablaResumen
 * Tabla densa secundaria con unidades y monto por producto. Footer
 * "Total general" en theme.accent. Ancho acotado (subordinada a la principal).
 *
 * @param {object} props
 * @param {Array} props.totales - [{ producto_nombre, cantidad_total, monto_total }]
 * @param {number} props.totalGeneral
 * @param {number} props.cantidadTotal
 */
function TablaResumen({ totales, totalGeneral, cantidadTotal }) {
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      overflow: 'hidden',
      maxWidth: 560,
    }}>
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${theme.hairline}`,
        fontFamily: theme.body,
        fontSize: theme.sizeHeading,
        fontWeight: theme.weightHeading,
        color: theme.ink,
        letterSpacing: '-0.01em',
      }}>Resumen del mes</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[
              { label: 'Producto', align: 'left'   },
              { label: 'Unidades', align: 'center' },
              { label: 'Total',    align: 'right'  },
            ].map((c, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                fontWeight: theme.weightHeading,
                color: theme.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: `1px solid ${theme.hairline}`,
                textAlign: c.align,
                whiteSpace: 'nowrap',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {totales.map((t) => {
            const tdBase = {
              padding: '10px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.ink,
              borderBottom: `1px solid ${theme.hairlineSoft}`,
            };
            return (
              <tr key={t.producto_nombre}>
                <td style={{ ...tdBase, fontWeight: theme.weightMedium }}>{t.producto_nombre}</td>
                <td style={{ ...tdBase, textAlign: 'center', color: theme.muted, fontVariantNumeric: 'tabular-nums' }}>{t.cantidad_total}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: theme.weightHeading, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPesos(t.monto_total)}</td>
              </tr>
            );
          })}
          <tr>
            <td style={{
              padding: '14px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightHeading,
              color: theme.ink,
              borderTop: `2px solid ${theme.accent}`,
              textAlign: 'left',
            }}>Total general</td>
            <td style={{
              padding: '14px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
              borderTop: `2px solid ${theme.accent}`,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>{cantidadTotal} unidades</td>
            <td style={{
              padding: '14px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightHeading,
              color: theme.accent,
              borderTop: `2px solid ${theme.accent}`,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>{fmtPesos(totalGeneral)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal de edición ─────────────────────────────────────────────────────────

const OPCIONES_FORMA_PAGO = [
  { value: 'efectivo',     label: 'Efectivo' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

/**
 * ModalEditarVenta
 * Modal de edición de venta. Usa el primitivo `Modal`. Producto y precio
 * unitario no son editables (la venta se "edita" sólo en cantidad y forma
 * de pago — preserva precio original).
 */
function ModalEditarVenta({ open, venta, form, onChange, onGuardar, onCancelar, guardando, errorEditar }) {
  const totalCalculado = venta && Number(form.cantidad) > 0
    ? Number(form.cantidad) * Number(form.precio_unitario)
    : null;

  return (
    <Modal
      open={open}
      onClose={onCancelar}
      loading={guardando}
      title="Editar venta"
      subtitle={venta ? `Fecha original: ${venta.fecha}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      {venta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CampoFijo label="Producto">{venta.producto_nombre}</CampoFijo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field
              label="Cantidad"
              type="number"
              value={form.cantidad}
              onChange={(v) => onChange('cantidad', v)}
            />
            <CampoFijo label="Precio unitario" numeric>{fmtPesos(form.precio_unitario)}</CampoFijo>
          </div>

          <Select
            label="Forma de pago"
            value={form.forma_pago}
            onChange={(v) => onChange('forma_pago', v)}
            options={OPCIONES_FORMA_PAGO}
          />

          {totalCalculado !== null && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: theme.radius,
              background: theme.accentSoft,
              border: `1px solid ${theme.accentSoft}`,
            }}>
              <span style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: theme.inkSoft,
              }}>Total calculado</span>
              <span style={{
                fontFamily: theme.body,
                fontSize: theme.sizeHeading,
                fontWeight: theme.weightHeading,
                color: theme.accent,
                fontVariantNumeric: 'tabular-nums',
              }}>{fmtPesos(totalCalculado)}</span>
            </div>
          )}

          {errorEditar && (
            <div style={{
              padding: '10px 12px',
              borderRadius: theme.radius,
              background: theme.dangerSoft,
              color: theme.danger,
              fontFamily: theme.body,
              fontSize: 13,
              textAlign: 'center',
            }}>{errorEditar}</div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

/**
 * SeccionVentas
 * Vista principal de Ventas. Carga las ventas del mes, las muestra en una
 * tabla densa con acciones editar/eliminar por fila y agrega una tabla de
 * resumen por producto. Permite exportar a Excel.
 */
export default function SeccionVentas() {
  const [mes, setMes]                           = useState(getMesActual);
  const [ventas, setVentas]                     = useState([]);
  const [totalesPorProducto, setTotalesPorProd] = useState([]);
  const [totalGeneral, setTotalGeneral]         = useState(0);
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [intento, setIntento]                   = useState(0);
  const [ventaAEliminar, setVentaAEliminar]     = useState(null);
  const [eliminando, setEliminando]             = useState(false);
  const [ventaAEditar, setVentaAEditar]         = useState(null);
  const [formEditar, setFormEditar]             = useState({});
  const [guardando, setGuardando]               = useState(false);
  const [errorEditar, setErrorEditar]           = useState(null);
  const [errorExport, setErrorExport]           = useState(null);

  // Carga de ventas del mes. `intento` re-dispara el efecto en "Reintentar".
  useEffect(() => {
    let cancelado = false;
    const cargarVentas = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await apiFetch(`/ventas/mensual?mes=${mes}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelado) return;
        setVentas(data.ventas);
        setTotalesPorProd(data.totalesPorProducto);
        setTotalGeneral(data.totalGeneral);
      } catch (err) {
        console.error('[seccionVentas] Error en cargarVentas:', err.message);
        if (!cancelado) setError('No se pudieron cargar las ventas. Intentá de nuevo.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarVentas();
    return () => { cancelado = true; };
  }, [mes, intento]);

  /**
   * Recalcula totales (general y por producto) localmente a partir de la
   * lista de ventas. Se usa tras editar o eliminar para no pegarle al server.
   * @param {Array} lista
   * @returns {{ totalGen: number, totalesOrdenados: Array }}
   */
  const recalcularTotales = (lista) => {
    const totalGen = lista.reduce((acc, v) => acc + Number(v.total), 0);
    const totalesMap = {};
    lista.forEach((v) => {
      if (!totalesMap[v.producto_nombre]) {
        totalesMap[v.producto_nombre] = { cantidad_total: 0, monto_total: 0 };
      }
      totalesMap[v.producto_nombre].cantidad_total += Number(v.cantidad);
      totalesMap[v.producto_nombre].monto_total    += Number(v.total);
    });
    const totalesOrdenados = Object.entries(totalesMap)
      .map(([nombre, vals]) => ({ producto_nombre: nombre, ...vals }))
      .sort((a, b) => b.monto_total - a.monto_total);
    return { totalGen, totalesOrdenados };
  };

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
    setFormEditar((f) => ({ ...f, [campo]: valor }));
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
      const nuevasVentas = ventas.map((v) => v.id === id ? {
        ...v,
        cantidad:        Number(formEditar.cantidad),
        precio_unitario: Number(formEditar.precio_unitario),
        total:           nuevoTotal,
        forma_pago:      formEditar.forma_pago,
      } : v);
      const { totalGen, totalesOrdenados } = recalcularTotales(nuevasVentas);
      setVentas(nuevasVentas);
      setTotalGeneral(totalGen);
      setTotalesPorProd(totalesOrdenados);
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
      const nuevasVentas = ventas.filter((v) => v.id !== id);
      const { totalGen, totalesOrdenados } = recalcularTotales(nuevasVentas);
      setVentas(nuevasVentas);
      setTotalGeneral(totalGen);
      setTotalesPorProd(totalesOrdenados);
    } catch (err) {
      console.error('[seccionVentas] Error en confirmarEliminar:', err.message);
    } finally {
      setEliminando(false);
      setVentaAEliminar(null);
    }
  };

  const exportarExcel = async () => {
    // El chunk de xlsx se baja recién acá (lazy, #3). Si la descarga falla
    // (red caída / hash viejo post-redeploy), cargarChunk lo convierte en un
    // error con mensaje al usuario en vez de un unhandled rejection silencioso.
    let XLSX;
    try {
      XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    } catch (err) {
      setErrorExport(err.message);
      return;
    }
    const wb = XLSX.utils.book_new();
    const filas = ventas.map((v) => ({
      Fecha:             v.fecha,
      Producto:          v.producto_nombre,
      Cantidad:          Number(v.cantidad),
      'Precio unitario': Number(v.precio_unitario),
      Total:             Number(v.total),
      'Forma de pago':   v.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Ventas');

    const filasTotales = totalesPorProducto.map((t) => ({
      Producto:            t.producto_nombre,
      'Unidades vendidas': Number(t.cantidad_total),
      Total:               Number(t.monto_total),
    }));
    filasTotales.push({
      Producto:            'TOTAL GENERAL',
      'Unidades vendidas': ventas.reduce((acc, v) => acc + Number(v.cantidad), 0),
      Total:               totalGeneral,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTotales), 'Totales');
    XLSX.writeFile(wb, `Ventas_${mes}.xlsx`);
  };

  const cantidadTotal = ventas.reduce((acc, v) => acc + Number(v.cantidad), 0);
  const accionesDeshabilitadas = eliminando || guardando;

  // Filas del ConfirmDialog de delete — armado en el render para que el
  // primitivo DetalleRecurso reciba el shape exacto que necesita.
  const filasDelete = ventaAEliminar ? [
    { label: 'Fecha',    valor: ventaAEliminar.fecha },
    { label: 'Producto', valor: ventaAEliminar.producto_nombre },
    { label: 'Cantidad', valor: String(ventaAEliminar.cantidad), numeric: true },
    {
      label: 'Total',
      valor: fmtPesos(ventaAEliminar.total),
      numeric: true,
      valorColor: theme.accent,
      valorWeight: theme.weightHeading,
    },
  ] : [];

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Ventas" subtitle="Productos vendidos por mes" />

      <ConfirmDialog
        open={!!ventaAEliminar}
        title="¿Eliminar esta venta?"
        message="Esta acción no se puede deshacer. El stock será restaurado."
        confirmLabel="Sí, eliminar"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setVentaAEliminar(null)}
      >
        {ventaAEliminar && <DetalleRecurso filas={filasDelete} />}
      </ConfirmDialog>

      <ModalEditarVenta
        open={!!ventaAEditar}
        venta={ventaAEditar}
        form={formEditar}
        onChange={handleChangeForm}
        onGuardar={confirmarEditar}
        onCancelar={() => setVentaAEditar(null)}
        guardando={guardando}
        errorEditar={errorEditar}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
      }}>
        <div />
        <SelectorMes value={mes} onChange={setMes} />
        <div style={{ justifySelf: 'end' }}>
          <BotonExportarExcel onClick={exportarExcel} disabled={ventas.length === 0} />
        </div>
      </div>

      {errorExport && (
        <Toast tone="danger" dismissible onDismiss={() => setErrorExport(null)}>
          {errorExport}
        </Toast>
      )}

      {cargando ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          tone="danger"
          glyph={<IconoAlerta />}
          title="No se pudo cargar"
          body={error}
          action={
            <Button variant="secondary" full={false} onClick={() => setIntento((n) => n + 1)}>
              <RefreshCw size={16} strokeWidth={1.75} />
              Reintentar
            </Button>
          }
        />
      ) : ventas.length === 0 ? (
        <EmptyState
          glyph={<Package size={28} strokeWidth={1.5} />}
          title="Sin ventas"
          body={`No hay ventas de productos registradas en ${mesALabel(mes)}.`}
        />
      ) : (
        <>
          <TablaVentas
            ventas={ventas}
            totalGeneral={totalGeneral}
            onEditar={abrirEditar}
            onEliminar={setVentaAEliminar}
            accionesDeshabilitadas={accionesDeshabilitadas}
          />
          <TablaResumen
            totales={totalesPorProducto}
            totalGeneral={totalGeneral}
            cantidadTotal={cantidadTotal}
          />
        </>
      )}
    </div>
  );
}
