// /frontend-barbero/src/utils/traspasos.js
// Traspasos de turnos entre barberos (F2 de plan_mejoras_operativas.md): los
// textos que ve cada lado y las cuentas sobre la respuesta de GET
// /admin/traspasos ({ enviados, recibidos }). Funciones puras, sin React.
//
// "A" es quien ofrece el turno (enviados) y "B" quien lo recibe (recibidos).
// La forma de una solicitud está en services/api.js (bloque de traspasos).

import { fmtDiaRelativo, fmtHora } from './fecha.js';
import { textoCliente } from './formato.js';

// ─── Textos de los motivos ──────────────────────────────────────────────────

// Por qué venció una solicitud, para B (al intentar aceptarla) y para A (en el
// detalle del turno y en sus avisos). `{B}` se reemplaza por el nombre de B.
const TEXTOS_MOTIVO = {
  horario_ocupado: {
    b: 'Ya no disponible: se ocupó tu horario',
    a: 'Vencida: {B} ya no tiene ese horario libre',
  },
  turno_no_reservado: {
    b: 'Ya no disponible: el turno se canceló',
    // Un turno futuro que dejó de estar reservado solo puede estar cancelado
    // (por el cliente, por A o por el dueño).
    a: 'Vencida: el turno se canceló',
  },
  turno_reprogramado: {
    b: 'Ya no disponible: el cliente cambió el horario',
    a: 'Vencida: el cliente cambió el horario del turno',
  },
  turno_reasignado: {
    b: 'Ya no disponible: el turno pasó a otro barbero',
    a: 'Vencida: el turno pasó a otro barbero',
  },
  turno_empezado: {
    b: 'Ya no disponible: el turno ya empezó',
    a: 'Vencida: el turno empezó sin respuesta',
  },
  barbero_inactivo: {
    b: 'Ya no disponible: tu usuario está inactivo',
    a: 'Vencida: {B} ya no está activo',
  },
};

// Para un motivo que el front no conoce (uno nuevo del backend).
const TEXTO_VENCIDA_GENERICO = { b: 'Ya no disponible', a: 'Vencida' };

/**
 * textoMotivoParaB
 * Por qué B ya no puede aceptar una solicitud vencida.
 * @param {string|null|undefined} motivo - `motivo` de la solicitud o del 409
 * @returns {string} Ej: "Ya no disponible: se ocupó tu horario"
 */
export function textoMotivoParaB(motivo) {
  return (TEXTOS_MOTIVO[motivo] ?? TEXTO_VENCIDA_GENERICO).b;
}

/**
 * textoMotivoParaA
 * Por qué venció una solicitud que A ofreció.
 * @param {string|null|undefined} motivo - `motivo` de la solicitud
 * @param {string} nombreB - nombre del barbero al que se le ofreció
 * @returns {string} Ej: "Vencida: Juan ya no tiene ese horario libre"
 */
export function textoMotivoParaA(motivo, nombreB) {
  return (TEXTOS_MOTIVO[motivo] ?? TEXTO_VENCIDA_GENERICO).a.replace('{B}', nombreB);
}

/**
 * fraseDelTurno
 * El día y la hora de un turno para meter en una frase.
 * @param {string} inicio - ISO del inicio del turno
 * @returns {string} Ej: "de hoy a las 10:00", "del jue 20/11 a las 10:00"
 */
export function fraseDelTurno(inicio) {
  const dia = fmtDiaRelativo(inicio);
  const conArticulo = dia === 'hoy' || dia === 'mañana' ? `de ${dia}` : `del ${dia}`;
  return `${conArticulo} a las ${fmtHora(inicio)}`;
}

/**
 * textoResultadoParaA
 * El aviso que ve A cuando su solicitud se cerró sin que él la retirara.
 * @param {Object} solicitud - con estado 'aceptado', 'rechazado' o 'vencido'
 * @returns {string} Ej: "Juan aceptó tu turno de hoy a las 10:00"; vacío para
 *   cualquier otro estado
 */
export function textoResultadoParaA(solicitud) {
  const nombreB = solicitud.a_barbero.nombre;
  const turno = fraseDelTurno(solicitud.turno.inicio);
  if (solicitud.estado === 'aceptado') return `${nombreB} aceptó tu turno ${turno}`;
  if (solicitud.estado === 'rechazado') return `${nombreB} rechazó tu turno ${turno}`;
  if (solicitud.estado === 'vencido') return textoMotivoParaA(solicitud.motivo, nombreB);
  return '';
}

