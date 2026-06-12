// /frontend/src/screens/admin/sections/SeccionPlanillas.jsx
//
// Sección Planillas del panel de administrador (read-only).
//
// Tab Detalle por barbero:
//   - Fila de ChipFiltro (primitivo) para elegir barbero activo.
//   - Un bloque colapsable por día con la tabla de cortes + subtotal del día.
//   - El subtotal queda visible aunque el bloque esté contraído (panorama rápido
//     de la semana sin necesidad de expandir cada día).
//   - Con comisiones ON, el slot "Pago" del subtotal muestra el monto a pagar al
//     barbero ese día (comisión + propinas). Esta semántica se hereda del
//     diseño original (Paso 2 del rediseño consideró cambiarlo y se descartó —
//     ver pregunta 3 del chat: opción c).
//
// Tab Resumen semanal:
//   - Tabla consolidada por barbero con totales de la semana + columna
//     Comisión opcional (toggle global).
//
// Comisión por día: comisión calculada sobre monto_servicios (nunca sobre
// propinas), según comision_tipo del barbero ("porcentaje" o "fijo" por corte).
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// El fondo del contenedor lo da PanelAdmin (theme.surfaceAlt, D7 del plan).
// Loading via primitivo LoadingState (D6). Hover de filas via :hover scoped con
// <style> inline (excepción consciente §4.2, deuda #21).

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Scissors, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import {
  getFechaHoy,
  formatFechaCorta,
  getSemanaActual,
  semanaAFechaLunes,
} from '../../../utils/fecha';
import { fmtPesos, formatPago } from '../../../utils/formato';
import { cargarChunk } from '../../../utils/cargarChunk';
import {
  Tabs,
  LoadingState,
  EmptyState,
  Toast,
  Button,
  IconoAlerta,
  ChipFiltro,
  BadgeFormaPago,
  BotonExportarExcel,
  TogglePill,
  SelectorSemana,
} from '../../../components/ui';
import { theme } from '../../../theme/tokens.js';

// ─── Helpers de dominio ───────────────────────────────────────────────────────

/**
 * Agrupa un array de cortes por fecha (YYYY-MM-DD) y ordena cronológicamente.
 * @param {Array} cortes
 * @returns {Array<{fecha: string, cortes: Array}>}
 */
function agruparPorDia(cortes) {
  const mapa = new Map();
  for (const c of cortes) {
    if (!mapa.has(c.fecha)) mapa.set(c.fecha, []);
    mapa.get(c.fecha).push(c);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, cortes]) => ({ fecha, cortes }));
}

/**
 * Calcula la comisión del día sobre el monto de servicios.
 * @param {number} montoServicios
 * @param {'porcentaje'|'fijo'} tipo
 * @param {number} valor
 * @param {number} cantidadCortes
 * @returns {number}
 */
