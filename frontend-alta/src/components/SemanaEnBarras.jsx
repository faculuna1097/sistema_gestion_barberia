// /frontend-alta/src/components/SemanaEnBarras.jsx
// La semana dibujada como barras (plan §5.2): una fila por día abierto, con la
// barra a lo largo de una escala de horas común a todos los días, así se ve de
// un vistazo qué día abre antes o cierra más tarde. La pausa del mediodía, si
// hay, queda como un corte en la barra. Las barras siguen en vivo los botones
// de +/-.
// La usan la pantalla del horario del local (4) y, en la fase 4, los horarios
// del equipo: por eso acepta varios bloques por día.
// Sin librería de gráficos (sistema_de_disenio.md §6.1): divs con ancho
// proporcional y los tokens del tema.

import { theme } from '../theme/tokens.js';
import { aMinutos, fmtHoraCorta, fmtRango, fmtRangoCorto, aHora } from '../utils/horas.js';
import { idDiaSemana, nombreDia, ordenarDias } from '../utils/semana.js';
import { prefiereMenosMovimiento } from '../utils/movimiento.js';
import { useHover } from '../hooks/useHover.js';

// La escala va al menos de las 6 a las 24: así cambiar la apertura o el cierre
// mueve la barra (con una escala justa al horario, la barra llenaría siempre
// todo el ancho y no se vería el cambio). Se estira si hace falta.
const ESCALA_DESDE = 6 * 60;
const ESCALA_HASTA = 24 * 60;
// Una marca de la escala cada 6 horas.
const MARCA_CADA = 6 * 60;
// Columnas de cada fila (y de la escala de abajo): el día, la barra y el rango
// en texto. Anchos fijos para que las barras de todos los días queden
// alineadas; 92 px entra el rango más largo de un bloque ("10:30 a 20:30").
const COLUMNAS = '36px 1fr 92px';

/**
 * calcularEscala (interna)
 * @param {Array<{hora_inicio: string, hora_fin: string}>} bloques
 * @returns {{desde: number, hasta: number, marcas: number[]}} En minutos.
 */
function calcularEscala(bloques) {
  let desde = ESCALA_DESDE;
  let hasta = ESCALA_HASTA;
  bloques.forEach((b) => {
    desde = Math.min(desde, Math.floor(aMinutos(b.hora_inicio) / 60) * 60);
    hasta = Math.max(hasta, Math.ceil(aMinutos(b.hora_fin) / 60) * 60);
  });
  const marcas = [];
  for (let m = Math.ceil(desde / MARCA_CADA) * MARCA_CADA; m <= hasta; m += MARCA_CADA) marcas.push(m);
  return { desde, hasta, marcas };
}

/**
 * tramosSinPausa (interna)
 * Los tramos que se dibujan de un bloque: el bloque entero, o partido en dos
 * si la pausa cae adentro.
 * @param {{hora_inicio: string, hora_fin: string}} bloque
 * @param {{hora_inicio: string, hora_fin: string}|null} pausa
 * @returns {Array<{desde: number, hasta: number}>} En minutos.
 */
function tramosSinPausa(bloque, pausa) {
  const desde = aMinutos(bloque.hora_inicio);
  const hasta = aMinutos(bloque.hora_fin);
  if (!pausa) return [{ desde, hasta }];
  const pDesde = aMinutos(pausa.hora_inicio);
  const pHasta = aMinutos(pausa.hora_fin);
  if (pHasta <= desde || pDesde >= hasta) return [{ desde, hasta }];
  return [
    { desde, hasta: Math.max(desde, pDesde) },
    { desde: Math.min(hasta, pHasta), hasta },
  ].filter((t) => t.hasta > t.desde);
}

/**
 * FilaDia
 * Una fila: el día, la barra y el rango en texto. Si hay `onTocar`, la fila es
 * un botón de 44 px de alto que abre el detalle del día debajo.
 * @param {number} props.dia - dia_semana
 * @param {Array} props.bloques - Los bloques de ese día
 * @param {Object|null} props.pausa
 * @param {Object} props.escala - calcularEscala
 * @param {boolean} props.propio - El día tiene horario propio (texto en ink)
 * @param {boolean} props.abierto - Su detalle está abierto
 * @param {Function} [props.onTocar]
 * @param {string} props.detalleId - id del detalle (aria-controls)
 * @param {string} [props.id] - id del botón del día (para devolverle el foco)
 * @returns {JSX.Element}
 */
