// /frontend/src/components/SelectorDia.jsx

// Selector de día. Envuelve a SelectorPeriodo con la lógica específica de días:
// formatea el label como "Lunes 15 de Marzo de 2026", calcula si el día
// seleccionado es hoy, deshabilita el botón ▶ para evitar navegar a días
// futuros y muestra el badge "Hoy" cuando corresponde.
//
// Uso:
//   const [fecha, setFecha] = useState(getFechaHoy());
//   <SelectorDia value={fecha} onChange={setFecha} />
//
// El value es un string en formato 'YYYY-MM-DD' (ej: '2026-03-15').

import SelectorPeriodo from './SelectorPeriodo';
import {
  desplazarDia,
  getFechaHoy,
  fechaALabel,
} from '../utils/fechas';

/**
 * @param {object} props
 * @param {string}   props.value     - Día seleccionado en formato 'YYYY-MM-DD'
 * @param {(fecha: string) => void} props.onChange - Callback al cambiar de día
 */
export default function SelectorDia({ value, onChange }) {
  const esHoy = value >= getFechaHoy();

  const handleAnterior  = () => onChange(desplazarDia(value, -1));
  const handleSiguiente = () => onChange(desplazarDia(value, +1));

  return (
    <SelectorPeriodo
      label={fechaALabel(value)}
      onAnterior={handleAnterior}
      onSiguiente={handleSiguiente}
      siguienteDeshabilitado={esHoy}
      badge={esHoy ? { texto: 'Hoy', destacado: true } : null}
      minWidth={220}
      fontSize={15}
    />
  );
}