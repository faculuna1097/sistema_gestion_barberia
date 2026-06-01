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
//   - El rango horario de la agenda se deriva del min/max de los turnos del
//     día (con padding 1h por extremo) y se clampa al menos a 08:00–22:00.
//     Si no hay turnos, se usa 08:00–22:00 directo. El endpoint admin no
//     expone el horario_atencion global del tenant (deuda backend anotada).

import { useState, useEffect } from 'react';
import {
  Check,
  UserX,
  Trash2,
  X,
  Calendar,
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
  getAdminTurnos,
  patchAdminTurnoEstado,
  cancelarAdminTurno,
} from '../../../services/api';
import { getFechaHoy, formatHora, TZ } from '../../../utils/fecha';
import { theme } from '../../../theme/tokens.js';
import {
  LoadingState,
  EmptyState,
  IconoAlerta,
  Button,
  ChipFiltro,
  Modal,
  DetalleRecurso,
  AvatarIniciales,
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
 * calcularRangoAgenda
 * Deriva [inicio, fin] en minutos a partir de los turnos del día.
 * Padding de 1h por extremo. Clamp externo a 08:00–22:00 (la agenda
 * solo se expande, nunca se contrae por debajo del default).
 * @param {Array} turnos
 * @returns {{ inicio: number, fin: number }}
 */
function calcularRangoAgenda(turnos) {
  if (!turnos || turnos.length === 0) {
    return { inicio: FALLBACK_INICIO, fin: FALLBACK_FIN };
  }
  const todos = turnos.flatMap(t => [minutosDelDia(t.inicio), minutosDelDia(t.fin)]);
  const min = Math.min(...todos) - 60;
  const max = Math.max(...todos) + 60;
  return {
    inicio: Math.min(FALLBACK_INICIO, Math.max(0, Math.floor(min / 60) * 60)),
    fin:    Math.max(FALLBACK_FIN,    Math.min(24 * 60, Math.ceil(max / 60) * 60)),
  };
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
 * ModalDetalleTurno
 * Modal único de detalle + acciones para un turno.
 * Tiene dos "modos" internos:
 *   - 'detalle': listado + acciones (según estado del turno).
 *   - 'confirmando': vista de confirmación para cancelar (sin anidar modales).
 */
function ModalDetalleTurno({ turno, onCerrar, onCambiarEstado, onCancelar, accionando }) {
  const [modo, setModo] = useState('detalle');

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
  ];

  return (
    <Modal
      open
      title={modo === 'detalle' ? 'Detalle del turno' : 'Cancelar este turno'}
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
                  onClick={() => onCambiarEstado(turno.id, 'completado')}
                  disabled={accionando}
                  style={{ flex: 1 }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  Marcar completado
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

  // Rango horario de la agenda — derivado del dataset completo del día
  // (no de los filtrados), así no "pega saltos" cuando cambia el chip de estado.
  const rangoAgenda = calcularRangoAgenda(turnos);

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

      {/* La agenda / lista siempre se renderiza si hay barberos cargados,
          aunque no haya turnos visibles. El calendario "vacío" sigue siendo
          la representación correcta del día (huecos visibles, columnas
          presentes). EmptyState se reserva para el caso edge de no tener
          ningún barbero cargado en el tenant. */}
      {!cargando && !error && barberosVisibles.length === 0 && (
        <EmptyState
          glyph={<Calendar size={28} strokeWidth={1.5} />}
          title="Sin barberos cargados"
          body="No hay barberos activos para mostrar la agenda. Cargá al menos uno desde Gestión."
        />
      )}

      {!cargando && !error && barberosVisibles.length > 0 && vista === 'agenda' && (
        <AgendaVista
          turnos={turnosVisibles}
          barberosVisibles={barberosVisibles}
          rangoInicio={rangoAgenda.inicio}
          rangoFin={rangoAgenda.fin}
          fecha={fecha}
          onTurnoClick={setTurnoSeleccionado}
        />
      )}

      {!cargando && !error && barberosVisibles.length > 0 && vista === 'lista' && (
        <ListaVista
          turnos={turnosVisibles}
          mostrarBarbero={barberoActivo === null}
          onTurnoClick={setTurnoSeleccionado}
        />
      )}

      {/* ── MODAL DE DETALLE ───────────────────────────────────────────── */}
      {turnoSeleccionado && (
        <ModalDetalleTurno
          turno={turnoSeleccionado}
          onCerrar={() => setTurnoSeleccionado(null)}
          onCambiarEstado={cambiarEstado}
          onCancelar={cancelarTurno}
          accionando={accionando === turnoSeleccionado.id}
        />
      )}
    </div>
  );
}
