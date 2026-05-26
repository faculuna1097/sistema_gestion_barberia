// /frontend-barbero/src/components/MiPlanilla.jsx
// Vista semanal de la planilla del barbero autenticado.
// Navegable por semana. Muestra:
//   - Hero con la comisión semanal (lo más importante).
//   - Desglose de la semana (cortes, monto, propinas, total).
//   - Detalle de cortes agrupados por día.

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ClipboardX } from 'lucide-react';

import { getPlanilla, getResumenPlanilla } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fmtFechaCorta, fmtFechaLarga } from '../utils/fecha.js';

import {
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  SummaryRow,
} from './ui';

// ─── Helpers locales de semana ─────────────────────────────────────────────

/**
 * formatearFechaISO
 * Helper privado: convierte una instancia Date a YYYY-MM-DD (zona local).
 * @param {Date} d
 * @returns {string}
 */
function formatearFechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * lunesDeEstaSemana
 * Devuelve el lunes de la semana actual en formato YYYY-MM-DD.
 * @returns {string}
 */
function lunesDeEstaSemana() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia; // domingo cuenta como fin de semana previa
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return formatearFechaISO(lunes);
}

/**
 * sumarSemanas
 * Suma N semanas a una fecha YYYY-MM-DD.
 * @param {string} fecha
 * @param {number} semanas
 * @returns {string}
 */
function sumarSemanas(fecha, semanas) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + semanas * 7);
  return formatearFechaISO(d);
}

/**
 * domingoDe
 * Dado el lunes (YYYY-MM-DD), devuelve el domingo de la misma semana.
 * @param {string} lunes
 * @returns {string}
 */
