// /frontend-alta/src/hooks/useFocoPendiente.js
// Llevar el foco a un elemento después del próximo render: para cuando el
// botón que se tocó desaparece con el cambio (ej. "Lo paso después", "Usar el
// horario de los demás días") y el foco caería en la página.
//
// Por qué no requestAnimationFrame: el navegador lo frena con la pestaña en
// segundo plano, y el foco quedaba sin mover. Un efecto corre siempre después
// de que React dibujó el cambio, con el elemento nuevo ya en la página.

import { useCallback, useEffect, useState } from 'react';

/**
 * useFocoPendiente
 * @returns {Function} pedirFoco(buscar): `buscar` es una función que devuelve
 *   el elemento a enfocar (o null), y se llama después del próximo render. Si
 *   no devuelve nada, el foco queda donde estaba.
 */
export function useFocoPendiente() {
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    if (!pedido) return;
    setPedido(null);
    pedido.buscar()?.focus();
  }, [pedido]);

  return useCallback((buscar) => setPedido({ buscar }), []);
}
