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
//   - Columna "Descansos": cuántos se tomó y cuánto tiempo (registro de
//     descansos, /admin/planilla/descansos; decisiones_descansos.md).
//   - Al tocar un barbero se abre ModalDetalleBarbero: cifras de la semana,
//     pago, total generado por día, por forma de pago y por origen, y el
//     registro de sus descansos (aunque no haya cortado). También en modo
//     barbero: ve su propio registro.
//   - El Excel del Resumen suma las columnas de descansos y una segunda hoja
//     "Descansos" con un renglón por descanso.
//   - El registro de descansos es opcional: si no se puede cargar, la planilla
//     se ve igual, con un aviso en su lugar (cargarDescansos).
//
// Origen de un corte (`con_turno` del backend): si vino de un turno o fue un
// cliente que llegó sin reservar. En la tabla del Detalle y su Excel, la
// columna "Cliente" muestra el nombre o "sin turno"; en el Resumen, la columna
// "Con turno" (en su Excel, "Con turno" y "Sin turno").
//
// Qué barberos se listan lo decide el backend (planillaService): los activos,
// aunque no hayan cortado (en 0), más los dados de baja que cortaron esa
// semana. El EmptyState de cada tab queda solo para cuando no hay ningún
// barbero que listar (ej. semanas anteriores al alta de todos).
//
// Comisión: siempre un porcentaje sobre los servicios (nunca sobre las
// propinas), con el % guardado en cada corte. La calcula el backend
// (backend/src/utils/comision.js) y manda la de cada corte en el detalle: la del
// día es la suma de sus cortes (utils/comision.js), y la de la semana viene en el
// resumen. Este archivo no repite la fórmula.
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
  fechaDeInstante,
  formatHora,
  formatDuracion,
  formatAntelacion,
} from '../../../utils/fecha';
import { fmtPesos, fmtPorcentaje, formatPago, OPCIONES_FORMA_PAGO } from '../../../utils/formato';
import { textoEstadoBloque } from '../../../utils/descansos';
import { sumarComision, porcentajesDeCortes, textoPorcentajeComision } from '../../../utils/comision';
import { cargarChunk } from '../../../utils/cargarChunk';
import {
  Tabs,
  LoadingState,
  EmptyState,
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
  Toast,
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
 * Texto de la columna "Cliente" de un corte: el nombre del cliente si vino de
 * un turno, o "sin turno" si fue alguien que llegó sin reservar.
 * Lo usan la tabla del Detalle y su Excel.
 * @param {{con_turno?: boolean, cliente_nombre: string|null}} corte
 * @returns {string} El nombre, 'sin turno', o '—' si el backend no mandó
 *   `con_turno` (así un backend viejo no rotula todo como "sin turno") o si el
 *   turno no tiene nombre de cliente.
 */
function textoCliente(corte) {
  if (corte.con_turno === false) return 'sin turno';
  if (corte.con_turno === true) return corte.cliente_nombre || '—';
  return '—';
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

/**
 * Suma el registro de descansos de varios barberos: cantidad, minutos y el %
 * sobre la suma de sus jornadas (fila TOTAL del Resumen y de su Excel).
 * @param {Array<{cantidad: number, minutos: number, minutos_jornada: number}>} registros
 * @returns {{cantidad: number, minutos: number, minutos_jornada: number, porcentaje: number|null}}
 *   `porcentaje` con un decimal, null si no hay jornada.
 */
function sumarDescansos(registros) {
  const cantidad = registros.reduce((s, r) => s + r.cantidad, 0);
  const minutos = registros.reduce((s, r) => s + r.minutos, 0);
  const jornada = registros.reduce((s, r) => s + r.minutos_jornada, 0);
  return {
    cantidad,
    minutos,
    minutos_jornada: jornada,
    porcentaje: jornada > 0 ? Math.round((minutos / jornada) * 1000) / 10 : null,
  };
}

/**
 * Rango horario de un bloque de descanso como texto. Uno liberado antes de
 * empezar no tiene rango efectivo: se muestra el que se había marcado.
 * @param {{ desde: string, hasta: string, hasta_programada: string, estado: string }} bloque
 *   - de /admin/planilla/descansos
 * @returns {string} Ej: '13:00 – 14:00'
 */
function rangoDescanso(bloque) {
  const fin = bloque.estado === 'liberado' ? bloque.hasta_programada : bloque.hasta;
  return `${formatHora(bloque.desde)} – ${formatHora(fin)}`;
}

/**
 * Cuánto antes se marcó un descanso, como texto. En uno de varias partes
 * pegadas dice también la de la parte marcada más tarde, que es la que delata
 * una extensión de último momento.
 * @param {{ partes: Array, antelacion_minutos: number, antelacion_ultima_minutos: number }} bloque
 *   - de /admin/planilla/descansos
 * @returns {string} Ej: 'marcado 1 día 2 h antes', '2 partes · la primera, 1 día
 *   antes; la última, 5 min antes'
 */
function textoAntelacionDescanso(bloque) {
  if (bloque.partes.length > 1) {
    return `${bloque.partes.length} partes · la primera, ${formatAntelacion(bloque.antelacion_minutos)} antes; `
      + `la última, ${formatAntelacion(bloque.antelacion_ultima_minutos)} antes`;
  }
  return `marcado ${formatAntelacion(bloque.antelacion_minutos)} antes`;
}

/**
 * Pide el registro de descansos de la semana (/admin/planilla/descansos). Es un
 * dato secundario: si falla, Planillas se muestra igual sin él (con un aviso),
 * en vez de caerse entera. Pasa, por ejemplo, con un backend anterior que no
 * tiene el endpoint, mientras se despliega. Por eso no lanza.
 * @param {string} fechaLunes - Lunes de la semana, YYYY-MM-DD.
 * @returns {Promise<Array|null>} El registro por barbero, o null si no se pudo cargar.
 */
async function cargarDescansos(fechaLunes) {
  try {
    const res = await apiFetch(`/admin/planilla/descansos?semana=${fechaLunes}`);
    if (!res.ok) throw new Error(`respuesta ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[seccionPlanillas] Registro de descansos no disponible:', err.message);
    return null;
  }
}

// Aviso que reemplaza al registro de descansos cuando no se pudo cargar.
const AVISO_DESCANSOS_NO_CARGADOS = 'No se pudo cargar el registro de descansos.';

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
  // Registro de descansos por barbero_id (/admin/planilla/descansos).
  const [descansosData, setDescansosData]         = useState(new Map());
  // true si el registro de descansos no se pudo cargar (el resto sí): se avisa
  // en el Resumen y en el modal, y el Excel sale sin las columnas de descansos.
  const [descansosNoCargaron, setDescansosNoCargaron] = useState(false);
  const [barberoActivo, setBarberoActivo]         = useState(null);
  const [mostrarComisiones, setMostrarComisiones] = useState(true);
  const [cargando, setCargando]                   = useState(false);
  const [error, setError]                         = useState(null);
  const [intento, setIntento]                     = useState(0);
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
        // El detalle y el resumen son la planilla: sin ellos no hay nada que
        // mostrar. Los descansos son opcionales (cargarDescansos no lanza).
        const [resDetalle, resResumen, descansos] = await Promise.all([
          apiFetch(`/admin/planilla?semana=${fechaLunes}`),
          apiFetch(`/admin/planilla/resumen?semana=${fechaLunes}`),
          cargarDescansos(fechaLunes),
        ]);
        if (!resDetalle.ok || !resResumen.ok) {
          throw new Error('Error en la respuesta del servidor');
        }
        const [detalle, resumen] = await Promise.all([resDetalle.json(), resResumen.json()]);
        if (cancelado) return;
        setDetalleData(detalle);
        setResumenData(resumen);
        setDescansosData(new Map((descansos ?? []).map((d) => [d.barbero_id, d])));
        setDescansosNoCargaron(descansos === null);
        setBarberoActivo((prev) => elegirBarberoInicial(detalle, prev));
        setDiasExpandidos(new Set([getFechaHoy()]));
      } catch (err) {
        console.error('[seccionPlanillas] Error en cargarDatos:', err.message);
        if (!cancelado) setError('No se pudieron cargar las planillas. Intentá de nuevo.');
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
    // vacío. Si la descarga falla, cargarChunk avisa con un toast.
    const XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    if (!XLSX) return;
    const filas = [];
    detalleData.forEach((barbero) => {
      const infoComision = resumenData?.barberos.find((b) => b.barbero_id === barbero.barbero_id);
      filas.push({
        Barbero: `── ${barbero.barbero_nombre} ──`,
        // Esta primera fila fija el orden de las columnas del Excel (json_to_sheet).
        Fecha: '', Hora: '', Servicio: '', Cliente: '', 'Monto ($)': '', 'Propina ($)': '', 'Total ($)': '',
        ...(mostrarComisiones ? { 'A pagar ($)': '' } : {}),
        'Forma de pago': '',
      });
      agruparPorDia(barbero.cortes).forEach(({ cortes: cd }) => {
        cd.forEach((c) => {
          filas.push({
            Barbero: '', Fecha: formatFechaCorta(c.fecha), Hora: c.hora, Servicio: c.servicio_nombre,
            Cliente: textoCliente(c),
            'Monto ($)': c.monto_servicios, 'Propina ($)': c.propina,
            'Total ($)': c.monto_servicios + c.propina,
            ...(mostrarComisiones ? { 'A pagar ($)': '' } : {}),
            'Forma de pago': formatPago(c.forma_pago),
          });
        });
        if (mostrarComisiones && infoComision) {
          const { servicios: montoDelDia, propinas: propinaDelDia, total: totalDelDia } = sumarCortes(cd);
          const comisionDelDia = sumarComision(cd);
          // La comisión del día suma las propinas (van siempre al barbero), igual
          // que el "Pago" del día en pantalla y la comisión semanal del backend:
          // así los subtotales de los días suman lo del subtotal de la semana.
          filas.push({
            Barbero: `Subtotal (${cd.length} cortes)`, Fecha: '', Hora: '', Servicio: '', Cliente: '',
            'Monto ($)': montoDelDia,
            'Propina ($)': propinaDelDia,
            'Total ($)': totalDelDia,
            'A pagar ($)': comisionDelDia + propinaDelDia, 'Forma de pago': '',
          });
        }
      });
      const { servicios: totalMonto, propinas: totalPropina, total: totalSemana } = sumarCortes(barbero.cortes);
      filas.push({
        Barbero: `Subtotal semana (${barbero.cortes.length} cortes)`, Fecha: '', Hora: '', Servicio: '', Cliente: '',
        'Monto ($)': totalMonto, 'Propina ($)': totalPropina, 'Total ($)': totalSemana,
        ...(mostrarComisiones && infoComision ? { 'A pagar ($)': infoComision.comision } : {}),
        'Forma de pago': '',
      });
      filas.push({ Barbero: '', Fecha: '', Hora: '', Servicio: '', Cliente: '', 'Monto ($)': '', 'Propina ($)': '', 'Total ($)': '', 'Forma de pago': '' });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Detalle semanal');
    XLSX.writeFile(wb, `detalle-semanal-${semana}.xlsx`);
  };

  // ── Exportación Excel — Resumen ───────────────────────────────────────────
  const exportarResumen = async () => {
    if (!resumenData?.barberos.length) return;
    // El import() va después del early-return: no bajamos el chunk en un export
    // vacío. Si la descarga falla, cargarChunk avisa con un toast.
    const XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    if (!XLSX) return;
    // En el Excel, con y sin turno van en dos columnas (en pantalla es una sola,
    // "N de M"): así se pueden sumar y filtrar como números. Lo mismo los
    // descansos: cantidad, minutos y % de la jornada, en columnas numéricas. Si
    // el registro no se pudo cargar, esas columnas no van (un 0 sería falso).
    const columnasDescansos = (d) => (descansosNoCargaron ? {} : {
      Descansos: d?.cantidad ?? 0,
      'Descanso (min)': d?.minutos ?? 0,
      '% jornada': d?.porcentaje ?? '',
    });
    const filas = resumenData.barberos.map((b) => ({
      Barbero: b.barbero_nombre, Cortes: b.cantidad_cortes,
      'Con turno': b.cortes_con_turno, 'Sin turno': b.cortes_sin_turno,
      'Monto servicios ($)': b.monto_servicios, 'Propinas ($)': b.propinas,
      'Total generado ($)': b.total_generado,
      ...(mostrarComisiones ? { 'A pagar ($)': b.comision } : {}),
      ...columnasDescansos(descansosData.get(b.barbero_id)),
    }));
    const t = resumenData.totales;
    filas.push({
      Barbero: 'TOTAL', Cortes: t.cantidad_cortes,
      'Con turno': t.cortes_con_turno, 'Sin turno': t.cortes_sin_turno,
      'Monto servicios ($)': t.monto_servicios, 'Propinas ($)': t.propinas,
      'Total generado ($)': t.total_generado,
      ...(mostrarComisiones ? { 'A pagar ($)': t.comision } : {}),
      ...columnasDescansos(sumarDescansos([...descansosData.values()])),
    });

    // Segunda hoja: un renglón por descanso, también los liberados antes de
    // empezar (no cuentan en el tiempo, pero quedan registrados). Las
    // antelaciones van en minutos para poder ordenar por la más corta.
    const filasDescansos = [...descansosData.values()].flatMap((d) =>
      d.bloques.map((bl) => ({
        Barbero: d.barbero_nombre,
        Día: formatFechaCorta(fechaDeInstante(bl.desde)),
        Desde: formatHora(bl.desde),
        Hasta: formatHora(bl.hasta),
        'Programado hasta': formatHora(bl.hasta_programada),
        Minutos: bl.minutos,
        Estado: textoEstadoBloque(bl.estado, bl.hasta),
        'Antelación (min)': bl.antelacion_minutos,
        'Antelación de la última parte (min)': bl.antelacion_ultima_minutos,
        Partes: bl.partes.length,
        'Lo cargó': bl.origen === 'admin' ? 'Administrador' : 'Barbero',
      })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Resumen semanal');
    if (filasDescansos.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasDescansos), 'Descansos');
    }
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
  const descansosDetalle = descansosData.get(barberoDetalle) ?? null;

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
          <>
            {descansosNoCargaron && <Toast tone="warning">{AVISO_DESCANSOS_NO_CARGADOS}</Toast>}
            <TablaResumen
              resumenData={resumenData}
              descansos={descansosData}
              mostrarComisiones={mostrarComisiones}
              onVerDetalle={setBarberoDetalle}
            />
          </>
        )
      )}

      <ModalDetalleBarbero
        resumen={resumenDetalle}
        cortes={cortesDetalle}
        descansos={descansosDetalle}
        descansosNoCargaron={descansosNoCargaron}
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
 * @param {object|null} props.infoComisionActiva - Fila del barbero en el resumen.
 *   `null` si no se cargó (entonces no se muestra el pago del día). La comisión
 *   del día sale de los cortes; de acá solo se toma el % actual de respaldo.
 * @param {boolean} props.mostrarComisiones
 */
function BloqueDia({ fecha, cortesDelDia, expandido, esHoy, onToggle, infoComisionActiva, mostrarComisiones }) {
  const { servicios: totalMonto, propinas: totalPropina, total: totalGeneral } = sumarCortes(cortesDelDia);
  const comisionDelDia = sumarComision(cortesDelDia);

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
                <ThCelda>Cliente</ThCelda>
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
                  <TdCelda>{textoCliente(c)}</TdCelda>
                  <TdCelda alinear="right">{fmtPesos(c.monto_servicios)}</TdCelda>
                  <TdCelda alinear="right">
                    {c.propina > 0
                      ? fmtPesos(c.propina)
                      : <span style={{ color: theme.muted }}>—</span>}
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
            {/* Hora, Servicio y Cliente. */}
            <td colSpan={3} style={{ ...tdTotalBase, color: theme.ink }}>
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
                    {textoPorcentajeComision(porcentajesDeCortes(cortesDelDia), infoComisionActiva.comision_valor)} + prop
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
 * Contenido de la celda "Con turno" del Resumen: cuántos de los cortes vinieron
 * de un turno (ej. "8 de 15"). Los sin turno son la resta.
 * @param {number|undefined} conTurno - `cortes_con_turno` del resumen.
 * @param {number} total - `cantidad_cortes` del resumen.
 * @returns {JSX.Element|string} "N de M", o un "—" gris si no hay cortes o si
 *   el backend no mandó el dato.
 */
function textoConTurno(conTurno, total) {
  if (typeof conTurno !== 'number' || total === 0) {
    return <span style={{ color: theme.muted }}>—</span>;
  }
  return `${conTurno} de ${total}`;
}

/**
 * Contenido de la celda "Descansos" del Resumen: cuántos y cuánto tiempo.
 * @param {{cantidad: number, minutos: number}|undefined} registro - del barbero
 *   en /admin/planilla/descansos (o la suma, en la fila TOTAL).
 * @returns {JSX.Element|string} Ej: "3 · 1 h 30 min", o un "—" gris si no se
 *   tomó ninguno o no llegó el dato.
 */
function textoDescansos(registro) {
  if (!registro || registro.cantidad === 0) {
    return <span style={{ color: theme.muted }}>—</span>;
  }
  return `${registro.cantidad} · ${formatDuracion(registro.minutos)}`;
}

/**
 * TablaResumen
 * Tabla consolidada del tab Resumen. Una fila por barbero + fila TOTAL.
 * Cada fila de barbero abre su detalle: click en cualquier parte de la fila y,
 * para el teclado, el botón con chevron de la última celda (patrón de fila
 * clickeable, sistema de diseño §4.4).
 *
 * @param {object} props
 * @param {{ barberos: Array, totales: object }} props.resumenData
 * @param {Map<string, object>} props.descansos - Registro de descansos por barbero_id.
 * @param {boolean} props.mostrarComisiones
 * @param {(barberoId: string) => void} props.onVerDetalle - Abre el detalle del barbero.
 */
function TablaResumen({ resumenData, descansos, mostrarComisiones, onVerDetalle }) {
  const { barberos, totales } = resumenData;
  const totalDescansos = sumarDescansos([...descansos.values()]);
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
            <ThCelda alinear="right">Con turno</ThCelda>
            <ThCelda alinear="right">Descansos</ThCelda>
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
              <TdCelda alinear="right">{textoConTurno(b.cortes_con_turno, b.cantidad_cortes)}</TdCelda>
              <TdCelda alinear="right">{textoDescansos(descansos.get(b.barbero_id))}</TdCelda>
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
                    {textoPorcentajeComision(b.comision_porcentajes, b.comision_valor)} + prop
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
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>
              {textoConTurno(totales.cortes_con_turno, totales.cantidad_cortes)}
            </td>
            <td style={{ ...tdTotalBase, textAlign: 'right' }}>{textoDescansos(totalDescansos)}</td>
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
 * Renglones de "Pago de la semana": comisión, propinas y total a pagar. Los
 * montos vienen del backend: `comision_servicios` (sin propinas) y `comision`
 * (ya incluye las propinas). El modal no repite la fórmula.
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
  return [
    {
      label: `Comisión (${textoPorcentajeComision(resumen.comision_porcentajes, resumen.comision_valor)} de servicios)`,
      monto: resumen.comision_servicios,
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
 * filasPorOrigen
 * Dos filas, con turno y sin turno, con sus cortes y el total generado
 * (servicios + propinas) de cada una: cuánto entra por el turnero y cuánto por
 * clientes que llegan sin turno.
 * @param {Array} cortes - Cortes del barbero en la semana (/admin/planilla).
 * @returns {Array<{clave: string, label: string, cantidad: number, total: number}>}
 *   Filas para ListaConBarras.
 */
function filasPorOrigen(cortes) {
  return [
    { clave: 'con_turno', label: 'Con turno', valor: true },
    { clave: 'sin_turno', label: 'Sin turno', valor: false },
  ].map(({ clave, label, valor }) => {
    // Comparación estricta: un corte sin el dato (backend viejo) no cae en ninguna.
    const delOrigen = cortes.filter((c) => c.con_turno === valor);
    return { clave, label, cantidad: delOrigen.length, total: sumarCortes(delOrigen).total };
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
  return (
    <CifrasRecuadros cifras={[
      { label: 'Cortes',         valor: resumen.cantidad_cortes },
      { label: 'Servicios',      valor: fmtPesos(resumen.monto_servicios) },
      { label: 'Propinas',       valor: fmtPesos(resumen.propinas) },
      { label: 'Total generado', valor: fmtPesos(resumen.total_generado) },
    ]} />
  );
}

/**
 * CifrasRecuadros
 * Cifras en recuadros: rótulo mono arriba, valor grande abajo y, opcional, una
 * nota chica que le da contexto (ej. "de 38 h"). La usan las cifras de la
 * semana y las de los descansos del modal.
 * @param {Array<{label: string, valor: string|number, nota?: string}>} props.cifras
 * @returns {JSX.Element}
 */
function CifrasRecuadros({ cifras }) {
  // auto-fit: todas en una fila si entran; si no, pasan a la siguiente.
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
            {c.nota && (
              <span style={{
                marginLeft: 6,
                fontSize: theme.sizeBody,
                fontWeight: theme.weightRegular,
                color: theme.muted,
                letterSpacing: 0,
              }}>
                {c.nota}
              </span>
            )}
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
 * La usan "Total generado por día", "Por forma de pago" y "Por origen" del modal.
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
      <TituloSeccion>{titulo}</TituloSeccion>

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
                color: theme.muted,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {vacio ? '—' : `${f.cantidad} corte${f.cantidad !== 1 ? 's' : ''}`}
              </span>
              <span style={{
                textAlign: 'right',
                color: vacio ? theme.muted : theme.ink,
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
 * TituloSeccion
 * Eyebrow mono en mayúsculas sobre una sección del modal del barbero.
 * @param {ReactNode} props.children - El título
 * @returns {JSX.Element}
 */
function TituloSeccion({ children }) {
  return (
    <div style={{
      marginBottom: 4,
      fontFamily: theme.mono,
      fontWeight: theme.weightHeading,
      fontSize: theme.sizeMicro,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.inkSoft,
    }}>
      {children}
    </div>
  );
}

/**
 * RegistroDescansos
 * Sección "Descansos" del modal del barbero: cuántos se tomó en la semana,
 * cuánto tiempo y qué parte de su jornada, y la lista de cada uno (día, rango,
 * duración, estado, antelación y si lo cargó el administrador). Los liberados
 * antes de empezar se listan en gris y no suman. Los descansos pegados son uno
 * solo (los une el backend).
 * @param {object} props.registro - Del barbero en /admin/planilla/descansos:
 *   { cantidad, minutos, minutos_jornada, porcentaje, bloques }
 * @returns {JSX.Element}
 */
function RegistroDescansos({ registro }) {
  const { cantidad, minutos, minutos_jornada: jornada, porcentaje, bloques } = registro;
  const sinTomar = cantidad === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TituloSeccion>Descansos</TituloSeccion>
      <CifrasRecuadros cifras={[
        { label: 'Descansos', valor: cantidad },
        { label: 'Tiempo', valor: sinTomar ? '—' : formatDuracion(minutos) },
        {
          label: 'De la jornada',
          valor: porcentaje === null ? '—' : fmtPorcentaje(porcentaje),
          nota: jornada > 0 ? `de ${formatDuracion(jornada)}` : undefined,
        },
      ]} />

      {bloques.length === 0 ? (
        <p style={{ margin: '4px 0 0', fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          Sin descansos esta semana.
        </p>
      ) : (
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {bloques.map((bl) => {
            const liberado = bl.estado === 'liberado';
            const detalle = [
              textoEstadoBloque(bl.estado, bl.hasta)
                + (bl.estado === 'terminado_antes' ? ` (era hasta ${formatHora(bl.hasta_programada)})` : ''),
              textoAntelacionDescanso(bl),
              ...(bl.origen === 'admin' ? ['lo cargó el administrador'] : []),
            ].join(' · ');
            return (
              <li
                key={bl.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: `1px solid ${theme.hairlineSoft}`,
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ color: liberado ? theme.muted : theme.ink, fontWeight: theme.weightMedium }}>
                    {formatFechaCorta(fechaDeInstante(bl.desde))} · {rangoDescanso(bl)}
                  </span>
                  <span style={{ color: theme.muted, lineHeight: 1.5 }}>{detalle}</span>
                </div>
                <span style={{
                  flexShrink: 0,
                  color: liberado ? theme.muted : theme.ink,
                  fontWeight: theme.weightMedium,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {liberado ? '—' : formatDuracion(bl.minutos)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * ModalDetalleBarbero
 * Detalle de la semana de un barbero, desde el tab Resumen: las cuatro cifras
 * de la semana, el pago (solo con comisiones), el total generado por día, por
 * forma de pago y por origen (con / sin turno), y el registro de sus descansos.
 * Sin cortes, la parte de plata se reemplaza por un aviso, pero los descansos
 * se ven igual. En modo barbero se ve igual: son sus propios números. No
 * calcula comisiones: usa la fila del resumen y suma los cortes del detalle.
 * @param {object|null} props.resumen - Fila del barbero en /admin/planilla/resumen;
 *   null = cerrado.
 * @param {Array}   props.cortes            - Cortes del barbero en la semana (/admin/planilla).
 * @param {object|null} props.descansos     - Su registro en /admin/planilla/descansos;
 *   null si no llegó (no se muestra la sección).
 * @param {boolean} props.descansosNoCargaron - El registro de descansos no se pudo
 *   cargar: en lugar de la sección va un aviso.
 * @param {string}  props.semana            - Semana 'YYYY-WNN'.
 * @param {boolean} props.mostrarComisiones - Estado del toggle de comisiones.
 * @param {() => void} props.onClose        - Cierra el modal.
 * @param {(barberoId: string) => void} props.onVerCortes - Pasa al tab Detalle con ese barbero.
 * @returns {JSX.Element|null}
 */
function ModalDetalleBarbero({
  resumen, cortes, descansos, descansosNoCargaron, semana, mostrarComisiones, onClose, onVerCortes,
}) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sinCortes ? (
        <EmptyState
          glyph={<Scissors size={28} strokeWidth={1.5} />}
          title="Sin cortes esta semana"
          body="No hay cortes registrados en la semana seleccionada."
        />
      ) : (
        <>
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
          {/* Misma escala: qué parte de la semana vino de turnos y qué parte no. */}
          <ListaConBarras
            titulo="Por origen"
            filas={filasPorOrigen(cortes)}
            maximo={resumen.total_generado}
          />
        </>
      )}
      {descansosNoCargaron
        ? <Toast tone="warning">{AVISO_DESCANSOS_NO_CARGADOS}</Toast>
        : descansos && <RegistroDescansos registro={descansos} />}
      </div>
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
