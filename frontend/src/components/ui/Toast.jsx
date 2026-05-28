// /frontend/src/components/ui/Toast.jsx
// Toast inline para feedback efímero de operaciones (guardado exitoso, error
// de acción, etc.). Pensado para usar en el flujo del padre (no flotante
// globalmente) — el caller decide dónde renderizarlo. El primitivo solo se
// ocupa de la presentación visual + auto-dismiss + botón de cerrar opcional.
//
// Patrón de uso: el caller mantiene state { tone, texto }, monta el Toast
// cuando hay mensaje y le pasa onDismiss para limpiarlo. El Toast dispara
// el onDismiss cuando expira el autoDismissMs o cuando el usuario clickea
// el botón X (si dismissible está activo).
//
// Construido para cerrar deuda #30 al aparecer el 3er caso real:
// BannerError de SeccionTurnero, mensajeExito de TabSeguridad. El feedback
// inline persistente sin auto-dismiss (MensajeFeedback de TabTurnero) NO
// usa Toast — es un patrón distinto (mensaje en form, no efímero).

import { useEffect } from 'react';
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
 * Banner inline con ícono + texto + (opcional) botón cerrar. Auto-dismiss
 * configurable: si autoDismissMs está definido, dispara onDismiss al expirar.
 *
 * @param {object} props
 * @param {'success'|'danger'|'warning'|'info'} [props.tone='info'] - Variante visual.
 * @param {React.ReactNode} props.children - Texto del mensaje.
 * @param {() => void} props.onDismiss - Callback cuando se cierra (auto o manual).
 * @param {number} [props.autoDismissMs] - Si está, dispara onDismiss tras ese tiempo.
 * @param {boolean} [props.dismissible=false] - Muestra el botón X manual.
 */
function Toast({
  tone = 'info',
  children,
  onDismiss,
  autoDismissMs,
  dismissible = false,
}) {
  const cfg = TONES[tone] ?? TONES.info;

  // Auto-dismiss — limpia el timer al desmontar o si cambia el callback.
  useEffect(() => {
    if (!autoDismissMs) return;
    const id = setTimeout(() => { onDismiss?.(); }, autoDismissMs);
    return () => clearTimeout(id);
  }, [autoDismissMs, onDismiss]);

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
