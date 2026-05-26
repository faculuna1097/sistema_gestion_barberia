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
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { fmtPesos } from '../../../utils/formato';
import { theme } from '../../../theme/tokens.js';
import {
  Card,
  ScreenHeader,
  EmptyState,
  IconoAlerta,
  Button,
  LoadingState,
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

/**
 * BadgeVariacion
 * Badge de comparativa porcentual con ícono ▲/▼.
 * Verde (success) si pct ≥ 0, rojo (danger) si pct < 0.
 * Si pct es null, muestra un fallback neutro con sinDatosLabel.
 *
 * Candidato a promover a primitivo cuando aparezca el segundo caso
 * de uso (Balances/Ventas seguramente lo van a pedir).
 *
 * @param {number|null} props.pct - Porcentaje de variación.
 * @param {string} [props.sinDatosLabel] - Texto del fallback.
 */
function BadgeVariacion({ pct, sinDatosLabel = 'Sin datos previos' }) {
  if (pct === null || pct === undefined) {
    return (
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.mutedSoft,
        fontWeight: theme.weightMedium,
      }}>{sinDatosLabel}</span>
    );
  }

  const subiendo = pct >= 0;
  const Icon = subiendo ? TrendingUp : TrendingDown;
  const fg = subiendo ? theme.success : theme.danger;
  const bg = subiendo ? theme.successSoft : theme.dangerSoft;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      background: bg,
      color: fg,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      fontWeight: theme.weightMedium,
      letterSpacing: '-0.005em',
    }}>
      <Icon size={14} strokeWidth={2} />
      {Math.abs(pct)}%
    </span>
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
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <Eyebrow>Hoy</Eyebrow>

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
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
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
    <Card padding={16}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Package size={14} strokeWidth={1.75} />
          Alertas de stock
        </span>

        {hayAlertas && (
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
      </div>

      {hayAlertas ? (
        <div role="table" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Encabezado */}
          <div role="row" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px',
            padding: '0 0 8px 0',
            borderBottom: `1px solid ${theme.hairline}`,
            fontFamily: theme.mono,
            fontSize: theme.sizeMicro,
            fontWeight: theme.weightMedium,
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <span role="columnheader">Producto</span>
            <span role="columnheader" style={{ textAlign: 'right' }}>Actual</span>
            <span role="columnheader" style={{ textAlign: 'right' }}>Mínimo</span>
          </div>

          {/* Filas */}
          {productos.map((p) => (
            <div
              key={p.id}
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 100px',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: `1px solid ${theme.hairlineSoft}`,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
              }}
            >
              <span role="cell" style={{ color: theme.ink, fontWeight: theme.weightMedium }}>
                {p.nombre}
              </span>
              <span role="cell" style={{
                textAlign: 'right',
                color: theme.danger,
                fontWeight: theme.weightHeading,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {p.stock_actual}
              </span>
              <span role="cell" style={{
                textAlign: 'right',
                color: theme.muted,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {p.stock_minimo}
              </span>
            </div>
          ))}
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
  const contenedor = {
    padding: 24,
    fontFamily: theme.body,
    color: theme.ink,
  };

  if (cargando) {
    return (
      <div style={contenedor}>
        <ScreenHeader title="Inicio" subtitle="Resumen operativo del día" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div style={contenedor}>
        <ScreenHeader title="Inicio" subtitle="Resumen operativo del día" />
        <EmptyState
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
      <ScreenHeader title="Inicio" subtitle="Resumen operativo del día" />

      {/* Cards apiladas. CardDia + CardMes comparten altura (gridAutoRows:1fr). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridAutoRows: '1fr', gap: 16 }}>
          <CardDia data={resumen} />
          <CardMes data={comparativo} />
        </div>
        <CardStock productos={stockBajo} />
      </div>
    </div>
  );
}
