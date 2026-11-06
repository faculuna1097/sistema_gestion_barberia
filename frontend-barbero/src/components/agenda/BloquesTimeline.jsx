// /frontend-barbero/src/components/agenda/BloquesTimeline.jsx
// Las piezas que el Timeline posiciona sobre la grilla: el bloque de un
// descanso o de una ausencia, el botón de un slot libre y el bloque de un turno.
// Usan la misma geometría que las celdas de la grilla (cajaVertical).

import { Check, Coffee, CalendarOff } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { useHover } from '../../hooks/useHover.js';
import { OFFSET_IZQ, cajaVertical } from './geometria.js';

// Fondo rayado de las ausencias: lo que las distingue de un descanso además del
// texto y el ícono. Rayas finas en `hairline` sobre `surfaceAlt`.
const FONDO_AUSENCIA = `repeating-linear-gradient(135deg, ${theme.surfaceAlt} 0 8px, ${theme.hairline} 8px 10px)`;

// Mapa estado → tokens del sistema. La barra lateral usa el color fuerte;
// el fondo del bloque, su variante soft.
const ESTILO_ESTADO = {
  reservado:  { fuerte: theme.accent,  soft: theme.accentSoft  },
  completado: { fuerte: theme.success, soft: theme.successSoft },
  no_asistio: { fuerte: theme.warning, soft: theme.warningSoft },
};

// Interlineado (px) de los dos renglones de un turno (hora y cliente), a 14 px.
// Un slot mide como mínimo 48 px (geometria.js): su caja tiene 46 y, sin el
// padding vertical de 4 + 4, quedan 38 para el texto. Con el interlineado global
// (1,5 → 21 px por renglón) el segundo renglón se cortaría; con 18 entran los dos (36).
const INTERLINEADO_TURNO = 18;

/**
 * BloqueNeutro
 * Bloque de un descanso o de una ausencia (suspensión), posicionado por hora.
 * Neutro, sin color de estado, para no competir con los turnos. Se distinguen
 * entre sí por el texto ("Descanso" / "Ausencia · motivo"), el ícono y el fondo
 * (liso el descanso, rayado la ausencia): el color nunca va solo.
 * El descanso es un botón (abre su detalle); la ausencia no tiene acciones en la
 * Agenda, así que es un bloque sin interacción.
 * Usa la misma geometría que las celdas de la grilla (cajaVertical); el ícono y
 * el texto van centrados en el bloque. Un descanso unido (varias partes pegadas,
 * unidas por el servidor) es un solo bloque.
 * @param {Object} props.bloque - de prepararAgenda, ya recortado al rango visible
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onTocar - solo se usa en los descansos
 */
