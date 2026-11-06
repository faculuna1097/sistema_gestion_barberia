// /frontend-turnero/src/hooks/useListaRemota.js
// Carga de una lista del backend con estado de carga, error y reintento.
// Lo usa App.jsx para servicios y barberos, que se piden una sola vez y bajan
// por props a las pantallas.

import { useEffect, useState } from 'react';

/**
 * useListaRemota
 * Pide una lista al montar y expone su estado. Si falla, `reintentar()` la
 * vuelve a pedir (la llama el botón "Reintentar" de la pantalla que la muestra).
 * @param {Function} cargar - Función async que devuelve la lista (ej. getServicios).
 *   Tiene que ser estable (una función de módulo, no una flecha inline).
 * @param {Object} opciones
 * @param {string} opciones.nombre - Nombre de la lista, para el log de error (ej. 'servicios')
 * @param {boolean} [opciones.activa=true] - false para no pedirla (rutas que no la usan)
 * @returns {{ datos: Array, cargando: boolean, error: boolean, reintentar: Function }}
 */
export function useListaRemota(cargar, { nombre, activa = true }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(activa);
  const [error, setError] = useState(false);
  // Cada reintento lo incrementa y vuelve a correr el efecto de carga.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activa) return undefined;
    let cancelado = false;

    /**
     * pedir
     * Trae la lista y actualiza el estado, salvo que el efecto ya se haya
     * descartado (desmontaje o reintento nuevo).
     */
    async function pedir() {
      try {
        const lista = await cargar();
        if (!cancelado) setDatos(lista);
      } catch (err) {
        console.error(`[useListaRemota] Error cargando ${nombre}:`, err.message);
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    pedir();
    return () => { cancelado = true; };
  }, [cargar, nombre, activa, intento]);

  /**
   * reintentar
   * Vuelve a pedir la lista: limpia el error y muestra el skeleton.
   */
  const reintentar = () => {
    setCargando(true);
    setError(false);
    setIntento((n) => n + 1);
  };

  return { datos, cargando, error, reintentar };
}
