// /frontend-barbero/src/components/ui/MarcoAcceso.jsx
// Marco de la pantalla de acceso de la app del barbero: la foto del local de
// fondo (FondoLocal) y una card clara centrada. Lo comparten las dos fases del
// login (elegir barbero y PIN), así la card no se vuelve a montar al cambiar
// de fase.
//
// Copia adaptada de /frontend/src/components/ui/MarcoAcceso.jsx (2026-11-13, F5
// de plan_mejoras_operativas.md), para que el barbero vea la misma "puerta" en
// su celular que en el iPad y el panel. Diferencias con la del panel: no tiene
// `onSubmit` (el login del barbero no es un formulario) y la bajada de
// `EncabezadoAcceso` es una región `aria-live`, para que el lector de pantalla
// anuncie "PIN incorrecto".
//
// Estructura: FondoLocal → un overlay con scroll propio → la card. FondoLocal es
// overflow:hidden, así que el overlay scrollea: si la card no entra (muchos
// barberos, un celular chico), se desliza en vez de recortarse. `margin: auto`
// la centra cuando sobra lugar.

import { theme } from '../../theme/tokens.js';
import FondoLocal from './FondoLocal.jsx';

/**
 * MarcoAcceso
 * Fondo del local + card centrada de la pantalla de acceso.
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] - Foto del local para el fondo.
 * @param {number} [props.maxAncho=380] - Ancho máximo de la card.
 * @param {React.ReactNode} [props.esquina] - Botón de la esquina superior
 *   izquierda de la card (ej. "Volver"); se posiciona solo (absolute). Con él,
 *   la card suma lugar arriba.
 * @param {React.ReactNode} props.children - Contenido de la card.
 * @returns {JSX.Element}
 */
function MarcoAcceso({ imagenLocal, maxAncho = 380, esquina = null, children }) {
  return (
    <FondoLocal imagenLocal={imagenLocal}>
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        // 16 en el celular, 24 desde ~600 px.
        padding: 'clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
      }}>
        <main style={{
          position: 'relative',
          margin: 'auto',
          width: '100%',
          maxWidth: maxAncho,
          boxSizing: 'border-box',
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          boxShadow: theme.shadowMd,
          // Con botón en la esquina, más lugar arriba (el botón mide 44).
          padding: esquina ? '56px 24px 24px' : 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          animation: 'om-fade .26s ease-out both',
        }}>
          {esquina}
          {children}
        </main>
      </div>
    </FondoLocal>
  );
}

/**
 * EncabezadoAcceso
 * Título y bajada de la pantalla de acceso, centrados. La bajada cambia de
 * color cuando es un error (ej. "PIN incorrecto"), sin moverse de lugar, y es
 * una región `aria-live`: sus cambios se anuncian. El título es enfocable por
 * código (tabIndex -1): al cambiar de fase, el login lleva el foco ahí para que
 * el lector de pantalla anuncie la pantalla nueva.
 * @param {Object} props
 * @param {React.ReactNode} props.titulo
 * @param {React.ReactNode} [props.bajada] - Texto debajo del título.
 * @param {boolean} [props.error=false] - Pinta la bajada en `danger`.
 * @param {React.Ref} [props.tituloRef] - Ref al <h1>.
 * @returns {JSX.Element}
 */
export function EncabezadoAcceso({ titulo, bajada, error = false, tituloRef }) {
  return (
    <div style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h1
        ref={tituloRef}
        tabIndex={-1}
        style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeTitle,
          lineHeight: 1.25,
          color: theme.ink,
          letterSpacing: '-0.02em',
          margin: 0,
          outline: 'none',
          overflowWrap: 'anywhere',
        }}
      >
        {titulo}
      </h1>
      <p
        aria-live="polite"
        style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: error ? theme.weightMedium : theme.weightRegular,
          color: error ? theme.danger : theme.muted,
          lineHeight: 1.5,
          margin: 0,
          minHeight: 21,
          transition: `color ${theme.transitionFast}`,
        }}
      >
        {bajada}
      </p>
    </div>
  );
}

export default MarcoAcceso;
