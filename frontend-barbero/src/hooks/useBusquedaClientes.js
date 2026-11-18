// /frontend-barbero/src/hooks/useBusquedaClientes.js
// Búsqueda de clientes con espera entre teclas. La usan el alta de turno (wizard
// y atajo de la Agenda) y "Asignar cliente", a través de SelectorCliente.

import { useEffect, useRef, useState } from 'react';
import { buscarClientes } from '../services/api.js';

// Cuánto se espera después de la última tecla antes de buscar.
const ESPERA_MS = 300;
// Desde cuántas letras se busca (el servidor pide al menos 2).
const MINIMO_LETRAS = 2;

/**
 * useBusquedaClientes
 * Busca clientes de todo el local (no solo los del barbero: auditoría 2026-11,
 * Z2-01) a medida que se escribe. Espera ESPERA_MS sin teclas antes de pedir, y descarta
 * la respuesta de una búsqueda vieja que llega después de una nueva.
 * @param {string} texto - lo escrito en el buscador
 * @returns {{ resultados: Array, buscando: boolean, error: boolean, buscado: boolean }}
 *   `buscado` dice si los resultados corresponden al texto actual (para mostrar
 *   "sin resultados" solo cuando de verdad no hubo).
 */
export function useBusquedaClientes(texto) {
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const refPedido = useRef(0);

  useEffect(() => {
    const limpio = texto.trim();
    const pedido = ++refPedido.current;
    setBuscado(false);
    if (limpio.length < MINIMO_LETRAS) {
      setResultados([]);
      setBuscando(false);
      setError(false);
      return undefined;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const data = await buscarClientes(limpio);
        if (pedido !== refPedido.current) return;
        setResultados(data);
        setError(false);
      } catch (err) {
        if (pedido !== refPedido.current) return;
        console.error('[useBusquedaClientes] Error buscando clientes:', err.message);
        setResultados([]);
        setError(true);
      } finally {
        if (pedido === refPedido.current) {
          setBuscando(false);
          setBuscado(true);
        }
      }
    }, ESPERA_MS);
    return () => clearTimeout(timer);
  }, [texto]);

  return { resultados, buscando, error, buscado };
}
