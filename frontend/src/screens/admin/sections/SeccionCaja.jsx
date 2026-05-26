// /frontend/src/screens/admin/sections/SeccionCaja.jsx
//
// Sección Caja del panel de administrador.
// - Tab "Movimientos del día": tabla de movimientos del día seleccionado +
//   totales netos por canal (efectivo / Mercado Pago).
// - Tabs "Cierre de caja" / "Historial de cierres": placeholders (v1.1).
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// El fondo del contenedor lo da PanelAdmin (theme.surfaceAlt, D7 del plan).
// Loading via primitivo LoadingState (D6).

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Banknote, Trash2, Inbox, Construction, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import SelectorDia from '../../../components/SelectorDia';
import BadgeFormaPago from '../../../components/BadgeFormaPago';
import BotonExportarExcel from '../../../components/BotonExportarExcel';
import TogglePill from '../../../components/TogglePill';
import { getFechaHoy } from '../../../utils/fecha';
import { fmtPesos, formatPago } from '../../../utils/formato';
import {
  ScreenHeader,
  Tabs,
  LoadingState,
  EmptyState,
  ConfirmDialog,
  Button,
  IconoAlerta,
} from '../../../components/ui';
import { theme } from '../../../theme/tokens.js';

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * TipoMovimientoPill
 * Pill compacto que indica el tipo de movimiento (corte / venta / gasto).
 * Local a esta sección. Promover a primitivo cuando aparezca el segundo uso (§7.1).
 * @param {object} props
 * @param {'corte'|'venta'|'gasto'} props.tipo
 */
function TipoMovimientoPill({ tipo }) {
  const variantes = {
    corte: { background: theme.successSoft, color: theme.success, label: 'Corte' },
    venta: { background: theme.accentSoft,  color: theme.accent,  label: 'Venta' },
    gasto: { background: theme.dangerSoft,  color: theme.danger,  label: 'Gasto' },
  };
  const v = variantes[tipo] ?? { background: theme.surfaceAlt, color: theme.muted, label: tipo };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      background: v.background,
      color: v.color,
    }}>{v.label}</span>
  );
}

/**
 * DetalleMovimientoConfirm
 * Bloque de detalle (hora / detalle / barbero / monto) que se inserta
 * dentro del ConfirmDialog como children, para que el dueño confirme que
 * está eliminando la fila correcta.
 * @param {object} props
 * @param {object} props.movimiento
 */
