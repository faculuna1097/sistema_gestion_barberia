// /frontend/src/components/SelectorMes.jsx

// Selector de mes. Envuelve a SelectorPeriodo con la lógica específica de meses:
// formatea el label, calcula si el mes seleccionado es el actual y deshabilita
// el botón ▶ para evitar navegar a meses futuros.
//
// Uso:
//   const [mes, setMes] = useState(getMesActual());
//   <SelectorMes value={mes} onChange={setMes} />
//
// El value es un string en formato 'YYYY-MM' (ej: '2026-03').

import SelectorPeriodo from './SelectorPeriodo';
import {
  desplazarMes,
  getMesActual,
  mesALabel,
} from '../utils/fecha';

/**
 * @param {object} props
 * @param {string}   props.value     - Mes seleccionado en formato 'YYYY-MM'
 * @param {(mes: string) => void} props.onChange - Callback al cambiar de mes
 */
export default function SelectorMes({ value, onChange }) {
  const esActual = value >= getMesActual();

  const handleAnterior  = () => onChange(desplazarMes(value, -1));
  const handleSiguiente = () => onChange(desplazarMes(value, +1));

  return (
    <SelectorPeriodo
      label={mesALabel(value)}
      onAnterior={handleAnterior}
      onSiguiente={handleSiguiente}
      siguienteDeshabilitado={esActual}
      minWidth={160}
      fontSize={17}
    />
  );
}