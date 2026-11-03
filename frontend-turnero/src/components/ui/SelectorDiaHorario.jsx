// /frontend-turnero/src/components/ui/SelectorDiaHorario.jsx
// Elección de día y horario: una grilla semanal con los días reservables y,
// debajo, los horarios libres del día elegido.
// Presentacional: los datos, sus estados y los reintentos llegan por props (los
// arma el hook useDisponibilidad). Lo usan "¿Cuándo?" (SeleccionCuando) y la
// reprogramación de la gestión del turno (GestionTurno).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { estiloEyebrow } from './estilos.js';
import {
  diaNumero, diaDeSemana, esHoy, fmtDiaEnOracion, fmtMes, nombreMes,
} from '../../utils/fecha.js';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import IconoAlerta from './IconoAlerta.jsx';
import Skeleton from './Skeleton.jsx';
import SlotChip, { ALTO_SLOT } from './SlotChip.jsx';

// Encabezado de la grilla de días: la semana arranca el lunes (convención AR).
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Alto de la celda de un día (la real y su skeleton: no salta al cargar).
const ALTO_DIA = 48;

// Separación visible entre los días de la grilla.
const GAP_GRILLA = 4;

// Grilla de días: 7 columnas parejas (minmax evita que una celda la desborde).
// Entre columnas no hay gap: cada día ocupa su columna entera y se dibuja con
// medio gap de aire a cada lado (MEDIO_GAP), así el área tocable incluye el
// espacio entre días sin que se vea distinto. El margen negativo compensa ese
// aire en los bordes. Con 375 px de pantalla, un día toca 49 px de ancho en
// "¿Cuándo?" y 44,8 en la reprogramación (antes, 45,6 y 40,8).
const MEDIO_GAP = GAP_GRILLA / 2;
const estiloGrillaDias = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  rowGap: GAP_GRILLA,
  margin: `0 -${MEDIO_GAP}px`,
};

// Grilla de horarios: 4 columnas parejas.
const estiloGrillaHorarios = {
  listStyle: 'none',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
};

/**
 * columnaDelDia
 * Columna de la grilla (1 a 7, lunes a domingo) que le toca a un día.
 * @param {string} fecha - YYYY-MM-DD
 * @returns {number} Ej: un jueves → 4
 */
function columnaDelDia(fecha) {
  // diaDeSemana: 0 = domingo … 6 = sábado. Con la semana desde el lunes, el
  // domingo pasa a ser la columna 7.
  return ((diaDeSemana(fecha) + 6) % 7) + 1;
}

/**
 * tituloMeses
 * Título de la grilla: el mes de los días, o los dos si el rango cruza de mes.
 * @param {Array<string>} dias - YYYY-MM-DD en orden
 * @returns {string} Ej: "Octubre" o "Octubre – Noviembre"
 */
function tituloMeses(dias) {
  const meses = [...new Set(dias.map(fmtMes))];
  return meses.join(' – ');
}

/**
 * SelectorDiaHorario
 * Grilla semanal de días + horarios del día elegido. Los días sin lugar se ven
 * sin caja y deshabilitados. Días y horarios tienen cada uno su estado
 * (cargando, error, listo) y su reintento; un error nunca se muestra como
 * "sin turnos".
 * @param {Array<string>} props.dias - Días de la grilla (YYYY-MM-DD, en orden)
 * @param {Array<string>} props.diasDisponibles - Los que tienen al menos un horario libre
 * @param {'cargando'|'error'|'listo'} props.estadoDias
 * @param {Function} props.onReintentarDias - Vuelve a pedir los días
 * @param {string|null} props.fecha - Día elegido (YYYY-MM-DD); null si ninguno tiene lugar
 * @param {Function} props.onElegirFecha - Recibe el día tocado
 * @param {Array<string>} props.horarios - Horarios libres del día elegido (ISO, en orden)
 * @param {'cargando'|'error'|'listo'|null} props.estadoHorarios - null si no hay día elegido
 * @param {Function} props.onReintentarHorarios - Vuelve a pedir los horarios del día
 * @param {string|null} props.horario - Horario marcado (ISO), o null
 * @param {Function} props.onElegirHorario - Recibe el ISO del horario tocado
 * @param {string} props.textoSinDias - Qué decir si ningún día tiene lugar
 * @param {ReactNode} [props.accionSinDias] - Botón para ese caso (ej. pasar a "Cualquiera")
 */