function DetalleMovimientoConfirm({ movimiento }) {
  const filas = [
    { label: 'Hora', valor: movimiento.hora },
    { label: 'Detalle', valor: movimiento.detalle },
    ...(movimiento.barbero_nombre ? [{ label: 'Barbero', valor: movimiento.barbero_nombre }] : []),
    {
      label: 'Monto',
      valor: fmtPesos(movimiento.monto),
      valorColor: movimiento.tipo === 'gasto' ? theme.danger : theme.ink,
      valorWeight: theme.weightHeading,
    },
  ];
  return (
    <div style={{
      background: theme.surfaceAlt,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {filas.map((f, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: theme.sizeBody, fontFamily: theme.body }}>
          <span style={{ color: theme.muted }}>{f.label}</span>
          <span style={{
            color: f.valorColor ?? theme.ink,
            fontWeight: f.valorWeight ?? theme.weightMedium,
            textAlign: 'right',
            fontVariantNumeric: f.label === 'Monto' ? 'tabular-nums' : 'normal',
          }}>{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * TablaMovimientos
 * Tabla densa de movimientos. Hover de fila vía :hover scoped con un <style>
 * inline (excepción consciente al patrón useState — ver deuda #8 del sistema
 * de diseño: para tablas densas con N filas, useState por fila explota el
 * render al mover el mouse).
 *
 * @param {object} props
 * @param {Array} props.movimientos
 * @param {(m: object) => void} props.onEliminar
 */
function TablaMovimientos({ movimientos, onEliminar }) {
  const columnas = ['Hora', 'Tipo', 'Barbero', 'Detalle', 'Monto', 'Forma de pago', ''];

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      overflow: 'hidden',
    }}>
      <style>{`
        .om-caja-fila { transition: background ${theme.transitionFast}; }
        .om-caja-fila:hover { background: ${theme.surfaceAlt}; }
        .om-caja-btn-x { transition: color ${theme.transitionFast}, background ${theme.transitionFast}; }
        .om-caja-btn-x:hover { color: ${theme.danger}; background: ${theme.dangerSoft}; }
      `}</style>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columnas.map((col, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                fontWeight: theme.weightMedium,
                color: theme.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: theme.surfaceAlt,
                borderBottom: `1px solid ${theme.hairline}`,
                textAlign: col === 'Monto' ? 'right' : 'left',
                whiteSpace: 'nowrap',
                width: col === '' ? 40 : undefined,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m, i) => {
            const esGasto = m.tipo === 'gasto';
            const tdBase = {
              padding: '10px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.ink,
              borderBottom: i === movimientos.length - 1 ? 'none' : `1px solid ${theme.hairlineSoft}`,
              verticalAlign: 'middle',
            };
            return (
              <tr key={m.id || i} className="om-caja-fila">
                <td style={tdBase}>{m.hora}</td>
                <td style={tdBase}><TipoMovimientoPill tipo={m.tipo} /></td>
                <td style={{ ...tdBase, color: theme.muted }}>{m.barbero_nombre || '—'}</td>
                <td style={tdBase}>{m.detalle}</td>
                <td style={{
                  ...tdBase,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: theme.weightHeading,
                  color: esGasto ? theme.danger : theme.ink,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}>{esGasto ? '− ' : ''}{fmtPesos(m.monto)}</td>
                <td style={tdBase}><BadgeFormaPago forma={m.forma_pago} /></td>
                <td style={{ ...tdBase, padding: '6px 8px', textAlign: 'center', width: 40 }}>
                  <button
                    type="button"
                    onClick={() => onEliminar(m)}
                    aria-label={`Eliminar movimiento de las ${m.hora}`}
                    className="om-caja-btn-x"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: theme.radiusSm,
                      border: 'none',
                      background: 'transparent',
                      color: theme.muted,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CardTotal
 * Card de resumen para los totales netos (efectivo / MP).
 * Local a esta sección.
 * @param {object} props
 * @param {ReactNode} props.icono - Ícono o logo a la izquierda
 * @param {string} props.label - Label corto (eyebrow mono uppercase)
 * @param {number} props.monto - Monto neto (color condicional según signo)
 */
function CardTotal({ icono, label, monto }) {
  const colorMonto = monto >= 0 ? theme.success : theme.danger;
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        flexShrink: 0,
        color: theme.muted,
      }}>{icono}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          fontWeight: theme.weightMedium,
          color: theme.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>{label}</span>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeTitle,
          fontWeight: theme.weightHeading,
          color: colorMonto,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>{fmtPesos(monto)}</span>
      </div>
    </div>
  );
}

/**
 * LogoMercadoPagoConFallback
 * Renderiza el logo de MP desde /public; si la carga falla, muestra un placeholder.
 */
function LogoMercadoPagoConFallback() {
  const [falloLogo, setFalloLogo] = useState(false);
  if (falloLogo) {
    return <Banknote size={28} strokeWidth={1.5} />;
  }
  return (
    <img
      src="/mercadopago.png"
      alt="Mercado Pago"
      style={{ height: 32, objectFit: 'contain' }}
      onError={() => setFalloLogo(true)}
    />
  );
}

// ─── Tab Movimientos del día ──────────────────────────────────────────────────

function TabMovimientos() {
  const [fecha, setFecha]                              = useState(getFechaHoy);
  const [movimientos, setMovimientos]                  = useState([]);
  const [cargando, setCargando]                        = useState(true);
  const [error, setError]                              = useState(null);
  const [intento, setIntento]                          = useState(0);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null);
  const [eliminando, setEliminando]                   = useState(false);
  const [soloNegocio, setSoloNegocio]                 = useState(false);

  // Carga de movimientos. `intento` re-dispara el efecto al hacer "Reintentar".
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch(`/caja/movimientos-dia?fecha=${fecha}`);
        const data = await res.json();
        if (!cancelado) setMovimientos(data.movimientos || []);
      } catch (err) {
        console.error('[seccionCaja] Error en cargarMovimientos:', err.message);
        if (!cancelado) setError('No se pudieron cargar los movimientos.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [fecha, intento]);

  // Filtro "Solo Barberos": excluye los cortes de barberos con 100% de comisión.
  // En la práctica esos cortes van directo al bolsillo del barbero y no pasan
  // por la caja del local — sacarlos da la visión "cuenta del local puro".
  const movimientosFiltrados = soloNegocio
    ? movimientos.filter(m => m.tipo !== 'corte' || Number(m.comision_valor) < 100)
    : movimientos;

  // Totales netos por canal: gastos restan, ingresos suman.
  const calcularNeto = (forma) => movimientosFiltrados.reduce((acc, m) => {
    if (m.forma_pago !== forma) return acc;
    return m.tipo === 'gasto' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);
  const efectivoNeto    = calcularNeto('efectivo');
  const mercadoPagoNeto = calcularNeto('mercado_pago');

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

  if (cargando) return <LoadingState />;

  if (error) return (
    <EmptyState
      glyph={<IconoAlerta />}
      title="No se pudo cargar"
      body={error}
      action={
        <Button variant="secondary" full={false} onClick={() => setIntento(n => n + 1)}>
          <RefreshCw size={16} strokeWidth={1.75} />
          Reintentar
        </Button>
      }
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ConfirmDialog
        open={!!movimientoAEliminar}
        title="¿Eliminar este registro?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setMovimientoAEliminar(null)}
      >
        {movimientoAEliminar && <DetalleMovimientoConfirm movimiento={movimientoAEliminar} />}
      </ConfirmDialog>

      <div style={{ display: 'flex', gap: 12 }}>
        <CardTotal
          icono={<Banknote size={28} strokeWidth={1.5} />}
          label="Efectivo neto"
          monto={efectivoNeto}
        />
        <CardTotal
          icono={<LogoMercadoPagoConFallback />}
          label="Mercado Pago neto"
          monto={mercadoPagoNeto}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16 }}>
        <TogglePill
          activo={soloNegocio}
          onToggle={() => setSoloNegocio(v => !v)}
          labelOn="Solo Barberos"
        />
        <div style={{ justifySelf: 'center' }}>
          <SelectorDia value={fecha} onChange={setFecha} />
        </div>
        <BotonExportarExcel onClick={exportarExcel} disabled={movimientos.length === 0} />
      </div>

      {movimientosFiltrados.length === 0 ? (
        <EmptyState
          glyph={<Inbox size={28} strokeWidth={1.5} />}
          title="Sin movimientos"
          body="No hay movimientos registrados en este día."
        />
      ) : (
        <TablaMovimientos
          movimientos={movimientosFiltrados}
          onEliminar={setMovimientoAEliminar}
        />
      )}
    </div>
  );
}

// ─── Tabs placeholder (v1.1) ──────────────────────────────────────────────────

function TabCierre() {
  return (
    <EmptyState
      glyph={<Construction size={28} strokeWidth={1.5} />}
      title="Cierre de caja"
      body="Próximamente. Estamos trabajando en esta vista."
    />
  );
}

function TabHistorial() {
  return (
    <EmptyState
      glyph={<Construction size={28} strokeWidth={1.5} />}
      title="Historial de cierres"
      body="Próximamente. Estamos trabajando en esta vista."
    />
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'movimientos', label: 'Movimientos del día' },
  { key: 'cierre',      label: 'Cierre de caja' },
  { key: 'historial',   label: 'Historial de cierres' },
];

export default function SeccionCaja() {
  const [tabActivo, setTabActivo] = useState('movimientos');

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Caja" subtitle="Movimientos diarios y cierres" />

      <Tabs items={TABS} value={tabActivo} onChange={setTabActivo} />

      {tabActivo === 'movimientos' && <TabMovimientos />}
      {tabActivo === 'cierre'      && <TabCierre />}
      {tabActivo === 'historial'   && <TabHistorial />}
    </div>
  );
}