function calcularComisionDia(montoServicios, tipo, valor, cantidadCortes) {
  if (tipo === 'porcentaje') return montoServicios * valor / 100;
  return valor * cantidadCortes;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const TABS_PRINCIPALES = [
  { key: 'detalle', label: 'Detalle por barbero' },
  { key: 'resumen', label: 'Resumen semanal' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
/**
 * SeccionPlanillas
 * Planilla semanal de cortes y comisiones por barbero (read-only).
 * @param {object} props
 * @param {boolean} [props.modoBarbero=false] - Si true, la sección corre en modo
 *   barbero: el token ya scopea `/admin/planilla` a su propia data (un solo
 *   barbero en `detalleData`, autoseleccionado), así que se oculta la fila de
 *   chips de filtro por barbero (sobra con uno). El resto —toggle de comisiones,
 *   selector de semana, export— queda igual: es SU planilla y SU comisión.
 */
export default function SeccionPlanillas({ modoBarbero = false }) {
  const [semana, setSemana]                       = useState(getSemanaActual);
  const [tabActiva, setTabActiva]                 = useState('detalle');
  const [detalleData, setDetalleData]             = useState([]);
  const [resumenData, setResumenData]             = useState(null);
  const [barberoActivo, setBarberoActivo]         = useState(null);
  const [mostrarComisiones, setMostrarComisiones] = useState(true);
  const [cargando, setCargando]                   = useState(false);
  const [error, setError]                         = useState(null);
  const [intento, setIntento]                     = useState(0);
  const [errorExport, setErrorExport]             = useState(null);
  // Fechas (YYYY-MM-DD) actualmente expandidas en el tab Detalle.
  // Por defecto solo el día de hoy arranca expandido al cargar la semana.
  const [diasExpandidos, setDiasExpandidos] = useState(new Set());

  // ── Carga de datos ────────────────────────────────────────────────────────
  // `intento` re-dispara el efecto al hacer "Reintentar". `cancelado` evita
  // setState sobre un efecto vencido (cambio rápido de semana o desmonte).
  useEffect(() => {
    let cancelado = false;
    const cargarDatos = async () => {
      setCargando(true);
      setError(null);
      try {
        const fechaLunes = semanaAFechaLunes(semana);
        const [resDetalle, resResumen] = await Promise.all([
          apiFetch(`/admin/planilla?semana=${fechaLunes}`),
          apiFetch(`/admin/planilla/resumen?semana=${fechaLunes}`),
        ]);
        if (!resDetalle.ok || !resResumen.ok) throw new Error('Error en la respuesta del servidor');
        const [detalle, resumen] = await Promise.all([resDetalle.json(), resResumen.json()]);
        if (cancelado) return;
        setDetalleData(detalle);
        setResumenData(resumen);
        if (detalle.length > 0) setBarberoActivo(detalle[0].barbero_id);
        setDiasExpandidos(new Set([getFechaHoy()]));
      } catch (err) {
        console.error('[seccionPlanillas] Error en cargarDatos:', err.message);
        if (!cancelado) setError('No se pudieron cargar los datos. Revisá la conexión.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarDatos();
    return () => { cancelado = true; };
  }, [semana, intento]);

  // ── Exportación Excel — Detalle ───────────────────────────────────────────
  const exportarDetalle = async () => {
    if (!detalleData.length) return;
    // El import() va después del early-return: no bajamos el chunk en un export
    // vacío. Si la descarga falla, cargarChunk lo convierte en error con Toast.
    let XLSX;
    try {
      XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    } catch (err) {
      setErrorExport(err.message);
      return;
    }
    const filas = [];
    detalleData.forEach((barbero) => {
      const infoComision = resumenData?.barberos.find((b) => b.barbero_id === barbero.barbero_id);
      filas.push({
        Barbero: `── ${barbero.barbero_nombre} ──`,
        Fecha: '', Hora: '', Servicio: '', 'Monto ($)': '', 'Propina ($)': '', 'Total ($)': '',
        ...(mostrarComisiones ? { 'Comisión ($)': '' } : {}),
        'Forma de pago': '',
      });
      agruparPorDia(barbero.cortes).forEach(({ cortes: cd }) => {
        cd.forEach((c) => {
          filas.push({
            Barbero: '', Fecha: formatFechaCorta(c.fecha), Hora: c.hora, Servicio: c.servicio_nombre,
            'Monto ($)': c.monto_servicios, 'Propina ($)': c.propina,
            'Total ($)': c.monto_servicios + c.propina,
            ...(mostrarComisiones ? { 'Comisión ($)': '' } : {}),
            'Forma de pago': formatPago(c.forma_pago),
          });
        });
        if (mostrarComisiones && infoComision) {
          const montoDelDia = cd.reduce((s, c) => s + c.monto_servicios, 0);
          const comisionDelDia = calcularComisionDia(
            montoDelDia,
            infoComision.comision_tipo,
            infoComision.comision_valor,
            cd.length,
          );
          filas.push({
            Barbero: `Subtotal (${cd.length} cortes)`, Fecha: '', Hora: '', Servicio: '',
            'Monto ($)': montoDelDia,
            'Propina ($)': cd.reduce((s, c) => s + c.propina, 0),
            'Total ($)': montoDelDia + cd.reduce((s, c) => s + c.propina, 0),
            'Comisión ($)': comisionDelDia, 'Forma de pago': '',
          });
        }
      });
      const totalMonto   = barbero.cortes.reduce((s, c) => s + c.monto_servicios, 0);
      const totalPropina = barbero.cortes.reduce((s, c) => s + c.propina, 0);
      filas.push({
        Barbero: `Subtotal semana (${barbero.cortes.length} cortes)`, Fecha: '', Hora: '', Servicio: '',
        'Monto ($)': totalMonto, 'Propina ($)': totalPropina, 'Total ($)': totalMonto + totalPropina,
        ...(mostrarComisiones && infoComision ? { 'Comisión ($)': infoComision.comision } : {}),
        'Forma de pago': '',
      });
      filas.push({ Barbero: '', Fecha: '', Hora: '', Servicio: '', 'Monto ($)': '', 'Propina ($)': '', 'Total ($)': '', 'Forma de pago': '' });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Detalle semanal');
    XLSX.writeFile(wb, `detalle-semanal-${semana}.xlsx`);
  };

  // ── Exportación Excel — Resumen ───────────────────────────────────────────
  const exportarResumen = async () => {
    if (!resumenData?.barberos.length) return;
    // El import() va después del early-return: no bajamos el chunk en un export
    // vacío. Si la descarga falla, cargarChunk lo convierte en error con Toast.
    let XLSX;
    try {
      XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    } catch (err) {
      setErrorExport(err.message);
      return;
    }
    const filas = resumenData.barberos.map((b) => ({
      Barbero: b.barbero_nombre, Cortes: b.cantidad_cortes,
      'Monto servicios ($)': b.monto_servicios, 'Propinas ($)': b.propinas,
      'Total generado ($)': b.total_generado,
      ...(mostrarComisiones ? { 'Comisión ($)': b.comision } : {}),
    }));
    const t = resumenData.totales;
    filas.push({
      Barbero: 'TOTAL', Cortes: t.cantidad_cortes,
      'Monto servicios ($)': t.monto_servicios, 'Propinas ($)': t.propinas,
      'Total generado ($)': t.total_generado,
      ...(mostrarComisiones ? { 'Comisión ($)': t.comision } : {}),
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Resumen semanal');
    XLSX.writeFile(wb, `resumen-semanal-${semana}.xlsx`);
  };

  // ── Datos derivados ───────────────────────────────────────────────────────
  const hoy                 = getFechaHoy();
  const barberoSeleccionado = detalleData.find((b) => b.barbero_id === barberoActivo);
  const diasDelBarbero      = barberoSeleccionado ? agruparPorDia(barberoSeleccionado.cortes) : [];
  const infoComisionActiva  = resumenData?.barberos.find((b) => b.barbero_id === barberoActivo);

  /**
   * Alterna la expansión de un bloque de día.
   */
  const toggleDia = (fecha) => {
    setDiasExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(fecha)) nuevo.delete(fecha);
      else nuevo.add(fecha);
      return nuevo;
    });
  };

  /**
   * Cambia el barbero activo y resetea los días expandidos a solo hoy
   * (evita que quede expandido un día que el nuevo barbero no trabajó).
   */
  const cambiarBarbero = (barberoId) => {
    setBarberoActivo(barberoId);
    setDiasExpandidos(new Set([hoy]));
  };

  // ── Early returns: loading / error ────────────────────────────────────────
  if (cargando) return <LoadingState />;

  if (error) return (
    <EmptyState
      tone="danger"
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

  // ── Disabled de exportación según tab activa ──────────────────────────────
  const exportDisabled = tabActiva === 'detalle'
    ? detalleData.length === 0
    : !resumenData?.barberos?.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs items={TABS_PRINCIPALES} value={tabActiva} onChange={setTabActiva} />

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16 }}>
        <TogglePill
          activo={mostrarComisiones}
          onToggle={() => setMostrarComisiones(v => !v)}
          labelOn="Con comisiones"
          labelOff="Sin comisiones"
        />
        <div style={{ justifySelf: 'center' }}>
          <SelectorSemana value={semana} onChange={setSemana} />
        </div>
        <BotonExportarExcel
          onClick={tabActiva === 'detalle' ? exportarDetalle : exportarResumen}
          disabled={exportDisabled}
        />
      </div>

      {errorExport && (
        <Toast tone="danger" dismissible onDismiss={() => setErrorExport(null)}>
          {errorExport}
        </Toast>
      )}

      {/* ── TAB DETALLE ───────────────────────────────────────────────────── */}
      {tabActiva === 'detalle' && (
        detalleData.length === 0 ? (
          <EmptyState
            glyph={<Scissors size={28} strokeWidth={1.5} />}
            title="Sin cortes esta semana"
            body="No hay cortes registrados en la semana seleccionada."
          />
        ) : (
          <>
            {/* Fila de filtro por barbero: se oculta en modo barbero (un solo
                barbero, ya autoseleccionado, hace el filtro redundante). */}
            {!modoBarbero && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detalleData.map((b) => (
                  <ChipFiltro
                    key={b.barbero_id}
                    label={b.barbero_nombre}
                    activo={barberoActivo === b.barbero_id}
                    onClick={() => cambiarBarbero(b.barbero_id)}
                  />
                ))}
              </div>
            )}

            {diasDelBarbero.length === 0 ? (
              <EmptyState
                glyph={<Scissors size={28} strokeWidth={1.5} />}
                title="Sin cortes"
                body="Este barbero no tiene cortes en la semana seleccionada."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {diasDelBarbero.map(({ fecha, cortes: cortesDelDia }) => (
                  <BloqueDia
                    key={fecha}
                    fecha={fecha}
                    cortesDelDia={cortesDelDia}
                    expandido={diasExpandidos.has(fecha)}
                    esHoy={fecha === hoy}
                    onToggle={() => toggleDia(fecha)}
                    infoComisionActiva={infoComisionActiva}
                    mostrarComisiones={mostrarComisiones}
                  />
                ))}
              </div>
            )}
          </>
        )
      )}

      {/* ── TAB RESUMEN ───────────────────────────────────────────────────── */}
      {tabActiva === 'resumen' && (
        !resumenData || resumenData.barberos.length === 0 ? (
          <EmptyState
            glyph={<Scissors size={28} strokeWidth={1.5} />}
            title="Sin cortes esta semana"
            body="No hay cortes registrados en la semana seleccionada."
          />
        ) : (
          <TablaResumen resumenData={resumenData} mostrarComisiones={mostrarComisiones} />
        )
      )}
    </div>
  );
}

// ─── Sub-componente: BloqueDia ────────────────────────────────────────────────

/**
 * BloqueDia
 * Card colapsable de un día del barbero. Header con fecha + pill "Hoy" opcional
 * + cantidad de cortes + chevron. Tabla expandible con los cortes y un tfoot
 * con el subtotal que queda siempre visible.
 *
 * @param {object} props
 * @param {string} props.fecha - YYYY-MM-DD
 * @param {Array} props.cortesDelDia
 * @param {boolean} props.expandido
 * @param {boolean} props.esHoy
 * @param {() => void} props.onToggle
 * @param {object|null} props.infoComisionActiva - Info de comisión del barbero
 *   (tipo, valor, etc.) tomada del resumen. `null` si no se cargó.
 * @param {boolean} props.mostrarComisiones
 */
function BloqueDia({ fecha, cortesDelDia, expandido, esHoy, onToggle, infoComisionActiva, mostrarComisiones }) {
  const totalMonto   = cortesDelDia.reduce((s, c) => s + c.monto_servicios, 0);
  const totalPropina = cortesDelDia.reduce((s, c) => s + c.propina, 0);
  const totalGeneral = totalMonto + totalPropina;
  const comisionDelDia = infoComisionActiva
    ? calcularComisionDia(totalMonto, infoComisionActiva.comision_tipo, infoComisionActiva.comision_valor, cortesDelDia.length)
    : 0;

  const Chevron = expandido ? ChevronDown : ChevronRight;

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      overflow: 'hidden',
    }}>
      {/* Header clickable */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: esHoy ? theme.accentSoft : theme.surface,
          border: 'none',
          borderBottom: `1px solid ${theme.hairline}`,
          cursor: 'pointer',
          fontFamily: theme.body,
          textAlign: 'left',
        }}
        aria-expanded={expandido}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: theme.sizeBody,
            fontWeight: theme.weightHeading,
            color: esHoy ? theme.accent : theme.ink,
            letterSpacing: '-0.005em',
          }}>
            {formatFechaCorta(fecha)}
          </span>
          {esHoy && (
            <span style={{
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              fontWeight: theme.weightMedium,
              background: theme.accent,
              color: theme.accentInk,
              padding: '2px 8px',
              borderRadius: theme.radiusSm,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>HOY</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>
            {cortesDelDia.length} corte{cortesDelDia.length !== 1 ? 's' : ''}
          </span>
          <Chevron size={16} strokeWidth={1.75} color={theme.muted} />
        </div>
      </button>

      {/* Tabla del día */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {expandido && (
          <>
            <thead>
              <tr>
                <ThCelda>Hora</ThCelda>
                <ThCelda>Servicio</ThCelda>
                <ThCelda alinear="right">Monto</ThCelda>
                <ThCelda alinear="right">Propina</ThCelda>
                <ThCelda alinear="right">Total</ThCelda>
                <ThCelda>Pago</ThCelda>
              </tr>
            </thead>
            <tbody>
              {cortesDelDia.map((c) => (
                <tr key={c.corte_id} className="om-fila-hover">
                  <TdCelda>{c.hora}</TdCelda>
                  <TdCelda>{c.servicio_nombre}</TdCelda>
                  <TdCelda alinear="right">{fmtPesos(c.monto_servicios)}</TdCelda>
                  <TdCelda alinear="right">
                    {c.propina > 0
                      ? fmtPesos(c.propina)
                      : <span style={{ color: theme.mutedSoft }}>—</span>}
                  </TdCelda>
                  <TdCelda alinear="right" bold>{fmtPesos(c.monto_servicios + c.propina)}</TdCelda>
                  <TdCelda><BadgeFormaPago forma={c.forma_pago} /></TdCelda>
                </tr>
              ))}
            </tbody>
          </>
        )}
        <tfoot>
          <tr style={{ borderTop: `2px solid ${theme.accent}` }}>
            <td colSpan={2} style={{ ...tdTotalBase, color: theme.ink }}>
              Subtotal — {cortesDelDia.length} corte{cortesDelDia.length !== 1 ? 's' : ''}
            </td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totalMonto)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totalPropina)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right', color: theme.accent }}>
              {fmtPesos(totalGeneral)}
            </td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>
              {mostrarComisiones && infoComisionActiva ? (
                <span style={{ color: theme.accent, fontWeight: theme.weightHeading }}>
                  {fmtPesos(comisionDelDia + totalPropina)}
                  <span style={{
                    fontFamily: theme.mono,
                    fontSize: theme.sizeMicro,
                    fontWeight: theme.weightMedium,
                    color: theme.muted,
                    marginLeft: 6,
                    letterSpacing: '0.02em',
                  }}>
                    {infoComisionActiva.comision_tipo === 'porcentaje'
                      ? `${infoComisionActiva.comision_valor}% + prop`
                      : `$${infoComisionActiva.comision_valor}/c + prop`}
                  </span>
                </span>
              ) : null}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Sub-componente: TablaResumen ─────────────────────────────────────────────

/**
 * TablaResumen
 * Tabla consolidada del tab Resumen. Una fila por barbero + fila TOTAL.
 *
 * @param {object} props
 * @param {{ barberos: Array, totales: object }} props.resumenData
 * @param {boolean} props.mostrarComisiones
 */
function TablaResumen({ resumenData, mostrarComisiones }) {
  const { barberos, totales } = resumenData;
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <ThCelda>Barbero</ThCelda>
            <ThCelda alinear="right">Cortes</ThCelda>
            <ThCelda alinear="right">Monto servicios</ThCelda>
            <ThCelda alinear="right">Propinas</ThCelda>
            <ThCelda alinear="right">Total generado</ThCelda>
            {mostrarComisiones && <ThCelda alinear="right">Comisión</ThCelda>}
          </tr>
        </thead>
        <tbody>
          {barberos.map((b) => (
            <tr key={b.barbero_id} className="om-fila-hover">
              <TdCelda bold>{b.barbero_nombre}</TdCelda>
              <TdCelda alinear="right">{b.cantidad_cortes}</TdCelda>
              <TdCelda alinear="right">{fmtPesos(b.monto_servicios)}</TdCelda>
              <TdCelda alinear="right">{fmtPesos(b.propinas)}</TdCelda>
              <TdCelda alinear="right" bold>{fmtPesos(b.total_generado)}</TdCelda>
              {mostrarComisiones && (
                <td style={{ ...tdBase, textAlign: 'right', color: theme.accent, fontWeight: theme.weightHeading }}>
                  {fmtPesos(b.comision)}
                  <span style={{
                    fontFamily: theme.mono,
                    fontSize: theme.sizeMicro,
                    fontWeight: theme.weightMedium,
                    color: theme.muted,
                    marginLeft: 6,
                    letterSpacing: '0.02em',
                  }}>
                    {b.comision_tipo === 'porcentaje' ? `${b.comision_valor}%` : `$${b.comision_valor}/c`}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${theme.accent}` }}>
            <td style={tdTotalBase}>TOTAL</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{totales.cantidad_cortes}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totales.monto_servicios)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totales.propinas)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right', color: theme.accent }}>
              {fmtPesos(totales.total_generado)}
            </td>
            {mostrarComisiones && (
              <td style={{ ...tdTotalBase, textAlign: 'right', color: theme.accent }}>
                {fmtPesos(totales.comision)}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Sub-componentes de tabla (cell helpers) ──────────────────────────────────

/**
 * ThCelda
 * Celda de header con eyebrow mono uppercase + tokens.
 * @param {{children, alinear?: 'left'|'right'}} props
 */
function ThCelda({ children, alinear = 'left' }) {
  return (
    <th style={{
      padding: '8px 14px',
      fontFamily: theme.mono,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightHeading,
      color: theme.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: alinear,
      borderBottom: `1px solid ${theme.hairline}`,
    }}>
      {children}
    </th>
  );
}

/**
 * TdCelda
 * Celda de cuerpo con tokens y opcionalmente alineada a derecha / en negrita.
 * @param {{children, alinear?: 'left'|'right', bold?: boolean}} props
 */
function TdCelda({ children, alinear = 'left', bold = false }) {
  return (
    <td style={{
      ...tdBase,
      textAlign: alinear,
      fontWeight: bold ? theme.weightHeading : theme.weightRegular,
      fontVariantNumeric: alinear === 'right' ? 'tabular-nums' : 'normal',
    }}>
      {children}
    </td>
  );
}

const tdBase = {
  padding: '8px 14px',
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  color: theme.ink,
  borderBottom: `1px solid ${theme.hairlineSoft}`,
};

const tdTotalBase = {
  padding: '10px 14px',
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  fontWeight: theme.weightHeading,
  color: theme.ink,
  fontVariantNumeric: 'tabular-nums',
};
