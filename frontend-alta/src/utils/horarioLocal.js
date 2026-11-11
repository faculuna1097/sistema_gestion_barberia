// /frontend-alta/src/utils/horarioLocal.js
// El horario del local en el formulario (pantallas 3 y 4): qué días abre, el
// horario "común" que comparten casi todos, los días que tienen uno propio
// (ej. el sábado cierra antes) y la pausa del mediodía.
//
// En `datos` (plan §5.6) el local tiene un rango por día abierto
// (local.horario) y una pausa para todos (local.pausa). Lo demás es de la
// interfaz y va en `progreso`, porque el backend descarta cualquier otra clave:
//   - progreso.horario_comun: el rango común. Hace falta cuando ningún día lo
//     usa (todos tienen uno propio) para saber qué darle a un día que se prende.
//   - progreso.dias_distintos: los días con horario propio. Se guarda aparte
//     (y no se deduce de "el rango no es el común") para que un día distinto no
//     se pierda si el común pasa por su mismo rango y después sigue de largo.
// leerHorarioLocal reconcilia las dos fuentes: si lo guardado no cierra (ej.
// datos de antes de esta fase), manda local.horario.
//
// Todas las funciones de cambio reciben `datos` y devuelven `datos` nuevos,
// para pasarlas directo a actualizar() de useSolicitud.
// Funciones puras (sin React) para poder probarlas con Node.

import { MARGEN_PAUSA_MINUTOS } from './validaciones.js';
import {
  aMinutos, aHora, esRangoValido, mismoRango, PASO_MINUTOS, HORA_MINIMA, HORA_MAXIMA,
} from './horas.js';
import { ordenarDias, posicionEnSemana } from './semana.js';

/**
 * HORARIO_POR_DEFECTO
 * Con qué horario se prende el primer día: el de una barbería típica.
 */
export const HORARIO_POR_DEFECTO = { hora_inicio: '10:00', hora_fin: '20:00' };

/**
 * PAUSA_POR_DEFECTO
 * La pausa que se propone al tocar "¿Cierran al mediodía?", si entra en el
 * horario común (si no, se centra una hora en él: pausaSugerida).
 */
export const PAUSA_POR_DEFECTO = { hora_inicio: '13:00', hora_fin: '14:00' };

/**
 * esDiaSemana (interna)
 * @param {*} valor
 * @returns {boolean} true si es un entero de 0 a 6.
 */
const esDiaSemana = (valor) => Number.isInteger(valor) && valor >= 0 && valor <= 6;

/**
 * soloRango (interna)
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {{hora_inicio: string, hora_fin: string}} Una copia con solo las dos horas.
 */
const soloRango = (rango) => ({ hora_inicio: rango.hora_inicio, hora_fin: rango.hora_fin });

/**
 * leerHorarioLocal
 * La vista del horario que usan las pantallas, la tarjeta y las funciones de
 * cambio. Ignora las entradas mal formadas de local.horario.
 * @param {Object} datos - El formulario completo
 * @returns {{
 *   dias: number[],
 *   porDia: Map<number, {hora_inicio: string, hora_fin: string}>,
 *   comun: {hora_inicio: string, hora_fin: string},
 *   distintos: Set<number>,
 *   pausa: {hora_inicio: string, hora_fin: string}|null,
 * }} `dias`: los abiertos, de lunes a domingo. `comun`: el rango de los días
 *   sin horario propio. `distintos`: los días con horario propio.
 */
export function leerHorarioLocal(datos) {
  const porDia = new Map();
  (Array.isArray(datos.local?.horario) ? datos.local.horario : []).forEach((entrada) => {
    if (entrada && esDiaSemana(entrada.dia_semana) && esRangoValido(entrada) && !porDia.has(entrada.dia_semana)) {
      porDia.set(entrada.dia_semana, soloRango(entrada));
    }
  });
  const dias = ordenarDias(porDia.keys());

  const progreso = datos.progreso ?? {};
  const marcados = new Set((Array.isArray(progreso.dias_distintos) ? progreso.dias_distintos : []).filter((d) => porDia.has(d)));

  // El común sale de un día que lo usa; si no hay ninguno, de lo guardado.
  const diaComun = dias.find((d) => !marcados.has(d));
  const comun = diaComun !== undefined
    ? porDia.get(diaComun)
    : (esRangoValido(progreso.horario_comun) ? soloRango(progreso.horario_comun) : HORARIO_POR_DEFECTO);

  // Un día con otro rango es distinto aunque no esté marcado (datos viejos).
  const distintos = new Set(dias.filter((d) => marcados.has(d) || !mismoRango(porDia.get(d), comun)));

  const pausa = datos.local?.pausa ? soloRango(datos.local.pausa) : null;
  return { dias, porDia, comun: soloRango(comun), distintos, pausa };
}

/**
 * escribir (interna)
 * Vuelca una vista del horario en `datos`: local.horario de lunes a domingo, y
 * el común y los días distintos en progreso.
 * @param {Object} datos
 * @param {Object} vista - { porDia, comun, distintos }
 * @returns {Object} Los datos nuevos.
 */
function escribir(datos, { porDia, comun, distintos }) {
  const dias = ordenarDias(porDia.keys());
  return {
    ...datos,
    local: {
      ...datos.local,
      horario: dias.map((dia) => ({ dia_semana: dia, ...porDia.get(dia) })),
    },
    progreso: {
      ...datos.progreso,
      horario_comun: soloRango(comun),
      dias_distintos: ordenarDias([...distintos].filter((d) => porDia.has(d))),
    },
  };
}

