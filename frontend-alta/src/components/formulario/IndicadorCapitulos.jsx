// /frontend-alta/src/components/formulario/IndicadorCapitulos.jsx
// Dónde está el cliente: el nombre del capítulo y cuatro tramos, uno por
// capítulo (plan §5.2: "cuatro capítulos en lugar de 'paso N de 13'"). El tramo
// del capítulo actual se llena según cuántas de sus pantallas ya pasó.
// Local de Formulario (sistema_de_disenio.md §7.1): no se usa en otro lado.

import { theme } from '../../theme/tokens.js';
import { CAPITULOS, PANTALLAS, indiceCapitulo } from '../../config/pantallas.js';
import { prefiereMenosMovimiento } from '../../utils/movimiento.js';
import { estiloSoloLector } from '../ui/estilos.js';

/**
 * avanceDelCapitulo
 * Qué fracción del capítulo actual se cubre al estar en una pantalla: la
 * primera de un capítulo de cuatro llena 1/4, la última lo llena entero.
 * @param {number} numero - Número de pantalla
 * @returns {number} De 0 a 1 (0 si la pantalla no tiene capítulo).
 */
function avanceDelCapitulo(numero) {
  const capitulo = PANTALLAS[numero]?.capitulo;
  if (!capitulo) return 0;
  const delCapitulo = PANTALLAS.filter((p) => p.capitulo === capitulo).map((p) => p.numero);
  return (delCapitulo.indexOf(numero) + 1) / delCapitulo.length;
}

/**
 * IndicadorCapitulos
 * Nombre del capítulo actual y la barra de cuatro tramos. Las pantallas sin
 * capítulo (Bienvenida, Revisión, Listo) no lo muestran: el que lo usa no lo
 * monta.
 * @param {number} props.pantalla - Número de la pantalla actual
 * @returns {JSX.Element|null}
 */
function IndicadorCapitulos({ pantalla }) {
  const actual = indiceCapitulo(pantalla);
  if (actual < 0) return null;
  const avance = avanceDelCapitulo(pantalla);
  // El llenado acompaña el cambio de pantalla; con "reducir movimiento", salta.
  const transicion = prefiereMenosMovimiento() ? 'none' : 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
      <p style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {CAPITULOS[actual].nombre}
        <span style={estiloSoloLector}>{`, capítulo ${actual + 1} de ${CAPITULOS.length}`}</span>
      </p>

      {/* Decorativa para el lector: el texto de arriba ya dice el capítulo. */}
      <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
        {CAPITULOS.map((capitulo, i) => {
          const llenado = i < actual ? 1 : (i === actual ? avance : 0);
          return (
            <div key={capitulo.id} style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: theme.hairline,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: theme.accent,
                transform: `scaleX(${llenado})`,
                transformOrigin: 'left',
                transition: transicion,
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IndicadorCapitulos;
