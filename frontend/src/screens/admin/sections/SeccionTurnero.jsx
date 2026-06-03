// /frontend/src/screens/admin/sections/SeccionTurnero.jsx
//
// Sección Turnero del panel admin — vista global de turnos del día.
//
// Decisiones de diseño puntuales de esta sección:
//   - SIN ScreenHeader: para maximizar la verticalidad de la agenda, el título
//     se omite (excepción consciente al patrón del resto del admin).
//   - DOS vistas en toggle: "Agenda" (default) y "Lista".
//     * Agenda: grilla CSS hecha a mano. Eje vertical = horas de la jornada,
//       columnas = barberos visibles. Cada turno es un bloque dimensionado por
//       su duración real. Si la fecha es hoy y la hora actual está dentro del
//       rango, se dibuja una línea horizontal indigo de "ahora".
//     * Lista: tabla densa D10 (sin bandas grises, hover scoped). Click en
//       fila abre el mismo Modal de detalle que la agenda.
//   - Filtros: chips de barbero (primarios, tamaño md) + chips de estado
//     (secundarios, tamaño sm) usando el primitivo ChipFiltro.
//   - KPIs del día (Total / Reservados / Completados / Sin éxito) calculados
//     sobre el dataset completo del día (no respeta filtros), así representan
//     siempre "lo que hay en el día".
//   - Errores de acción (cambiar estado / cancelar) se muestran como banner
//     inline con auto-dismiss. NO se usa alert() ni Toast (Toast queda como
//     deuda — construir cuando aparezca el segundo caso).
//   - El rango horario de la agenda parte de la jornada de atención real del
//     local ese día (GET /admin/horario-atencion) y se EXPANDE para incluir
//     cualquier turno que caiga fuera de ella (padding 1h por extremo). Si el
//     horario no se pudo leer o el día está cerrado, cae al fallback 08:00–22:00.
//   - Días que el local tiene cerrados: si no hay turnos, se muestra un
//     EmptyState "Local cerrado" en vez de una grilla vacía engañosa; si hay
//     turnos (caso borde: reservados antes de cerrar ese día), se muestra la
//     grilla igual con una nota.

import { useState, useEffect } from 'react';
import {
  Check,
  UserX,
  Trash2,
  X,
  Calendar,
  CalendarOff,
  Phone,
  Mail,
  Copy,
  CheckCircle2,
  CalendarDays,
  Hourglass,
  RefreshCw,
} from 'lucide-react';

import {
  getBarberosAdmin,
  getServiciosAdmin,
  getAdminTurnos,
  getAdminHorarioAtencion,
  patchAdminTurnoEstado,
  completarAdminTurno,
  cancelarAdminTurno,
} from '../../../services/api';
import { getFechaHoy, formatHora, aHoraCorta, TZ } from '../../../utils/fecha';
import { fmtPesos } from '../../../utils/formato';
import { theme } from '../../../theme/tokens.js';
import {
  LoadingState,
  EmptyState,
  IconoAlerta,
  Button,
  Field,
  Select,
  ChipFiltro,
  Modal,
  DetalleRecurso,
  AvatarIniciales,
  BadgeFormaPago,
  Toast,
  SelectorDia,
} from '../../../components/ui';

// ═══════════════════════════════════════════════════════════════════════════
// Constantes y maps
// ═══════════════════════════════════════════════════════════════════════════

// Mapa de estado → colores semánticos del admin + labels + ícono.
// Diferente del primitivo StatusPill (que mapea para el flujo del cliente —
// allí "reservado" = success). Per D9, está OK divergir: en el admin,
// "reservado" significa "abierto, requiere atención" → accent (indigo).
const ESTADO_MAP = {
  reservado:  { bg: theme.accentSoft,  fg: theme.accent,  border: theme.accent,  label: 'Reservado',  Icon: Calendar },
  completado: { bg: theme.successSoft, fg: theme.success, border: theme.success, label: 'Completado', Icon: CheckCircle2 },
  no_asistio: { bg: theme.warningSoft, fg: theme.warning, border: theme.warning, label: 'No asistió', Icon: UserX },
  cancelado:  { bg: theme.surfaceAlt,  fg: theme.muted,   border: theme.muted,   label: 'Cancelado',  Icon: X },
};

// Lista de estados filtrables, en el orden visual deseado.
const ESTADOS_FILTRO = ['reservado', 'completado', 'no_asistio', 'cancelado'];

// Altura de cada hora en la grilla de agenda (px).
const ALTO_HORA_PX = 60;

// Rango horario fallback (cuando no hay turnos cargados).
const FALLBACK_INICIO = 8 * 60;   // 08:00
const FALLBACK_FIN    = 22 * 60;  // 22:00

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de tiempo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * minutosDelDia
 * Convierte un timestamp ISO a "minutos desde 00:00 del día" en TZ Argentina.
 * @param {string} iso
 * @returns {number}
 */