/**
 * elegirDias
 * Deja abiertos exactamente `dias`: los que se prenden toman el horario común
 * y los que se apagan se borran (con su horario propio, si tenían).
 * @param {Object} datos
 * @param {Iterable<number>} dias - dia_semana
 * @returns {Object} Los datos nuevos.
 */
export function elegirDias(datos, dias) {
  const vista = leerHorarioLocal(datos);
  const elegidos = new Set(dias);
  const porDia = new Map();
  elegidos.forEach((dia) => {
    porDia.set(dia, vista.porDia.get(dia) ?? soloRango(vista.comun));
  });
  return escribir(datos, { ...vista, porDia });
}

/**
 * alternarDia
 * Prende un día cerrado (con el horario común) o apaga uno abierto.
 * @param {Object} datos
 * @param {number} dia - dia_semana
 * @returns {Object} Los datos nuevos.
 */
export function alternarDia(datos, dia) {
  const { dias } = leerHorarioLocal(datos);
  return elegirDias(datos, dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia]);
}

/**
 * cambiarHorarioComun
 * Cambia el rango común: lo toman todos los días que no tienen horario propio.
 * @param {Object} datos
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {Object} Los datos nuevos.
 */
export function cambiarHorarioComun(datos, rango) {
  const vista = leerHorarioLocal(datos);
  const porDia = new Map(vista.porDia);
  vista.dias.forEach((dia) => {
    if (!vista.distintos.has(dia)) porDia.set(dia, soloRango(rango));
  });
  return escribir(datos, { ...vista, porDia, comun: rango });
}

/**
 * cambiarHorarioDia
 * Le da a un día su propio horario: desde acá no sigue al común.
 * @param {Object} datos
 * @param {number} dia - dia_semana (abierto)
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {Object} Los datos nuevos (los mismos si el día no está abierto).
 */
export function cambiarHorarioDia(datos, dia, rango) {
  const vista = leerHorarioLocal(datos);
  if (!vista.porDia.has(dia)) return datos;
  const porDia = new Map(vista.porDia).set(dia, soloRango(rango));
  return escribir(datos, { ...vista, porDia, distintos: new Set(vista.distintos).add(dia) });
}

/**
 * volverAlHorarioComun
 * Un día con horario propio vuelve a tener el común (y a seguirlo).
 * @param {Object} datos
 * @param {number} dia - dia_semana
 * @returns {Object} Los datos nuevos.
 */
export function volverAlHorarioComun(datos, dia) {
  const vista = leerHorarioLocal(datos);
  if (!vista.porDia.has(dia)) return datos;
  const porDia = new Map(vista.porDia).set(dia, soloRango(vista.comun));
  const distintos = new Set(vista.distintos);
  distintos.delete(dia);
  return escribir(datos, { ...vista, porDia, distintos });
}

/**
 * pausaSugerida
 * La pausa que se propone para un horario: PAUSA_POR_DEFECTO si entra con
 * MARGEN_PAUSA_MINUTOS de atención de cada lado; si no, una hora centrada en
 * el rango (puede no entrar si el rango es corto: lo dice la validación).
 * @param {{hora_inicio: string, hora_fin: string}} rango - El horario común
 * @returns {{hora_inicio: string, hora_fin: string}}
 */
export function pausaSugerida(rango) {
  const inicio = aMinutos(rango.hora_inicio);
  const fin = aMinutos(rango.hora_fin);
  const entra = aMinutos(PAUSA_POR_DEFECTO.hora_inicio) - inicio >= MARGEN_PAUSA_MINUTOS
    && fin - aMinutos(PAUSA_POR_DEFECTO.hora_fin) >= MARGEN_PAUSA_MINUTOS;
  if (entra) return { ...PAUSA_POR_DEFECTO };

  const medio = Math.floor((inicio + fin) / 2 / PASO_MINUTOS) * PASO_MINUTOS;
  const desde = Math.max(medio - PASO_MINUTOS, aMinutos(HORA_MINIMA));
  const hasta = Math.min(desde + 2 * PASO_MINUTOS, aMinutos(HORA_MAXIMA));
  return { hora_inicio: aHora(desde), hora_fin: aHora(hasta) };
}

/**
 * cambiarPausa
 * Pone la pausa del mediodía (la misma para todos los días, plan §5.6), o la
 * saca con null.
 * @param {Object} datos
 * @param {{hora_inicio: string, hora_fin: string}|null} pausa
 * @returns {Object} Los datos nuevos.
 */
export function cambiarPausa(datos, pausa) {
  return { ...datos, local: { ...datos.local, pausa: pausa ? soloRango(pausa) : null } };
}

/**
 * gruposPorRango
 * Junta los días abiertos que tienen el mismo rango, para resumir el horario
 * en pocas líneas ("Lun a vie 10 a 20", "Sáb 10 a 18"). El grupo más grande
 * va primero; a igual tamaño, el que empieza antes en la semana.
 * @param {Object} datos
 * @returns {Array<{dias: number[], rango: {hora_inicio: string, hora_fin: string}}>}
 */
export function gruposPorRango(datos) {
  const { dias, porDia } = leerHorarioLocal(datos);
  const grupos = [];
  dias.forEach((dia) => {
    const rango = porDia.get(dia);
    const grupo = grupos.find((g) => mismoRango(g.rango, rango));
    if (grupo) grupo.dias.push(dia);
    else grupos.push({ dias: [dia], rango });
  });
  return grupos.sort((a, b) => b.dias.length - a.dias.length
    || posicionEnSemana(a.dias[0]) - posicionEnSemana(b.dias[0]));
}
