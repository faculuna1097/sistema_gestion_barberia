// /frontend/src/components/ui/FondoLocal.jsx
// Fondo ambiental compartido por las superficies operativas del local
// (MainScreen + los 3 flujos Corte/Venta/Gasto + los dos logins). Encapsula la
// foto del local (tenant_imagen tipo='local') con BLUR + velo, sobre un
// contenedor full-screen centrado.
//
// Es una SUPERFICIE ESPECIAL del sistema de diseño: el blur está prohibido en
// general (glassmorphism, §2), pero acá la pantalla es ambiental (vive todo el
// día en el iPad del mostrador) y el efecto da calidez sin sacrificar contraste
// (lo que va encima —botones sólidos o un panel claro— es opaco). Centralizado
// para garantizar que todas las superficies compartan exactamente el mismo
// fondo (mismas constantes, mismo velo, mismo fallback).
//
// PERF / UX percibida (#6): la foto se pinta con `background-image` de CSS, que
// NO avisa cuándo terminó de bajar → antes "aparecía de golpe" (snap) tras un
// período gris. Para suavizarlo:
//   • B (siempre): precargamos la foto con `new Image()` para detectar su carga
//     y hacemos FADE-IN del fondo (en vez del snap). El `new Image()` además
//     calienta el cache → el `background-image` después pinta instantáneo.
//   • A (solo si `esperarImagen`): un "telón" gris por encima retiene el
//     contenido hasta que la foto cargó (o salta un timeout), para que la
//     pantalla "entre" ya con la imagen. Pensado para la superficie ambiental
//     de entrada (MainScreen). No se usa en los logins (el form debe ser usable
//     al instante) ni en los flujos (la foto ya está en cache al llegar).
//
// El contenedor centra su contenido (flex center). Los hijos posicionados con
// `position: absolute` (ej. las esquinas de MainScreen) quedan relativos a este
// contenedor (que es `position: relative`), fuera del flujo del centrado.

import { useState, useEffect } from 'react';
import { theme } from '../../theme/tokens.js';

// ─── Presentación del fondo ───────────────────────────────────────────────────
// Constantes pensadas para iterar el look sin tocar a los consumidores.
//   VELO            — 'oscuro' da más calidez/cine; 'claro' mantiene el aire Stripe/Clerk.
//   BLUR_PX_DEFAULT — desenfoque por defecto (superficies operativas). Los logins
//                     pueden pedir más blur (sensación de "bloqueo") vía prop.
const VELO = 'oscuro'; // 'oscuro' | 'claro'
const BLUR_PX_DEFAULT = 4;

// Color del velo según la variante elegida.
const VELO_BG =
  VELO === 'oscuro' ? 'rgba(9, 9, 11, 0.45)' : 'rgba(255, 255, 255, 0.62)';

// Tope (ms) que el telón gris retiene el contenido esperando el onload de la
// foto. Si la imagen tarda más, revelamos igual (cuando finalmente baje, ya
// estará pintada detrás). Evita que una imagen lenta bloquee la entrada para
// siempre. Acordado en 2500 ms (cubre el peor caso frío sin colgar la entrada).
const TIMEOUT_REVELADO_MS = 2500;

// URLs de fondo ya descargadas en esta sesión. Compartido por TODAS las
// instancias de FondoLocal (módulo, no estado de React): una vez que una
// pantalla bajó la foto, las siguientes la dan por lista → volver/entrar a
// MainScreen o a un flujo no re-muestra el telón gris ni re-hace el fade.
const fotosCargadas = new Set();

/**
 * prefiereSinMovimiento
 * ¿El SO pide reducir animaciones? Si sí, no aplicamos transiciones de opacidad
 * (la foto / el contenido aparecen directo). Accesibilidad (§5 del sistema).
 * @returns {boolean}
 */
function prefiereSinMovimiento() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * FondoLocal
 * Contenedor full-screen con la foto del local (blur + velo) de fondo y el
 * contenido centrado encima. Si no hay foto, cae a `theme.surfaceAlt`.
 *
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] — URL de la foto del local. Sin ella,
 *   fallback a `theme.surfaceAlt`.
 * @param {boolean} [props.esperarImagen=false] — si true, retiene el contenido
 *   tras un telón gris hasta que la foto cargó (o salta el timeout), para que la
 *   pantalla "entre" ya con la imagen. Solo tiene sentido en la superficie
 *   ambiental de entrada (MainScreen). Sin foto, no hay nada que esperar.
 * @param {number} [props.blurPx=4] — intensidad del desenfoque de la foto.
 * @param {React.ReactNode} props.children — contenido a renderizar sobre el fondo.
 * @returns {JSX.Element}
 */