function minutosDelDia(iso) {
  const [hh, mm] = formatHora(iso).split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * minutosAhoraEnTZ
 * Minutos del día actual en TZ Argentina (para la línea "ahora").
 * @returns {number}
 */
function minutosAhoraEnTZ() {
  const ahora = new Date();
  const hhmm = ahora.toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * horaAMinutos
 * Convierte una hora 'HH:MM' a minutos desde 00:00.
 * @param {string} hhmm - 'HH:MM'
 * @returns {number}
 */
function horaAMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * jornadaDelDia
 * Dado el horario de atención semanal del local (array de 7 días) y una fecha
 * 'YYYY-MM-DD', devuelve el estado de atención de ESE día:
 *   - { abierto: true, inicio, fin }  → abierto (rango del local en minutos)
 *   - { abierto: false }              → cerrado (conocido)
 *   - null                            → desconocido (no se pudo leer el horario)
 * El dia_semana sigue la convención de Date.getDay() (0=domingo .. 6=sábado), la
 * misma del backend. La fecha se parsea por componentes (Date local) para evitar
 * el corrimiento de TZ que daría parsear el 'YYYY-MM-DD' como UTC.
 * @param {Array|null} horarioAtencion
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {{ abierto: boolean, inicio?: number, fin?: number }|null}
 */
function jornadaDelDia(horarioAtencion, fechaStr) {
  if (!Array.isArray(horarioAtencion)) return null;
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  const entrada = horarioAtencion.find((d) => d.dia_semana === diaSemana);
  if (!entrada) return null;
  if (!entrada.abierto || !entrada.hora_inicio || !entrada.hora_fin) return { abierto: false };
  return {
    abierto: true,
    inicio: horaAMinutos(aHoraCorta(entrada.hora_inicio)),
    fin:    horaAMinutos(aHoraCorta(entrada.hora_fin)),
  };
}

/**
 * calcularRangoAgenda
 * Deriva [inicio, fin] en minutos para la grilla de agenda.
 * Base = jornada de atención del local ese día (si se conoce y está abierto); si
 * no, el fallback 08:00–22:00. Sobre esa base se EXPANDE (nunca se contrae) para
 * incluir cualquier turno que caiga fuera de la jornada, con 1h de padding por
 * extremo (caso borde: turno en una franja que el local ya no abre).
 * @param {Array} turnos
 * @param {{ inicio: number, fin: number }|null} jornada - rango del local ese día en minutos, o null (cerrado/desconocido → fallback)
 * @returns {{ inicio: number, fin: number }}
 */
function calcularRangoAgenda(turnos, jornada) {
  // Base: jornada del local redondeada a la hora, o el fallback fijo.
  let inicio = jornada ? Math.floor(jornada.inicio / 60) * 60 : FALLBACK_INICIO;
  let fin    = jornada ? Math.ceil(jornada.fin / 60) * 60     : FALLBACK_FIN;

  // Expandir para no esconder turnos fuera de la jornada (padding 1h por extremo).
  if (turnos && turnos.length > 0) {
    const todos = turnos.flatMap((t) => [minutosDelDia(t.inicio), minutosDelDia(t.fin)]);
    inicio = Math.min(inicio, Math.max(0,       Math.floor((Math.min(...todos) - 60) / 60) * 60));
    fin    = Math.max(fin,    Math.min(24 * 60, Math.ceil((Math.max(...todos) + 60) / 60) * 60));
  }
  return { inicio, fin };
}

/**
 * duracionMinutos
 * Calcula la duración de un turno (fin − inicio) en minutos.
 * @param {Object} turno
 * @returns {number}
 */
function duracionMinutos(turno) {
  return minutosDelDia(turno.fin) - minutosDelDia(turno.inicio);
}

/**
 * formatDuracion
 * "30 min" / "1 h" / "1 h 30 min".
 * @param {number} mins
 * @returns {string}
 */
function formatDuracion(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * esHoy
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {boolean}
 */
function esHoy(fechaStr) {
  return fechaStr === getFechaHoy();
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SegmentedVista
 * Par de botones adyacentes para alternar entre vista Agenda y Lista.
 * Local — segundo caso de "segmented binario visual" en el admin (el
 * primero es la toggle de Caja, que usa otro componente: TogglePill).
 * Si aparece un tercer caso, evaluar primitivo `Segmented`.
 */
function SegmentedVista({ valor, onChange }) {
  const opciones = [
    { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
    { id: 'lista',  label: 'Lista',  Icon: Hourglass },
  ];
  return (
    <div
      role="tablist"
      aria-label="Vista del turnero"
      style={{
        display: 'inline-flex',
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        overflow: 'hidden',
        background: theme.surface,
      }}
    >
      {opciones.map((op, idx) => {
        const activo = valor === op.id;
        return (
          <button
            key={op.id}
            role="tab"
            aria-selected={activo}
            type="button"
            onClick={() => onChange(op.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: activo ? theme.accentSoft : 'transparent',
              color: activo ? theme.accent : theme.inkSoft,
              border: 'none',
              borderRight: idx === 0 ? `1px solid ${theme.hairline}` : 'none',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: activo ? theme.weightHeading : theme.weightMedium,
              cursor: 'pointer',
              transition: `background ${theme.transitionFast}, color ${theme.transitionFast}`,
            }}
          >
            <op.Icon size={14} strokeWidth={2} />
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * KpiMini
 * Mini-card de KPI del día. Eyebrow + número grande.
 */
function KpiMini({ label, valor, tono }) {
  const colorNum = {
    accent:  theme.accent,
    success: theme.success,
    warning: theme.warning,
    muted:   theme.muted,
    ink:     theme.ink,
  }[tono || 'ink'];

  return (
    <div
      style={{
        flex: 1,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: '12px 16px',
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          fontWeight: theme.weightHeading,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: theme.inkSoft,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: theme.body,
          fontSize: 22,
          fontWeight: theme.weightHeading,
          color: colorNum,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}
      >
        {valor}
      </div>
    </div>
  );
}

/**
 * EstadoTurnoPill
 * Pill compacta del estado de un turno. Mapeo del dominio admin.
 */
function EstadoTurnoPill({ estado }) {
  const c = ESTADO_MAP[estado] || ESTADO_MAP.cancelado;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontFamily: theme.body,
        fontSize: 12,
        fontWeight: theme.weightHeading,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
      }}
    >
      <c.Icon size={11} strokeWidth={2.4} />
      {c.label}
    </span>
  );
}

/**
 * BloqueAgenda
 * Un turno renderizado como bloque absolute-positioned dentro de la columna
 * del barbero. Altura proporcional a la duración del turno.
 */
function BloqueAgenda({ turno, rangoInicio, onClick }) {
  const [hover, setHover] = useState(false);
  const ini = minutosDelDia(turno.inicio);
  const fin = minutosDelDia(turno.fin);
  const top    = ((ini - rangoInicio) / 60) * ALTO_HORA_PX;
  const height = ((fin - ini)         / 60) * ALTO_HORA_PX;
  const c = ESTADO_MAP[turno.estado] || ESTADO_MAP.cancelado;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 4,
        right: 4,
        height: `${Math.max(height - 2, 22)}px`,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeftWidth: 3,
        borderRadius: theme.radiusSm,
        padding: '4px 8px',
        textAlign: 'left',
        color: c.fg,
        fontFamily: theme.body,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: hover ? theme.shadowSm : 'none',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: `transform ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        zIndex: 2,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: theme.mono,
          fontWeight: theme.weightHeading,
          opacity: 0.85,
          marginBottom: 2,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
      >
        {formatHora(turno.inicio)}–{formatHora(turno.fin)}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: theme.weightHeading,
          color: theme.ink,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {turno.cliente_nombre}
      </div>
      {height >= 50 && (
        <div
          style={{
            fontSize: 12,
            color: theme.inkSoft,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}
        >
          {turno.servicio_nombre}
        </div>
      )}
    </button>
  );
}

/**
 * LineaAhora
 * Línea horizontal indigo + dot, posicionada en el minuto actual del día.
 * Se redibuja cada 60s.
 */
function LineaAhora({ rangoInicio, rangoFin }) {
  const [mins, setMins] = useState(minutosAhoraEnTZ());

  useEffect(() => {
    const id = setInterval(() => setMins(minutosAhoraEnTZ()), 60000);
    return () => clearInterval(id);
  }, []);

  if (mins < rangoInicio || mins > rangoFin) return null;
  const top = ((mins - rangoInicio) / 60) * ALTO_HORA_PX;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${top}px`,
        height: 0,
        borderTop: `2px solid ${theme.accent}`,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -5,
          top: -5,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: theme.accent,
        }}
      />
    </div>
  );
}

/**
 * AgendaVista
 * Grilla barbero × hora. Columna izq fija con etiquetas de hora (cada hora
 * completa). Filas/columnas dibujadas con border + position absolute para
 * los bloques.
 */
function AgendaVista({ turnos, barberosVisibles, rangoInicio, rangoFin, fecha, onTurnoClick }) {
  const totalHoras = (rangoFin - rangoInicio) / 60;
  const horas = Array.from({ length: totalHoras + 1 }, (_, i) => rangoInicio + i * 60);

  // Agrupar turnos por barbero_id para asignar a la columna correcta.
  const turnosPorBarbero = new Map();
  for (const t of turnos) {
    if (!turnosPorBarbero.has(t.barbero_id)) turnosPorBarbero.set(t.barbero_id, []);
    turnosPorBarbero.get(t.barbero_id).push(t);
  }

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        overflow: 'hidden',
      }}
    >
      {/* Header columnas: hora + barberos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `64px repeat(${barberosVisibles.length}, 1fr)`,
          borderBottom: `1px solid ${theme.hairline}`,
        }}
      >
        <div style={{ padding: '10px 8px' }} />
        {barberosVisibles.map((b) => (
          <div
            key={b.id}
            style={{
              padding: '10px 12px',
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              fontWeight: theme.weightHeading,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: theme.inkSoft,
              borderLeft: `1px solid ${theme.hairline}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AvatarIniciales nombre={b.nombre} size={20} />
            <span style={{ color: theme.ink }}>{b.nombre}</span>
          </div>
        ))}
      </div>

      {/* Cuerpo: grilla con horas (izq) y columnas de barberos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `64px repeat(${barberosVisibles.length}, 1fr)`,
          position: 'relative',
        }}
      >
        {/* Columna de horas */}
        <div style={{ position: 'relative', height: `${totalHoras * ALTO_HORA_PX}px` }}>
          {horas.map((h, idx) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: `${idx * ALTO_HORA_PX}px`,
                right: 8,
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                color: theme.muted,
                fontVariantNumeric: 'tabular-nums',
                transform: 'translateY(-50%)',
              }}
            >
              {idx === 0 ? '' : `${String(Math.floor(h / 60)).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {/* Columnas de barberos */}
        {barberosVisibles.map((b) => (
          <div
            key={b.id}
            style={{
              position: 'relative',
              height: `${totalHoras * ALTO_HORA_PX}px`,
              borderLeft: `1px solid ${theme.hairline}`,
            }}
          >
            {/* Líneas guía cada hora */}
            {horas.slice(1).map((h, idx) => (
              <div
                key={h}
                aria-hidden
                style={{
                  position: 'absolute',
                  top: `${(idx + 1) * ALTO_HORA_PX}px`,
                  left: 0,
                  right: 0,
                  height: 0,
                  borderTop: `1px solid ${theme.hairlineSoft}`,
                }}
              />
            ))}
            {/* Bloques de turnos */}
            {(turnosPorBarbero.get(b.id) || []).map((t) => (
              <BloqueAgenda
                key={t.id}
                turno={t}
                rangoInicio={rangoInicio}
                onClick={() => onTurnoClick(t)}
              />
            ))}
          </div>
        ))}

        {/* Línea "ahora" si la fecha es hoy */}
        {esHoy(fecha) && (
          <div
            style={{
              position: 'absolute',
              left: 64,
              right: 0,
              top: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            <LineaAhora rangoInicio={rangoInicio} rangoFin={rangoFin} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ListaVista
 * Tabla densa de turnos (D10). Click en fila abre el modal de detalle.
 */
function ListaVista({ turnos, mostrarBarbero, onTurnoClick }) {
  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Hora</Th>
            <Th>Duración</Th>
            {mostrarBarbero && <Th>Barbero</Th>}
            <Th>Cliente</Th>
            <Th>Servicio</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => (
            <tr
              key={t.id}
              className="om-fila-hover"
              onClick={() => onTurnoClick(t)}
              style={{ cursor: 'pointer' }}
            >
              <Td mono>{formatHora(t.inicio)}</Td>
              <Td muted>{formatDuracion(duracionMinutos(t))}</Td>
              {mostrarBarbero && (
                <Td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <AvatarIniciales nombre={t.barbero_nombre} size={20} />
                    {t.barbero_nombre}
                  </span>
                </Td>
              )}
              <Td bold>{t.cliente_nombre}</Td>
              <Td>{t.servicio_nombre}</Td>
              <Td><EstadoTurnoPill estado={t.estado} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Th / Td — cell helpers de la tabla de Lista (D10).
 */
function Th({ children }) {
  return (
    <th
      style={{
        padding: '10px 14px',
        fontFamily: theme.mono,
        fontSize: theme.sizeMicro,
        fontWeight: theme.weightHeading,
        color: theme.inkSoft,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: 'left',
        borderBottom: `1px solid ${theme.hairline}`,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono, muted, bold }) {
  return (
    <td
      style={{
        padding: '10px 14px',
        fontFamily: mono ? theme.mono : theme.body,
        fontSize: theme.sizeBody,
        color: muted ? theme.muted : theme.ink,
        fontWeight: bold ? theme.weightHeading : theme.weightRegular,
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        borderBottom: `1px solid ${theme.hairlineSoft}`,
      }}
    >
      {children}
    </td>
  );
}

/**
 * FilaDetalleConCopia
 * Fila label/valor con botón de copiar al portapapeles. "Copiado" 1.5s.
 * Usada en el modal para teléfono / email.
 */
function FilaDetalleConCopia({ label, valor, Icon }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin clipboard API o permiso denegado: no-op silencioso.
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          fontWeight: theme.weightHeading,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: theme.inkSoft,
        }}
      >
        {label}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={14} color={theme.muted} strokeWidth={2} />}
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.ink }}>
          {valor}
        </span>
        <button
          type="button"
          onClick={copiar}
          aria-label={`Copiar ${label}`}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            color: copiado ? theme.success : theme.muted,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: theme.mono,
            fontSize: theme.sizeMicro,
          }}
        >
          {copiado ? <><Check size={12} /> Copiado</> : <Copy size={12} />}
        </button>
      </span>
    </div>
  );
}

/**
 * BotonFormaPago
 * Botón toggle de forma de pago para el modo "completar". Text-only, tintado
 * con el color de BadgeFormaPago correspondiente cuando está activo (efectivo →
 * success, Mercado Pago → accent); surface neutro cuando no. Touch target 44px.
 * @param {string} label
 * @param {boolean} activo
 * @param {Function} onClick
 * @param {string} tonoBg - fondo cuando está activo (el *Soft del color)
 * @param {string} tonoFg - color de texto/borde cuando está activo
 */
function BotonFormaPago({ label, activo, onClick, tonoBg, tonoFg }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        flex: 1,
        minHeight: 44,
        padding: '10px 12px',
        background: activo ? tonoBg : theme.surface,
        border: `1px solid ${activo ? tonoFg : theme.hairline}`,
        borderRadius: theme.radius,
        color: activo ? tonoFg : theme.inkSoft,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: activo ? theme.weightHeading : theme.weightMedium,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}`,
      }}
    >
      {label}
    </button>
  );
}

// Estilos del modo "completar" del ModalDetalleTurno.
// labelEyebrow replica la label del primitivo Field (mono micro uppercase,
// color muted) para que "Forma de pago" / "Precio" se vean uniformes con la
// label del Field de propina.
const labelEyebrow = {
  display: 'block',
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};

const precioReadonlyBox = {
  marginTop: 8,
  padding: '12px 14px',
  background: theme.surfaceAlt,
  border: `1px solid ${theme.hairline}`,
  borderRadius: theme.radius,
  fontFamily: theme.body,
  fontSize: 15,
  fontWeight: theme.weightMedium,
  color: theme.ink,
  fontVariantNumeric: 'tabular-nums',
};

const totalRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 16,
  paddingTop: 12,
  borderTop: `1px solid ${theme.hairline}`,
};

const totalLabelStyle = {
  fontFamily: theme.mono,
  fontSize: theme.sizeMicro,
  fontWeight: theme.weightHeading,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.inkSoft,
};

const totalValorStyle = {
  fontFamily: theme.body,
  fontSize: 18,
  fontWeight: theme.weightHeading,
  color: theme.ink,
  fontVariantNumeric: 'tabular-nums',
};

/**
 * ModalDetalleTurno
 * Modal único de detalle + acciones para un turno.
 * Tiene tres "modos" internos:
 *   - 'detalle': listado + acciones (según estado del turno).
 *   - 'completando': form para registrar el corte (servicio + forma de pago +
 *     precio + propina) y completar el turno. El servicio es editable (default
 *     = el del turno) y el precio lo sigue. Reemplaza al viejo "marcar
 *     completado" directo, que cambiaba el estado sin dejar registro financiero.
 *   - 'confirmando': vista de confirmación para cancelar (sin anidar modales).
 * @param {Array} servicios - catálogo de servicios del tenant ({ id, nombre,
 *   precio, activo }). Fuente del selector de servicio y del precio. Si está
 *   vacío (no cargó), el form degrada a precio editable a mano.
 */
function ModalDetalleTurno({ turno, onCerrar, onCambiarEstado, onCompletar, onCancelar, accionando, servicios }) {
  const [modo, setModo] = useState('detalle');

  // Estado del form de "completar" (local al modal, como el modo confirmando).
  const [formaPago, setFormaPago]       = useState(null);
  const [propina, setPropina]           = useState('');
  const [precioManual, setPrecioManual] = useState('');
  // Servicio elegido para el corte. Default = el del turno; editable en el form.
  const [servicioId, setServicioId]     = useState(turno.servicio_id);

  // El catálogo (servicios) es la fuente del precio. Si no cargó (raro), se
  // degrada a precio editable a mano (precioNoDerivable).
  const catalogoOk = servicios.length > 0;
  const serviciosActivos = servicios.filter((s) => s.activo);
  // Garantizamos que el servicio actual del turno esté en las opciones aunque
  // haya sido desactivado, para que el default se muestre y se pueda dejar igual.
  const servicioDelTurno = servicios.find((s) => s.id === turno.servicio_id);
  const opcionesServicio = (servicioDelTurno && !servicioDelTurno.activo)
    ? [servicioDelTurno, ...serviciosActivos]
    : serviciosActivos;
  const servicioSel = servicios.find((s) => s.id === servicioId);
  const servicioCambiado = servicioId !== turno.servicio_id;

  // Precio: del servicio seleccionado (read-only) o, sin catálogo, a mano.
  const precioNoDerivable = !catalogoOk;
  const precio       = precioNoDerivable ? Number(precioManual) : Number(servicioSel?.precio);
  const propinaNum   = propina === '' ? 0 : Number(propina);
  const precioValido = Number.isFinite(precio) && precio >= 0 && (!precioNoDerivable || precioManual !== '');
  const puedeCompletar = formaPago !== null && precioValido;
  const totalPreview = (Number.isFinite(precio) ? precio : 0) + propinaNum;

  const confirmarCompletar = () => {
    onCompletar(turno.id, {
      forma_pago: formaPago,
      precio,
      propina: propinaNum,
      // Solo mandamos servicio_id si cambió: si no, el backend usa su path
      // retrocompat (deriva del turno), que además completa bien un turno cuyo
      // servicio fue desactivado después (mandarlo explícito daría 400).
      ...(servicioCambiado ? { servicio_id: servicioId } : {}),
    });
  };

  const titulo = {
    detalle: 'Detalle del turno',
    completando: 'Completar turno',
    confirmando: 'Cancelar este turno',
  }[modo];

  const esReservado = turno.estado === 'reservado';
  // Si el turno ya comenzó (hora de inicio <= ahora) ocultamos "Cancelar
  // turno" — a esa altura las opciones reales son completado o no asistió.
  const yaComenzo = new Date(turno.inicio) <= new Date();

  // Filas estáticas del DetalleRecurso (label/valor simples).
  const filasBase = [
    { label: 'Estado',    valor: <EstadoTurnoPill estado={turno.estado} /> },
    { label: 'Hora',      valor: `${formatHora(turno.inicio)} – ${formatHora(turno.fin)}` },
    { label: 'Duración',  valor: formatDuracion(duracionMinutos(turno)) },
    { label: 'Servicio',  valor: turno.servicio_nombre },
    { label: 'Barbero',   valor: turno.barbero_nombre },
    { label: 'Cliente',   valor: turno.cliente_nombre },
    // Solo para turnos completados con corte vinculado (forma_pago/monto_total
    // son null para reservado/cancelado/no_asistio o completado sin corte).
    ...(turno.estado === 'completado' && turno.forma_pago
      ? [{ label: 'Pago', valor: <BadgeFormaPago forma={turno.forma_pago} /> }]
      : []),
    ...(turno.estado === 'completado' && turno.monto_total != null
      ? [{ label: 'Total', valor: fmtPesos(turno.monto_total) }]
      : []),
  ];

  return (
    <Modal
      open
      title={titulo}
      onClose={onCerrar}
      loading={accionando}
      maxWidth={460}
    >
      {modo === 'detalle' ? (
        <>
          <DetalleRecurso filas={filasBase} />

          {/* Contacto del cliente (con botones de copiar) — solo si hay datos */}
          {(turno.cliente_telefono || turno.cliente_email) && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: theme.surfaceAlt,
                border: `1px solid ${theme.hairline}`,
                borderRadius: theme.radius,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {turno.cliente_telefono && (
                <FilaDetalleConCopia label="Teléfono" valor={turno.cliente_telefono} Icon={Phone} />
              )}
              {turno.cliente_email && (
                <FilaDetalleConCopia label="Email" valor={turno.cliente_email} Icon={Mail} />
              )}
            </div>
          )}

          {/* Acciones — solo si el turno está reservado.
              Fila 1: Completado + No asistió, cada uno ocupa la mitad
              (flex: 1) para llenar el ancho del modal.
              Fila 2 (solo si el turno NO empezó todavía): Cancelar turno,
              centrado en su propio div con ancho natural. */}
          {esReservado && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <Button
                  variant="primary"
                  full={false}
                  onClick={() => setModo('completando')}
                  disabled={accionando}
                  style={{ flex: 1 }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  Completar
                </Button>
                <Button
                  variant="secondary"
                  full={false}
                  onClick={() => onCambiarEstado(turno.id, 'no_asistio')}
                  disabled={accionando}
                  style={{ flex: 1 }}
                >
                  <UserX size={14} strokeWidth={2} />
                  No asistió
                </Button>
              </div>
              {!yaComenzo && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <Button
                    variant="ghost"
                    full={false}
                    onClick={() => setModo('confirmando')}
                    disabled={accionando}
                    style={{ color: theme.danger }}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    Cancelar turno
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : modo === 'completando' ? (
        // ── Modo completar: registra el corte (forma de pago + monto) ─────
        <>
          <DetalleRecurso filas={[{ label: 'Cliente', valor: turno.cliente_nombre }]} />

          {/* Servicio — editable. Default = el del turno; el precio lo sigue.
              Sin catálogo (raro) no se muestra el selector y el servicio queda
              el del turno (el backend lo deriva). */}
          {catalogoOk && (
            <div style={{ marginTop: 16 }}>
              <Select
                label="Servicio"
                value={servicioId}
                onChange={setServicioId}
                options={opcionesServicio.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          )}

          {/* Precio — sigue al servicio elegido (read-only); editable solo si el
              catálogo no cargó. */}
          <div style={{ marginTop: 16 }}>
            {precioNoDerivable ? (
              <Field
                label="Precio"
                type="text"
                inputMode="numeric"
                value={precioManual}
                onChange={(v) => setPrecioManual(v.replace(/\D/g, ''))}
                placeholder="0"
                helper="No se pudo tomar el precio del servicio. Ingresalo a mano."
              />
            ) : (
              <>
                <span style={labelEyebrow}>Precio</span>
                <div style={precioReadonlyBox}>{fmtPesos(precio)}</div>
              </>
            )}
          </div>

          {/* Forma de pago — dos botones tintados como BadgeFormaPago */}
          <div style={{ marginTop: 16 }}>
            <span style={labelEyebrow}>Forma de pago</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <BotonFormaPago
                label="Efectivo"
                activo={formaPago === 'efectivo'}
                onClick={() => setFormaPago('efectivo')}
                tonoBg={theme.successSoft}
                tonoFg={theme.success}
              />
              <BotonFormaPago
                label="Mercado Pago"
                activo={formaPago === 'mercado_pago'}
                onClick={() => setFormaPago('mercado_pago')}
                tonoBg={theme.accentSoft}
                tonoFg={theme.accent}
              />
            </div>
          </div>

          {/* Propina — opcional, visible siempre */}
          <div style={{ marginTop: 16 }}>
            <Field
              label="Propina (opcional)"
              type="text"
              inputMode="numeric"
              value={propina}
              onChange={(v) => setPropina(v.replace(/\D/g, ''))}
              placeholder="0"
            />
          </div>

          {/* Total que se va a registrar */}
          <div style={totalRowStyle}>
            <span style={totalLabelStyle}>Total</span>
            <span style={totalValorStyle}>{fmtPesos(totalPreview)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button
              variant="secondary"
              full={false}
              onClick={() => setModo('detalle')}
              disabled={accionando}
              style={{ flex: 1 }}
            >
              Volver
            </Button>
            <Button
              variant="primary"
              full={false}
              onClick={confirmarCompletar}
              disabled={accionando || !puedeCompletar}
              style={{ flex: 1 }}
            >
              {accionando ? 'Completando…' : 'Completar turno'}
            </Button>
          </div>
        </>
      ) : (
        // ── Modo confirmación de cancelación ─────────────────────────────
        <>
          <p
            style={{
              margin: '0 0 16px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.inkSoft,
            }}
          >
            Se notificará al cliente por email si tiene uno registrado.
            Esta acción no se puede deshacer.
          </p>
          <DetalleRecurso
            filas={[
              { label: 'Hora',     valor: formatHora(turno.inicio) },
              { label: 'Cliente',  valor: turno.cliente_nombre },
              { label: 'Servicio', valor: turno.servicio_nombre },
              { label: 'Barbero',  valor: turno.barbero_nombre },
            ]}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button
              variant="secondary"
              full={false}
              onClick={() => setModo('detalle')}
              disabled={accionando}
              style={{ flex: 1 }}
            >
              Volver
            </Button>
            <Button
              variant="danger"
              full={false}
              onClick={() => onCancelar(turno.id)}
              disabled={accionando}
              style={{ flex: 1 }}
            >
              {accionando ? 'Cancelando…' : 'Sí, cancelar turno'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function SeccionTurnero() {
  const [fecha, setFecha]                 = useState(getFechaHoy);
  const [vista, setVista]                 = useState('agenda'); // 'agenda' | 'lista'
  const [barberos, setBarberos]           = useState([]);
  const [servicios, setServicios]         = useState([]); // catálogo, solo para derivar precio al completar
  const [horarioAtencion, setHorarioAtencion] = useState(null); // 7 días {dia_semana,abierto,hora_inicio,hora_fin}; null = aún no cargó / falló
  const [barberoActivo, setBarberoActivo] = useState(null); // null = Todos
  const [estadoActivo, setEstadoActivo]   = useState(null); // null = Todos
  const [turnos, setTurnos]               = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [intento, setIntento]             = useState(0);
  const [accionando, setAccionando]       = useState(null);
  const [errorAccion, setErrorAccion]     = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);

  // El auto-dismiss del banner de error vive dentro del primitivo Toast
  // (autoDismissMs=6000). El `key` con el texto del error fuerza remount
  // cuando llega un mensaje nuevo, reiniciando el timer.
  const mostrarErrorAccion = (mensaje) => setErrorAccion(mensaje);

  // ── Carga inicial de barberos ───────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getBarberosAdmin();
        setBarberos(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarBarberos:', err.message);
      }
    };
    cargar();
  }, []);

  // ── Carga del catálogo de servicios ─────────────────────────────────────
  // Solo se usa para derivar el precio del servicio al completar un turno (el
  // turno de /admin/turnos no trae precio). Carga independiente de barberos a
  // propósito: si esta falla, la agenda sigue andando y el modal de completar
  // degrada a precio editable (precioDerivado = undefined).
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getServiciosAdmin();
        setServicios(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarServicios:', err.message);
      }
    };
    cargar();
  }, []);

  // ── Carga del horario de atención del local ──────────────────────────────
  // Define el rango base de la agenda (la jornada real del día) y permite marcar
  // los días que el local tiene cerrados. Carga independiente: si falla, la
  // agenda degrada al fallback 08:00–22:00 (jornadaDelDia devuelve null) y no se
  // marca ningún día como cerrado.
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getAdminHorarioAtencion();
        setHorarioAtencion(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarHorarioAtencion:', err.message);
      }
    };
    cargar();
  }, []);

  // ── Carga de turnos (cuando cambia fecha / barbero / intento) ───────────
  // Nota: el filtro por estado se aplica client-side (no impacta el fetch),
  // así no se rehace la request cada vez que se togglean los chips de estado.
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await getAdminTurnos(fecha, barberoActivo);
        if (!cancelado) setTurnos(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarTurnos:', err.message);
        if (!cancelado) setError('No se pudieron cargar los turnos.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [fecha, barberoActivo, intento]);

  // ── Acciones ────────────────────────────────────────────────────────────
  const cambiarEstado = async (turnoId, nuevoEstado) => {
    setAccionando(turnoId);
    try {
      const actualizado = await patchAdminTurnoEstado(turnoId, nuevoEstado);
      setTurnos((prev) =>
        prev.map((t) => (t.id === turnoId ? { ...t, estado: actualizado.estado } : t)),
      );
      setTurnoSeleccionado((prev) =>
        prev && prev.id === turnoId ? { ...prev, estado: actualizado.estado } : prev,
      );
    } catch (err) {
      console.error('[seccionTurnero] Error en cambiarEstado:', err.message);
      mostrarErrorAccion(`No se pudo cambiar el estado: ${err.message}`);
    } finally {
      setAccionando(null);
    }
  };

  // Completar un turno reservado = registrar el corte (forma de pago + monto) y
  // marcarlo completado, en una sola llamada. Distinto de cambiarEstado: aquel
  // solo cambiaba el estado y no dejaba registro financiero (sin corte).
  const completarTurno = async (turnoId, datos) => {
    setAccionando(turnoId);
    try {
      const res = await completarAdminTurno(turnoId, datos);
      // Update optimista para reflejar el turno completado sin refetch. Si se
      // cambió el servicio, actualizamos id + nombre (del catálogo) también, así
      // la agenda/lista muestran el servicio nuevo. res.servicio_id es el final
      // que dejó el backend.
      setTurnos((prev) =>
        prev.map((t) => {
          if (t.id !== turnoId) return t;
          const cambioServicio = datos.servicio_id != null;
          const servicioNombre = cambioServicio
            ? (servicios.find((s) => s.id === datos.servicio_id)?.nombre ?? t.servicio_nombre)
            : t.servicio_nombre;
          return {
            ...t,
            estado: 'completado',
            forma_pago: datos.forma_pago,
            monto_total: res.monto_total,
            servicio_id: res.servicio_id ?? t.servicio_id,
            servicio_nombre: servicioNombre,
          };
        }),
      );
      setTurnoSeleccionado(null);
    } catch (err) {
      console.error('[seccionTurnero] Error en completarTurno:', err.message);
      mostrarErrorAccion(`No se pudo completar el turno: ${err.message}`);
    } finally {
      setAccionando(null);
    }
  };

  const cancelarTurno = async (turnoId) => {
    setAccionando(turnoId);
    try {
      await cancelarAdminTurno(turnoId);
      setTurnos((prev) =>
        prev.map((t) => (t.id === turnoId ? { ...t, estado: 'cancelado' } : t)),
      );
      setTurnoSeleccionado(null);
    } catch (err) {
      console.error('[seccionTurnero] Error en cancelarTurno:', err.message);
      mostrarErrorAccion(`No se pudo cancelar el turno: ${err.message}`);
    } finally {
      setAccionando(null);
    }
  };

  // ── Derivados ───────────────────────────────────────────────────────────
  // KPIs del día: SIEMPRE sobre el dataset completo (no respeta filtros).
  const kpisDia = {
    total:      turnos.length,
    reservado:  turnos.filter((t) => t.estado === 'reservado').length,
    completado: turnos.filter((t) => t.estado === 'completado').length,
    sinExito:   turnos.filter((t) => t.estado === 'no_asistio' || t.estado === 'cancelado').length,
  };

  // Turnos visibles: aplica filtro de estado (el de barbero ya viene del fetch).
  const turnosVisibles = estadoActivo
    ? turnos.filter((t) => t.estado === estadoActivo)
    : turnos;

  // Barberos visibles en la agenda (columnas).
  const barberosVisibles = barberoActivo
    ? barberos.filter((b) => b.id === barberoActivo)
    : barberos;

  // Estado de atención del local para el día elegido (abierto / cerrado /
  // desconocido). De ahí salen: el rango base de la agenda y el flag de "cerrado".
  const estadoJornada = jornadaDelDia(horarioAtencion, fecha);
  const jornadaAbierta = estadoJornada?.abierto
    ? { inicio: estadoJornada.inicio, fin: estadoJornada.fin }
    : null;
  // Cerrado solo si lo SABEMOS (horario leído y día marcado cerrado). Si el
  // horario no cargó, estadoJornada es null → no afirmamos que esté cerrado.
  const localCerrado = estadoJornada?.abierto === false;

  // Rango horario de la agenda — base = jornada del local; se expande con el
  // dataset completo del día (no los filtrados), así no "pega saltos" cuando
  // cambia el chip de estado.
  const rangoAgenda = calcularRangoAgenda(turnos, jornadaAbierta);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', fontFamily: theme.body, color: theme.ink }}>

      {/* Banner de error de acción */}
      {errorAccion && (
        <Toast
          key={errorAccion}
          tone="danger"
          autoDismissMs={6000}
          dismissible
          onDismiss={() => setErrorAccion(null)}
        >{errorAccion}</Toast>
      )}

      {/* ── FILA CONTROLES ─────────────────────────────────────────────── */}
      {/* Grid de 3 columnas (1fr / auto / 1fr) — el SelectorDia queda
          ópticamente centrado independientemente del ancho del toggle. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div />
        <SelectorDia value={fecha} onChange={setFecha} permitirFuturo />
        <div style={{ justifySelf: 'end' }}>
          <SegmentedVista valor={vista} onChange={setVista} />
        </div>
      </div>

      {/* ── KPIs DEL DÍA ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <KpiMini label="Total del día" valor={kpisDia.total}      tono="ink" />
        <KpiMini label="Reservados"    valor={kpisDia.reservado}  tono="accent" />
        <KpiMini label="Completados"   valor={kpisDia.completado} tono="success" />
        <KpiMini label="Sin éxito"     valor={kpisDia.sinExito}   tono="muted" />
      </div>

      {/* ── FILTRO PRIMARIO: BARBEROS ──────────────────────────────────── */}
      {barberos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ChipFiltro
              label="Todos"
              activo={barberoActivo === null}
              onClick={() => setBarberoActivo(null)}
            />
            {barberos.map((b) => (
              <ChipFiltro
                key={b.id}
                label={b.nombre}
                activo={barberoActivo === b.id}
                onClick={() => setBarberoActivo(b.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── FILTRO SECUNDARIO: ESTADO ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: theme.sizeMicro,
            fontWeight: theme.weightHeading,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: theme.inkSoft,
          }}
        >
          Estado
        </span>
        <ChipFiltro
          size="sm"
          label="Todos"
          activo={estadoActivo === null}
          onClick={() => setEstadoActivo(null)}
        />
        {ESTADOS_FILTRO.map((e) => (
          <ChipFiltro
            key={e}
            size="sm"
            label={ESTADO_MAP[e].label}
            activo={estadoActivo === e}
            onClick={() => setEstadoActivo(e)}
          />
        ))}
      </div>

      {/* ── CONTENIDO ──────────────────────────────────────────────────── */}
      {cargando && <LoadingState />}

      {!cargando && error && (
        <EmptyState
          tone="danger"
          glyph={<IconoAlerta />}
          title="Algo salió mal"
          body={error}
          action={
            <Button variant="primary" full={false} onClick={() => setIntento((n) => n + 1)}>
              <RefreshCw size={14} strokeWidth={2} />
              Reintentar
            </Button>
          }
        />
      )}

      {/* La agenda / lista se renderiza si hay barberos cargados, aunque no
          haya turnos visibles —EXCEPTO los días que el local tiene cerrados y
          sin ningún turno, donde una grilla vacía sería engañosa (ver el
          EmptyState "Local cerrado" más abajo). El EmptyState "Sin barberos" se
          reserva para el caso de no tener ningún barbero cargado en el tenant. */}
      {!cargando && !error && barberosVisibles.length === 0 && (
        <EmptyState
          glyph={<Calendar size={28} strokeWidth={1.5} />}
          title="Sin barberos cargados"
          body="No hay barberos activos para mostrar la agenda. Cargá al menos uno desde Gestión."
        />
      )}

      {/* Día que el local tiene cerrado y sin turnos: EmptyState en vez de la
          grilla vacía 08–22, que sugeriría falsamente "abierto sin reservas". */}
      {!cargando && !error && barberosVisibles.length > 0 && localCerrado && turnos.length === 0 && (
        <EmptyState
          glyph={<CalendarOff size={28} strokeWidth={1.5} />}
          title="Local cerrado"
          body="El local no atiende este día."
        />
      )}

      {/* Día cerrado PERO con turnos (reservados antes de cerrar ese día): se
          muestra la grilla igual, con una nota que explica la rareza. */}
      {!cargando && !error && barberosVisibles.length > 0 && localCerrado && turnos.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Toast tone="warning">
            El local figura cerrado este día, pero tiene turnos cargados.
          </Toast>
        </div>
      )}

      {!cargando && !error && barberosVisibles.length > 0 && !(localCerrado && turnos.length === 0) && vista === 'agenda' && (
        <AgendaVista
          turnos={turnosVisibles}
          barberosVisibles={barberosVisibles}
          rangoInicio={rangoAgenda.inicio}
          rangoFin={rangoAgenda.fin}
          fecha={fecha}
          onTurnoClick={setTurnoSeleccionado}
        />
      )}

      {!cargando && !error && barberosVisibles.length > 0 && !(localCerrado && turnos.length === 0) && vista === 'lista' && (
        <ListaVista
          turnos={turnosVisibles}
          mostrarBarbero={barberoActivo === null}
          onTurnoClick={setTurnoSeleccionado}
        />
      )}

      {/* ── MODAL DE DETALLE ───────────────────────────────────────────── */}
      {turnoSeleccionado && (
        <ModalDetalleTurno
          key={turnoSeleccionado.id}
          turno={turnoSeleccionado}
          onCerrar={() => setTurnoSeleccionado(null)}
          onCambiarEstado={cambiarEstado}
          onCompletar={completarTurno}
          onCancelar={cancelarTurno}
          accionando={accionando === turnoSeleccionado.id}
          servicios={servicios}
        />
      )}
    </div>
  );
}
