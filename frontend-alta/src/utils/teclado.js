// /frontend-alta/src/utils/teclado.js
// Atajos de teclado de los campos del formulario.

/**
 * alPresionarEnter
 * Arma un onKeyDown que llama a `accion` con Enter (en los campos de texto,
 * Enter avanza de pantalla, plan §5.2). Ignora el Enter que confirma una
 * composición del teclado (acentos, predictivo de algunos teclados).
 * @param {Function} accion - Lo que hace el Enter (ej. el "Seguir")
 * @returns {Function} Handler para onKeyDown.
 */
export function alPresionarEnter(accion) {
  return (e) => {
    if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    accion();
  };
}
