// /frontend/src/utils/toast.js
// API imperativa del Toast flotante (sistema_de_disenio.md §4.8).
//
// Cualquier código (un handler, un helper como cargarChunk) puede mostrar un
// aviso efímero sin tener estado propio ni montar nada:
//
//   import { toast } from '../utils/toast';
//   toast.exito('Horario actualizado correctamente.');
//   toast.error('No se pudo eliminar el gasto. Intentá de nuevo.');
//
// Los avisos los dibuja <ToastProvider>, montado una sola vez en main.jsx, que
// al montarse se registra acá como despachador. Va en un .js aparte del
// provider para que el .jsx exporte solo el componente
// (react-refresh/only-export-components).

// Cuánto queda a la vista cada tono, en ms. El error dura más porque hay que
// leerlo y entender qué falló; además lleva una X para cerrarlo antes.
export const DURACION_TOAST = {
  success: 4000,
  info:    4000,
  warning: 6000,
  danger:  6000,
};

// Función que registra el ToastProvider montado; null si no hay ninguno.
let despachar = null;

/**
 * registrarDespachador
 * Lo llama ToastProvider al montarse. Devuelve la función para desregistrarlo.
 * @param {(aviso: {tone: string, texto: string}) => void} fn
 * @returns {() => void}
 */
export function registrarDespachador(fn) {
  despachar = fn;
  return () => { if (despachar === fn) despachar = null; };
}

/**
 * toast
 * Muestra avisos flotantes, centrados arriba y con auto-dismiss.
 *   - show({ tone, texto }): tono 'success' | 'danger' | 'warning' | 'info'.
 *   - exito(texto) / error(texto): atajos de los dos casos comunes.
 */
export const toast = {
  /**
   * @param {{tone?: 'success'|'danger'|'warning'|'info', texto: string}} aviso
   */
  show({ tone = 'info', texto }) {
    if (!despachar) {
      console.warn('[toast] show — no hay ToastProvider montado | texto:', texto);
      return;
    }
    despachar({ tone, texto });
  },
  /** @param {string} texto */
  exito(texto) { toast.show({ tone: 'success', texto }); },
  /** @param {string} texto */
  error(texto) { toast.show({ tone: 'danger', texto }); },
};
