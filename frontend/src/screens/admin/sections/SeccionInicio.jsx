// /frontend/src/screens/admin/sections/SeccionInicio.jsx
// Sección Inicio del Panel de Administrador.
// Layout: grid 2 columnas arriba (Hoy + Mes) + Stock full-width abajo.
// Los 3 endpoints se llaman en paralelo con Promise.all al montar.

import { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  Package,
  CheckCircle2,
  RefreshCw,
  Sun,
  CalendarRange,
} from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { fmtPesos } from '../../../utils/formato';
import { getFechaHoy, fechaADiaMes } from '../../../utils/fecha';
import { theme } from '../../../theme/tokens.js';
import {
  Card,
  EmptyState,
  IconoAlerta,
  Button,
  LoadingState,
  BadgeVariacion,
} from '../../../components/ui';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/**
 * Eyebrow
 * Microlabel en mayúsculas (mono) usado como título de cada card.
 * @param {string} props.children - Texto a mostrar.
 */
function Eyebrow({ children }) {
  return (
    <div style={{
      fontFamily: theme.mono,
      fontWeight: theme.weightMedium,
      fontSize: theme.sizeMicro,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.muted,
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      {children}
    </div>
  );
}

/**
 * CardEyebrow
 * Título de card alineado a la izquierda (ícono + label mono-micro-uppercase),
 * con slot opcional a la derecha. Centraliza el patrón de header que comparten
 * las 3 cards de Inicio (día, mes, stock) — antes el de stock estaba inline.
 * @param {ReactNode} props.icon - Ícono Lucide (size 14).
 * @param {ReactNode} props.children - Texto del título.
 * @param {ReactNode} [props.right] - Contenido opcional a la derecha (ej. el badge de stock).
 */
function CardEyebrow({ icon, children, right }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: right ? 'space-between' : 'flex-start',
      marginBottom: 14,
      flexShrink: 0,
      fontFamily: theme.mono,
      fontWeight: theme.weightMedium,
      fontSize: theme.sizeMicro,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.muted,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {icon}
        {children}
      </span>
      {right}
    </div>
  );
}

/**
 * Metrica
 * Bloque KPI: ícono + número grande + label.
 * @param {ReactNode} props.icon - Ícono Lucide (size 20, color heredado).
 * @param {string|number} props.valor - Valor principal a mostrar.
 * @param {string} props.label - Texto descriptivo bajo el valor.
 * @param {string} [props.tintColor] - Color del ícono. Default theme.muted.
 */
function Metrica({ icon, valor, label, tintColor }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      minWidth: 0,
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: theme.radius,
        background: theme.surfaceAlt,
        color: tintColor ?? theme.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeTitle,
          fontWeight: theme.weightHeading,
          color: theme.ink,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>{valor}</span>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          lineHeight: 1.3,
        }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Card 1 — Actividad del día ───────────────────────────────────────────────

/**
 * CardDia
 * Muestra clientes atendidos y facturación de hoy.
 * @param {object} props.data - Respuesta de /inicio/resumen-dia.
 */
function CardDia({ data }) {
  const { clientes_dia, monto_dia } = data;

  return (
    <Card
      padding={16}
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
    >
      <CardEyebrow icon={<Sun size={14} strokeWidth={1.75} />}>
        Estadísticas del día
      </CardEyebrow>

      {/* Centro: fecha de hoy + pill "Hoy" (mismo indigo sólido que el badge
          de SelectorDia/Caja). Va dentro del Eyebrow centrado para rimar con
          el "{mes} — del 1 al N" de la card del mes. */}
      <Eyebrow>
        {fechaADiaMes(getFechaHoy())}
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          fontWeight: theme.weightMedium,
          padding: '2px 8px',
          borderRadius: 20,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.accentInk,
          background: theme.accent,
        }}>
          Hoy
        </span>
      </Eyebrow>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Metrica
          icon={<Users size={20} strokeWidth={1.75} />}
          valor={clientes_dia}
          label={clientes_dia === 1 ? 'cliente atendido' : 'clientes atendidos'}
        />

        <div style={{ width: 1, height: 40, background: theme.hairline, flexShrink: 0 }} />

        <Metrica
          icon={<DollarSign size={20} strokeWidth={1.75} />}
          valor={fmtPesos(monto_dia)}
          label="facturado hoy"
        />
      </div>
    </Card>
  );
}

