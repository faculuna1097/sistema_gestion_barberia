// /frontend-barbero/src/components/ui/FondoLocal.jsx
// Fondo a pantalla completa con la foto del local (tenant_imagen tipo='local')
// desenfocada y con un velo oscuro. Hoy lo usa MarcoAcceso (el login).
//
// Copia adaptada de /frontend/src/components/ui/FondoLocal.jsx (2026-11-13, F5
// de plan_mejoras_operativas.md): los fronts no comparten código
// (sistema_de_disenio.md §8). Diferencias con la del panel: no tiene el "telón"
// que retiene el contenido hasta que baja la foto (`esperarImagen`, solo lo usa
// la pantalla de entrada del iPad) y mide el ancho con 100%, no 100vw.
//
// El blur está prohibido en general (§2), pero esta es la superficie de acceso
// que ya lo usa en el panel: lo que va encima es una card opaca, así que el
// contraste no depende de la foto. Sin foto, el fondo es `surfaceAlt`.
//
// La foto se pinta con `background-image`, que no avisa cuándo terminó de
// bajar: se precarga con `new Image()` y, al cargar, el fondo entra con un
// fundido en vez de aparecer de golpe.

import { useState, useEffect } from 'react';
import { theme } from '../../theme/tokens.js';
import { ALTO_VISIBLE } from '../../utils/pantalla.js';

// Velo sobre la foto (ink al 45 %, el mismo del panel). Fija el contraste de lo
// que va encima sin importar si la foto es clara u oscura.
const VELO = 'rgba(9, 9, 11, 0.45)';

// Desenfoque por defecto. Los logins del panel usan 10.
const BLUR_PX_DEFAULT = 10;

/**
 * prefiereSinMovimiento
 * ¿El sistema pide reducir animaciones? Si sí, la foto aparece sin fundido.
 * @returns {boolean}
 */
function prefiereSinMovimiento() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * FondoLocal
 * Contenedor a pantalla completa (ancho 100 %, alto visible) con la foto del
 * local de fondo y el contenido encima. Es `position: relative` y
 * `overflow: hidden`: el contenido que necesite scroll lo maneja adentro (como
 * MarcoAcceso).
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] - URL de la foto. Sin ella, fondo `surfaceAlt`.
 * @param {number} [props.blurPx=10] - Desenfoque de la foto, en px.
 * @param {React.ReactNode} props.children - Lo que va encima del fondo.
 * @returns {JSX.Element}
 */
function FondoLocal({ imagenLocal, blurPx = BLUR_PX_DEFAULT, children }) {
  // URL de la foto que ya terminó de bajar. Se compara con la actual, así un
  // cambio de URL vuelve a esperar la carga sin resetear estado en el efecto.
  const [fotoLista, setFotoLista] = useState(null);
  const [sinMovimiento] = useState(prefiereSinMovimiento);

  // Precarga la foto para saber cuándo bajó (un background-image no lo avisa)
  // y, de paso, la deja en la caché del navegador.
  useEffect(() => {
    if (!imagenLocal) return undefined;
    let vivo = true;
    const img = new Image();
    img.onload = () => { if (vivo) setFotoLista(imagenLocal); };
    img.onerror = () => {
      if (vivo) console.warn('[FondoLocal] No se pudo cargar la foto del local; queda el fondo gris.');
    };
    img.src = imagenLocal;
    return () => {
      vivo = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imagenLocal]);

  const fotoCargada = Boolean(imagenLocal) && fotoLista === imagenLocal;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: ALTO_VISIBLE,
      overflow: 'hidden',
      background: theme.surfaceAlt,
      fontFamily: theme.body,
    }}>
      {imagenLocal && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            // Recorta la foto agrandada (scale 1.1, para que el blur no deje
            // bordes transparentes): sin esto el contenedor se vuelve scrolleable.
            overflow: 'hidden',
            opacity: fotoCargada ? 1 : 0,
            transition: sinMovimiento ? 'none' : `opacity ${theme.transitionMedium}`,
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${imagenLocal}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${blurPx}px)`,
            transform: 'scale(1.1)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: VELO }} />
        </div>
      )}

      {children}
    </div>
  );
}

export default FondoLocal;
