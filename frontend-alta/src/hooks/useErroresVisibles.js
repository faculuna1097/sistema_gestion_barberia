// /frontend-alta/src/hooks/useErroresVisibles.js
// Cuándo se ve el error de un campo (plan §5.4): al salir del campo o al tocar
// "Seguir", nunca mientras se escribe la primera vez. Una vez visible, el error
// sigue el valor en vivo: desaparece apenas se corrige.
// Los errores en sí salen de erroresDePantalla (utils/validaciones.js): este
// hook solo decide cuáles mostrar. Lo usan todas las pantallas con campos.

import { useCallback, useState } from 'react';

/**
 * esDelCampo (interna)
 * @param {string} campo - El `campo` de un error ('local.horario.2.hora_fin')
 * @param {string} prefijo - Lo que pregunta la pantalla ('local.horario')
 * @returns {boolean} true si el error es de ese campo o de uno de adentro.
 */
const esDelCampo = (campo, prefijo) => campo === prefijo || campo.startsWith(`${prefijo}.`);

/**
 * useErroresVisibles
 * @param {Array<{campo: string, mensaje: string}>} errores - Los errores actuales de la pantalla
 * @returns {{
 *   errorDe: (prefijo: string) => string|undefined,
 *   revelar: (prefijo: string) => void,
 *   revelarTodos: () => void,
 * }}
 *   `errorDe(prefijo)`: el mensaje del primer error de ese campo (o de uno de
 *   adentro), solo si ya se reveló; si no, undefined. `revelar(prefijo)`: lo
 *   llama el campo al salir (blur) o al cambiar un valor de un toque (botones
 *   +/-). `revelarTodos()`: lo llama el "Seguir".
 */
export function useErroresVisibles(errores) {
  const [revelados, setRevelados] = useState(() => new Set());
  const [todos, setTodos] = useState(false);

  const revelar = useCallback((prefijo) => {
    setRevelados((prev) => (prev.has(prefijo) ? prev : new Set(prev).add(prefijo)));
  }, []);

  const revelarTodos = useCallback(() => setTodos(true), []);

  /**
   * errorDe
   * @param {string} prefijo - Campo o grupo de campos ('local.nombre', 'local.pausa')
   * @returns {string|undefined} El mensaje a mostrar, o undefined.
   */
  const errorDe = (prefijo) => {
    if (!todos && !revelados.has(prefijo)) return undefined;
    return errores.find((error) => esDelCampo(error.campo, prefijo))?.mensaje;
  };

  return { errorDe, revelar, revelarTodos };
}