// ─── Card 2 — Resumen del mes ─────────────────────────────────────────────────

/**
 * CardMes
 * Muestra clientes y facturación del mes actual + comparativa vs mismo
 * período del mes anterior.
 * @param {object} props.data - Respuesta de /inicio/comparativo-mes.
 */
function CardMes({ data }) {
  const {
    clientes_actual, monto_actual,
    diferencia_pct, dia_corte, mes_actual, mes_anterior,
  } = data;

  return (
    <Card
      padding={16}
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
    >
      <CardEyebrow icon={<CalendarRange size={14} strokeWidth={1.75} />}>
        Estadísticas del mes
      </CardEyebrow>

      <Eyebrow>{mes_actual} — del 1 al {dia_corte}</Eyebrow>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
        <Metrica
          icon={<Users size={20} strokeWidth={1.75} />}
          valor={clientes_actual}
          label={clientes_actual === 1 ? 'cliente atendido' : 'clientes atendidos'}
        />

        <div style={{ width: 1, height: 40, background: theme.hairline, flexShrink: 0 }} />

        <Metrica
          icon={<DollarSign size={20} strokeWidth={1.75} />}
          valor={fmtPesos(monto_actual)}
          label="facturado este mes"
        />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 12,
        borderTop: `1px solid ${theme.hairlineSoft}`,
      }}>
        <BadgeVariacion
          pct={diferencia_pct}
          sinDatosLabel={`Sin datos de ${mes_anterior}`}
        />
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
        }}>
          vs {mes_anterior} al día {dia_corte}
        </span>
      </div>
    </Card>
  );
}

// ─── Card 3 — Alertas de stock ────────────────────────────────────────────────

/**
 * CardStock
 * Lista productos con stock_actual ≤ stock_minimo. Si no hay ninguno,
 * muestra un EmptyState positivo.
 * @param {Array<object>} props.productos - Lista de productos en alerta.
 */
