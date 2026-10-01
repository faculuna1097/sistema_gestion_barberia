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
//     "A pagar" opcional (comisión + propinas; toggle global).
//   - Al tocar un barbero se abre ModalDetalleBarbero: cifras de la semana,
//     pago, total generado por día y por forma de pago. También en modo barbero.
//
// Qué barberos se listan lo decide el backend (planillaService): los activos,
// aunque no hayan cortado (en 0), más los dados de baja que cortaron esa
// semana. El EmptyState de cada tab queda solo para cuando no hay ningún
// barbero que listar (ej. semanas anteriores al alta de todos).
//
// Comisión por día: comisión calculada sobre monto_servicios (nunca sobre
// propinas), según comision_tipo del barbero ("porcentaje" o "fijo" por corte).
// Hoy no hay barberos con comisión fija: siempre es porcentaje (ver la deuda
// "Comisión: siempre porcentaje" en docs/estado_actual.md).
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// El fondo del contenedor lo da PanelAdmin (theme.surfaceAlt, D7 del plan).
// Loading via primitivo LoadingState (D6). Hover de filas via :hover scoped con
// <style> inline (excepción consciente §4.2, deuda #21).

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Scissors, RefreshCw, ArrowRight } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import {
  getFechaHoy,
  formatFechaCorta,
  getSemanaActual,
  semanaAFechaLunes,
  semanaALabel,
  desplazarDia,
} from '../../../utils/fecha';
import { fmtPesos, formatPago, OPCIONES_FORMA_PAGO } from '../../../utils/formato';
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
  Modal,
  BotonIconoFila,
  DesgloseMontos,
  BarraProporcional,
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
 * Suma los montos de una lista de cortes (un día, una semana, una forma de pago).
 * @param {Array<{monto_servicios: number, propina: number}>} cortes
 * @returns {{servicios: number, propinas: number, total: number}} Monto de
 *   servicios, propinas y total generado (servicios + propinas).
 */
function sumarCortes(cortes) {
  const servicios = cortes.reduce((s, c) => s + c.monto_servicios, 0);
  const propinas  = cortes.reduce((s, c) => s + c.propina, 0);
  return { servicios, propinas, total: servicios + propinas };
}

/**
 * Calcula la comisión del día sobre el monto de servicios.
 * La rama `fijo` no se usa hoy (no hay barberos con comisión fija). Si
 * volviera: los que llaman le suman las propinas en los dos tipos, y el
 * backend no se las suma a `fijo` (deuda en docs/estado_actual.md).
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

/**
 * Elige el barbero seleccionado en el tab Detalle al cargar una semana.
 * Mantiene el que ya estaba elegido si sigue en la lista (permite comparar un
 * barbero entre semanas sin que el filtro salte a otro); si no, el primero con
 * cortes; si nadie cortó, el primero de la lista.
 * @param {Array} detalle - Respuesta de /admin/planilla (un item por barbero).
 * @param {string|null} barberoPrevio - barbero_id elegido antes de la carga.
 * @returns {string|null} barbero_id a seleccionar; null si la lista está vacía.
 */
