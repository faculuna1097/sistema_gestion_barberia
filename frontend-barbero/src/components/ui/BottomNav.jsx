// /frontend-barbero/src/components/ui/BottomNav.jsx
// Barra de navegación inferior fija — patrón clásico mobile.
// Pensada para vivir como último hijo del PageContainer (sticky bottom),
// respeta su max-width y la safe-area iOS.

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * BottomNav
 * Barra inferior de navegación con N slots equiwidth (ícono + label).
 * El item activo se pinta con color de acento. Inactivos con texto muted.
 * Cada item es un <button> accesible por teclado (Enter/Space disparan onClick).
 * @param {Array<{id: string, label: string, icon: React.ComponentType}>} props.items
 *        - Lista de items. `icon` es el componente de lucide-react (ej: `Home`, `Calendar`).
 * @param {string} props.activo - ID del item actualmente activo.
 * @param {(id: string) => void} props.onChange - Callback al tocar un item.
 */
function BottomNav({ items, activo, onChange }) {
  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        borderTop: `1px solid ${theme.hairline}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 10,
      }}
    >
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          activo={item.id === activo}
          onClick={() => onChange(item.id)}
        />
      ))}
    </nav>
  );
}

/**
 * NavItem
 * Slot individual del BottomNav. Hover con useState (consistencia con MD §4.2).
 * Touch target ≥ 44px (MD §5.4).
 * @param {{id, label, icon}} props.item
 * @param {boolean} props.activo
 * @param {Function} props.onClick
 */
function NavItem({ item, activo, onClick }) {
  const [hover, setHover] = useState(false);
  const Icon = item.icon;

  // Color: activo gana sobre hover; hover gana sobre inactivo.
  const color = activo ? theme.accent : (hover ? theme.inkSoft : theme.muted);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={activo ? 'page' : undefined}
      style={{
        flex: 1,
        minHeight: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '8px 4px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color,
        fontFamily: theme.body,
        transition: `color ${theme.transitionFast}`,
      }}
    >
      <Icon
        size={22}
        strokeWidth={activo ? 2 : 1.75}
        aria-hidden="true"
      />
      <span style={{
        fontSize: theme.sizeMicro,
        fontWeight: activo ? theme.weightMedium : theme.weightRegular,
        lineHeight: 1.2,
        letterSpacing: 0.1,
      }}>
        {item.label}
      </span>
    </button>
  );
}

export default BottomNav;