function SelectorDiaHorario({
  dias, diasDisponibles, estadoDias, onReintentarDias,
  fecha, onElegirFecha,
  horarios, estadoHorarios, onReintentarHorarios,
  horario, onElegirHorario,
  textoSinDias, accionSinDias,
}) {
  if (estadoDias === 'error') {
    return (
      <EmptyState
        glyph={<IconoAlerta/>}
        title="No pudimos cargar los días"
        body="Revisá tu conexión e intentá de nuevo."
        action={
          <Button variant="secondary" onClick={onReintentarDias} full={false}>
            Reintentar
          </Button>
        }
      />
    );
  }

  const cargandoDias = estadoDias === 'cargando';

  // Qué va debajo de la grilla, según el estado de los días y de los horarios.
  // Sin día elegido (ninguno con lugar) no hay horarios que esperar.
  let contenidoHorarios;
  if (cargandoDias) {
    contenidoHorarios = <HorariosSkeleton/>;
  } else if (!fecha) {
    contenidoHorarios = (
      <EmptyState
        glyph={<IconoCalendario/>}
        title="Sin turnos libres"
        body={textoSinDias}
        action={accionSinDias}
      />
    );
  } else if (estadoHorarios === 'cargando') {
    contenidoHorarios = <HorariosSkeleton/>;
  } else if (estadoHorarios === 'error') {
    contenidoHorarios = (
      <EmptyState
        glyph={<IconoAlerta/>}
        title="No pudimos cargar los horarios"
        body="Revisá tu conexión e intentá de nuevo."
        action={
          <Button variant="secondary" onClick={onReintentarHorarios} full={false}>
            Reintentar
          </Button>
        }
      />
    );
  } else if (horarios.length === 0) {
    // El día tenía lugar al pedir los días, pero ya no (otro cliente reservó
    // en el medio, o pasó la hora del último turno de hoy).
    contenidoHorarios = (
      <EmptyState
        glyph={<IconoCalendario/>}
        title="Sin horarios libres"
        body="Ya no quedan horarios este día. Probá con otro."
      />
    );
  } else {
    // key: al cambiar de día, los horarios se montan de cero y corre su cascada.
    contenidoHorarios = (
      <ListaHorarios
        key={fecha}
        fecha={fecha}
        horarios={horarios}
        horario={horario}
        onElegir={onElegirHorario}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <GrillaDias
        dias={dias}
        diasDisponibles={diasDisponibles}
        cargando={cargandoDias}
        fecha={fecha}
        onElegir={onElegirFecha}
      />
      {contenidoHorarios}
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * GrillaDias
 * Calendario semanal de 7 columnas (lunes a domingo): título con el mes (o
 * los dos meses, si el rango cruza), encabezado con los días de la semana y
 * los días en sus columnas. El primer día arranca en su columna; los lugares
 * de antes y de después quedan vacíos. Mientras carga, cada día es un skeleton
 * del mismo tamaño.
 * @param {Array<string>} props.dias
 * @param {Array<string>} props.diasDisponibles
 * @param {boolean} props.cargando
 * @param {string|null} props.fecha - Día elegido
 * @param {Function} props.onElegir - Recibe el día tocado
 */
function GrillaDias({ dias, diasDisponibles, cargando, fecha, onElegir }) {
  const disponibles = new Set(diasDisponibles);
  const columnaInicial = columnaDelDia(dias[0]);

  return (
    <div role="group" aria-label="Días">
      <div style={{
        marginBottom: 8,
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>{tituloMeses(dias)}</div>

      <div style={estiloGrillaDias}>
        {/* Encabezado: decorativo, cada día ya dice su nombre en el aria-label */}
        {DIAS_SEMANA.map((d) => (
          <div key={d} aria-hidden="true" style={{
            paddingBottom: 4,
            ...estiloEyebrow,
            textAlign: 'center',
          }}>{d}</div>
        ))}

        {dias.map((dia, i) => {
          // El primer día va en su columna; los demás siguen solos.
          const ubicacion = i === 0 ? { gridColumnStart: columnaInicial } : undefined;
          return cargando ? (
            <div key={dia} aria-hidden="true" style={{ ...ubicacion, padding: `0 ${MEDIO_GAP}px` }}>
              <Skeleton height={ALTO_DIA} radius={theme.radius}/>
            </div>
          ) : (
            <CeldaDia
              key={dia}
              fecha={dia}
              primera={i === 0}
              disponible={disponibles.has(dia)}
              elegida={dia === fecha}
              onElegir={onElegir}
              style={ubicacion}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * CeldaDia
 * Botón de un día: el número y, arriba, una etiqueta chica si hace falta
 * ("hoy", o el mes abreviado en el día 1 cuando el rango cruza de mes).
 * Estados: con lugar, elegido y sin lugar (deshabilitado). La diferencia
 * entre con lugar y sin lugar es de forma, no solo de color: el día con lugar
 * es una caja con borde y número fuerte; el día sin lugar no tiene caja, solo
 * el texto en gris claro. Así se ve de un vistazo qué días atiende.
 * El aria-label lo lee entero: "martes 6 de octubre" o "…, sin turnos".
 * Aparece con un fundido corto al reemplazar a su skeleton.
 *
 * Área tocable: el botón ocupa la columna entera (incluido el aire entre días)
 * y la caja que se ve va adentro, con MEDIO_GAP de margen a cada lado. El
 * anillo de foco se dibuja en la caja (no en el botón), a 2 px como el global,
 * así se ve igual que antes.
 * @param {string} props.fecha - YYYY-MM-DD
 * @param {boolean} props.primera - True si es el primer día de la grilla (ahí
 *   el mes ya está en el título: no lleva el mes abreviado)
 * @param {boolean} props.disponible - True si tiene al menos un horario libre
 * @param {boolean} props.elegida
 * @param {Function} props.onElegir - Recibe la fecha
 * @param {Object} [props.style] - Ubicación en la grilla (columna del primer día)
 */
function CeldaDia({ fecha, primera, disponible, elegida, onElegir, style }) {
  // Foco por teclado (no por toque ni clic): prende el anillo de la caja.
  const [focoVisible, setFocoVisible] = useState(false);

  const hoy = esHoy(fecha);
  const etiqueta = [hoy ? 'Hoy' : null, fmtDiaEnOracion(fecha), disponible ? null : 'sin turnos']
    .filter(Boolean)
    .join(', ');

  // Etiqueta chica arriba del número: "hoy" gana; si no, el mes en el día 1.
  let marca = null;
  if (hoy) marca = 'hoy';
  else if (diaNumero(fecha) === 1 && !primera) marca = nombreMes(fecha);

  // Estilo por estado, con prioridad: elegida > sin lugar > con lugar.
  // Sin lugar, el borde es transparente (no se saca): la celda mide lo mismo.
  let fondo = theme.surface;
  let borde = theme.mutedSoft;
  let colorNumero = theme.ink;
  let pesoNumero = theme.weightHeading;
  let colorMarca = theme.muted;
  if (elegida) {
    fondo = theme.accent;
    borde = theme.accent;
    colorNumero = theme.accentInk;
    colorMarca = theme.accentInk;
  } else if (!disponible) {
    fondo = 'transparent';
    borde = 'transparent';
    colorNumero = theme.mutedSoft;
    pesoNumero = theme.weightRegular;
    colorMarca = theme.mutedSoft;
  }

  return (
    <button
      type="button"
      onClick={() => onElegir(fecha)}
      onFocus={(e) => setFocoVisible(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocoVisible(false)}
      disabled={!disponible}
      aria-pressed={elegida}
      aria-label={etiqueta}
      className="tt-presionable tt-aparecer"
      style={{
        display: 'block',
        width: '100%',
        padding: `0 ${MEDIO_GAP}px`,
        background: 'transparent',
        border: 'none',
        // El anillo va en la caja de adentro (focoVisible).
        outline: 'none',
        cursor: disponible ? 'pointer' : 'not-allowed',
        fontFamily: theme.body,
        lineHeight: 1.15,
        // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
        transition: `transform ${theme.transitionFast}`,
        ...style,
      }}
    >
      <span style={{
        height: ALTO_DIA,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: fondo,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        outline: focoVisible ? `2px solid ${theme.accent}` : 'none',
        outlineOffset: 2,
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}>
        {marca && (
          <span style={{
            fontSize: theme.sizeMicro,
            fontWeight: theme.weightMedium,
            color: colorMarca,
          }}>{marca}</span>
        )}
        <span style={{
          fontSize: theme.sizeHeading,
          fontWeight: pesoNumero,
          letterSpacing: '-0.01em',
          color: colorNumero,
        }}>{diaNumero(fecha)}</span>
      </span>
    </button>
  );
}

/**
 * ListaHorarios
 * Horarios libres del día en una sola grilla de 4 columnas, en orden. Los
 * chips aparecen en cascada (tt-escalonado).
 * @param {string} props.fecha - Día de los horarios (para el nombre accesible de la lista)
 * @param {Array<string>} props.horarios - ISO en orden
 * @param {string|null} props.horario - ISO marcado
 * @param {Function} props.onElegir - Recibe el ISO tocado
 */
function ListaHorarios({ fecha, horarios, horario, onElegir }) {
  return (
    <ul aria-label={`Horarios del ${fmtDiaEnOracion(fecha)}`} style={estiloGrillaHorarios}>
      {horarios.map((iso, i) => (
        <li key={iso} className="tt-escalonado" style={{ '--tt-indice': i }}>
          <SlotChip iso={iso} selected={iso === horario} onClick={() => onElegir(iso)}/>
        </li>
      ))}
    </ul>
  );
}

/**
 * HorariosSkeleton
 * Silueta de los horarios mientras cargan: dos renglones de chips del mismo
 * alto que los reales.
 */
function HorariosSkeleton() {
  return (
    <div aria-hidden="true" style={estiloGrillaHorarios}>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} height={ALTO_SLOT} radius={theme.radius}/>
      ))}
    </div>
  );
}

/**
 * IconoCalendario
 * SVG para los EmptyState de "sin turnos" y "sin horarios".
 */
function IconoCalendario() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default SelectorDiaHorario;
