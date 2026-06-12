// /frontend/src/components/SelectorSemana.jsx

// Selector de semana ISO. Envuelve a SelectorPeriodo con la lógica específica
// de semanas: formatea el label como rango lunes → domingo, calcula si la
// semana seleccionada es la actual, deshabilita el botón ▶ para evitar navegar
// a semanas futuras y muestra el badge "Esta semana" cuando corresponde.
//
// Uso:
//   const [semana, setSemana] = useState(getSemanaActual());
//   <SelectorSemana value={semana} onChange={setSemana} />
//
// El value es un string en formato 'YYYY-WNN' (ej: '2026-W12').

import SelectorPeriodo from './SelectorPeriodo';
import {
  desplazarSemana,
  getSemanaActual,
  semanaALabel,
} from '../../utils/fecha';

/**
 * @param {object} props
 * @param {string}   props.value     - Semana seleccionada en formato 'YYYY-WNN'
 * @param {(semana: string) => void} props.onChange - Callback al cambiar de semana
 */
export default function SelectorSemana({ value, onChange }) {
  const esActual = value >= getSemanaActual();

  const handleAnterior  = () => onChange(desplazarSemana(value, -1));
  const handleSiguiente = () => onChange(desplazarSemana(value, +1));

  return (
    <SelectorPeriodo
      label={semanaALabel(value)}
      onAnterior={handleAnterior}
      onSiguiente={handleSiguiente}
      siguienteDeshabilitado={esActual}
      badge={esActual ? { texto: 'Esta semana', destacado: true } : null}
      minWidth={200}
      fontSize={15}
      labelDestacado={esActual}
    />
  );
}