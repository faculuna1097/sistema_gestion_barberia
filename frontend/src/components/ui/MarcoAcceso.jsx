// /frontend/src/components/ui/MarcoAcceso.jsx
// Marco de las pantallas de acceso: el login del iPad (PantallaLoginOperativo),
// el login del panel por PIN (PantallaLoginPanel) y la recuperación por mail
// (PantallaRecuperacion). Se centralizó el 2026-11-13 (F6 de
// plan_mejoras_operativas.md), al tercer uso (sistema_de_disenio.md §7.1).
//
// Estructura: `FondoLocal` (la foto del local con blur y velo) → un overlay con
// scroll propio → la card clara centrada. FondoLocal es overflow:hidden, así que
// el overlay scrollea: si sube el teclado del iPad o del celular y achica la
// pantalla, la card scrollea en vez de recortarse. `margin: auto` la centra
// cuando sobra lugar.

import { theme } from '../../theme/tokens.js';
import FondoLocal from './FondoLocal.jsx';

/**
 * MarcoAcceso
 * Fondo del local + card centrada de una pantalla de acceso.
 *
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] - Foto del local para el fondo.
 * @param {number} [props.blurPx] - Desenfoque de la foto (los logins usan más
 *   que el resto del iPad, para la sensación de "bloqueo").
 * @param {number} [props.maxAncho=380] - Ancho máximo de la card.
 * @param {React.ReactNode} [props.esquina] - Botón de la esquina superior
 *   izquierda de la card (ej. "Cancelar"). Con él, la card suma lugar arriba.
 * @param {Function} [props.onSubmit] - Si viene, la card es un <form> con este
 *   submit (el login del iPad, para que Enter envíe y el gestor de contraseñas
 *   reconozca el formulario).
 * @param {React.ReactNode} props.children - Contenido de la card.
 * @returns {JSX.Element}
 */
function MarcoAcceso({ imagenLocal, blurPx, maxAncho = 380, esquina = null, onSubmit, children }) {
  const Card = onSubmit ? 'form' : 'div';
  return (
    <FondoLocal imagenLocal={imagenLocal} blurPx={blurPx}>
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        // 16 en el celular, 24 desde ~600 px.
        padding: 'clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
      }}>
        <Card
          onSubmit={onSubmit}
          noValidate={onSubmit ? true : undefined}
          style={{
            position: 'relative',
            margin: 'auto',
            width: '100%',
            maxWidth: maxAncho,
            boxSizing: 'border-box',
            background: theme.surface,
            border: `1px solid ${theme.hairline}`,
            borderRadius: theme.radiusLg,
            boxShadow: theme.shadowMd,
            // 24 en el celular, 32 desde ~530 px. Con botón en la esquina, más arriba.
            padding: esquina ? '48px clamp(24px, 6vw, 32px) 32px' : 'clamp(24px, 6vw, 32px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            animation: 'om-fade .26s ease-out both',
          }}
        >
          {esquina}
          {children}
        </Card>
      </div>
    </FondoLocal>
  );
}

/**
 * EncabezadoAcceso
 * Título y bajada de una pantalla de acceso, centrados, debajo del logo. La bajada
 * cambia de color cuando es un error (ej. "PIN incorrecto"), sin moverse de lugar.
 * El título acepta `tituloRef` y es enfocable por código (tabIndex -1): al cambiar
 * de paso dentro de la misma card, la pantalla lleva el foco ahí para que el lector
 * de pantalla anuncie el paso nuevo.
 *
 * @param {Object} props
 * @param {string} props.titulo
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
          color: theme.ink,
          letterSpacing: '-0.02em',
          margin: 0,
          outline: 'none',
        }}
      >
        {titulo}
      </h1>
      {bajada && (
        <p style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: error ? theme.weightMedium : theme.weightRegular,
          color: error ? theme.danger : theme.muted,
          lineHeight: 1.5,
          margin: 0,
          minHeight: 22,
          transition: `color ${theme.transitionFast}`,
        }}>
          {bajada}
        </p>
      )}
    </div>
  );
}

export default MarcoAcceso;
