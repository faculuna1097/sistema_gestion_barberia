// /frontend/src/components/ui/Modal.jsx
// Shell genérico de modal — overlay + card surface + animaciones + ESC + click fuera.
//
// Pensado para form modals (edición, creación) y diálogos que necesitan
// más estructura que ConfirmDialog (campos, validación, contenido custom).
// ConfirmDialog todavía no se refactoriza para usar Modal internamente
// (anotado como deuda en el plan).

import { useEffect } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Modal
 * Modal centrado con overlay. Cierra con ESC y click fuera salvo loading.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose - Disparado por ESC y click fuera (no por loading)
 * @param {string} props.title
 * @param {string} [props.subtitle] - Texto secundario en muted bajo el título
 * @param {ReactNode} props.children - Cuerpo del modal
 * @param {ReactNode} [props.footer] - Fila de acciones (típicamente <Button>s)
 * @param {boolean} [props.loading=false] - Si true, deshabilita ESC y click fuera
 * @param {number} [props.maxWidth=440]
 */
function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  loading = false,
  maxWidth = 440,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={loading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="om-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 20,
          width: '100%',
          maxWidth,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
        }}
      >
        <div
          id="om-modal-title"
          style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}
        >{title}</div>

        {subtitle && (
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 6,
          }}>{subtitle}</div>
        )}

        <div style={{ marginTop: 16 }}>{children}</div>

        {footer && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
