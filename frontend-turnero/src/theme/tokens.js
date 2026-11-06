// /frontend-turnero/src/theme/tokens.js
// Tokens del sistema de diseño del turnero.
// Parte de "Luz" (Stripe/Clerk look), con identidad propia: fondo blanco y
// acento casi negro en vez de indigo (el turnero lo usa el cliente final).
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
  bg:           '#FFFFFF',  // fondo de la app
  surface:      '#FFFFFF',  // cards, inputs
  surfaceAlt:   '#F4F4F5',  // hover suave, fondos de soporte
  ink:          '#09090B',  // texto principal
  inkSoft:      '#27272A',  // texto secundario fuerte
  // Texto secundario. Más oscuro que zinc-500 (#71717A, 4,40:1 sobre surfaceAlt)
  // para llegar a WCAG AA: 5,28:1 sobre blanco, 5,05 sobre #FAFAFA y 4,80 sobre surfaceAlt.
  muted:        '#6B6B74',
  // Deshabilitado, bordes en hover y lo decorativo. No es para texto que se lee:
  // da 2,56:1 sobre blanco.
  mutedSoft:    '#A1A1AA',
  hairline:     '#E4E4E7',  // borders, separadores
  hairlineSoft: '#F4F4F5',  // separadores muy sutiles

  // Acento único — casi negro (zinc-900).
  accent:       '#18181B',
  accentHover:  '#27272A',  // hover del accent (zinc-800): sobre negro, un filtro de brillo no se nota
  accentInk:    '#FFFFFF',  // texto sobre fondo accent
  accentSoft:   '#F4F4F5',  // backgrounds tinted con accent (neutro)

  // Estados.
  success:      '#15803D',
  successSoft:  '#DCFCE7',
  danger:       '#B91C1C',
  dangerSoft:   '#FEE2E2',
  warning:      '#B45309',
  warningSoft:  '#FEF3C7',

  // Hero de la landing: texto claro sobre la foto del local (o sobre `accent`
  // si no hay foto). El título va en `accentInk`.
  // El degradado oscurece solo la franja del texto: de transparente a `ink` al
  // 55 % a los 48 px y al 80 % abajo. Con eso el texto pasa AA aunque la foto
  // sea blanca (peor caso medido: título 7:1, estado 6,8:1). Es la única
  // excepción a "sin gradientes": funcional, no decorativo.
  heroScrim:    'linear-gradient(180deg, rgba(9,9,11,0) 0px, rgba(9,9,11,0.55) 48px, rgba(9,9,11,0.8) 100%)',
  heroInkSoft:  'rgba(255,255,255,0.85)',  // texto secundario del hero (estado abierto/cerrado)
  heroSuccess:  '#4ADE80',  // punto "abierto" sobre fondo oscuro (green-400): el green-700 no se ve

  // ── Tipografía ────────────────────────────────────────────────
  // Tres familias capadas para mantener jerarquía limpia.
  body: '"Geist", "DM Sans", system-ui, -apple-system, sans-serif',
  mono: '"Geist Mono", "DM Mono", ui-monospace, monospace',

  // 4 tamaños recurrentes.
  sizeTitle:   24,  // h1, h2 de pantalla
  sizeHeading: 18,  // h3, títulos de card
  sizeBody:    14,  // texto base
  sizeMicro:   11,  // eyebrows, micro-labels en mayúsculas

  // Tamaño funcional (no de jerarquía): los inputs deben ser ≥16px para
  // evitar el auto-zoom de iOS Safari al enfocar un campo de texto.
  sizeInput:   16,

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
