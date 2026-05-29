// /frontend/src/components/ui/Modal.jsx
// Shell genérico de modal — overlay + card surface + animaciones + ESC + click fuera.
//
// Pensado para form modals (edición, creación) y diálogos que necesitan
// más estructura que ConfirmDialog (campos, validación, contenido custom).
// ConfirmDialog todavía no se refactoriza para usar Modal internamente
// (anotado como deuda en el plan).

import { useEffect, useId } from 'react';
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
  // id único por instancia para asociar el título con aria-labelledby
  // (evita colisión si dos modales se montaran a la vez — ver deuda #25).
  const titleId = useId();

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
      aria-labelledby={titleId}
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
          width: '100%',
          maxWidth,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
          // Layout en 3 zonas: header y footer fijos, body scrollea.
          // maxHeight acota al viewport (32 = 16px de padding del overlay arriba+abajo).
          // overflow:hidden recorta el scroll del body a las esquinas redondeadas.
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'hidden',
        }}
      >
        {/* Header fijo: padding sup/lados 20, sin inferior (el gap al body lo da el body) */}
        <div style={{ flexShrink: 0, padding: '20px 20px 0' }}>
          <div
            id={titleId}
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
        </div>

        {/* Body scrolleable: flex:1 + minHeight:0 habilita el scroll dentro del flex column.
            paddingTop 16 replica el marginTop del children de antes; el inferior es 20 solo
            cuando no hay footer (cuando lo hay, el gap de 20 lo aporta el padding sup del footer).
            No se renderiza si no hay children (ej. ConfirmDialog solo-mensaje), para no dejar
            padding muerto entre el header y el footer. */}
        {children != null && (
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: footer ? '16px 20px 0' : '16px 20px 20px',
          }}>{children}</div>
        )}

        {/* Footer fijo: padding 20 en todos los lados (sup 20 = gap al body) */}
        {footer && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '20px 20px 20px' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
