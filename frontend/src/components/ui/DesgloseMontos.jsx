// /frontend/src/components/ui/DesgloseMontos.jsx
// Cuenta de montos renglón por renglón, estilo ticket: operador (+, −, =),
// rótulo, barra proporcional opcional y monto. Lo usan los modales de detalle
// de Balances (la cuenta de un mes del histórico) y de Planillas.
//
// No calcula nada: cada renglón llega con su monto ya resuelto por la sección.
// Los colores siguen la regla de las tablas: salidas en danger, resultados en
// accent, el resto en ink. El renglón "total" lleva la línea indigo de 2px de
// las filas TOTAL.

import { theme } from '../../theme/tokens.js';
import { fmtPesos } from '../../utils/formato.js';
import BarraProporcional from './BarraProporcional.jsx';

// Color del monto y de la barra según el tono del renglón. La barra neutra va
// en gris para que el color quede para las salidas y los resultados.
const TONOS = {
  neutro:   { texto: theme.ink,    barra: theme.mutedSoft },
  positivo: { texto: theme.accent, barra: theme.accent },
  negativo: { texto: theme.danger, barra: theme.danger },
};

// Borde superior, padding y pesos según la variante del renglón.
const VARIANTES = {
  normal:   { borde: 'none',                         padding: '8px 0',  peso: theme.weightRegular, pesoMonto: theme.weightMedium },
  subtotal: { borde: `1px solid ${theme.hairline}`,  padding: '8px 0',  peso: theme.weightMedium,  pesoMonto: theme.weightMedium },
  total:    { borde: `2px solid ${theme.accent}`,    padding: '12px 0', peso: theme.weightHeading, pesoMonto: theme.weightHeading },
};

/**
 * segmentosDe
 * Segmentos de la barra de un renglón: los que trae el renglón o, si no trae,
 * uno solo con el valor absoluto del monto en el color de su tono (así un
 * resultado negativo también se dibuja, en danger).
 * @param {object} renglon - Renglón de DesgloseMontos.
 * @returns {Array<{valor: number, color: string}>}
 */
function segmentosDe(renglon) {
  if (renglon.segmentos) return renglon.segmentos;
  return [{ valor: Math.abs(renglon.monto), color: TONOS[renglon.tono ?? 'neutro'].barra }];
}

/**
 * DesgloseMontos
 * Lista de renglones con la forma: operador · rótulo · barra · monto.
 *
 * @param {object} props
 * @param {Array<{
 *   label: string,
 *   monto: number,
 *   operador?: '+'|'−'|'=',
 *   tono?: 'neutro'|'positivo'|'negativo',
 *   variante?: 'normal'|'subtotal'|'total',
 *   segmentos?: Array<{valor: number, color: string}>,
 * }>} props.renglones - En orden de lectura. `label` no se repite dentro de la
 *   lista (es la key). `tono` pinta el monto y la barra (default neutro);
 *   `segmentos` reemplaza la barra por una partida en tramos.
 * @param {string} [props.titulo] - Eyebrow mono sobre la lista.
 * @param {boolean} [props.conBarras=true] - Si false, no dibuja la columna de barras.
 * @param {number} [props.maximo] - Valor que ocupa la barra entera. Default: el
 *   renglón más grande, así todas las barras comparten escala.
 * @returns {JSX.Element}
 */
function DesgloseMontos({ renglones, titulo, conBarras = true, maximo }) {
  const tope = maximo ?? Math.max(
    0,
    ...renglones.map((r) => segmentosDe(r).reduce((suma, s) => suma + Math.max(0, s.valor), 0)),
  );
  // Anchos fijos para que las columnas queden alineadas entre renglones
  // (cada renglón es su propia grilla).
  const columnas = conBarras
    ? '16px minmax(0, 1fr) minmax(80px, 160px) 112px'
    : '16px minmax(0, 1fr) 112px';

  return (
    <div>
      {titulo && (
        <div style={{
          marginBottom: 4,
          fontFamily: theme.mono,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: theme.inkSoft,
        }}>
          {titulo}
        </div>
      )}

      {/* role="list": Safari les saca la semántica de lista a las <ul> con
          list-style none. */}
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {renglones.map((r) => {
          const tono = TONOS[r.tono ?? 'neutro'];
          const variante = VARIANTES[r.variante ?? 'normal'];
          return (
            <li
              key={r.label}
              style={{
                display: 'grid',
                gridTemplateColumns: columnas,
                columnGap: 12,
                alignItems: 'center',
                padding: variante.padding,
                borderTop: variante.borde,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
              }}
            >
              <span style={{ fontFamily: theme.mono, color: theme.muted, textAlign: 'center' }}>
                {r.operador ?? ''}
              </span>
              <span style={{ color: theme.ink, fontWeight: variante.peso }}>
                {r.label}
              </span>
              {conBarras && <BarraProporcional segmentos={segmentosDe(r)} maximo={tope} />}
              <span style={{
                textAlign: 'right',
                color: tono.texto,
                fontWeight: variante.pesoMonto,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtPesos(r.monto)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DesgloseMontos;
