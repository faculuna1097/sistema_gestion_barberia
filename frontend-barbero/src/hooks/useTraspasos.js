// /frontend-barbero/src/hooks/useTraspasos.js
// Las solicitudes de traspaso del barbero de la sesión (F2 de
// plan_mejoras_operativas.md), cargadas una sola vez para toda la app: las usan
// la campanita de "Hoy" y el número de la barra, el modal de avisos, la Agenda
// (la marca del turno) y el detalle del turno.
//
// Pide GET /admin/traspasos al montar, cada INTERVALO_MS con la app a la vista,
// al volver al primer plano y después de cada acción (`recargar`). Con un error
// de red se queda con el último dato. Sin pendientes por verificar, el pedido
// cuesta una sola query en el servidor.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { getTraspasos } from '../services/api.js';
import { leerAvisosVistos, guardarAvisosVistos } from '../utils/sesion.js';
import {
  recibidasPendientes, resultadosParaA, enviadaPorTurno, firmaDeAceptados, aplicarSolicitud,
} from '../utils/traspasos.js';

// Cada cuánto se actualiza con la app a la vista (el mismo ritmo que la Agenda).
const INTERVALO_MS = 60 * 1000;

/**
 * useTraspasos
 * @param {string|null} barberoId - el barbero de la sesión; null sin sesión (no
 *   pide nada y vacía lo cargado)
 * @returns {{
 *   datos: { enviados: Array, recibidos: Array } | null,
 *   pendientes: Array,        // las que B tiene que responder
 *   resultados: Array,        // los avisos de A (aceptado, rechazado, vencido)
 *   vistos: Set<string>,      // ids de resultados ya vistos en este celular
 *   contador: number,         // pendientes + resultados no vistos (la campanita)
 *   porTurno: Map<string, Object>, // turno_id → solicitud vigente de A (enviadaPorTurno)
 *   firmaAceptados: string,   // cambia cuando un turno pasó de una Agenda a otra
 *   recargar: () => Promise<void>,
 *   aplicar: (solicitud: Object) => void,
 *   marcarVistos: (ids: string[]) => void,
 * }}
 */
export default function useTraspasos(barberoId) {
  const [datos, setDatos] = useState(null);
  const [vistos, setVistos] = useState(() => new Set(barberoId ? leerAvisosVistos(barberoId) : []));
  // Hay un pedido en curso: el intervalo no arranca otro.
  const refCargando = useRef(false);
  // Número del último pedido: la respuesta de un pedido viejo (por ejemplo, de
  // la sesión anterior) no pisa la de ahora.
  const refPedido = useRef(0);

  /**
   * recargar
   * Pide la lista al servidor. Si falla, queda la anterior y se loguea.
   */
  const recargar = useCallback(async () => {
    if (!barberoId) return;
    const pedido = ++refPedido.current;
    refCargando.current = true;
    try {
      const respuesta = await getTraspasos();
      if (pedido === refPedido.current) setDatos(respuesta);
    } catch (err) {
      console.error('[useTraspasos] Error cargando los traspasos:', err.message);
    } finally {
      if (pedido === refPedido.current) refCargando.current = false;
    }
  }, [barberoId]);

  // Al cambiar de sesión: vaciar, leer lo visto de ese barbero y cargar.
  useEffect(() => {
    refPedido.current += 1;
    refCargando.current = false;
    setDatos(null);
    setVistos(new Set(barberoId ? leerAvisosVistos(barberoId) : []));
    recargar();
  }, [barberoId, recargar]);

  // Cada INTERVALO_MS con la app a la vista, y al volver al primer plano.
  useEffect(() => {
    if (!barberoId) return undefined;
    /**
     * refrescar
     * Recarga si la app está a la vista y no hay otro pedido en curso.
     */
    const refrescar = () => {
      if (document.visibilityState !== 'visible' || refCargando.current) return;
      recargar();
    };
    const id = setInterval(refrescar, INTERVALO_MS);
    document.addEventListener('visibilitychange', refrescar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
  }, [barberoId, recargar]);

  /**
   * aplicar
   * Dibuja al instante la solicitud que devolvió una acción (convenciones §8).
   * Quien la llama recarga después para confirmar.
   * @param {Object} solicitud
   */
  const aplicar = useCallback((solicitud) => {
    setDatos((actual) => aplicarSolicitud(actual, solicitud, barberoId));
  }, [barberoId]);

  /**
   * marcarVistos
   * Anota avisos como vistos (al cerrar el modal) y los guarda en el celular.
   * Lo guardado se limpia: quedan solo los ids que todavía vienen del servidor.
   * @param {string[]} ids
   */
  const marcarVistos = useCallback((ids) => {
    if (!barberoId || !datos || ids.length === 0) return;
    const vigentes = new Set(datos.enviados.map((s) => s.id));
    const nuevo = new Set([...vistos, ...ids].filter((id) => vigentes.has(id)));
    guardarAvisosVistos(barberoId, [...nuevo]);
    setVistos(nuevo);
  }, [barberoId, datos, vistos]);

  const derivados = useMemo(() => {
    const pendientes = recibidasPendientes(datos);
    const resultados = resultadosParaA(datos);
    const noVistos = resultados.filter((s) => !vistos.has(s.id)).length;
    return {
      pendientes,
      resultados,
      contador: pendientes.length + noVistos,
      porTurno: enviadaPorTurno(datos),
      firmaAceptados: firmaDeAceptados(datos),
    };
  }, [datos, vistos]);

  return { datos, vistos, ...derivados, recargar, aplicar, marcarVistos };
}