function CardStock({ productos }) {
  const hayAlertas = productos.length > 0;

  return (
    // flex:1 + minHeight:0 → la card toma el alto sobrante del panel y deja
    // que su lista interna scrollee, sin empujar el alto total (ver SeccionInicio).
    <Card padding={16} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <CardEyebrow
        icon={<Package size={14} strokeWidth={1.75} />}
        right={hayAlertas && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 20,
            padding: '0 8px',
            borderRadius: 999,
            background: theme.dangerSoft,
            color: theme.danger,
            fontFamily: theme.body,
            fontSize: theme.sizeMicro,
            fontWeight: theme.weightHeading,
            letterSpacing: '0.02em',
          }}>
            {productos.length}
          </span>
        )}
      >
        Alertas de stock
      </CardEyebrow>

      {hayAlertas ? (
        // Scroll interno: la lista toma el alto sobrante de la card (flex:1 +
        // minHeight:0) y scrollea por dentro, así el panel no scrollea (mismo
        // patrón aceptado que BloqueFeriados — divergencia consciente de
        // "secciones sin overflow propio", #42 del registro de deudas).
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {/* Header sticky: queda fijo al scrollear. background surface
                  (= fondo de la Card) para que las filas pasen limpio por
                  debajo. La línea inferior va por box-shadow inset y no por
                  border-bottom: el borde de un <th> sticky con border-collapse
                  se pierde al scrollear. */}
              <tr>
                {[
                  { label: 'Producto', align: 'left',  width: undefined },
                  { label: 'Actual',   align: 'right', width: 100 },
                  { label: 'Mínimo',   align: 'right', width: 100 },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: theme.surface,
                      textAlign: col.align,
                      width: col.width,
                      padding: '0 0 8px 0',
                      boxShadow: `inset 0 -1px 0 ${theme.hairline}`,
                      fontFamily: theme.mono,
                      fontSize: theme.sizeMicro,
                      fontWeight: theme.weightMedium,
                      color: theme.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td style={{
                    padding: '10px 0',
                    borderBottom: `1px solid ${theme.hairlineSoft}`,
                    fontFamily: theme.body,
                    fontSize: theme.sizeBody,
                    color: theme.ink,
                    fontWeight: theme.weightMedium,
                  }}>
                    {p.nombre}
                  </td>
                  <td style={{
                    padding: '10px 0',
                    borderBottom: `1px solid ${theme.hairlineSoft}`,
                    fontFamily: theme.body,
                    fontSize: theme.sizeBody,
                    textAlign: 'right',
                    color: theme.danger,
                    fontWeight: theme.weightHeading,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {p.stock_actual}
                  </td>
                  <td style={{
                    padding: '10px 0',
                    borderBottom: `1px solid ${theme.hairlineSoft}`,
                    fontFamily: theme.body,
                    fontSize: theme.sizeBody,
                    textAlign: 'right',
                    color: theme.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {p.stock_minimo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          glyph={<CheckCircle2 size={28} strokeWidth={1.75} color={theme.success} />}
          title="Stock en orden"
          body="Ningún producto está por debajo del mínimo."
        />
      )}
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * SeccionInicio
 * Carga los 3 endpoints en paralelo al montarse. Muestra LoadingState
 * mientras carga y EmptyState con acción "Reintentar" si algo falla.
 */
export default function SeccionInicio() {
  const [resumen,     setResumen]     = useState(null);
  const [comparativo, setComparativo] = useState(null);
  const [stockBajo,   setStockBajo]   = useState(null);
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState(null);

  // Trigger para reintentar manualmente. Cambiar el valor re-ejecuta el efecto.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    const cargarDatos = async () => {
      setCargando(true);
      setError(null);
      try {
        const [resumenData, comparativoData, stockData] = await Promise.all([
          apiFetch('/inicio/resumen-dia').then(r => r.json()),
          apiFetch('/inicio/comparativo-mes').then(r => r.json()),
          apiFetch('/inicio/stock-bajo').then(r => r.json()),
        ]);
        if (cancelado) return;
        setResumen(resumenData);
        setComparativo(comparativoData);
        setStockBajo(stockData.productos || []);
      } catch (err) {
        if (cancelado) return;
        console.error('[seccionInicio] Error en cargarDatos:', err.message);
        setError('No se pudieron cargar los datos. Probá recargar.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargarDatos();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Estilos del contenedor de la sección ────────────────────────────────────
  // Inicio es superficie tipo dashboard: fit-to-screen. El contenedor toma el
  // alto del <main> (height:100% + box-border) y es flex column, para que la
  // card de stock absorba el sobrante y scrollee por dentro en vez de hacer
  // scrollear el panel entero. (Excepción consciente a "el main es el que
  // scrollea" — aplica solo a superficies overview, no a los reportes.)
  const contenedor = {
    height: '100%',
    boxSizing: 'border-box',
    padding: 24,
    fontFamily: theme.body,
    color: theme.ink,
    display: 'flex',
    flexDirection: 'column',
  };

  if (cargando) {
    return (
      <div style={contenedor}>
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div style={contenedor}>
        <EmptyState
          tone="danger"
          glyph={<IconoAlerta />}
          title="No se pudo cargar"
          body={error}
          action={
            <Button
              variant="secondary"
              full={false}
              onClick={() => setIntento(n => n + 1)}
            >
              <RefreshCw size={16} strokeWidth={1.75} />
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={contenedor}>
      {/* Columna flex que llena el contenedor: las 2 cards KPI quedan a su alto
          natural (flexShrink:0) y la card de stock toma el sobrante (flex:1). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* CardDia + CardMes comparten altura (gridAutoRows:1fr). */}
        <div style={{ display: 'grid', gridAutoRows: '1fr', gap: 16, flexShrink: 0 }}>
          <CardDia data={resumen} />
          <CardMes data={comparativo} />
        </div>
        <CardStock productos={stockBajo} />
      </div>
    </div>
  );
}
