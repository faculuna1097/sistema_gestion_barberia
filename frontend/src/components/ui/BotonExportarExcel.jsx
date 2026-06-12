// /frontend/src/components/BotonExportarExcel.jsx
// Botón de "Exportar Excel" — wrapper delgado sobre el primitivo Button
// que fija el ícono (Lucide Download) y el label.
//
// Razón de no usar Button directo en el consumidor: estandariza el ícono
// y el label entre secciones (Caja, Ventas, Gastos, Balances) — si en el
// futuro queremos cambiar a "Descargar reporte" o cambiar el ícono, se
// toca un solo lugar.

import { Download } from 'lucide-react';
import Button from './Button.jsx';

/**
 * BotonExportarExcel
 * @param {object} props
 * @param {() => void} props.onClick - Handler al hacer click.
 * @param {boolean} [props.disabled=false] - Deshabilita el botón.
 */
export default function BotonExportarExcel({ onClick, disabled = false }) {
  return (
    <Button variant="secondary" full={false} onClick={onClick} disabled={disabled}>
      <Download size={16} strokeWidth={1.75} />
      Exportar Excel
    </Button>
  );
}