export function BloqueNeutro({ bloque, origen, pxPorHora, onTocar }) {
  const [hover, eventosHover] = useHover();
  const esDescanso = bloque.tipo === 'descanso';
  const Icono = esDescanso ? Coffee : CalendarOff;
  const texto = esDescanso
    ? 'Descanso'
    : `Ausencia${bloque.motivo ? ` · ${bloque.motivo}` : ''}`;

  const estilo = {
    position: 'absolute',
    ...cajaVertical(bloque.minInicio, bloque.minFin, origen, pxPorHora),
    left: OFFSET_IZQ + 4,
    right: 4,
    background: esDescanso ? theme.surfaceAlt : FONDO_AUSENCIA,
    border: 'none',
    borderLeft: `3px solid ${esDescanso ? theme.mutedSoft : theme.muted}`,
    borderRadius: theme.radiusSm,
    padding: '4px 8px',
    overflow: 'hidden',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: theme.inkSoft,
  };

  const contenido = (
    <>
      <Icono size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
      {/* minWidth 0: si el texto no entra (motivo largo), se achica con "…"
          en vez de desbordar a los dos lados del centro. */}
      <span style={{
        minWidth: 0,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {texto}
      </span>
    </>
  );

  if (!esDescanso) return <div style={estilo}>{contenido}</div>;

  return (
    <button
      type="button"
      onClick={onTocar}
      {...eventosHover}
      aria-label={`Descanso de ${fmtHora(bloque.desdeIso)} a ${fmtHora(bloque.hastaIso)}`}
      style={{
        ...estilo,
        cursor: 'pointer',
        boxShadow: hover ? theme.shadowSm : 'none',
        transition: `box-shadow ${theme.transitionFast}`,
      }}
    >
      {contenido}
    </button>
  );
}

/**
 * SlotTocable
 * Botón de un slot libre y futuro: tocarlo lo suma o lo saca de la selección
 * para marcar un descanso (reglas en utils/seleccionSlots.js). Ocupa todo el
 * alto del slot (≥ ALTO_MIN_SLOT), así el área táctil no baja de 44 px.
 * Por dentro va vacío: la hora ya está en la columna izquierda. Elegido, muestra
 * una tilde (el fondo lo pone el bloque de la selección). La hora va en el
 * aria-label.
 * El hover solo se activa en dispositivos con mouse (useHover): en una
 * pantalla táctil quedaría pegado después de tocar.
 * Ocupa exactamente su celda (cajaVertical): el área táctil es el alto del slot
 * menos la separación entre celdas (≥ 46 px con ALTO_MIN_SLOT de 48).
 * @param {Object} props.slot - slot de la grilla (prepararAgenda)
 * @param {boolean} props.seleccionado
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onTocar
 */
export function SlotTocable({ slot, seleccionado, origen, pxPorHora, onTocar }) {
  const [hover, eventosHover] = useHover();
  const hora = fmtHora(slot.inicioIso);

  // Seleccionado: el fondo lo pone el bloque de la selección (Timeline).
  const fondo = hover && !seleccionado ? theme.surfaceAlt : 'transparent';

  return (
    <button
      type="button"
      onClick={onTocar}
      {...eventosHover}
      aria-label={`${hora}, libre`}
      aria-pressed={seleccionado}
      style={{
        position: 'absolute',
        ...cajaVertical(slot.minInicio, slot.minFin, origen, pxPorHora),
        left: OFFSET_IZQ + 4,
        right: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 12px',
        background: fondo,
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: 'pointer',
        color: theme.accent,
        outlineOffset: -2,
        zIndex: 1,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {seleccionado && <Check size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}

/**
 * BloqueTurno
 * Bloque clickable posicionado por hora. Fondo soft + barra lateral de color.
 * Usa la misma geometría que las celdas de la grilla (cajaVertical). Hover solo
 * con mouse (useHover).
 * @param {Object} props.turno - con minInicio/minFin (prepararAgenda)
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onClick
 */
export function BloqueTurno({ turno, origen, pxPorHora, onClick }) {
  const [hover, eventosHover] = useHover();

  const caja = cajaVertical(turno.minInicio, turno.minFin, origen, pxPorHora);
  const top = caja.top;
  const alto = Math.max(caja.height, 28);

  const estilo = ESTILO_ESTADO[turno.estado] || ESTILO_ESTADO.reservado;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      {...eventosHover}
      style={{
        position: 'absolute',
        top,
        left: OFFSET_IZQ + 4,
        right: 4,
        height: alto,
        background: estilo.soft,
        borderLeft: `3px solid ${estilo.fuerte}`,
        borderRadius: theme.radiusSm,
        padding: '4px 8px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 1,
        boxShadow: hover ? theme.shadowSm : 'none',
        transition: `box-shadow ${theme.transitionFast}`,
      }}
    >
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: `${INTERLINEADO_TURNO}px`,
        fontWeight: theme.weightMedium,
        color: estilo.fuerte,
        whiteSpace: 'nowrap',
      }}>
        {fmtHora(turno.inicio)}
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: `${INTERLINEADO_TURNO}px`,
        color: theme.inkSoft,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {turno.cliente_nombre || 'Sin nombre'}
        {turno.servicio_nombre && ` · ${turno.servicio_nombre}`}
      </div>
    </div>
  );
}
