// /frontend-alta/src/components/SelectorDias.jsx
// Los siete días de la semana como botones que se prenden y se apagan (plan
// §5.2). Lo usan la pantalla de días del local (3) y, en la fase 4, la de los
// horarios del equipo (7), un selector por barbero.
// Vive en components/ y no en ui/: es del dominio del formulario (días de
// atención), igual que TarjetaBarberia.

import { theme } from '../theme/tokens.js';
import { ORDEN_SEMANA, nombreDia } from '../utils/semana.js';

/**
 * BotonDia
 * Un día: alto de 56 px y el ancho de su columna (en 375 px, ~45 px: por
 * encima de los 44 del toque cómodo). `aria-pressed` dice si está prendido.
 * @param {number} props.dia - dia_semana
 * @param {boolean} props.prendido
 * @param {boolean} props.deshabilitado - El día no se puede elegir (ej. el local no abre)
 * @param {Function} props.onClick
 * @param {string} [props.describedBy] - id del texto de error del grupo
 * @param {Object} [props.ref] - Ref al <button> (para llevar el foco al primer día)
 * @returns {JSX.Element}
 */
function BotonDia({ dia, prendido, deshabilitado, onClick, describedBy, ref }) {
  let fondo = theme.surface;
  let color = theme.ink;
  let borde = theme.hairline;
  if (prendido) {
    fondo = theme.accent;
    color = theme.accentInk;
    borde = theme.accent;
  } else if (deshabilitado) {
    fondo = theme.surfaceAlt;
    color = theme.mutedSoft;
    borde = theme.hairlineSoft;
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={deshabilitado ? undefined : onClick}
      disabled={deshabilitado}
      aria-pressed={prendido}
      aria-label={nombreDia(dia, { mayuscula: true })}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        flex: 1,
        minWidth: 0,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: fondo,
        color,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        cursor: deshabilitado ? 'not-allowed' : 'pointer',
        boxShadow: prendido ? theme.shadowSm : 'none',
        // `transform` acompaña al achique de al-presionable (index.css) al tocar.
        transition: `background ${theme.transitionFast}, color ${theme.transitionFast}, border-color ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {/* La abreviatura se ve; el nombre completo lo lee el aria-label. */}
      <span aria-hidden="true">{nombreDia(dia, { corto: true, mayuscula: true })}</span>
    </button>
  );
}

/**
 * SelectorDias
 * Fila de siete botones, de lunes a domingo, dentro de un grupo con nombre.
 * Con error, cada botón apunta al texto del error (aria-describedby): el foco
 * del "Seguir" va al primer día y el lector lee el porqué.
 * @param {number[]} props.seleccionados - dia_semana prendidos (0 = domingo)
 * @param {Function} props.onAlternar - Recibe el dia_semana tocado
 * @param {string} props.etiqueta - Nombre del grupo para el lector ("Días que abre el local")
 * @param {number[]} [props.habilitados] - Si viene, solo estos días se pueden tocar (fase 4: los que abre el local)
 * @param {string} [props.errorId] - id del texto de error, si hay error
 * @param {Object} [props.refPrimero] - Ref al primer botón habilitado (para el foco del error)
 * @returns {JSX.Element}
 */
function SelectorDias({ seleccionados, onAlternar, etiqueta, habilitados, errorId, refPrimero }) {
  const prendidos = new Set(seleccionados);
  const sePuede = (dia) => !habilitados || habilitados.includes(dia);
  const primero = ORDEN_SEMANA.find(sePuede);

  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', gap: 4 }}>
      {ORDEN_SEMANA.map((dia) => (
        <BotonDia
          key={dia}
          ref={dia === primero ? refPrimero : undefined}
          dia={dia}
          prendido={prendidos.has(dia)}
          deshabilitado={!sePuede(dia)}
          onClick={() => onAlternar(dia)}
          describedBy={errorId}
        />
      ))}
    </div>
  );
}

export default SelectorDias;
