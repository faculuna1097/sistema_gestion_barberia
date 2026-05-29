// /frontend/src/components/ui/FondoLocal.jsx
// Fondo ambiental compartido por las superficies operativas del local
// (MainScreen + los 3 flujos Corte/Venta/Gasto). Encapsula la foto del local
// (tenant_imagen tipo='local') con BLUR + velo oscuro, sobre un contenedor
// full-screen centrado.
//
// Es una SUPERFICIE ESPECIAL del sistema de diseño: el blur está prohibido en
// general (glassmorphism, §2), pero acá la pantalla es ambiental (vive todo el
// día en el iPad del mostrador) y el efecto da calidez sin sacrificar contraste
// (lo que va encima —botones sólidos o un panel claro— es opaco). Centralizado
// para garantizar que MainScreen y los flujos compartan exactamente el mismo
// fondo (mismas constantes, mismo velo, mismo fallback).
//
// El contenedor centra su contenido (flex center). Los hijos posicionados con
// `position: absolute` (ej. las esquinas de MainScreen) quedan relativos a este
// contenedor (que es `position: relative`), fuera del flujo del centrado.

import { theme } from '../../theme/tokens.js';

// ─── Presentación del fondo ───────────────────────────────────────────────────
// Constantes pensadas para iterar el look sin tocar a los consumidores.
//   VELO    — 'oscuro' da más calidez/cine; 'claro' mantiene el aire Stripe/Clerk.
//   BLUR_PX — intensidad del desenfoque de la foto del local.
const VELO = 'oscuro'; // 'oscuro' | 'claro'
const BLUR_PX = 4;

// Color del velo según la variante elegida.
const VELO_BG =
  VELO === 'oscuro' ? 'rgba(9, 9, 11, 0.45)' : 'rgba(255, 255, 255, 0.62)';

/**
 * FondoLocal
 * Contenedor full-screen con la foto del local (blur + velo) de fondo y el
 * contenido centrado encima. Si no hay foto, cae a `theme.surfaceAlt`.
 *
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] — URL de la foto del local. Sin ella,
 *   fallback a `theme.surfaceAlt`.
 * @param {React.ReactNode} props.children — contenido a renderizar sobre el fondo.
 * @returns {JSX.Element}
 */
function FondoLocal({ imagenLocal, children }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.body,
        background: imagenLocal ? 'transparent' : theme.surfaceAlt,
      }}
    >
      {imagenLocal && (
        <>
          {/* Capa de imagen: foto del local desenfocada. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${imagenLocal}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${BLUR_PX}px)`,
              // scale evita que el blur revele bordes transparentes.
              transform: 'scale(1.1)',
            }}
          />
          {/* Velo plano sobre la foto para fijar contraste. No es glassmorphism. */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, background: VELO_BG }}
          />
        </>
      )}

      {children}
    </div>
  );
}

export default FondoLocal;