function elegirBarberoInicial(detalle, barberoPrevio) {
  if (detalle.some((b) => b.barbero_id === barberoPrevio)) return barberoPrevio;
  const primeroConCortes = detalle.find((b) => b.cortes.length > 0);
  return (primeroConCortes ?? detalle[0])?.barbero_id ?? null;
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
  // barbero_id abierto en ModalDetalleBarbero (tab Resumen); null = cerrado.
  const [barberoDetalle, setBarberoDetalle] = useState(null);

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
        setBarberoActivo((prev) => elegirBarberoInicial(detalle, prev));
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
        ...(mostrarComisiones ? { 'A pagar ($)': '' } : {}),
        'Forma de pago': '',
      });
      agruparPorDia(barbero.cortes).forEach(({ cortes: cd }) => {
        cd.forEach((c) => {
          filas.push({
            Barbero: '', Fecha: formatFechaCorta(c.fecha), Hora: c.hora, Servicio: c.servicio_nombre,
            'Monto ($)': c.monto_servicios, 'Propina ($)': c.propina,
            'Total ($)': c.monto_servicios + c.propina,
            ...(mostrarComisiones ? { 'A pagar ($)': '' } : {}),
            'Forma de pago': formatPago(c.forma_pago),
          });
        });
        if (mostrarComisiones && infoComision) {
          const { servicios: montoDelDia, propinas: propinaDelDia, total: totalDelDia } = sumarCortes(cd);
          const comisionDelDia = calcularComisionDia(
            montoDelDia,
            infoComision.comision_tipo,
            infoComision.comision_valor,
            cd.length,
          );
          // La comisión del día suma las propinas (van siempre al barbero), igual
          // que el "Pago" del día en pantalla y la comisión semanal del backend:
          // así los subtotales de los días suman lo del subtotal de la semana.
          filas.push({
            Barbero: `Subtotal (${cd.length} cortes)`, Fecha: '', Hora: '', Servicio: '',
            'Monto ($)': montoDelDia,
            'Propina ($)': propinaDelDia,
            'Total ($)': totalDelDia,
            'A pagar ($)': comisionDelDia + propinaDelDia, 'Forma de pago': '',
          });
        }
      });
      const { servicios: totalMonto, propinas: totalPropina, total: totalSemana } = sumarCortes(barbero.cortes);
      filas.push({
        Barbero: `Subtotal semana (${barbero.cortes.length} cortes)`, Fecha: '', Hora: '', Servicio: '',
        'Monto ($)': totalMonto, 'Propina ($)': totalPropina, 'Total ($)': totalSemana,
        ...(mostrarComisiones && infoComision ? { 'A pagar ($)': infoComision.comision } : {}),
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
      ...(mostrarComisiones ? { 'A pagar ($)': b.comision } : {}),
    }));
    const t = resumenData.totales;
    filas.push({
      Barbero: 'TOTAL', Cortes: t.cantidad_cortes,
      'Monto servicios ($)': t.monto_servicios, 'Propinas ($)': t.propinas,
      'Total generado ($)': t.total_generado,
      ...(mostrarComisiones ? { 'A pagar ($)': t.comision } : {}),
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
  // Datos del modal del Resumen: la fila del resumen y los cortes del detalle.
  // El modal lee las dos respuestas (misma dependencia entre tabs que la #28).
  const resumenDetalle = resumenData?.barberos.find((b) => b.barbero_id === barberoDetalle) ?? null;
  const cortesDetalle  = detalleData.find((b) => b.barbero_id === barberoDetalle)?.cortes ?? [];

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

  /**
   * Desde el modal del Resumen, cierra el modal y pasa al tab Detalle con ese
   * barbero elegido (sus cortes de la semana, día por día).
   * @param {string} barberoId
   */
  const verCortes = (barberoId) => {
    setBarberoDetalle(null);
    cambiarBarbero(barberoId);
    setTabActiva('detalle');
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
                body={modoBarbero
                  ? 'No tenés cortes en la semana seleccionada.'
                  : 'Este barbero no tiene cortes en la semana seleccionada.'}
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
          <TablaResumen
            resumenData={resumenData}
            mostrarComisiones={mostrarComisiones}
            onVerDetalle={setBarberoDetalle}
          />
        )
      )}

      <ModalDetalleBarbero
        resumen={resumenDetalle}
        cortes={cortesDetalle}
        semana={semana}
        mostrarComisiones={mostrarComisiones}
        onClose={() => setBarberoDetalle(null)}
        onVerCortes={verCortes}
      />
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
  const { servicios: totalMonto, propinas: totalPropina, total: totalGeneral } = sumarCortes(cortesDelDia);
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
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>
              {fmtPesos(totalGeneral)}
            </td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>
              {mostrarComisiones && infoComisionActiva ? (
                <span style={{ fontWeight: theme.weightHeading }}>
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
 * Cada fila de barbero abre su detalle: click en cualquier parte de la fila y,
 * para el teclado, el botón con chevron de la última celda (patrón de fila
 * clickeable, sistema de diseño §4.4).
 *
 * @param {object} props
 * @param {{ barberos: Array, totales: object }} props.resumenData
 * @param {boolean} props.mostrarComisiones
 * @param {(barberoId: string) => void} props.onVerDetalle - Abre el detalle del barbero.
 */
function TablaResumen({ resumenData, mostrarComisiones, onVerDetalle }) {
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
            {/* "A pagar" y no "Comisión": el monto incluye las propinas (en
                Balances, "comisión" no las incluye). */}
            {mostrarComisiones && <ThCelda alinear="right">A pagar</ThCelda>}
            <th aria-label="Detalle" style={{ width: 1, borderBottom: `1px solid ${theme.hairline}` }} />
          </tr>
        </thead>
        <tbody>
          {barberos.map((b) => (
            <tr
              key={b.barbero_id}
              className="om-fila-hover"
              onClick={() => onVerDetalle(b.barbero_id)}
              style={{ cursor: 'pointer' }}
            >
              <TdCelda bold>{b.barbero_nombre}</TdCelda>
              <TdCelda alinear="right">{b.cantidad_cortes}</TdCelda>
              <TdCelda alinear="right">{fmtPesos(b.monto_servicios)}</TdCelda>
              <TdCelda alinear="right">{fmtPesos(b.propinas)}</TdCelda>
              <TdCelda alinear="right" bold>{fmtPesos(b.total_generado)}</TdCelda>
              {mostrarComisiones && (
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: theme.weightHeading }}>
                  {fmtPesos(b.comision)}
                  <span style={{
                    fontFamily: theme.mono,
                    fontSize: theme.sizeMicro,
                    fontWeight: theme.weightMedium,
                    color: theme.muted,
                    marginLeft: 6,
                    letterSpacing: '0.02em',
                  }}>
                    {/* Con `fijo` (hoy sin uso) el backend no suma propinas. */}
                    {b.comision_tipo === 'porcentaje' ? `${b.comision_valor}% + prop` : `$${b.comision_valor}/c`}
                  </span>
                </td>
              )}
              {/* Padding vertical chico: el botón de 28px no agranda la fila. */}
              <td style={{ ...tdBase, padding: '4px 14px 4px 0' }}>
                <BotonIconoFila
                  tono="accent"
                  icono={<ChevronRight size={14} strokeWidth={1.75} />}
                  ariaLabel={`Ver el detalle de ${b.barbero_nombre}`}
                  onClick={(e) => {
                    // Sin esto, el click también le llega al <tr>.
                    e.stopPropagation();
                    onVerDetalle(b.barbero_id);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${theme.accent}` }}>
            <td style={tdTotalBase}>TOTAL</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{totales.cantidad_cortes}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totales.monto_servicios)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{fmtPesos(totales.propinas)}</td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>
              {fmtPesos(totales.total_generado)}
            </td>
            {mostrarComisiones && (
              <td style={{ ...tdTotalBase, textAlign: 'right' }}>
                {fmtPesos(totales.comision)}
              </td>
            )}
            {/* Columna del botón de detalle: la fila TOTAL no abre nada. */}
            <td style={tdTotalBase} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Modal: detalle de un barbero en la semana ────────────────────────────────

/**
 * renglonesPago
 * Renglones de "Pago de la semana": comisión, propinas y total a pagar. El
 * total es `comision` del backend (ya incluye las propinas) y la comisión sola
 * sale de restarle las propinas: el modal no repite la fórmula de comisión.
 * Con `fijo` (hoy sin uso) el backend no suma propinas, así que la comisión va
 * sin el renglón de propinas.
 * Todo en neutro: Planillas la ven el dueño y el barbero, y para uno este monto
 * es una salida y para el otro lo que cobra (sistema_de_disenio §3.1.1).
 * @param {object} resumen - Fila del barbero en /admin/planilla/resumen.
 * @returns {Array<object>} Renglones para DesgloseMontos.
 */
function renglonesPago(resumen) {
  const total = {
    operador: '=',
    label: 'Total a pagar',
    monto: resumen.comision,
    variante: 'total',
  };
  if (resumen.comision_tipo !== 'porcentaje') {
    return [
      { label: `Comisión (${fmtPesos(resumen.comision_valor)} por corte)`, monto: resumen.comision },
      total,
    ];
  }
  return [
    {
      label: `Comisión (${resumen.comision_valor}% de servicios)`,
      monto: resumen.comision - resumen.propinas,
    },
    { operador: '+', label: 'Propinas', monto: resumen.propinas },
    total,
  ];
}

/**
 * filasPorDia
 * Los siete días de la semana (lunes a domingo) con sus cortes y el total
 * generado de cada uno. Los días sin cortes quedan con cantidad 0.
 * @param {Array}  cortes - Cortes del barbero en la semana (/admin/planilla).
 * @param {string} semana - Semana 'YYYY-WNN'.
 * @returns {Array<{clave: string, label: string, cantidad: number, total: number}>}
 *   Filas para ListaConBarras.
 */
function filasPorDia(cortes, semana) {
  const lunes = semanaAFechaLunes(semana);
  const cortesPorFecha = new Map(agruparPorDia(cortes).map((d) => [d.fecha, d.cortes]));
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = desplazarDia(lunes, i);
    const delDia = cortesPorFecha.get(fecha) ?? [];
    return {
      clave: fecha,
      label: formatFechaCorta(fecha),
      cantidad: delDia.length,
      total: sumarCortes(delDia).total,
    };
  });
}

/**
 * filasPorFormaPago
 * Una fila por forma de pago del sistema, con sus cortes y el total generado
 * (servicios + propinas) que entró por ella.
 * @param {Array} cortes - Cortes del barbero en la semana (/admin/planilla).
 * @returns {Array<{clave: string, label: string, cantidad: number, total: number}>}
 *   Filas para ListaConBarras.
 */
function filasPorFormaPago(cortes) {
  return OPCIONES_FORMA_PAGO.map(({ value, label }) => {
    const deLaForma = cortes.filter((c) => c.forma_pago === value);
    return {
      clave: value,
      label,
      cantidad: deLaForma.length,
      total: sumarCortes(deLaForma).total,
    };
  });
}

/**
 * CifrasSemana
 * Las cuatro cifras de la semana del barbero en recuadros: cortes, servicios,
 * propinas y total generado. Salen tal cual del resumen del backend.
 * @param {object} props.resumen - Fila del barbero en /admin/planilla/resumen.
 * @returns {JSX.Element}
 */
function CifrasSemana({ resumen }) {
  const cifras = [
    { label: 'Cortes',         valor: resumen.cantidad_cortes },
    { label: 'Servicios',      valor: fmtPesos(resumen.monto_servicios) },
    { label: 'Propinas',       valor: fmtPesos(resumen.propinas) },
    { label: 'Total generado', valor: fmtPesos(resumen.total_generado) },
  ];

  // auto-fit: 4 columnas si entran; si no, pasan a 2.
  return (
    <dl style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: 8,
      margin: 0,
    }}>
      {cifras.map((c) => (
        <div
          key={c.label}
          style={{
            border: `1px solid ${theme.hairline}`,
            borderRadius: theme.radius,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <dt style={{
            fontFamily: theme.mono,
            fontSize: theme.sizeMicro,
            fontWeight: theme.weightMedium,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: theme.muted,
          }}>
            {c.label}
          </dt>
          <dd style={{
            margin: 0,
            fontFamily: theme.body,
            fontSize: theme.sizeHeading,
            fontWeight: theme.weightHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {c.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * ListaConBarras
 * Lista de filas con la forma: rótulo · barra proporcional al total · cortes ·
 * monto. Las filas sin cortes quedan en gris con "—" (así se ven los huecos).
 * La barra va en gris, como las neutras de DesgloseMontos: son ingresos
 * (sistema_de_disenio §3.1.1).
 * La usan "Total generado por día" y "Por forma de pago" del modal.
 * @param {string} props.titulo - Eyebrow mono sobre la lista.
 * @param {Array<{clave: string, label: string, cantidad: number, total: number}>} props.filas
 * @param {number} [props.maximo] - Total que ocupa la barra entera. Default: la
 *   fila más grande.
 * @returns {JSX.Element}
 */
function ListaConBarras({ titulo, filas, maximo }) {
  const tope = maximo ?? Math.max(0, ...filas.map((f) => f.total));

  return (
    <div>
      <div style={{
        marginBottom: 4,
        fontFamily: theme.mono,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: theme.inkSoft,
      }}>
        {titulo}
      </div>

      {/* role="list": Safari les saca la semántica de lista a las <ul> con
          list-style none. */}
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {filas.map((f) => {
          const vacio = f.cantidad === 0;
          return (
            <li
              key={f.clave}
              style={{
                display: 'grid',
                // Monto en 112px, igual que DesgloseMontos: los montos del
                // modal quedan alineados entre secciones.
                gridTemplateColumns: '120px minmax(0, 1fr) 72px 112px',
                columnGap: 12,
                alignItems: 'center',
                padding: '8px 0',
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
              }}
            >
              <span style={{ color: vacio ? theme.muted : theme.ink }}>
                {f.label}
              </span>
              <BarraProporcional segmentos={[{ valor: f.total, color: theme.mutedSoft }]} maximo={tope} />
              <span style={{
                textAlign: 'right',
                color: vacio ? theme.mutedSoft : theme.muted,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {vacio ? '—' : `${f.cantidad} corte${f.cantidad !== 1 ? 's' : ''}`}
              </span>
              <span style={{
                textAlign: 'right',
                color: vacio ? theme.mutedSoft : theme.ink,
                fontWeight: theme.weightMedium,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {vacio ? '—' : fmtPesos(f.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * ModalDetalleBarbero
 * Detalle de la semana de un barbero, desde el tab Resumen: las cuatro cifras
 * de la semana, el pago (solo con comisiones), el total generado por día y por
 * forma de pago. En modo barbero se ve igual: son sus propios números. No
 * calcula comisiones: usa la fila del resumen y suma los cortes del detalle.
 * @param {object|null} props.resumen - Fila del barbero en /admin/planilla/resumen;
 *   null = cerrado.
 * @param {Array}   props.cortes            - Cortes del barbero en la semana (/admin/planilla).
 * @param {string}  props.semana            - Semana 'YYYY-WNN'.
 * @param {boolean} props.mostrarComisiones - Estado del toggle de comisiones.
 * @param {() => void} props.onClose        - Cierra el modal.
 * @param {(barberoId: string) => void} props.onVerCortes - Pasa al tab Detalle con ese barbero.
 * @returns {JSX.Element|null}
 */
function ModalDetalleBarbero({ resumen, cortes, semana, mostrarComisiones, onClose, onVerCortes }) {
  if (!resumen) return null;

  const sinCortes = resumen.cantidad_cortes === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={resumen.barbero_nombre}
      subtitle={`Semana ${semanaALabel(semana)}`}
      maxWidth={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <Button variant="ghost" full={false} onClick={onClose}>Cerrar</Button>
          {!sinCortes && (
            <Button variant="secondary" full={false} onClick={() => onVerCortes(resumen.barbero_id)}>
              Ver los cortes
              <ArrowRight size={16} strokeWidth={1.75} />
            </Button>
          )}
        </div>
      }
    >
      {sinCortes ? (
        <EmptyState
          glyph={<Scissors size={28} strokeWidth={1.5} />}
          title="Sin cortes esta semana"
          body="No hay cortes registrados en la semana seleccionada."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <CifrasSemana resumen={resumen} />
          {mostrarComisiones && (
            <DesgloseMontos
              titulo="Pago de la semana"
              renglones={renglonesPago(resumen)}
              conBarras={false}
            />
          )}
          <ListaConBarras titulo="Total generado por día" filas={filasPorDia(cortes, semana)} />
          {/* Escala = total de la semana: cada barra muestra qué parte entró por esa forma. */}
          <ListaConBarras
            titulo="Por forma de pago"
            filas={filasPorFormaPago(cortes)}
            maximo={resumen.total_generado}
          />
        </div>
      )}
    </Modal>
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