/**
 * textoEstadoEnDetalle
 * La línea que muestra el detalle de un turno de A según su última solicitud.
 * @param {Object|null|undefined} solicitud - la más nueva del turno, si tiene
 * @returns {string|null} null si no hay nada que mostrar (sin solicitud o retirada)
 */
export function textoEstadoEnDetalle(solicitud) {
  if (!solicitud) return null;
  const nombreB = solicitud.a_barbero.nombre;
  switch (solicitud.estado) {
    case 'pendiente': return `Traspaso pendiente a ${nombreB}`;
    case 'aceptado':  return `${nombreB} aceptó el traspaso`;
    case 'rechazado': return `${nombreB} rechazó el traspaso`;
    case 'vencido':   return textoMotivoParaA(solicitud.motivo, nombreB);
    default:          return null;
  }
}

/**
 * textoErrorAlResponder
 * Qué decirle a B cuando Aceptar o Rechazar falla.
 * @param {Error & { status?: number, codigo?: string, datos?: Object }} err
 * @param {Object} solicitud - la que intentó responder
 * @returns {string} Ej: "Ya no disponible: se ocupó tu horario", "Juan retiró la oferta"
 */
export function textoErrorAlResponder(err, solicitud) {
  if (err.codigo === 'traspaso_vencido') return textoMotivoParaB(err.datos?.motivo);
  if (err.codigo === 'traspaso_ya_respondido') {
    return err.datos?.estado === 'retirado'
      ? `${solicitud.de_barbero.nombre} retiró la oferta`
      : 'Ya respondiste esta oferta';
  }
  if (err.codigo === 'traspaso_no_encontrado') return 'Esta oferta ya no existe';
  return err.status && err.status < 500 && err.message
    ? err.message
    : 'No se pudo responder. Probá de nuevo.';
}

/**
 * textoErrorAlRetirar
 * Qué decirle a A cuando "Retirar" falla porque B ya respondió.
 * @param {Error & { status?: number, codigo?: string, datos?: Object }} err
 * @param {Object} solicitud - la que intentó retirar
 * @returns {string} Ej: "Juan ya aceptó el turno"
 */
export function textoErrorAlRetirar(err, solicitud) {
  const nombreB = solicitud.a_barbero.nombre;
  if (err.codigo === 'traspaso_ya_respondido') {
    if (err.datos?.estado === 'aceptado') return `${nombreB} ya aceptó el turno`;
    if (err.datos?.estado === 'rechazado') return `${nombreB} ya rechazó el turno`;
    return 'La oferta ya estaba retirada';
  }
  if (err.codigo === 'traspaso_no_encontrado') return 'Esta oferta ya no existe';
  return err.status && err.status < 500 && err.message
    ? err.message
    : 'No se pudo retirar la oferta. Probá de nuevo.';
}

/**
 * textoConflictoAlOfrecer
 * Qué decirle a A cuando el turno ya no se puede ofrecer (lo resuelve la
 * Agenda: cierra la hoja de traspasar, avisa y recarga).
 * @param {Error & { codigo?: string }} err
 * @returns {string}
 */
export function textoConflictoAlOfrecer(err) {
  if (err.codigo === 'traspaso_pendiente') return 'Este turno ya tiene una oferta pendiente.';
  if (err.codigo === 'turno_no_traspasable') return 'Este turno ya no se puede traspasar.';
  if (err.codigo === 'turno_no_encontrado') return 'Este turno ya no está en tu agenda.';
  return err.message || 'No se pudo ofrecer el turno.';
}

/**
 * textoDatosTurno
 * Servicio y cliente de un turno, en una línea.
 * @param {{ servicio_nombre: string|null, cliente_nombre: string|null }} turno
 * @returns {string} Ej: "Corte · Pedro Gómez", "Corte · Sin datos"
 */
export function textoDatosTurno(turno) {
  return [turno.servicio_nombre, textoCliente(turno.cliente_nombre)].filter(Boolean).join(' · ');
}

// ─── Cuentas sobre { enviados, recibidos } ──────────────────────────────────

// Estados de una solicitud de A que le llegan como aviso: los que no causó él
// (retirarla sí la cierra él).
const ESTADOS_CON_AVISO = new Set(['aceptado', 'rechazado', 'vencido']);

