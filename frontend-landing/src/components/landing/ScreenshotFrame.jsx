// /frontend-landing/src/components/landing/ScreenshotFrame.jsx
// Marco para mostrar capturas del producto. Bordes redondeados + sombra para
// el aire premium de las landings SaaS, sin glassmorphism ni gradientes (§2).
// Si todavía no hay imagen, muestra un placeholder neutro (no rompe el layout).
// El "chrome" tipo navegador es opcional (off por defecto, para no duplicar
// chrome si la captura ya lo trae).

import { Image as ImageIcon } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * ChromeBar
 * Barra superior tipo navegador (puntos + url). Solo si chrome=true.
 * @param {string} props.label - Texto de la barra de URL
 */
function ChromeBar({ label }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.hairlineSoft}`,
        background: theme.surfaceAlt,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: 999, background: theme.hairline }} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          maxWidth: 260,
          marginInline: 'auto',
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          color: theme.muted,
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: 999,
          padding: '4px 12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div style={{ width: 42 }} aria-hidden="true" />
    </div>
  );
}

/**
 * Placeholder
 * Caja neutra que ocupa el lugar de la captura hasta que se suba.
 * @param {string} props.label - Texto del placeholder
 */
function Placeholder({ label }) {
  return (
    <div
      style={{
        aspectRatio: '16 / 10',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: theme.surfaceAlt,
        color: theme.muted,
      }}
    >
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
      <span style={{ fontFamily: theme.body, fontSize: 13 }}>{label}</span>
    </div>
  );
}

// Corte celular/escritorio, el mismo de las clases om- de index.css (768 px).
// Va en el atributo media del <source>: lo resuelve el navegador, no el render.
const MEDIA_CELULAR = '(max-width: 767px)';

/**
 * Captura
 * La imagen de la captura. Con imageMobile arma un <picture>: el navegador
 * elige la versión según el ancho y baja una sola. Sin imageMobile, un <img>.
 * @param {string} props.image - URL de la captura de escritorio
 * @param {number} [props.width] - Ancho real del archivo de escritorio en px
 * @param {number} [props.height] - Alto real del archivo de escritorio en px
 * @param {{src: string, width: number, height: number}} [props.imageMobile] -
 *   Versión para celular (< 768 px), con sus medidas reales
 * @param {boolean} props.priority - Descarga con prioridad alta (fetchpriority)
 * @param {'lazy'|'eager'} [props.loading] - Carga diferida nativa del <img>
 * @param {string} props.alt - Texto alternativo (vale para las dos versiones)
 * @returns {JSX.Element}
 */
function Captura({ image, width, height, imageMobile, priority, loading, alt }) {
  // height: 'auto' es obligatorio: con el atributo height solo, la imagen
  // quedaría con alto fijo. Así el navegador usa width/height como
  // proporción y reserva el lugar justo.
  const img = (
    <img
      src={image}
      alt={alt}
      width={width}
      height={height}
      fetchPriority={priority ? 'high' : undefined}
      loading={loading}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
  if (!imageMobile) return img;

  // El width/height del <source> reserva la proporción de la versión celular
  // (sin ellos, el lugar se reservaría con la proporción de la de escritorio y
  // saltaría al cargar). El fetchpriority del <img> vale para la que se elija.
  return (
    <picture>
      <source
        media={MEDIA_CELULAR}
        srcSet={imageMobile.src}
        width={imageMobile.width}
        height={imageMobile.height}
      />
      {img}
    </picture>
  );
}

/**
 * ScreenshotFrame
 * Marco que contiene una captura del producto (o un placeholder).
 * @param {string} [props.image] - URL de la captura; si falta, muestra placeholder
 * @param {number} [props.width] - Ancho real del archivo en px. Junto con height,
 *   el navegador reserva el espacio antes de que cargue (sin salto de contenido)
 * @param {number} [props.height] - Alto real del archivo en px
 * @param {{src: string, width: number, height: number}} [props.imageMobile] -
 *   Versión para celular (< 768 px). Si viene, se baja solo la que corresponde
 * @param {boolean} [props.priority=false] - Imagen principal de la página (Hero):
 *   se descarga con prioridad alta. Solo una por página
 * @param {'lazy'|'eager'} [props.loading] - 'lazy' para capturas lejos del
 *   primer pantallazo: no se bajan hasta que el usuario se acerca
 * @param {string} [props.alt=''] - Texto alternativo de la imagen
 * @param {ReactNode} [props.children] - Contenido alternativo si no hay image
 * @param {boolean} [props.chrome=false] - Muestra la barra tipo navegador
 * @param {string} [props.label='barbermanager.app'] - URL de la ChromeBar
 * @param {string} [props.placeholderLabel='Captura del producto'] - Texto del placeholder
 * @param {Object} [props.style] - Override del contenedor
 * @returns {JSX.Element}
 */
function ScreenshotFrame({
  image,
  width,
  height,
  imageMobile,
  priority = false,
  loading,
  alt = '',
  children,
  chrome = false,
  label = 'barbermanager.app',
  placeholderLabel = 'Captura del producto',
  style,
}) {
  return (
    <div
      style={{
        borderRadius: theme.radiusLg,
        border: `1px solid ${theme.hairline}`,
        background: theme.surface,
        boxShadow: theme.shadowLg,
        overflow: 'hidden',
        ...style,
      }}
    >
      {chrome && <ChromeBar label={label} />}
      {image ? (
        <Captura
          image={image}
          width={width}
          height={height}
          imageMobile={imageMobile}
          priority={priority}
          loading={loading}
          alt={alt}
        />
      ) : (
        children ?? <Placeholder label={placeholderLabel} />
      )}
    </div>
  );
}

export default ScreenshotFrame;
