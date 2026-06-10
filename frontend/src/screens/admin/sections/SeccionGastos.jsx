// /frontend/src/screens/admin/sections/SeccionGastos.jsx
//
// Sección Gastos del panel de administrador.
// Lista los gastos del mes seleccionado con edición y eliminación por fila,
// más una tabla de resumen por categoría.
//
// Espejo estructural de SeccionVentas — comparten primitivos:
//   Modal, Select, BotonIconoFila, DetalleRecurso (todos en /ui).
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// Fondo lo da PanelAdmin (theme.surfaceAlt, D7). Loading via LoadingState (D6).
// Monto por fila en theme.danger (semántica de egreso, consistente con
// la fila de gasto en SeccionCaja). Total del mes y resumen en theme.accent.

import { useState, useEffect } from 'react';
import { Pencil, Trash2, Receipt, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { mesALabel, getMesActual } from '../../../utils/fecha';
import { fmtPesos } from '../../../utils/formato';
import {
  ScreenHeader,
  LoadingState,
  EmptyState,
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
 * BadgeCategoria
 * Pill neutro tipo tag para mostrar la categoría en cada fila. Estilos de
 * tokens (`surfaceAlt`/`inkSoft`), sin border. Local — promover si aparece
 * un segundo uso fuera de Gastos.
 *
 * @param {object} props
 * @param {string} props.nombre
 */
function BadgeCategoria({ nombre }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      background: theme.surfaceAlt,
      color: theme.inkSoft,
    }}>{nombre}</span>
  );
}

/**
 * TablaGastos
 * Tabla densa con detalle por gasto + footer "Total del mes" en theme.accent.
 * Monto por fila en theme.danger (egreso). Hover scoped (#21).
 *
 * @param {object} props
 * @param {Array} props.gastos
 * @param {number} props.totalGeneral
 * @param {(g: object) => void} props.onEditar
 * @param {(g: object) => void} props.onEliminar
 * @param {boolean} props.accionesDeshabilitadas
 */
