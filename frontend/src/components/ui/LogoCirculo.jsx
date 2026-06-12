// /frontend/src/components/ui/LogoCirculo.jsx
// Logo del tenant dentro de un círculo con borde + sombra. Si no hay logo,
// muestra el icono Lock como fallback (afordancia de "acceso" en las pantallas
// de login). El logo usa object-fit: cover para llenar el círculo.
//
// Promovido desde las copias locales de PantallaLoginAdmin y PantallaLoginOperativo
// (deuda #14). El color del fallback es configurable (`fallbackColor`) porque el
// login admin lo usa para reflejar el estado del PIN (accent → danger al fallar);
// el resto cae al accent por defecto.
//
// Nota: el círculo decorativo de MainScreen NO usa este primitivo a propósito —
// es de otra naturaleza (sin fallback Lock, no es afordancia de acceso).

import { Lock } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * LogoCirculo
 * Logo del tenant en un círculo; fallback a icono Lock si no hay logo.
 * @param {Object} props
 * @param {string} [props.imagenLogo]    - URL del logo (tenant_imagen tipo='logo'). Si falta, muestra Lock.
 * @param {number} [props.size=96]       - Diámetro del círculo en px.
 * @param {string} [props.fallbackColor] - Color del icono Lock (default: theme.accent).
 *                                         El login admin lo varía según el estado del PIN.
 * @returns {JSX.Element}
 */
function LogoCirculo({ imagenLogo, size = 96, fallbackColor = theme.accent }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      boxShadow: theme.shadowSm,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      color: fallbackColor,
      transition: `color ${theme.transitionMedium}`,
      flexShrink: 0,
    }}>
      {imagenLogo ? (
        <img
          src={imagenLogo}
          alt="Logo del negocio"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Lock size={Math.round(size * 0.35)} strokeWidth={1.75} />
      )}
    </div>
  );
}

export default LogoCirculo;
