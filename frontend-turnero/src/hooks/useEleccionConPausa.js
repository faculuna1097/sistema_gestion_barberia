// /frontend-turnero/src/hooks/useEleccionConPausa.js
// Feedback de una elección que avanza de pantalla: la opción tocada se marca
// al instante y se avanza recién después de una pausa corta.

import { useEffect, useRef, useState } from 'react';
import { pausaEleccionMs } from '../utils/movimiento.js';

/**
 * useEleccionConPausa
 * Envuelve el callback de una elección (servicio, barbero, día, horario) para
 * que la opción tocada se vea marcada ~150 ms antes de avanzar. Con "reducir
 * movimiento" no hay pausa.
 * Mientras una elección está en curso ignora otros toques (un doble toque no
 * avanza dos veces). Si la pantalla se desmonta antes de que venza la pausa
 * (ej. el cliente tocó "Volver"), la elección pendiente se descarta.
 * @param {Function} onElegir - Recibe el valor elegido; se llama después de la pausa
 * @returns {[*, Function]} [elegido, elegir]: `elegido` es el valor tocado
 *   mientras corre la pausa (null si no hay ninguno) y la pantalla lo usa para
 *   marcar la opción; `elegir(valor)` reemplaza al onClick de cada opción
 */
export function useEleccionConPausa(onElegir) {
  const [elegido, setElegido] = useState(null);
  const temporizadorRef = useRef(null);

  // Última versión del callback: el temporizador la lee al vencer.
  const onElegirRef = useRef(onElegir);
  useEffect(() => { onElegirRef.current = onElegir; });

  // Al desmontar, se cancela la elección pendiente.
  useEffect(() => () => clearTimeout(temporizadorRef.current), []);

  /**
   * elegir
   * Marca `valor` y, tras la pausa, llama a onElegir con él.
   * @param {*} valor - La opción tocada
   */
  const elegir = (valor) => {
    if (temporizadorRef.current !== null) return;
    const pausa = pausaEleccionMs();
    if (pausa === 0) {
      onElegirRef.current(valor);
      return;
    }
    setElegido(valor);
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;
      onElegirRef.current(valor);
    }, pausa);
  };

  return [elegido, elegir];
}
