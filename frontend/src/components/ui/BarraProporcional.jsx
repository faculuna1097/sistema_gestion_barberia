// /frontend/src/components/ui/BarraProporcional.jsx
// Barra horizontal con ancho proporcional a un valor, hecha con divs y tokens
// (sin librería de gráficos). Puede ir partida en segmentos de distinto color,
// uno al lado del otro. Primer uso: DesgloseMontos (Balances y Planillas).
//
// Es decorativa (aria-hidden): el número que representa siempre se muestra
// como texto al lado, que es lo que leen los lectores de pantalla.

import { theme } from '../../theme/tokens.js';

/**
 * BarraProporcional
 * Pista gris de ancho completo con los segmentos pintados encima, de izquierda
 * a derecha. Cada segmento ocupa `valor / maximo` del ancho; si la suma pasa
 * del máximo, el sobrante se recorta. Un segmento con valor > 0 muestra al
 * menos 2px, para que un monto chico no desaparezca.
 *
 * @param {object} props
 * @param {Array<{valor: number, color: string}>} props.segmentos - Valores (los
 *   negativos cuentan como 0) y color de cada tramo, un token de `theme`.
 * @param {number} props.maximo - Valor que ocupa la barra entera. Con 0 o menos,
 *   la barra queda vacía.
 * @param {number} [props.alto=8] - Alto de la barra en px.
 * @returns {JSX.Element}
 */
function BarraProporcional({ segmentos, maximo, alto = 8 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        width: '100%',
        height: alto,
        // hairline y no surfaceAlt: sobre el blanco del modal, surfaceAlt casi
        // no se distingue.
        background: theme.hairline,
        borderRadius: theme.radiusSm,
        overflow: 'hidden',
      }}
    >
      {segmentos.map((s, i) => {
        const valor = Math.max(0, s.valor);
        const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0;
        return (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: `${pct}%`,
              minWidth: valor > 0 && maximo > 0 ? 2 : 0,
              background: s.color,
            }}
          />
        );
      })}
    </div>
  );
}

export default BarraProporcional;