function domingoDe(lunes) {
  const d = new Date(lunes + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return formatearFechaISO(d);
}

/**
 * tituloSemana
 * Genera el título contextual de la semana ("Esta semana" / "Semana anterior" / "Semana del DD de mmm").
 * No contempla semanas futuras: el NavegadorSemana bloquea avanzar más allá de la actual.
 * @param {string} lunes
 * @returns {string}
 */
function tituloSemana(lunes) {
  const lunesActual = lunesDeEstaSemana();
  if (lunes === lunesActual) return 'Esta semana';
  if (lunes === sumarSemanas(lunesActual, -1)) return 'Semana anterior';
  return `Semana del ${fmtFechaCorta(lunes)}`;
}

/**
 * agruparPorDia
 * Toma los cortes (cada uno con `fecha` ISO) y los agrupa por día YYYY-MM-DD.
 * Devuelve un array ordenado de menor a mayor fecha.
 * @param {Array} cortes
 * @returns {Array<{ fecha: string, cortes: Array }>}
 */
function agruparPorDia(cortes) {
  const mapa = new Map();
  for (const c of cortes) {
    const fecha = new Date(c.fecha).toISOString().slice(0, 10);
    if (!mapa.has(fecha)) mapa.set(fecha, []);
    mapa.get(fecha).push(c);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, cortes]) => ({ fecha, cortes }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MiPlanilla
 * Orquesta la carga de planilla + resumen de la semana seleccionada.
 */
export default function MiPlanilla() {
  const [semana, setSemana] = useState(lunesDeEstaSemana());
  const [detalle, setDetalle] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  /**
   * cargar
   * Trae detalle y resumen en paralelo para la semana actual.
   */
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [det, res] = await Promise.all([
        getPlanilla(semana),
        getResumenPlanilla(semana),
      ]);
      setDetalle(det);
      setResumen(res);
    } catch (err) {
      console.error('[MiPlanilla] Error cargando planilla:', err.message);
      setErrorCarga('No se pudo cargar la planilla.');
    } finally {
      setCargando(false);
    }
  }, [semana]);

  useEffect(() => { cargar(); }, [cargar]);

  // El detalle viene agrupado por barbero. Como rol=barbero, solo viene el propio.
  const miDetalle = detalle && detalle.length > 0 ? detalle[0] : null;
  const miResumen = resumen?.barberos?.length > 0 ? resumen.barberos[0] : null;

  const cortes = miDetalle?.cortes || [];
  const diasConCortes = agruparPorDia(cortes);

  const esEstaSemana = semana === lunesDeEstaSemana();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '16px 16px 24px',
    }}>
      <ScreenHeader
        eyebrow="Mi planilla"
        title={tituloSemana(semana)}
        subtitle={`Del ${fmtFechaCorta(semana)} al ${fmtFechaCorta(domingoDe(semana))}`}
      />

      <NavegadorSemana
        semana={semana}
        esEstaSemana={esEstaSemana}
        puedeAvanzar={!esEstaSemana}
        onAnterior={() => setSemana(sumarSemanas(semana, -1))}
        onSiguiente={() => setSemana(sumarSemanas(semana, 1))}
        onHoy={() => setSemana(lunesDeEstaSemana())}
      />

      {cargando && <EsqueletoPlanilla />}

      {!cargando && errorCarga && (
        <EmptyState
          glyph={<ClipboardX size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No pudimos cargar la planilla"
          body={errorCarga}
          action={
            <Button variant="secondary" full={false} onClick={cargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {!cargando && !errorCarga && (
        <>
          <HeroComision resumen={miResumen} />
          <DesgloseSemanal resumen={miResumen} cantidadCortes={cortes.length} />
          <DetalleCortes diasConCortes={diasConCortes} />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes locales (uso único — no se promueven a primitivos)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * NavegadorSemana
 * Barra de navegación: ← anterior · etiqueta · → siguiente.
 * La etiqueta se vuelve botón "Volver a esta semana" cuando no es la semana actual.
 * La flecha "siguiente" queda deshabilitada cuando puedeAvanzar=false (bloquea futuro).
 */
function NavegadorSemana({ semana, esEstaSemana, puedeAvanzar, onAnterior, onSiguiente, onHoy }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: 4,
    }}>
      <BotonFlecha onClick={onAnterior} aria="Semana anterior">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </BotonFlecha>

      <div style={{
        flex: 1,
        textAlign: 'center',
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
      }}>
        {esEstaSemana ? (
          <span>{fmtFechaCorta(semana)} – {fmtFechaCorta(domingoDe(semana))}</span>
        ) : (
          <button
            type="button"
            onClick={onHoy}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.accent,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightMedium,
              padding: '4px 8px',
              borderRadius: theme.radiusSm,
            }}
            aria-label="Volver a la semana actual"
          >
            Ir a esta semana
          </button>
        )}
      </div>

      <BotonFlecha
        onClick={onSiguiente}
        disabled={!puedeAvanzar}
        aria={puedeAvanzar ? 'Semana siguiente' : 'No se puede avanzar a semanas futuras'}
      >
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </BotonFlecha>
    </div>
  );
}

/**
 * BotonFlecha
 * Botón discreto cuadrado de 36×36 px para las flechas del navegador.
 * Hover con useState (MD §4.2). Soporta disabled (visual + bloqueo de click).
 */
function BotonFlecha({ children, onClick, aria, disabled = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      aria-label={aria}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: !disabled && hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? theme.mutedSoft : theme.inkSoft,
        opacity: disabled ? 0.5 : 1,
        transition: `background ${theme.transitionFast}, color ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * HeroComision
 * Card grande con la comisión semanal — dato más importante.
 * Si resumen es null (sin cortes esta semana), igual se muestra con $0
 * para que el barbero entienda que cargó pero no facturó nada.
 */
function HeroComision({ resumen }) {
  // Si no hay resumen del backend, defaults a 0.
  const comision = Number(resumen?.comision ?? 0);
  const tipo = resumen?.comision_tipo;
  const valor = resumen?.comision_valor;

  // Sub-label que explica cómo se calcula la comisión.
  let detalleComision = '—';
  if (tipo === 'porcentaje' && valor != null) {
    detalleComision = `${valor}% de ${fmtPesos(Number(resumen?.total_generado ?? 0))}`;
  } else if (tipo === 'fijo' && valor != null) {
    detalleComision = `${fmtPesos(Number(valor))} fijo por corte`;
  }

  return (
    <Card padding={20} style={{ borderRadius: theme.radiusLg }}>
      <div style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>
        Comisión semanal
      </div>
      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: 36,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: theme.accent,
        marginTop: 4,
      }}>
        {fmtPesos(comision)}
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        marginTop: 6,
      }}>
        {detalleComision}
      </div>
    </Card>
  );
}

/**
 * DesgloseSemanal
 * Lista de SummaryRow con los totales de la semana (cortes, montos, propinas).
 */
function DesgloseSemanal({ resumen, cantidadCortes }) {
  // Para semanas sin cortes, mostramos igual la tabla con ceros — informa más que ocultarla.
  const montoServ  = Number(resumen?.monto_servicios ?? 0);
  const propinas   = Number(resumen?.propinas ?? 0);
  const totalGen   = Number(resumen?.total_generado ?? 0);

  return (
    <Card padding={14}>
      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: theme.ink,
        marginBottom: 6,
      }}>
        Desglose
      </div>
      <SummaryRow label="Cortes"          value={cantidadCortes} />
      <SummaryRow label="Monto servicios" value={fmtPesos(montoServ)} />
      <SummaryRow label="Propinas"        value={fmtPesos(propinas)} />
      <SummaryRow label="Total generado"  value={fmtPesos(totalGen)} />
    </Card>
  );
}

/**
 * DetalleCortes
 * Lista de cortes agrupados por día. Si no hay cortes, muestra EmptyState inline.
 * @param {Array<{ fecha: string, cortes: Array }>} props.diasConCortes
 */
function DetalleCortes({ diasConCortes }) {
  return (
    <div>
      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: theme.ink,
        marginBottom: 8,
      }}>
        Detalle de cortes
      </div>

      {diasConCortes.length === 0 ? (
        <EmptyState
          glyph={<ClipboardX size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="Sin cortes esta semana"
          body="Cuando registres un corte, va a aparecer acá."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {diasConCortes.map(({ fecha, cortes }) => (
            <DiaConCortes key={fecha} fecha={fecha} cortes={cortes} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DiaConCortes
 * Sub-header con la fecha + lista de cortes del día.
 */
function DiaConCortes({ fecha, cortes }) {
  // Sumatoria del día — informativo, no obligatorio.
  const totalDia = cortes.reduce(
    (acc, c) => acc + Number(c.monto_servicios || 0) + Number(c.propina || 0),
    0
  );

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 6,
        padding: '0 2px',
      }}>
        <div style={{
          fontFamily: theme.mono,
          fontWeight: theme.weightMedium,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.muted,
        }}>
          {fmtFechaLarga(fecha)}
        </div>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeMicro + 1,
          color: theme.muted,
        }}>
          {cortes.length} corte{cortes.length === 1 ? '' : 's'} · {fmtPesos(totalDia)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cortes.map((c) => <CorteFila key={c.corte_id} corte={c} />)}
      </div>
    </div>
  );
}

/**
 * CorteFila
 * Una línea de corte: hora + servicio + forma_pago a la izquierda; $monto y $propina a la derecha.
 * Si la propina es 0, no se muestra.
 */
function CorteFila({ corte }) {
  const monto = Number(corte.monto_servicios || 0);
  const propina = Number(corte.propina || 0);
  const hora = corte.hora?.slice(0, 5) || '—';

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: 12,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeBody,
        color: theme.ink,
        minWidth: 44,
      }}>
        {hora}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {corte.servicio_nombre || 'Servicio'}
        </div>
        {corte.forma_pago && (
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            color: theme.muted,
            marginTop: 2,
            textTransform: 'capitalize',
          }}>
            {corte.forma_pago.replace('_', ' ')}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
        }}>
          {fmtPesos(monto)}
        </div>
        {propina > 0 && (
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            color: theme.success,
            marginTop: 2,
          }}>
            + {fmtPesos(propina)} prop.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EsqueletoPlanilla
 * Esqueleto de carga: una "hero" grande + tres SummaryRow + algunas filas de detalle.
 */
function EsqueletoPlanilla() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={110} radius={theme.radiusLg} />
      <Skeleton height={170} radius={theme.radius} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={60} radius={theme.radius} />
        ))}
      </div>
    </div>
  );
}
