// /frontend/src/components/ui/DetalleRecurso.jsx
// Lista vertical de pares label/valor — pensado para insertarse como
// children del ConfirmDialog cuando se confirma una acción destructiva y
// se quiere mostrar el resumen del recurso afectado.

import { theme } from '../../theme/tokens.js';

/**
 * DetalleRecurso
 * Renderiza una lista de filas { label (izq, muted) | valor (der, ink) }
 * dentro de un bloque con fondo `surfaceAlt`. Cada fila acepta opciones
 * puntuales para destacar el valor (típicamente el monto).
 *
 * @param {object} props
 * @param {Array<{
 *   label: string,
 *   valor: import('react').ReactNode,
 *   numeric?: boolean,
 *   valorColor?: string,
 *   valorWeight?: string|number,
 * }>} props.filas
 */
function DetalleRecurso({ filas }) {
  return (
    <div style={{
      background: theme.surfaceAlt,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {filas.map((f, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: theme.sizeBody,
          fontFamily: theme.body,
        }}>
          <span style={{ color: theme.muted }}>{f.label}</span>
          <span style={{
            color: f.valorColor ?? theme.ink,
            fontWeight: f.valorWeight ?? theme.weightMedium,
            textAlign: 'right',
            fontVariantNumeric: f.numeric ? 'tabular-nums' : 'normal',
          }}>{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

export default DetalleRecurso;
