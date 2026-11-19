// /frontend/src/hooks/useAhoraPorMinuto.js
// El instante actual, actualizado una vez por minuto, justo cuando cambia el
// minuto. Lo usan el Reloj de MainScreen y el aviso de turnos sin cobrar.
//
// No corre por segundo a propósito: el iPad del local tiene MainScreen prendida
// todo el día, y nada de lo que depende de esto muestra segundos.

import { useState, useEffect } from 'react';

/**
 * useAhoraPorMinuto
 * Devuelve un Date con el instante actual. El primer tick se alinea al borde del
 * próximo minuto; después, uno cada 60 s.
 * @returns {Date} El instante del último tick (o del montaje).
 */
export function useAhoraPorMinuto() {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    let intervalId;
    // Alinear el primer tick al borde del próximo minuto; luego cada 60s.
    const msAlProximoMinuto = 60000 - (Date.now() % 60000);
    const timeoutId = setTimeout(() => {
      setAhora(new Date());
      intervalId = setInterval(() => setAhora(new Date()), 60000);
    }, msAlProximoMinuto);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return ahora;
}
