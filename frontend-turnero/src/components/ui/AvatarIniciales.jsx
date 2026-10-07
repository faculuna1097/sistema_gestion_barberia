// /frontend-turnero/src/components/ui/AvatarIniciales.jsx
// Círculo con las iniciales de un nombre, en un tono neutro único.
// Usado en SeleccionBarbero y Confirmacion/GestionTurno.

import { theme } from '../../theme/tokens.js';

/**
 * AvatarIniciales
 * Avatar circular con iniciales. Mismo tono neutro para todos (identidad en
 * blanco y negro del turnero): el nombre al lado ya distingue a cada persona.
 * @param {string} props.nombre - Nombre completo (toma iniciales de primera y última palabra)
 * @param {number} [props.size=40] - Diámetro en px
 */
function AvatarIniciales({ nombre, size = 40 }) {
  const iniciales = obtenerIniciales(nombre);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: theme.surfaceAlt,
      color: theme.inkSoft,
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

export default AvatarIniciales;
