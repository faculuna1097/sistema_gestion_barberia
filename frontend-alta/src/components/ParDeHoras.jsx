// /frontend-alta/src/components/ParDeHoras.jsx
// Un rango del día como dos SelectorHora lado a lado: desde y hasta. Lo usan
// el horario del local (pantalla 4: apertura, cierre y la pausa) y los bloques
// de cada barbero (pantalla 7). Salió de PantallaHorario en la fase 4, al
// tener un segundo uso.

import SelectorHora from './SelectorHora.jsx';
import { PASO_MINUTOS, HORA_MAXIMA, HORA_MINIMA, sumarMinutos } from '../utils/horas.js';

/**
 * ParDeHoras
 * Cada hora frena PASO_MINUTOS antes de la otra, así el rango nunca queda al
 * revés. `min` y `max` acotan además el rango entero (ej. un bloque de barbero
 * dentro del horario del local ese día). Una hora que ya está fuera de esos
 * topes (ej. el local cambió después) solo se puede mover hacia adentro.
 * @param {{hora_inicio: string, hora_fin: string}} props.rango
 * @param {Function} props.onCambiar - Recibe el rango nuevo
 * @param {string} props.etiquetaInicio - "Abren", "Entra"
 * @param {string} props.etiquetaFin - "Cierran", "Sale"
 * @param {string} [props.min=HORA_MINIMA] - Lo más temprano que puede empezar
 * @param {string} [props.max=HORA_MAXIMA] - Lo más tarde que puede terminar
 * @param {string} [props.errorId] - id del error que describe a los botones
 * @param {Object} [props.refPrimero] - Ref al primer botón (para llevarle el foco)
 * @returns {JSX.Element}
 */
function ParDeHoras({
  rango, onCambiar, etiquetaInicio, etiquetaFin, min = HORA_MINIMA, max = HORA_MAXIMA, errorId, refPrimero,
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <SelectorHora
        etiqueta={etiquetaInicio}
        valor={rango.hora_inicio}
        min={min}
        max={sumarMinutos(rango.hora_fin, -PASO_MINUTOS)}
        onCambiar={(hora) => onCambiar({ ...rango, hora_inicio: hora })}
        errorId={errorId}
        refPrimero={refPrimero}
      />
      <SelectorHora
        etiqueta={etiquetaFin}
        valor={rango.hora_fin}
        min={sumarMinutos(rango.hora_inicio, PASO_MINUTOS)}
        max={max}
        onCambiar={(hora) => onCambiar({ ...rango, hora_fin: hora })}
        errorId={errorId}
      />
    </div>
  );
}

export default ParDeHoras;
