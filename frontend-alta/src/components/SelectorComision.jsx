// /frontend-alta/src/components/SelectorComision.jsx
// La comisión de un barbero (o la de todos): una barra que salta de 5 en 5,
// de 0 a 100, con botones de - y + a los costados (pantalla 5). Es el
// SelectorConBarra con el rango y el formato de la comisión.
// Vive en components/ y no en ui/: el paso y el tope son los de la comisión
// (utils/equipo.js).

import { COMISION_MAXIMA } from '../utils/validaciones.js';
import { COMISION_POR_DEFECTO, PASO_COMISION } from '../utils/equipo.js';
import SelectorConBarra from './SelectorConBarra.jsx';

/**
 * fmtComision (interna)
 * @param {number} valor
 * @returns {string} "50 %"
 */
const fmtComision = (valor) => `${valor} %`;

/**
 * SelectorComision
 * @param {string} props.etiqueta - Nombre visible ("Todos", "Juan")
 * @param {number} props.valor - El % actual
 * @param {Function} props.onCambiar - Recibe el % nuevo (entero, múltiplo de 5)
 * @param {string} [props.errorId] - id del texto de error que describe a la barra
 * @param {Object} [props.ref] - Ref a la barra (para llevarle el foco a un error)
 * @returns {JSX.Element}
 */
function SelectorComision({ etiqueta, valor, onCambiar, errorId, ref }) {
  return (
    <SelectorConBarra
      ref={ref}
      etiqueta={etiqueta}
      valor={valor}
      onCambiar={onCambiar}
      min={0}
      max={COMISION_MAXIMA}
      paso={PASO_COMISION}
      porDefecto={COMISION_POR_DEFECTO}
      formatear={fmtComision}
      unidadPaso={`${PASO_COMISION} %`}
      errorId={errorId}
    />
  );
}

export default SelectorComision;
