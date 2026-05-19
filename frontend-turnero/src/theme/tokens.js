// /frontend-turnero/src/theme/tokens.js
// Tokens del sistema de diseño — tema "Luz" (Stripe/Clerk look).
// Single source of truth para colores, tipografía, spacing, radios.
// Se importa así:   import { theme } from '../theme/tokens';

/**
 * theme
 * Objeto inmutable con todos los tokens visuales del producto.
 * Cualquier componente debe leer de acá en vez de hardcodear valores.
 */
export const theme = {
  // ── Colores ───────────────────────────────────────────────────
  // Neutros (zinc).
  bg:           '#FAFAFA',  // fondo de la app
  surface:      '#FFFFFF',  // cards, inputs
  surfaceAlt:   '#F4F4F5',  // hover suave, fondos de soporte
  ink:          '#09090B',  // texto principal
  inkSoft:      '#27272A',  // texto secundario fuerte
  muted:        '#71717A',  // texto secundario
  mutedSoft:    '#A1A1AA',  // texto deshabilitado / placeholder
  hairline:     '#E4E4E7',  // borders, separadores
  hairlineSoft: '#F4F4F5',  // separadores muy sutiles

  // Acento único — indigo.
  accent:       '#4F46E5',
  accentInk:    '#FFFFFF',  // texto sobre fondo accent
  accentSoft:   '#EEF2FF',  // backgrounds tinted con accent

  // Estados.
  success:      '#15803D',
  successSoft:  '#DCFCE7',
  danger:       '#B91C1C',
  dangerSoft:   '#FEE2E2',
  warning:      '#B45309',
  warningSoft:  '#FEF3C7',

  // ── Tipografía ────────────────────────────────────────────────
  // Tres familias capadas para mantener jerarquía limpia.
  body: '"Geist", "DM Sans", system-ui, -apple-system, sans-serif',
  mono: '"Geist Mono", "DM Mono", ui-monospace, monospace',

  // 4 tamaños recurrentes.
  sizeTitle:   24,  // h1, h2 de pantalla
  sizeHeading: 18,  // h3, títulos de card
  sizeBody:    14,  // texto base
  sizeMicro:   11,  // eyebrows, micro-labels en mayúsculas

  weightRegular: 400,
  weightMedium:  500,
  weightHeading: 600,

  // ── Layout ────────────────────────────────────────────────────
  radius:    10,  // botones, inputs, cards normales
  radiusLg:  14,  // cards "destacadas" (resumen)
  radiusSm:   6,  // skeletons, pills chicos

  // Ancho máximo de la columna principal — wizard mobile-first.
  maxWidth:  480,

  // ── Sombras ───────────────────────────────────────────────────
  shadowSm: '0 1px 2px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.06)',

  // ── Transiciones ──────────────────────────────────────────────
  transitionFast:   '.12s ease-out',
  transitionMedium: '.18s ease-out',
};

/**
 * spacing
 * Escala fija de spacing. Usar siempre múltiplos definidos.
 * Ej: spacing[4] = 16px.
 */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
};
