// /frontend/src/components/ui/Toast.jsx
// La card visual de un aviso: ícono + texto + botón de cerrar opcional, en el
// tono que corresponda. Se usa de dos formas (sistema_de_disenio.md §4.8):
//
//   - Flotante (lo normal para feedback efímero): no se monta a mano. Se llama
//     a `toast.show()` / `toast.exito()` / `toast.error()` (utils/toast.js) y
//     ToastProvider la dibuja centrada arriba, con auto-dismiss.
//   - Inline: para un mensaje que tiene que quedarse junto a lo que lo causó
//     (error de carga con "Reintentar", error dentro de un modal abierto, una
//     nota fija de la pantalla). El caller la monta en su layout y decide
//     cuándo sacarla.

import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

// Mapping de variantes tonales — colores, bg, ícono por tipo.
const TONES = {
  success: { bg: theme.successSoft, color: theme.success, Icon: CheckCircle2 },
  danger:  { bg: theme.dangerSoft,  color: theme.danger,  Icon: AlertTriangle },
  warning: { bg: theme.warningSoft, color: theme.warning, Icon: AlertTriangle },
  info:    { bg: theme.accentSoft,  color: theme.accent,  Icon: Info },
};

/**
 * Toast
 * Card de aviso con ícono + texto + (opcional) botón cerrar. No se va sola: el
 * auto-dismiss del flotante lo maneja ToastProvider.
 *
 * @param {object} props
 * @param {'success'|'danger'|'warning'|'info'} [props.tone='info'] - Variante visual.
 * @param {React.ReactNode} props.children - Texto del mensaje.
 * @param {() => void} [props.onDismiss] - Callback del botón X.
 * @param {boolean} [props.dismissible=false] - Muestra el botón X manual.
 */
function Toast({
  tone = 'info',
  children,
  onDismiss,
  dismissible = false,
}) {
  const cfg = TONES[tone] ?? TONES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        borderRadius: theme.radius,
        color: cfg.color,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
      }}
    >
      <cfg.Icon size={16} strokeWidth={1.75} />
      <span style={{ flex: 1 }}>{children}</span>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            background: 'transparent',
            border: 'none',
            color: cfg.color,
            cursor: 'pointer',
            opacity: 0.7,
            transition: `opacity ${theme.transitionFast}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.7; }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default Toast;
