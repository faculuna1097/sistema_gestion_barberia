// /frontend/src/components/ui/ConfirmDialog.jsx
// Modal de confirmación. Reemplaza al window.confirm() nativo.
//
// Es un wrapper delgado sobre el primitivo Modal (deuda #24): reusa su shell
// (overlay + card + animaciones + ESC + click fuera + scroll interno + aria),
// y solo aporta la API de confirmación (dos botones, variante, labels).

import Modal from './Modal.jsx';
import Button from './Button.jsx';

/**
 * ConfirmDialog
 * Modal centrado con título, mensaje y dos acciones (cancelar / confirmar).
 * No se renderiza si open=false.
 * @param {boolean} props.open - Si el modal está visible
 * @param {string} props.title - Título corto
 * @param {string} props.message - Texto del cuerpo (se muestra como subtítulo del Modal)
 * @param {ReactNode} [props.children] - Contenido extra debajo del message (ej. detalle estructurado del recurso afectado)
 * @param {string} [props.confirmLabel='Confirmar']
 * @param {string} [props.cancelLabel='Cancelar']
 * @param {'primary'|'danger'} [props.confirmVariant='danger'] - Variante del botón de confirmar
 * @param {boolean} [props.loading=false] - Si está en proceso (deshabilita botones, ESC y click fuera)
 * @param {Function} props.onConfirm
 * @param {Function} props.onCancel - También se dispara con ESC y click fuera
 */
function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={message}
      loading={loading}
      maxWidth={360}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando…' : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export default ConfirmDialog;
