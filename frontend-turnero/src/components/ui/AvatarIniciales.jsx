// /frontend-turnero/src/components/ui/AvatarIniciales.jsx
// Círculo con las iniciales de un nombre. Color de fondo determinístico (hash del nombre).
// Usado en SeleccionBarbero y Confirmacion/GestionTurno.

import { theme } from '../../theme/tokens.js';

/**
 * AvatarIniciales
 * Avatar circular con iniciales y tono derivado del nombre.
 * Mismo nombre → mismo color en cualquier parte de la app.
 * @param {string} props.nombre - Nombre completo (toma iniciales de primera y última palabra)
 * @param {number} [props.size=40] - Diámetro en px
 */
function AvatarIniciales({ nombre, size = 40 }) {
  const iniciales = obtenerIniciales(nombre);
  const tono = tonoDesdeNombre(nombre);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: tono.bg,
      color: tono.fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: theme.body,
      fontWeight: theme.weightHeading,
      fontSize: Math.round(size * 0.36),
      letterSpacing: '-0.01em',
      userSelect: 'none',
    }}>
      {iniciales}
    </div>
  );
}

/**
 * obtenerIniciales
 * Devuelve las primeras 1-2 iniciales en mayúsculas de un nombre completo.
 * @param {string} nombre
 * @returns {string} Ej: "Mateo Aragón" → "MA", "Juan" → "J"
 */
function obtenerIniciales(nombre) {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

// Paleta discreta de tonos para avatares. Todos cumplen contraste AA contra blanco.
const AVATAR_TONOS = [
  { bg: '#E0E7FF', fg: '#3730A3' }, // indigo soft
  { bg: '#DBEAFE', fg: '#1E40AF' }, // blue soft
  { bg: '#D1FAE5', fg: '#065F46' }, // emerald soft
  { bg: '#FEF3C7', fg: '#92400E' }, // amber soft
  { bg: '#FCE7F3', fg: '#9D174D' }, // pink soft
  { bg: '#E0F2FE', fg: '#075985' }, // sky soft
  { bg: '#EDE9FE', fg: '#5B21B6' }, // violet soft
  { bg: '#FEE2E2', fg: '#991B1B' }, // red soft (apagado)
];

/**
 * tonoDesdeNombre
 * Mapea un nombre a un tono de la paleta de forma determinística.
 * @param {string} nombre
 * @returns {{bg: string, fg: string}}
 */
function tonoDesdeNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < (nombre || '').length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_TONOS.length;
  return AVATAR_TONOS[idx];
}

export default AvatarIniciales;