/**
 * recibidasPendientes
 * Las solicitudes que B tiene que responder.
 * @param {{ recibidos: Array }|null} datos
 * @returns {Array} por inicio del turno (como vienen del servidor)
 */
export function recibidasPendientes(datos) {
  return (datos?.recibidos ?? []).filter((s) => s.estado === 'pendiente');
}

/**
 * resultadosParaA
 * Las solicitudes de A que terminaron sin que él las retirara: lo que le llega
 * como aviso.
 * @param {{ enviados: Array }|null} datos
 * @returns {Array} por inicio del turno
 */
export function resultadosParaA(datos) {
  return (datos?.enviados ?? []).filter((s) => ESTADOS_CON_AVISO.has(s.estado));
}

/**
 * volvioAlBarbero
 * Si una solicitud aceptada que mandó el barbero quedó vieja porque el turno le
 * volvió (A → B → A, o A → B → C → A): en `recibidos` hay, del mismo turno, una
 * aceptada respondida después que la suya. Sin ese dato no se distingue del rato
 * en que B ya aceptó y la Agenda de A todavía no se recargó (ahí el turno también
 * figura como de A, y "Traspasar" tiene que seguir bloqueado).
 * @param {Object} enviada - solicitud de `enviados`
 * @param {Array} recibidos - `recibidos` de la respuesta (la más nueva por turno)
 * @returns {boolean} true si la enviada es una aceptada vieja de un turno que volvió
 */
function volvioAlBarbero(enviada, recibidos) {
  if (enviada.estado !== 'aceptado') return false;
  return recibidos.some((r) => r.turno.id === enviada.turno.id
    && r.estado === 'aceptado'
    && Date.parse(r.respondido_en) > Date.parse(enviada.respondido_en));
}

/**
 * enviadaPorTurno
 * La solicitud vigente de A para cada turno, para el detalle y la Agenda: la más
 * nueva que mandó, salvo una aceptada de un turno que después le volvió
 * (volvioAlBarbero, S-B-02 de auditoria_2026-11.md). Esa no se muestra como estado
 * del turno ni bloquea "Traspasar"; su aviso sigue en `resultadosParaA`.
 * @param {{ enviados: Array, recibidos: Array }|null} datos
 * @returns {Map<string, Object>} turno_id → solicitud
 */
export function enviadaPorTurno(datos) {
  const recibidos = datos?.recibidos ?? [];
  return new Map((datos?.enviados ?? [])
    .filter((s) => !volvioAlBarbero(s, recibidos))
    .map((s) => [s.turno.id, s]));
}

/**
 * firmaDeAceptados
 * Una marca de los traspasos aceptados de los dos lados. Cuando cambia, algún
 * turno pasó de una Agenda a otra y las pantallas con turnos se recargan.
 * @param {{ enviados: Array, recibidos: Array }|null} datos
 * @returns {string} ids de las aceptadas, ordenados ('' si no hay)
 */
export function firmaDeAceptados(datos) {
  return [...(datos?.enviados ?? []), ...(datos?.recibidos ?? [])]
    .filter((s) => s.estado === 'aceptado')
    .map((s) => s.id)
    .sort()
    .join(',');
}

/**
 * aplicarSolicitud
 * Pone en la lista una solicitud que devolvió el servidor tras una acción, sin
 * esperar la recarga (convenciones §8). En `enviados` reemplaza la del mismo
 * turno (hay una por turno: la más nueva); en `recibidos`, la del mismo id.
 * @param {{ enviados: Array, recibidos: Array }|null} datos
 * @param {Object} solicitud - la respuesta del servidor
 * @param {string} barberoId - el barbero de la sesión (dice en qué lista va)
 * @returns {{ enviados: Array, recibidos: Array }}
 */
export function aplicarSolicitud(datos, solicitud, barberoId) {
  const base = datos ?? { enviados: [], recibidos: [] };
  if (solicitud.de_barbero.id === barberoId) {
    const resto = base.enviados.filter((s) => s.turno.id !== solicitud.turno.id);
    const enviados = [...resto, solicitud]
      .sort((x, y) => new Date(x.turno.inicio) - new Date(y.turno.inicio));
    return { ...base, enviados };
  }
  return {
    ...base,
    recibidos: base.recibidos.map((s) => (s.id === solicitud.id ? solicitud : s)),
  };
}
