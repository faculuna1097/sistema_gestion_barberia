// /frontend-landing/src/components/landing/FeatureList.jsx
// Lista de beneficios con check. La usan las secciones de producto (Turnero,
// App barberos, Sistema de gestión) para enumerar qué incluye cada parte.

import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * FeatureList
 * Lista vertical de ítems, cada uno con un check en chip indigo.
 * @param {string[]} props.items - Textos de cada beneficio
 * @param {Object} [props.style] - Override del <ul>
 */
function FeatureList({ items, style }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {items.map((it) => (
        <li key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 999,
              background: theme.accentSoft,
              color: theme.accent,
              flex: '0 0 auto',
              marginTop: 1,
            }}
          >
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span style={{ fontFamily: theme.body, fontSize: 15, lineHeight: 1.5, color: theme.inkSoft }}>
            {it}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default FeatureList;
