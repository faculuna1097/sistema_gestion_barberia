// /frontend/src/components/ui/LoadingState.jsx
// Indicador de carga estándar del admin (gestión).
//
// Excepción consciente a §4.5 del sistema de diseño ("Loading → Skeleton"):
// el panel de gestión tiene secciones con layouts heterogéneos (KPIs, tablas
// densas, formularios), donde mantener un Skeleton fiel pantalla por pantalla
// agrega ruido sin beneficio. Para el turnero/barbero (vistas más uniformes y
// mobile-first), Skeleton sigue siendo la regla.
//
// Mismo spinner que usa PantallaCargando en App.jsx (Lucide Loader2 + keyframe
// `spin` de index.css). Centrado en el contenedor padre.

import { Loader2 } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * LoadingState
 * Spinner centrado para estados de carga en el panel de gestión.
 * @param {number} [props.size=24] - Tamaño del ícono en px.
 * @param {number|string} [props.minHeight=240] - Alto mínimo del contenedor
 *   para evitar layout shift al resolverse la carga.
 */
function LoadingState({ size = 24, minHeight = 240 }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        width: '100%',
        color: theme.muted,
      }}
    >
      <Loader2 size={size} strokeWidth={1.75} style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

export default LoadingState;
