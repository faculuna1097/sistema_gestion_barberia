// /frontend-turnero/src/components/ui/MiniCalendario.jsx
// Calendario 7× para seleccionar fecha entre un set de días dados.
// Usado en SeleccionFecha (wizard inicial) y GestionTurno (reprogramación).

import { theme } from '../../theme/tokens.js';
import { diaNumero, esHoy, diaDeSemana } from '../../utils/fecha.js';

// Días de la semana en orden lunes-primero (convención AR).
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * MiniCalendario
 * Renderiza un grid 7-columnas con el mes/año arriba y celdas cuadradas.
 * Marca "hoy" con dot accent, días cerrados del negocio y feriados como
 * deshabilitados, y la fecha seleccionada con fill accent.
 * @param {Array<string>} props.dias - Array de YYYY-MM-DD (mínimo 1)
 * @param {string|null} props.seleccionada - YYYY-MM-DD de la fecha seleccionada
 * @param {Function} props.onSeleccionar - Callback con la fecha clickeada
 * @param {Array<Object>} [props.horarioAtencion=[]] - Días abiertos del tenant: [{ dia_semana, ... }]
 * @param {Array<Object>} [props.feriados=[]] - Feriados del tenant: [{ fecha, ... }]
 */
function MiniCalendario({ dias, seleccionada, onSeleccionar, horarioAtencion = [], feriados = [] }) {
  const primerDia = dias[0];

  // Sublabel derivado de la cantidad de días visibles: la pantalla controla
  // cuántos días mostrar y el label se ajusta solo.
  const subLabel = `${dias.length} días`;

  // Conjuntos para resolver "¿está cerrado este día?" sin recorrer arrays
  // por cada celda. Día cerrado = su día-de-semana no abre, o es feriado.
  const diasAbiertos = new Set(horarioAtencion.map(h => h.dia_semana));
  const fechasFeriado = new Set(feriados.map(f => f.fecha));

  // Mes del primer día visible.
  const [y, m] = primerDia.split('-').map(Number);
  const mesLabel = new Date(y, m - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Padding inicial: cuántas celdas vacías van antes del primer día visible
  // para que se alinee con su columna de día-de-semana (lunes = 0).
  const primerDow = new Date(primerDia + 'T12:00:00').getDay();
  const offsetInicial = primerDow === 0 ? 6 : primerDow - 1;

  return (
    <div>
      {/* Header: mes y subLabel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
          letterSpacing: '-0.01em',
          textTransform: 'capitalize',
        }}>{mesLabel}</div>

        <div style={{
          fontFamily: theme.mono,
          fontWeight: theme.weightMedium,
          fontSize: theme.sizeMicro,
          color: theme.muted,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>{subLabel}</div>
      </div>

      {/* Grid 7 columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 6,
      }}>
        {/* Headers L M X J V S D */}
        {DIAS_SEMANA.map((d, i) => (
          <div
            key={`h-${i}`}
            style={{
              fontFamily: theme.mono,
              fontWeight: theme.weightMedium,
              fontSize: 10,
              color: theme.mutedSoft,
              letterSpacing: '0.04em',
              textAlign: 'center',
              paddingBottom: 6,
            }}
          >{d}</div>
        ))}

        {/* Padding inicial */}
        {Array.from({ length: offsetInicial }).map((_, i) => (
          <div key={`pad-${i}`}/>
        ))}

        {/* Días */}
        {dias.map(f => (
          <CeldaDia
            key={f}
            fecha={f}
            cerrado={!diasAbiertos.has(diaDeSemana(f)) || fechasFeriado.has(f)}
            seleccionada={f === seleccionada}
            onClick={() => onSeleccionar(f)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * CeldaDia
 * Celda cuadrada de un día. Estados: normal, hoy, seleccionado, cerrado.
 * "Cerrado" = día sin atención del negocio o feriado; lo resuelve el padre.
 * @param {string} props.fecha - YYYY-MM-DD
 * @param {boolean} props.cerrado - True si el negocio no atiende ese día
 * @param {boolean} props.seleccionada
 * @param {Function} props.onClick
 */
function CeldaDia({ fecha, cerrado, seleccionada, onClick }) {
  const hoy = esHoy(fecha);

  // Resolución de estilo por prioridad: seleccionada > cerrado > normal.
  let background, color, borderColor;
  if (seleccionada) {
    background = theme.accent;
    color = theme.accentInk;
    borderColor = theme.accent;
  } else if (cerrado) {
    background = 'transparent';
    color = theme.mutedSoft;
    borderColor = theme.hairlineSoft;
  } else {
    background = theme.surface;
    color = theme.ink;
    borderColor = theme.hairline;
  }

  return (
    <button
      type="button"
      onClick={cerrado ? undefined : onClick}
      disabled={cerrado}
      aria-label={fecha + (cerrado ? ' (cerrado)' : '') + (hoy ? ' (hoy)' : '')}
      style={{
        aspectRatio: '1',
        background,
        color,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        cursor: cerrado ? 'not-allowed' : 'pointer',
        opacity: cerrado ? 0.4 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 0,
        fontFamily: theme.body,
        fontWeight: hoy ? theme.weightHeading : theme.weightMedium,
        fontSize: 16,
        letterSpacing: '-0.01em',
        position: 'relative',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      {diaNumero(fecha)}

      {/* Dot inferior para "hoy" — solo si no está seleccionada (sino se confunde) */}
      {hoy && !seleccionada && (
        <span style={{
          position: 'absolute',
          bottom: 4,
          width: 4,
          height: 4,
          borderRadius: 999,
          background: theme.accent,
        }}/>
      )}
    </button>
  );
}

export default MiniCalendario;