function FilaDia({ dia, bloques, pausa, escala, propio, abierto, onTocar, detalleId, id }) {
  const [hover, eventosHover] = useHover();
  const total = escala.hasta - escala.desde;
  const transicion = prefiereMenosMovimiento()
    ? 'none'
    : 'left 180ms cubic-bezier(0.25, 1, 0.5, 1), width 180ms cubic-bezier(0.25, 1, 0.5, 1)';

  const pausaEnDia = pausa && bloques.some((b) => tramosSinPausa(b, pausa).length > 1);
  const textoRangos = bloques.map((b) => fmtRango(b)).join(' y ');
  const etiqueta = `${nombreDia(dia, { mayuscula: true })}: de ${textoRangos}`
    + `${pausaEnDia ? `, con pausa de ${fmtRango(pausa)}` : ''}`
    + `${propio ? ', horario propio' : ''}`;

  const contenido = (
    <>
      <span aria-hidden="true" style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        textAlign: 'left',
      }}>
        {nombreDia(dia, { corto: true, mayuscula: true })}
      </span>

      {/* La barra es decorativa: el texto de la derecha y el aria-label dicen el rango. */}
      <span aria-hidden="true" style={{
        position: 'relative',
        height: 20,
        borderRadius: theme.radiusSm,
        background: theme.surfaceAlt,
        overflow: 'hidden',
      }}>
        {escala.marcas.map((m) => (
          <span key={m} style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((m - escala.desde) / total) * 100}%`,
            width: 1,
            background: theme.hairline,
          }} />
        ))}
        {bloques.flatMap((b, i) => tramosSinPausa(b, pausa).map((t, j) => (
          <span key={`${i}-${j}`} style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((t.desde - escala.desde) / total) * 100}%`,
            width: `${((t.hasta - t.desde) / total) * 100}%`,
            background: theme.accent,
            borderRadius: 4,
            transition: transicion,
          }} />
        )))}
      </span>

      <span aria-hidden="true" style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: propio ? theme.weightMedium : theme.weightRegular,
        fontVariantNumeric: 'tabular-nums',
        color: propio ? theme.ink : theme.muted,
        textAlign: 'right',
      }}>
        {/* Un bloque por renglón: dos en uno ("10 a 13 · 14 a 20") no entran en la columna. */}
        {bloques.map((b, i) => (
          // Por posición: dos bloques iguales (solapados) no pueden compartir key.
          <span key={i} style={{ display: 'block', whiteSpace: 'nowrap' }}>
            {fmtRangoCorto(b)}
          </span>
        ))}
      </span>
    </>
  );

  const estiloFila = {
    width: '100%',
    minHeight: 44,
    display: 'grid',
    gridTemplateColumns: COLUMNAS,
    alignItems: 'center',
    gap: 12,
    padding: '0 8px',
    border: 'none',
    borderRadius: theme.radius,
    background: abierto ? theme.accentSoft : (hover ? theme.surfaceAlt : 'transparent'),
  };

  if (!onTocar) {
    return <div role="img" aria-label={etiqueta} style={estiloFila}>{contenido}</div>;
  }
  return (
    <button
      id={id}
      type="button"
      onClick={() => onTocar(dia)}
      {...eventosHover}
      aria-label={etiqueta}
      aria-expanded={abierto}
      aria-controls={abierto ? detalleId : undefined}
      className="al-presionable"
      style={{
        ...estiloFila,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {contenido}
    </button>
  );
}

/**
 * SemanaEnBarras
 * @param {Array<{dia_semana: number, hora_inicio: string, hora_fin: string}>} props.bloques
 *   Los rangos de cada día abierto (uno o varios por día)
 * @param {{hora_inicio: string, hora_fin: string}|null} [props.pausa] - Se dibuja como corte
 * @param {Set<number>} [props.propios] - Días con horario propio (su texto se resalta)
 * @param {number|null} [props.diaAbierto] - Día con el detalle abierto
 * @param {Function} [props.onTocarDia] - Recibe el dia_semana; sin él, las filas no se tocan
 * @param {ReactNode} [props.detalle] - Lo que va debajo del día abierto (ej. sus botones de hora)
 * @param {string} props.etiqueta - Nombre de la lista para el lector ("Horario de la semana")
 * @param {string} [props.idBase] - Prefijo de los ids de los detalles y de los
 *   botones de cada día (idDiaSemana)
 * @returns {JSX.Element}
 */
function SemanaEnBarras({
  bloques, pausa = null, propios, diaAbierto = null, onTocarDia, detalle, etiqueta, idBase = 'semana',
}) {
  const escala = calcularEscala(bloques);
  const total = escala.hasta - escala.desde;
  const dias = ordenarDias(bloques.map((b) => b.dia_semana));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Las horas de la escala, arriba (abajo quedaría separada por el detalle
          abierto de un día), alineadas con la columna de las barras. */}
      <div aria-hidden="true" style={{
        display: 'grid',
        gridTemplateColumns: COLUMNAS,
        gap: 12,
        padding: '0 8px',
      }}>
        <span />
        <span style={{ position: 'relative', height: 16 }}>
          {escala.marcas.map((m, i) => {
            const primera = i === 0 && m === escala.desde;
            const ultima = m === escala.hasta;
            return (
              <span key={m} style={{
                position: 'absolute',
                top: 0,
                left: `${((m - escala.desde) / total) * 100}%`,
                transform: primera ? 'none' : (ultima ? 'translateX(-100%)' : 'translateX(-50%)'),
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                color: theme.muted,
                whiteSpace: 'nowrap',
              }}>
                {m === 24 * 60 ? '24' : fmtHoraCorta(aHora(m))}
              </span>
            );
          })}
        </span>
        <span />
      </div>

      <ul aria-label={etiqueta} style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dias.map((dia) => {
          const detalleId = `${idBase}-detalle-${dia}`;
          const abierto = diaAbierto === dia;
          return (
            <li key={dia}>
              <FilaDia
                dia={dia}
                bloques={bloques.filter((b) => b.dia_semana === dia)}
                pausa={pausa}
                escala={escala}
                propio={propios?.has(dia) ?? false}
                abierto={abierto}
                onTocar={onTocarDia}
                detalleId={detalleId}
                id={idDiaSemana(idBase, dia)}
              />
              {abierto && detalle && (
                <div id={detalleId} className="al-crecer">
                  <div>{detalle}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SemanaEnBarras;
