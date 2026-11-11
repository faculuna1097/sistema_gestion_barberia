// /frontend-alta/src/hooks/useLibTelefono.js
// El estado de la carga diferida de libphonenumber-js (utils/libTelefono.js)
// para un componente: la pide si hace falta y vuelve a dibujar cuando llega.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  cargarLibTelefono, errorLibTelefono, libTelefonoCargada, suscribirLibTelefono,
} from '../utils/libTelefono.js';

/**
 * useLibTelefono
 * @param {boolean} [pedir=true] - Si la pide al montarse (o al pasar a true)
 * @returns {{lista: boolean, error: Error|null, reintentar: Function}}
 *   `lista`: ya se puede usar. `error`: la última carga falló (sin red, o un
 *   deploy nuevo borró el archivo). `reintentar`: la vuelve a pedir.
 */
export function useLibTelefono(pedir = true) {
  const lista = useSyncExternalStore(suscribirLibTelefono, libTelefonoCargada);
  const error = useSyncExternalStore(suscribirLibTelefono, errorLibTelefono);

  useEffect(() => {
    // El error ya queda en `error`: acá no hay nada más que hacer con él.
    if (pedir && !lista) cargarLibTelefono().catch(() => {});
  }, [pedir, lista]);

  const reintentar = useCallback(() => {
    cargarLibTelefono().catch(() => {});
  }, []);

  return { lista, error, reintentar };
}
