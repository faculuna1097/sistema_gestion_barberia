// /frontend-barbero/src/components/avisos/BotonAvisos.jsx
// La campanita de "Hoy": abre el modal de avisos y muestra cuántos hay sin
// atender (traspasos que te ofrecen y respuestas a los que ofreciste).

import { Bell } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';
import { ContadorAvisos } from '../ui';

/**
 * BotonAvisos
 * Botón de 44 × 44 con la campana y el número encima. El número va también en
 * el nombre accesible.
 * @param {number} props.cantidad - avisos sin atender (0: sin número)
 * @param {() => void} props.onAbrir
 * @returns {JSX.Element}
 */
export default function BotonAvisos({ cantidad, onAbrir }) {
  const [hover, eventosHover] = useHover();
  const etiqueta = cantidad
    ? `Avisos, ${cantidad} sin ver`
    : 'Avisos';

  return (
    <button
      type="button"
      onClick={onAbrir}
      {...eventosHover}
      aria-label={etiqueta}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: 999,
        cursor: 'pointer',
        color: cantidad ? theme.ink : theme.muted,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      <span style={{ position: 'relative', display: 'flex' }}>
        <Bell size={24} strokeWidth={1.75} aria-hidden="true" />
        <ContadorAvisos cantidad={cantidad} />
      </span>
    </button>
  );
}
