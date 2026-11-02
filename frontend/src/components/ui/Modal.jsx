// /frontend/src/components/ui/Modal.jsx
// Shell genérico de modal — overlay + card surface + animaciones + ESC + click
// fuera + manejo del foco.
//
// Pensado para form modals (edición, creación) y diálogos que necesitan
// más estructura que ConfirmDialog (campos, validación, contenido custom).
// ConfirmDialog es un wrapper delgado sobre este shell.
//
// Foco (accesibilidad con teclado): al abrirse lleva el foco a la card, Tab y
// Shift+Tab quedan encerrados adentro mientras está abierto, y al cerrarse el
// foco vuelve al elemento que lo abrió.

import { useEffect, useId, useRef } from 'react';
import { theme } from '../../theme/tokens.js';

// Elementos que pueden recibir foco con Tab.
const SELECTOR_ENFOCABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

// Pila de modales abiertos (sus ids, el último arriba). Si se abre uno sobre
// otro (ej. un ConfirmDialog sobre un Modal), solo el de arriba encierra el foco.
const pilaModales = [];

/**
 * enfocablesDe
 * Lista los elementos de un contenedor que reciben foco con Tab, en orden.
 * @param {HTMLElement} contenedor
 * @returns {HTMLElement[]}
 */
function enfocablesDe(contenedor) {
  return [...contenedor.querySelectorAll(SELECTOR_ENFOCABLES)]
    .filter((el) => el.getClientRects().length > 0);
}

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
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, onClose]);

  // Foco: al abrir lo lleva a la card y recuerda quién lo tenía; al cerrar (o
  // desmontar) se lo devuelve. Mientras está abierto, Tab y Shift+Tab giran
  // dentro de la card. El listener va en document (no en la card) para atrapar
  // también el caso en que el elemento enfocado desaparece (ej. un botón que
  // cambia el modo del modal) y el foco cae al body.
  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement;
    pilaModales.push(titleId);
    cardRef.current?.focus();

    const encerrarTab = (e) => {
      if (e.key !== 'Tab' || pilaModales[pilaModales.length - 1] !== titleId) return;
      const card = cardRef.current;
      if (!card) return;
      const enfocables = enfocablesDe(card);
      if (enfocables.length === 0) { e.preventDefault(); card.focus(); return; }
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const activo = document.activeElement;
      if (!card.contains(activo)) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primero).focus();
      } else if (e.shiftKey && (activo === primero || activo === card)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', encerrarTab);

    return () => {
      document.removeEventListener('keydown', encerrarTab);
      const i = pilaModales.indexOf(titleId);
      if (i !== -1) pilaModales.splice(i, 1);
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, [open, titleId]);

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
        background: theme.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
    >
      <div
        ref={cardRef}
        // tabIndex -1: la card recibe el foco al abrir (sin entrar en el orden
        // de Tab), así el lector de pantalla anuncia el diálogo y el primer Tab
        // va al primer campo o botón.
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          // Sin anillo: la card no es un control, solo el punto de partida del foco.
          outline: 'none',
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          width: '100%',
          maxWidth,
          boxShadow: theme.shadowLg,
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
