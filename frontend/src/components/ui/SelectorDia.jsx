// /frontend/src/components/ui/SelectorDia.jsx

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
//
// Con `botonHoy`, suma a la derecha un botón "Hoy" que vuelve al día de hoy
// (Caja, desde el 2026-11-19). Está siempre a la vista y deshabilitado si ya es
// hoy, así el selector no se corre de lugar al ir y volver.

import SelectorPeriodo from './SelectorPeriodo';
import Button from './Button.jsx';
import {
  desplazarDia,
  getFechaHoy,
  fechaALabel,
} from '../../utils/fecha';

/**
 * @param {object} props
 * @param {string}   props.value          - Día seleccionado en formato 'YYYY-MM-DD'
 * @param {(fecha: string) => void} props.onChange - Callback al cambiar de día
 * @param {boolean}  [props.permitirFuturo=false] - Si true, no deshabilita navegación a días futuros
 * @param {boolean}  [props.botonHoy=false] - Si true, suma el botón "Hoy" a la derecha
 */
export default function SelectorDia({ value, onChange, permitirFuturo = false, botonHoy = false }) {
  const hoy   = getFechaHoy();
  const esHoy = value === hoy;

  const handleAnterior  = () => onChange(desplazarDia(value, -1));
  const handleSiguiente = () => onChange(desplazarDia(value, +1));

  const selector = (
    <SelectorPeriodo
      label={fechaALabel(value)}
      onAnterior={handleAnterior}
      onSiguiente={handleSiguiente}
      siguienteDeshabilitado={!permitirFuturo && esHoy}
      badge={esHoy ? { texto: 'Hoy', destacado: true } : null}
      minWidth={220}
      fontSize={15}
    />
  );

  if (!botonHoy) return selector;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {selector}
      <Button
        variant="secondary"
        full={false}
        onClick={() => onChange(hoy)}
        disabled={esHoy}
        ariaLabel="Hoy: volver al día de hoy"
        // 44 de alto, como los botones de su fila en Caja (Button mide ~47).
        style={{ height: 44, padding: '0 16px' }}
      >
        Hoy
      </Button>
    </div>
  );
}