function FondoLocal({ imagenLocal, children, esperarImagen = false, blurPx = BLUR_PX_DEFAULT }) {
  // ¿La foto ya se descargó antes en esta sesión? Inicializa los estados para no
  // mostrar telón/fade en re-entradas (la foto ya está disponible al instante).
  const yaCargada = Boolean(imagenLocal) && fotosCargadas.has(imagenLocal);

  // fotoCargada: el .webp terminó de bajar. Dispara el fade-in del fondo (B).
  const [fotoCargada, setFotoCargada] = useState(yaCargada);
  // revelado: en modo gate (esperarImagen), indica que ya se puede levantar el
  // telón gris. Arranca cerrado solo si esperamos imagen y aún no está cargada.
  const [revelado, setRevelado] = useState(!esperarImagen || !imagenLocal || yaCargada);
  // Capturado una vez al montar: si el usuario pide menos movimiento, sin fades.
  const [sinMovimiento] = useState(prefiereSinMovimiento);

  // Precarga de la foto para detectar su `onload` (un background-image de CSS no
  // lo expone) y, de paso, calentar el cache. Al cargar: fade-in del fondo +
  // levanta el telón. Error/timeout: levanta el telón igual (sin marcar foto OK).
  useEffect(() => {
    if (!imagenLocal || fotosCargadas.has(imagenLocal)) {
      // Sin foto, o ya cargada antes: nada que esperar.
      if (imagenLocal) setFotoCargada(true);
      setRevelado(true);
      return undefined;
    }

    let vivo = true;

    const marcarCargada = () => {
      fotosCargadas.add(imagenLocal); // registrar aunque se desmonte (ya está en cache)
      if (!vivo) return;
      setFotoCargada(true);
      setRevelado(true);
    };
    const revelarSinFoto = () => {
      if (!vivo) return;
      setRevelado(true);
    };

    const img = new Image();
    img.onload = marcarCargada;
    img.onerror = revelarSinFoto;
    img.src = imagenLocal;

    // Cache hit síncrono (raro pero posible): la foto ya estaba lista.
    if (img.complete && img.naturalWidth > 0) {
      marcarCargada();
      return () => {
        vivo = false;
        img.onload = null;
        img.onerror = null;
      };
    }

    const timeoutId = setTimeout(revelarSinFoto, TIMEOUT_REVELADO_MS);
    return () => {
      vivo = false;
      img.onload = null;
      img.onerror = null;
      clearTimeout(timeoutId);
    };
  }, [imagenLocal]);

  // Transición de opacidad (fade). Funcional, no decorativa: reemplaza un corte
  // abrupto (§2 del sistema). Se anula si el usuario pide menos movimiento.
  const transicionOpacidad = sinMovimiento ? 'none' : `opacity ${theme.transitionMedium}`;

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
        // Base gris: fallback sin foto y telón de fondo mientras la foto carga.
        background: theme.surfaceAlt,
      }}
    >
      {imagenLocal && (
        // Capa foto+velo como una unidad. En modo gate se mantiene opaca (el
        // telón tapa la carga); sin gate hace fade-in al cargar (mata el snap).
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: esperarImagen || fotoCargada ? 1 : 0,
            transition: transicionOpacidad,
          }}
        >
          {/* Capa de imagen: foto del local desenfocada. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${imagenLocal}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${blurPx}px)`,
              // scale evita que el blur revele bordes transparentes.
              transform: 'scale(1.1)',
            }}
          />
          {/* Velo plano sobre la foto para fijar contraste. No es glassmorphism. */}
          <div style={{ position: 'absolute', inset: 0, background: VELO_BG }} />
        </div>
      )}

      {children}

      {/* Telón gris (solo modo gate): tapa el período de carga y se desvanece
          cuando la foto está lista → la pantalla entra ya con la imagen. Queda
          montado a opacidad 0 tras revelarse (invisible y click-through). */}
      {esperarImagen && imagenLocal && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: theme.surfaceAlt,
            opacity: revelado ? 0 : 1,
            pointerEvents: revelado ? 'none' : 'auto',
            transition: transicionOpacidad,
          }}
        />
      )}
    </div>
  );
}

export default FondoLocal;
