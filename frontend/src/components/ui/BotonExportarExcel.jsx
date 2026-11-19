// /frontend/src/components/ui/BotonExportarExcel.jsx
// Botón de "Exportar Excel" — wrapper delgado sobre el primitivo Button
// que fija el ícono (Lucide Download) y el nombre.
//
// Razón de no usar Button directo en el consumidor: estandariza el ícono
// y el nombre entre secciones (Caja, Ventas, Gastos, Balances, Planillas) — si
// en el futuro queremos cambiar a "Descargar reporte" o cambiar el ícono, se
// toca un solo lugar.
//
// Desde el 2026-11-19 (F4 de plan_mejoras_operativas.md, pedido del usuario) es
// solo el ícono, en un cuadrado de 44 × 44 (touch target de §5.4): con el
// texto, la fila de Caja no entraba en pantalla angosta al sumarse el botón
// "Hoy". El nombre queda para el lector de pantalla (ariaLabel) y al pasar el
// mouse (title).

import { Download } from 'lucide-react';
import Button from './Button.jsx';

const NOMBRE = 'Exportar Excel';

/**
 * BotonExportarExcel
 * @param {object} props
 * @param {() => void} props.onClick - Handler al hacer click.
 * @param {boolean} [props.disabled=false] - Deshabilita el botón.
 */
export default function BotonExportarExcel({ onClick, disabled = false }) {
  return (
    // El span lleva el title: Button no lo recibe, y así se ve también deshabilitado.
    <span title={NOMBRE} style={{ display: 'inline-flex', flexShrink: 0 }}>
      <Button
        variant="secondary"
        full={false}
        onClick={onClick}
        disabled={disabled}
        ariaLabel={NOMBRE}
        style={{ width: 44, height: 44, padding: 0 }}
      >
        <Download size={18} strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </span>
  );
}
