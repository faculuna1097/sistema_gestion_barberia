// /frontend/src/hooks/useTurnosSinCobrar.js
// Estado del aviso de turnos sin cobrar (F3 de plan_mejoras_operativas.md), el
// mismo para el iPad (MainScreen) y el Inicio del panel:
//   - Carga GET /api/turnos/sin-cobrar al montarse, cada 5 minutos y al volver a
//     la app (visibilitychange). Un error no rompe nada: queda el último dato.
//   - Ocultado temporal: cerrar el aviso lo oculta durante `insistencia_minutos`.
//     Vive en el estado del componente, así que también vuelve al remontar la
//     pantalla (volver de un flujo o de otra sección), lo que pase primero.
//   - Modo alerta desde 20 min antes del cierre de hoy: el aviso no se puede
//     ocultar mientras queden turnos.
//   - Si el detalle está abierto: se cierra de verdad cuando una respuesta llega
//     con la lista vacía, así no se vuelve a abrir solo cuando aparece otro turno
//     (S-B-03 de auditoria_2026-11.md).

import { useState, useEffect, useCallback } from 'react';
import { getTurnosSinCobrar } from '../services/api';
import { estaEnModoAlerta } from '../utils/turnosSinCobrar';
import { useAhoraPorMinuto } from './useAhoraPorMinuto';

// Cada cuánto se vuelve a pedir la lista.
const REFRESCO_MS = 5 * 60_000;

/**
 * useTurnosSinCobrar
 * @param {Object} params
 * @param {'operativo'|'admin'} params.modo - Con qué token se pide (iPad o panel).
 * @returns {{
 *   turnos: Array<{ id, barbero_id, barbero_nombre, inicio, fin, cliente_nombre }>,
 *   enAlerta: boolean,
 *   visible: boolean,
 *   ocultar: () => void,
 *   detalleAbierto: boolean,
 *   abrirDetalle: () => void,
 *   cerrarDetalle: () => void,
 * }} `visible`: si hay que mostrar el aviso (hay turnos y no está oculto, o está
 *   en alerta). `ocultar`: lo oculta durante la insistencia; no hace nada en alerta.
 *   `detalleAbierto`: si el detalle está abierto (nunca con la lista vacía);
 *   `abrirDetalle` y `cerrarDetalle` lo abren (el aviso) y lo cierran (la X).
 */
export function useTurnosSinCobrar({ modo }) {
  // Última respuesta del endpoint + el instante en que llegó (null hasta la primera).
  const [datos, setDatos] = useState(null);
  // Hasta qué instante (ms) está oculto el aviso. 0 = no está oculto.
  const [ocultoHasta, setOcultoHasta] = useState(0);
  // Si el detalle está abierto. Lo baja también una respuesta con la lista vacía.
  const [abierto, setAbierto] = useState(false);
  // Tick por minuto: vuelve a evaluar el modo alerta y el fin del ocultado.
  const ahora = useAhoraPorMinuto();

  useEffect(() => {
    let activo = true;

    /**
     * cargar
     * Pide la lista y la guarda con el instante en que llegó. Con la lista vacía,
     * cierra el detalle. Si falla, deja el último dato y lo loguea.
     */
    const cargar = async () => {
      try {
        const respuesta = await getTurnosSinCobrar(modo);
        if (!activo) return;
        setDatos({ ...respuesta, recibidoEn: Date.now() });
        if ((respuesta.turnos ?? []).length === 0) setAbierto(false);
      } catch (err) {
        console.error('[useTurnosSinCobrar] Error en cargar:', err.message);
      }
    };

    /**
     * alVolverALaApp
     * Recarga cuando la pestaña vuelve a primer plano (el iPad que se desbloquea).
     */
    const alVolverALaApp = () => {
      if (document.visibilityState === 'visible') cargar();
    };

    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    document.addEventListener('visibilitychange', alVolverALaApp);
    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverALaApp);
    };
  }, [modo]);

  const turnos = datos?.turnos ?? [];
  // El instante de referencia es el más nuevo entre el tick y la última respuesta:
  // al volver a la app la respuesta llega antes que el próximo tick.
  const ahoraMs = Math.max(ahora.getTime(), datos?.recibidoEn ?? 0);
  const enAlerta = turnos.length > 0 && estaEnModoAlerta(datos?.cierre_hoy ?? null, ahoraMs);
  const visible = turnos.length > 0 && (enAlerta || ahoraMs >= ocultoHasta);
  const insistenciaMinutos = datos?.insistencia_minutos ?? 0;

  const ocultar = useCallback(() => {
    if (enAlerta) return;
    setOcultoHasta(Date.now() + insistenciaMinutos * 60_000);
  }, [enAlerta, insistenciaMinutos]);

  /** abrirDetalle — Abre el detalle (lo llama el aviso). */
  const abrirDetalle = useCallback(() => setAbierto(true), []);
  /** cerrarDetalle — Cierra el detalle (X, ESC o tocar afuera). */
  const cerrarDetalle = useCallback(() => setAbierto(false), []);
  // La condición de la lista es una red: la respuesta vacía ya bajó `abierto`.
  const detalleAbierto = abierto && turnos.length > 0;

  return { turnos, enAlerta, visible, ocultar, detalleAbierto, abrirDetalle, cerrarDetalle };
}
