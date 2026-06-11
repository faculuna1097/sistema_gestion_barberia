// /frontend-landing/src/hooks/useMediaQuery.js
// Hook de responsive en JS (consistente con la filosofía del sistema: estado
// en useState en vez de media queries CSS, porque los estilos son inline).
// Lo usan el Nav (mostrar/ocultar anclas), el diagrama de flujo (horizontal vs
// vertical), la tabla comparativa, etc.

import { useState, useEffect } from 'react';

/**
 * Breakpoints de la landing. Un solo lugar para los cortes responsive.
 */
export const BREAKPOINTS = {
  mobile:  '(max-width: 767px)',
  desktop: '(min-width: 768px)',
};

/**
 * useMediaQuery
 * Devuelve si una media query CSS matchea, y se actualiza al cambiar el tamaño.
 * @param {string} query - Media query, ej: '(min-width: 768px)'
 * @returns {boolean} true si la query matchea actualmente.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    // Sincroniza por si la query cambió entre el render y el efecto.
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * useIsDesktop
 * Atajo para el corte mobile/desktop estándar de la landing (768px).
 * @returns {boolean} true en viewport ≥768px.
 */
export function useIsDesktop() {
  return useMediaQuery(BREAKPOINTS.desktop);
}
