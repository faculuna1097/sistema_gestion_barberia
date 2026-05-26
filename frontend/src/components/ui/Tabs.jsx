// /frontend/src/components/ui/Tabs.jsx
// Primitivo Tabs — variante underline (Stripe / Clerk / Linear).
//
// Patrón visual: tabs planos como botones de texto, sin contenedor con fondo.
// El tab activo muestra un borde inferior de 2px en theme.accent que se
// "engancha" sobre la línea base (border-bottom hairline del tablist).
// Razón de la variante (vs segmented pill): el fondo del área del admin es
// theme.surfaceAlt (D7 del plan), y un contenedor segmented gris-claro sobre
// gris-claro queda visualmente sucio. El underline se sostiene sin contenedor.
//
// Accesibilidad: WAI-ARIA tablist con navegación por teclado completa
// (←/→ para mover entre tabs, Home/End para primer/último). Foco visible
// vía el :focus-visible global de index.css.
//
// Primer uso: SeccionCaja (3 tabs). Próximo uso esperado: SeccionGestion.

import { useRef } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Tabs
 * Navegación entre vistas relacionadas dentro de una misma sección.
 *
 * @param {object} props
 * @param {Array<{key: string, label: string, icon?: React.ComponentType}>} props.items
 *   Lista de tabs. `icon` es opcional y debe ser un componente (ej. de Lucide)
 *   que acepte props `size` y `strokeWidth`.
 * @param {string} props.value - Key del tab actualmente activo.
 * @param {(key: string) => void} props.onChange - Callback al cambiar de tab.
 * @param {object} [props.style] - Override puntual de estilos del tablist.
 */
function Tabs({ items, value, onChange, style }) {
  // Refs a cada botón para manejar foco con flechas.
  const botonesRef = useRef([]);

  /**
   * Mueve foco y activa un tab por índice. Wrap-around en los extremos.
   * @param {number} indice
   */
  const focusYActivar = (indice) => {
    const total = items.length;
    const i = ((indice % total) + total) % total;
    const item = items[i];
    botonesRef.current[i]?.focus();
    onChange(item.key);
  };

  /**
   * Handler de teclado para navegación entre tabs (WAI-ARIA tablist).
   * @param {KeyboardEvent} e
   * @param {number} indiceActual
   */
  const onKeyDown = (e, indiceActual) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusYActivar(indiceActual + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusYActivar(indiceActual - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusYActivar(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusYActivar(items.length - 1);
    }
  };

  const tablistStyle = {
    display: 'flex',
    gap: 4,
    borderBottom: `1px solid ${theme.hairline}`,
    ...style,
  };

  return (
    <div role="tablist" style={tablistStyle}>
      {items.map((item, i) => {
        const activo = item.key === value;
        const Icon = item.icon;

        const tabStyle = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          marginBottom: -1, // tapa el hairline del tablist con el border-bottom propio
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${activo ? theme.accent : 'transparent'}`,
          color: activo ? theme.accent : theme.muted,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: activo ? theme.weightHeading : theme.weightMedium,
          letterSpacing: '-0.005em',
          cursor: 'pointer',
          transition: `color ${theme.transitionFast}, border-color ${theme.transitionFast}`,
          whiteSpace: 'nowrap',
        };

        return (
          <button
            key={item.key}
            ref={(el) => { botonesRef.current[i] = el; }}
            role="tab"
            type="button"
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onMouseEnter={(e) => {
              if (!activo) e.currentTarget.style.color = theme.ink;
            }}
            onMouseLeave={(e) => {
              if (!activo) e.currentTarget.style.color = theme.muted;
            }}
            style={tabStyle}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
