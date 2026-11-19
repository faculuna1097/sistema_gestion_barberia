// /frontend-turnero/src/components/ui/LineaContacto.jsx
// Fila de contacto del local (dirección, teléfono, reseñas): la usan la sección
// "Horarios y contacto" de la landing y el aviso de turno ya empezado de la
// gestión del turno.

import { estiloLineaInfo, estiloIconoInfo } from './estilos.js';

/**
 * ALTO_RENGLON_INFO
 * Alto de un renglón de texto de una fila de info (14 px × 1,5).
 */
const ALTO_RENGLON_INFO = 21;

/**
 * LineaContacto
 * Fila de contacto clickable: ícono + texto, renderizada como `<a>`.
 * Cumple el touch target mínimo de 44 px; el foco por teclado lo dibuja
 * el :focus-visible global de index.css.
 * Ícono y texto van juntos en un bloque centrado en la fila; adentro, el
 * ícono queda a la altura del primer renglón. Con un renglón se ve igual que
 * centrado; con dos (una dirección larga), el ícono acompaña al principio del
 * texto en vez de quedar entre los dos renglones.
 * @param {string} props.href - Destino del link (`tel:`, mapa, reseñas)
 * @param {boolean} [props.externo=false] - True si el link abre en otra pestaña
 * @param {JSX.Element} props.icono - Ícono a la izquierda
 * @param {string} props.texto - Texto visible
 */
function LineaContacto({ href, externo = false, icono, texto }) {
  return (
    <a
      href={href}
      target={externo ? '_blank' : undefined}
      rel={externo ? 'noopener noreferrer' : undefined}
      style={{ ...estiloLineaInfo, textDecoration: 'none' }}
    >
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: estiloLineaInfo.gap }}>
        <span style={{ ...estiloIconoInfo, height: ALTO_RENGLON_INFO, alignItems: 'center' }}>{icono}</span>
        <span>{texto}</span>
      </span>
    </a>
  );
}

export default LineaContacto;