function TablaGastos({ gastos, totalGeneral, onEditar, onEliminar, accionesDeshabilitadas }) {
  const columnas = [
    { label: 'Fecha',         align: 'left'   },
    { label: 'Categoría',     align: 'left'   },
    { label: 'Descripción',   align: 'left'   },
    { label: 'Monto',         align: 'right'  },
    { label: 'Forma de pago', align: 'left'   },
    { label: '',              align: 'center', width: 88 },
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
          {gastos.map((g) => {
            const tdBase = {
              padding: '10px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.ink,
              borderBottom: `1px solid ${theme.hairlineSoft}`,
              verticalAlign: 'middle',
            };
            return (
              <tr key={g.id} className="om-fila-hover">
                <td style={{ ...tdBase, color: theme.muted, whiteSpace: 'nowrap' }}>{g.fecha}</td>
                <td style={tdBase}><BadgeCategoria nombre={g.categoria_nombre} /></td>
                <td style={{ ...tdBase, color: theme.inkSoft }}>{g.descripcion}</td>
                <td style={{
                  ...tdBase,
                  textAlign: 'right',
                  fontWeight: theme.weightHeading,
                  color: theme.danger,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}>{fmtPesos(g.monto)}</td>
                <td style={tdBase}><BadgeFormaPago forma={g.forma_pago} /></td>
                <td style={{ ...tdBase, padding: '6px 8px', textAlign: 'center', width: 88 }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <BotonIconoFila
                      tono="accent"
                      icono={<Pencil size={14} strokeWidth={1.75} />}
                      ariaLabel={`Editar gasto ${g.descripcion}`}
                      onClick={() => onEditar(g)}
                      disabled={accionesDeshabilitadas}
                    />
                    <BotonIconoFila
                      tono="danger"
                      icono={<Trash2 size={14} strokeWidth={1.75} />}
                      ariaLabel={`Eliminar gasto ${g.descripcion}`}
                      onClick={() => onEliminar(g)}
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
            <td colSpan={3} style={{
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
 * Tabla densa secundaria con cantidad de gastos y monto por categoría.
 *
 * @param {object} props
 * @param {Array} props.totales - [{ categoria_nombre, cantidad, total }]
 * @param {number} props.totalGeneral
 * @param {number} props.cantidadGastos - Cantidad total de filas
 */
function TablaResumen({ totales, totalGeneral, cantidadGastos }) {
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
              { label: 'Categoría', align: 'left'   },
              { label: 'Cantidad',  align: 'center' },
              { label: 'Total',     align: 'right'  },
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
              <tr key={t.categoria_nombre}>
                <td style={{ ...tdBase, fontWeight: theme.weightMedium }}>{t.categoria_nombre}</td>
                <td style={{ ...tdBase, textAlign: 'center', color: theme.muted, fontVariantNumeric: 'tabular-nums' }}>{t.cantidad}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: theme.weightHeading, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtPesos(t.total)}</td>
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
            }}>{cantidadGastos} {cantidadGastos === 1 ? 'gasto' : 'gastos'}</td>
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
 * ModalEditarGasto
 * Modal de edición de gasto. 4 campos editables: categoría, descripción,
 * monto, forma de pago. Sin preview (el monto editado es directo).
 */
function ModalEditarGasto({ open, gasto, categorias, form, onChange, onGuardar, onCancelar, guardando, errorEditar }) {
  const opcionesCategoria = categorias.map((c) => ({ value: c.id, label: c.nombre }));

  return (
    <Modal
      open={open}
      onClose={onCancelar}
      loading={guardando}
      title="Editar gasto"
      subtitle={gasto ? `Fecha original: ${gasto.fecha}` : undefined}
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
      {gasto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select
            label="Categoría"
            value={form.categoria_id}
            onChange={(v) => onChange('categoria_id', v)}
            options={opcionesCategoria}
          />

          <Field
            label="Descripción"
            value={form.descripcion}
            onChange={(v) => onChange('descripcion', v)}
            placeholder="Descripción del gasto"
          />

          <Field
            label="Monto"
            type="number"
            value={form.monto}
            onChange={(v) => onChange('monto', v)}
          />

          <Select
            label="Forma de pago"
            value={form.forma_pago}
            onChange={(v) => onChange('forma_pago', v)}
            options={OPCIONES_FORMA_PAGO}
          />

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
 * SeccionGastos
 * Vista principal de Gastos. Carga gastos del mes + categorías, los muestra
 * en una tabla densa con acciones editar/eliminar y una tabla de resumen
 * por categoría. Exportable a Excel.
 */
export default function SeccionGastos() {
  const [mes, setMes]                           = useState(getMesActual);
  const [gastos, setGastos]                     = useState([]);
  const [totalesPorCategoria, setTotalesPorCat] = useState([]);
  const [totalGeneral, setTotalGeneral]         = useState(0);
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [intento, setIntento]                   = useState(0);
  const [categorias, setCategorias]             = useState([]);
  const [gastoAEliminar, setGastoAEliminar]     = useState(null);
  const [eliminando, setEliminando]             = useState(false);
  const [gastoAEditar, setGastoAEditar]         = useState(null);
  const [formEditar, setFormEditar]             = useState({});
  const [guardando, setGuardando]               = useState(false);
  const [errorEditar, setErrorEditar]           = useState(null);

  // Carga one-shot de categorías. Si falla queda como array vacío — el
  // select del modal queda sin opciones, pero la sección no se rompe.
  useEffect(() => {
    let cancelado = false;
    const cargarCategorias = async () => {
      try {
        const res = await apiFetch('/categorias');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setCategorias(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[seccionGastos] Error en cargarCategorias:', err.message);
      }
    };
    cargarCategorias();
    return () => { cancelado = true; };
  }, []);

  // Carga de gastos del mes. `intento` re-dispara el efecto en "Reintentar".
  useEffect(() => {
    let cancelado = false;
    const cargarGastos = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await apiFetch(`/gastos/mensual?mes=${mes}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelado) return;
        setGastos(data.gastos);
        setTotalesPorCat(data.totalesPorCategoria);
        setTotalGeneral(data.totalGeneral);
      } catch (err) {
        console.error('[seccionGastos] Error en cargarGastos:', err.message);
        if (!cancelado) setError('No se pudieron cargar los gastos. Intentá de nuevo.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarGastos();
    return () => { cancelado = true; };
  }, [mes, intento]);

  /**
   * Recalcula totales (general y por categoría) localmente. Se usa tras
   * editar o eliminar para no pegarle al server.
   * @param {Array} lista
   * @returns {{ totalGen: number, totalesOrdenados: Array }}
   */
  const recalcularTotales = (lista) => {
    const totalGen = lista.reduce((acc, g) => acc + Number(g.monto), 0);
    const totalesMap = {};
    lista.forEach((g) => {
      if (!totalesMap[g.categoria_nombre]) {
        totalesMap[g.categoria_nombre] = { total: 0, cantidad: 0 };
      }
      totalesMap[g.categoria_nombre].total    += Number(g.monto);
      totalesMap[g.categoria_nombre].cantidad += 1;
    });
    const totalesOrdenados = Object.entries(totalesMap)
      .map(([nombre, vals]) => ({ categoria_nombre: nombre, ...vals }))
      .sort((a, b) => b.total - a.total);
    return { totalGen, totalesOrdenados };
  };

  const abrirEditar = (g) => {
    setErrorEditar(null);
    setFormEditar({
      categoria_id: g.categoria_id,
      descripcion:  g.descripcion,
      monto:        g.monto,
      forma_pago:   g.forma_pago,
    });
    setGastoAEditar(g);
  };

  const handleChangeForm = (campo, valor) => {
    setFormEditar((f) => ({ ...f, [campo]: valor }));
  };

  const confirmarEditar = async () => {
    const { id } = gastoAEditar;
    setGuardando(true);
    setErrorEditar(null);
    try {
      const res = await apiFetch(`/gastos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          categoria_id: formEditar.categoria_id,
          descripcion:  formEditar.descripcion.trim(),
          monto:        Number(formEditar.monto),
          forma_pago:   formEditar.forma_pago,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }
      // El select devuelve strings; las categorías traen id numérico desde
      // el server. Comparamos con coerción para que el lookup funcione.
      const categoriaNombre = categorias.find((c) => String(c.id) === String(formEditar.categoria_id))?.nombre
        || gastoAEditar.categoria_nombre;

      const nuevosGastos = gastos.map((g) => g.id === id ? {
        ...g,
        categoria_id:     formEditar.categoria_id,
        categoria_nombre: categoriaNombre,
        descripcion:      formEditar.descripcion.trim(),
        monto:            Number(formEditar.monto),
        forma_pago:       formEditar.forma_pago,
      } : g);

      const { totalGen, totalesOrdenados } = recalcularTotales(nuevosGastos);
      setGastos(nuevosGastos);
      setTotalGeneral(totalGen);
      setTotalesPorCat(totalesOrdenados);
      setGastoAEditar(null);
    } catch (err) {
      console.error('[seccionGastos] Error en confirmarEditar:', err.message);
      setErrorEditar(err.message || 'No se pudo editar el gasto. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    const { id } = gastoAEliminar;
    setEliminando(true);
    try {
      const res = await apiFetch(`/gastos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error del servidor');
      const nuevosGastos = gastos.filter((g) => g.id !== id);
      const { totalGen, totalesOrdenados } = recalcularTotales(nuevosGastos);
      setGastos(nuevosGastos);
      setTotalGeneral(totalGen);
      setTotalesPorCat(totalesOrdenados);
    } catch (err) {
      console.error('[seccionGastos] Error en confirmarEliminar:', err.message);
    } finally {
      setEliminando(false);
      setGastoAEliminar(null);
    }
  };

  const exportarExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const filas = gastos.map((g) => ({
      Fecha:           g.fecha,
      Categoría:       g.categoria_nombre,
      Descripción:     g.descripcion,
      Monto:           Number(g.monto),
      'Forma de pago': g.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Gastos');

    const filasTotales = totalesPorCategoria.map((t) => ({
      Categoría:            t.categoria_nombre,
      'Cantidad de gastos': Number(t.cantidad),
      Total:                Number(t.total),
    }));
    filasTotales.push({
      Categoría:            'TOTAL GENERAL',
      'Cantidad de gastos': gastos.length,
      Total:                totalGeneral,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTotales), 'Totales');
    XLSX.writeFile(wb, `Gastos_${mes}.xlsx`);
  };

  const accionesDeshabilitadas = eliminando || guardando;

  // Filas del ConfirmDialog de delete — armado en el render.
  const filasDelete = gastoAEliminar ? [
    { label: 'Fecha',       valor: gastoAEliminar.fecha },
    { label: 'Categoría',   valor: gastoAEliminar.categoria_nombre },
    { label: 'Descripción', valor: gastoAEliminar.descripcion },
    {
      label: 'Monto',
      valor: fmtPesos(gastoAEliminar.monto),
      numeric: true,
      valorColor: theme.danger,
      valorWeight: theme.weightHeading,
    },
  ] : [];

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Gastos" subtitle="Registro mensual de egresos" />

      <ConfirmDialog
        open={!!gastoAEliminar}
        title="¿Eliminar este gasto?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setGastoAEliminar(null)}
      >
        {gastoAEliminar && <DetalleRecurso filas={filasDelete} />}
      </ConfirmDialog>

      <ModalEditarGasto
        open={!!gastoAEditar}
        gasto={gastoAEditar}
        categorias={categorias}
        form={formEditar}
        onChange={handleChangeForm}
        onGuardar={confirmarEditar}
        onCancelar={() => setGastoAEditar(null)}
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
          <BotonExportarExcel onClick={exportarExcel} disabled={gastos.length === 0} />
        </div>
      </div>

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
      ) : gastos.length === 0 ? (
        <EmptyState
          glyph={<Receipt size={28} strokeWidth={1.5} />}
          title="Sin gastos"
          body={`No hay gastos registrados en ${mesALabel(mes)}.`}
        />
      ) : (
        <>
          <TablaGastos
            gastos={gastos}
            totalGeneral={totalGeneral}
            onEditar={abrirEditar}
            onEliminar={setGastoAEliminar}
            accionesDeshabilitadas={accionesDeshabilitadas}
          />
          <TablaResumen
            totales={totalesPorCategoria}
            totalGeneral={totalGeneral}
            cantidadGastos={gastos.length}
          />
        </>
      )}
    </div>
  );
}
