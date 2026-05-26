// /frontend/src/components/ui/ConfirmDialog.jsx
// Modal de confirmación. Reemplaza al window.confirm() nativo.
// Copia idéntica del primitivo de frontend-turnero.

import { useEffect } from 'react';
import { theme } from '../../theme/tokens.js';
import Button from './Button.jsx';

/**
 * ConfirmDialog
 * Modal centrado con overlay, título, mensaje y dos acciones.
 * No se renderiza si open=false.
 * @param {boolean} props.open - Si el modal está visible
 * @param {string} props.title - Título corto
 * @param {string} props.message - Texto del cuerpo
 * @param {string} [props.confirmLabel='Confirmar']
 * @param {string} [props.cancelLabel='Cancelar']
 * @param {'primary'|'danger'} [props.confirmVariant='danger'] - Variante del botón de confirmar
 * @param {boolean} [props.loading=false] - Si está en proceso (deshabilita botones)
 * @param {Function} props.onConfirm
 * @param {Function} props.onCancel - También se dispara con ESC y click fuera
 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !loading) onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={loading ? undefined : onCancel}
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 20,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
        }}
      >
        <div
          id="confirm-dialog-title"
          style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}
        >{title}</div>

        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          lineHeight: 1.5,
          marginTop: 6,
        }}>{message}</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
