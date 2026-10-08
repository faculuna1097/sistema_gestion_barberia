// /frontend-turnero/src/hooks/useDisponibilidad.js
// Días y horarios libres para un servicio, con un barbero o con "Cualquiera",
// y el día elegido. Lo usan "¿Cuándo?" (SeleccionCuando) y la reprogramación
// de la gestión del turno (GestionTurno); SelectorDiaHorario muestra lo que
// devuelve.

import { useEffect, useState } from 'react';
import { getDiasDisponibles, getDisponibilidad } from '../services/api.js';
import { generarProximosDias, DIAS_RESERVABLES } from '../utils/fecha.js';

/**
 * claveDePedido
 * Identifica un pedido por sus parámetros. Cada respuesta se guarda con la
 * clave del pedido que la originó y solo se usa si coincide con la actual.
 * @param {...(string|number|null)} partes
 * @returns {string} Ej: 'srv-1||0' (barbero nulo = "Cualquiera")
 */
function claveDePedido(...partes) {
  return partes.join('|');
}

/**
 * estadoDeRespuesta
 * Estado de carga a partir de la respuesta vigente (la de la clave actual).
 * @param {Object|null} respuesta - { error: boolean, ... } o null si todavía no llegó
 * @returns {'cargando'|'error'|'listo'}
 */
function estadoDeRespuesta(respuesta) {
  if (!respuesta) return 'cargando';
  return respuesta.error ? 'error' : 'listo';
}

/**
 * useDisponibilidad
 * Pide los días con lugar de los próximos DIAS_RESERVABLES días, elige uno y
 * pide sus horarios. Cambiar de barbero vuelve a pedir todo.
 *
 * Día elegido: el que eligió el cliente (o `fechaPreferida` al montar) si
 * tiene lugar; si no, el primer día con lugar. Así, al cambiar de barbero se
 * conserva el día si el barbero nuevo tiene lugar ese día.
 *
 * Respuestas viejas: si el cliente cambia de barbero o de día antes de que
 * llegue una respuesta, esa respuesta no pisa a la nueva. Dos defensas:
 * el efecto que la pidió se descarta al limpiarse (flag `cancelado`), y cada
 * respuesta guarda la clave de su pedido y solo se muestra si coincide con la
 * clave actual. Mientras no coincide, el estado es 'cargando'.
 *
 * @param {Object} opciones
 * @param {string} opciones.servicioId
 * @param {string|null} [opciones.barberoId=null] - null para "Cualquiera"
 * @param {string|null} [opciones.fechaPreferida=null] - Día a elegir al montar
 *   si tiene lugar (ej. el del horario ya elegido, al volver de Datos)
 * @returns {{
 *   dias: Array<string>,
 *   diasDisponibles: Array<string>,
 *   estadoDias: 'cargando'|'error'|'listo',
 *   reintentarDias: Function,
 *   fecha: string|null,
 *   elegirFecha: Function,
 *   horarios: Array<string>,
 *   asignaciones: Object,
 *   estadoHorarios: 'cargando'|'error'|'listo'|null,
 *   reintentarHorarios: Function,
 * }} `fecha` es null mientras cargan los días o si ninguno tiene lugar;
 *   `estadoHorarios` es null sin día elegido; `asignaciones` ({ [ISO]: barbero_id })
 *   solo viene con "Cualquiera"
 */
export function useDisponibilidad({ servicioId, barberoId = null, fechaPreferida = null }) {
  // Días de la tira: fijos durante la vida de la pantalla.
  const [dias] = useState(() => generarProximosDias(DIAS_RESERVABLES));

  // ── Días con lugar ──────────────────────────────────────────
  const [intentoDias, setIntentoDias] = useState(0);
  const [respuestaDias, setRespuestaDias] = useState(null); // { clave, error, disponibles }
  const claveDias = claveDePedido(servicioId, barberoId, intentoDias);

  useEffect(() => {
    let cancelado = false;
    const clave = claveDePedido(servicioId, barberoId, intentoDias);

    /**
     * pedir
     * Trae los días con lugar y guarda la respuesta con la clave de su pedido.
     */
    async function pedir() {
      try {
        const { dias: disponibles } = await getDiasDisponibles(
          barberoId, servicioId, dias[0], dias[dias.length - 1],
        );
        if (!cancelado) setRespuestaDias({ clave, error: false, disponibles });
      } catch (err) {
        console.error('[useDisponibilidad] Error cargando días disponibles:', err.message);
        if (!cancelado) setRespuestaDias({ clave, error: true, disponibles: [] });
      }
    }
    pedir();
    return () => { cancelado = true; };
  }, [servicioId, barberoId, intentoDias, dias]);

  const diasVigentes = respuestaDias?.clave === claveDias ? respuestaDias : null;
  const estadoDias = estadoDeRespuesta(diasVigentes);
  const diasDisponibles = estadoDias === 'listo' ? diasVigentes.disponibles : [];

  // ── Día elegido (derivado, sin efecto) ──────────────────────
  const [fechaDeseada, setFechaDeseada] = useState(fechaPreferida);
  let fecha = null;
  if (estadoDias === 'listo') {
    const conLugar = new Set(diasDisponibles);
    fecha = conLugar.has(fechaDeseada)
      ? fechaDeseada
      : (dias.find((d) => conLugar.has(d)) ?? null);
  }

  // ── Horarios del día elegido ────────────────────────────────
  const [intentoHorarios, setIntentoHorarios] = useState(0);
  const [respuestaHorarios, setRespuestaHorarios] = useState(null); // { clave, error, slots, asignaciones }
  const claveHorarios = claveDePedido(servicioId, barberoId, fecha, intentoHorarios);

  useEffect(() => {
    if (!fecha) return undefined;
    let cancelado = false;
    const clave = claveDePedido(servicioId, barberoId, fecha, intentoHorarios);

    /**
     * pedir
     * Trae los horarios del día y guarda la respuesta con la clave de su pedido.
     */
    async function pedir() {
      try {
        const { slots, asignaciones = {} } = await getDisponibilidad(barberoId, servicioId, fecha);
        if (!cancelado) setRespuestaHorarios({ clave, error: false, slots, asignaciones });
      } catch (err) {
        console.error('[useDisponibilidad] Error cargando horarios:', err.message);
        if (!cancelado) setRespuestaHorarios({ clave, error: true, slots: [], asignaciones: {} });
      }
    }
    pedir();
    return () => { cancelado = true; };
  }, [servicioId, barberoId, fecha, intentoHorarios]);

  const horariosVigentes = fecha && respuestaHorarios?.clave === claveHorarios
    ? respuestaHorarios
    : null;
  const estadoHorarios = fecha ? estadoDeRespuesta(horariosVigentes) : null;

  return {
    dias,
    diasDisponibles,
    estadoDias,
    reintentarDias: () => setIntentoDias((n) => n + 1),
    fecha,
    elegirFecha: setFechaDeseada,
    horarios: estadoHorarios === 'listo' ? horariosVigentes.slots : [],
    asignaciones: estadoHorarios === 'listo' ? horariosVigentes.asignaciones : {},
    estadoHorarios,
    reintentarHorarios: () => setIntentoHorarios((n) => n + 1),
  };
}
