// /frontend-alta/src/utils/horarioEquipo.js
// El horario de cada barbero (pantalla 7): 'igual_local' o bloques propios,
// varios por día, sin pisarse y dentro del horario del local ese día (plan
// §5.4 y §5.6).
//
// - Al pasar a un barbero a horario propio, sus bloques se precargan desde el
//   del local, ya partidos por la pausa del mediodía si la hay (D11). Un
//   horario propio puede cubrir la pausa ("De corrido").
// - Si después cambia el horario del local (pantallas 3 y 4), los horarios
//   propios NO se reescriben: la validación los marca al volver a la 7 (y el
//   backend al enviar).
// - La respuesta a "¿Todos trabajan el horario del local?" va en
//   progreso.horarios_distintos (true = "No"). Un barbero con horario propio
//   la vuelve "No" aunque la marca falte.
//
// Los bloques de un barbero se editan por su posición en barbero.horario (la
// misma que usa el `campo` de un error: 'barberos.0.horario.3.hora_fin'). Los
// cambios de una hora no reordenan la lista, así los botones no saltan de
// lugar mientras se tocan; los que agregan o sacan bloques la dejan de lunes a
// domingo y por hora.
//
// Todas las funciones de cambio reciben `datos` y devuelven `datos` nuevos,
// para pasarlas directo a actualizar() de useSolicitud.
// Funciones puras (sin React) para poder probarlas con Node.

import { leerHorarioLocal, pausaSugerida } from './horarioLocal.js';
import { aMinutos, aHora, esRangoValido, mismoRango, PASO_MINUTOS } from './horas.js';
import { posicionEnSemana } from './semana.js';

/**
 * IGUAL_LOCAL
 * El horario de un barbero que trabaja el del local (plan §5.6).
 */
export const IGUAL_LOCAL = 'igual_local';

/**
 * RESPUESTA
 * Lo contestado en "¿Todos trabajan el horario del local?".
 */
export const RESPUESTA = { SI: 'si', NO: 'no' };

/**
 * soloRango (interna)
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {{hora_inicio: string, hora_fin: string}}
 */
const soloRango = (rango) => ({ hora_inicio: rango.hora_inicio, hora_fin: rango.hora_fin });

/**
 * esBloqueValido (interna)
 * @param {*} bloque
 * @returns {boolean} true si tiene un dia_semana de 0 a 6 y un rango válido.
 */
const esBloqueValido = (bloque) => Boolean(bloque)
  && Number.isInteger(bloque.dia_semana) && bloque.dia_semana >= 0 && bloque.dia_semana <= 6
  && esRangoValido(bloque);

/**
 * tieneHorarioPropio
 * @param {Object} barbero
 * @returns {boolean} true si su horario es una lista de bloques (no 'igual_local').
 */
export const tieneHorarioPropio = (barbero) => Array.isArray(barbero?.horario);

/**
 * partirPorPausa
 * Un rango sin la pausa: entero si la pausa no lo toca, o en los pedazos que
 * quedan antes y después (los vacíos se descartan).
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @param {{hora_inicio: string, hora_fin: string}|null} pausa
 * @returns {Array<{hora_inicio: string, hora_fin: string}>}
 */
export function partirPorPausa(rango, pausa) {
  const desde = aMinutos(rango.hora_inicio);
  const hasta = aMinutos(rango.hora_fin);
  if (!pausa) return [soloRango(rango)];
  const pDesde = aMinutos(pausa.hora_inicio);
  const pHasta = aMinutos(pausa.hora_fin);
  if (pHasta <= desde || pDesde >= hasta) return [soloRango(rango)];
  return [
    { desde, hasta: Math.min(hasta, pDesde) },
    { desde: Math.max(desde, pHasta), hasta },
  ].filter((t) => t.hasta > t.desde).map((t) => ({ hora_inicio: aHora(t.desde), hora_fin: aHora(t.hasta) }));
}

/**
 * bloquesDelLocalEnDia
 * Cómo trabaja ese día un barbero con el horario del local: el rango del día,
 * partido por la pausa si la hay.
 * @param {Object} datos
 * @param {number} dia - dia_semana
 * @returns {Array<{hora_inicio: string, hora_fin: string}>} Vacío si el local no abre.
 */
export function bloquesDelLocalEnDia(datos, dia) {
  const { porDia, pausa } = leerHorarioLocal(datos);
  const rango = porDia.get(dia);
  return rango ? partirPorPausa(rango, pausa) : [];
}

/**
 * bloquesDelLocal
 * El horario del local como bloques de barbero (la precarga del horario propio).
 * @param {Object} datos
 * @returns {Array<{dia_semana: number, hora_inicio: string, hora_fin: string}>} De lunes a domingo.
 */
export function bloquesDelLocal(datos) {
  return leerHorarioLocal(datos).dias.flatMap((dia) => bloquesDelLocalEnDia(datos, dia).map((r) => ({ dia_semana: dia, ...r })));
}

/**
 * ordenarBloques
 * @param {Array} bloques
 * @returns {Array} Una copia, de lunes a domingo y por hora de entrada.
 */
export function ordenarBloques(bloques) {
  return [...bloques].sort((a, b) => posicionEnSemana(a.dia_semana) - posicionEnSemana(b.dia_semana)
    || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
}

/**
 * bloquesDelDia
 * Los bloques de un barbero en un día, con su posición en barbero.horario (la
 * que usan las funciones de cambio y los errores). Solo los bien formados.
 * @param {Object} barbero
 * @param {number} dia - dia_semana
 * @returns {Array<{indice: number, hora_inicio: string, hora_fin: string}>}
 */
export function bloquesDelDia(barbero, dia) {
  if (!tieneHorarioPropio(barbero)) return [];
  return barbero.horario
    .map((bloque, indice) => ({ bloque, indice }))
    .filter(({ bloque }) => esBloqueValido(bloque) && bloque.dia_semana === dia)
    .map(({ bloque, indice }) => ({ indice, ...soloRango(bloque) }));
}

/**
 * diasDelBarbero
 * @param {Object} barbero
 * @returns {number[]} Los días en que tiene algún bloque (sin orden).
 */
export function diasDelBarbero(barbero) {
  if (!tieneHorarioPropio(barbero)) return [];
  return [...new Set(barbero.horario.filter(esBloqueValido).map((b) => b.dia_semana))];
}

/**
 * esDiaDistintoDelLocal
 * @param {Object} datos
 * @param {Object} barbero - Con horario propio
 * @param {number} dia
 * @returns {boolean} true si ese día no trabaja igual que el local.
 */
export function esDiaDistintoDelLocal(datos, barbero, dia) {
  const propios = bloquesDelDia(barbero, dia);
  const local = bloquesDelLocalEnDia(datos, dia);
  return propios.length !== local.length || propios.some((b, i) => !mismoRango(b, local[i]));
}

/**
 * respuestaHorarios
 * Lo contestado en "¿Todos trabajan el horario del local?".
 * @param {Object} datos
 * @returns {string|null} RESPUESTA.SI, RESPUESTA.NO o null si todavía no se contestó.
 */
export function respuestaHorarios(datos) {
  if ((datos.barberos ?? []).some(tieneHorarioPropio)) return RESPUESTA.NO;
  const marca = datos.progreso?.horarios_distintos;
  if (marca === true) return RESPUESTA.NO;
  if (marca === false) return RESPUESTA.SI;
  return null;
}

/**
 * cambiarHorarioDe (interna)
 * Aplica un cambio al horario del barbero de una clave.
 * @param {Object} datos
 * @param {string} clave
 * @param {Function} cambio - Recibe (horario, barbero) y devuelve el horario nuevo
 * @returns {Object} Los datos nuevos (los mismos si no hay barbero con esa clave).
 */
function cambiarHorarioDe(datos, clave, cambio) {
  if (!datos.barberos?.some((b) => b.clave === clave)) return datos;
  return {
    ...datos,
    barberos: datos.barberos.map((b) => (b.clave === clave ? { ...b, horario: cambio(b.horario, b) } : b)),
  };
}

/**
 * contestarTodosIgualLocal
 * "Sí": todos los barberos quedan con el horario del local.
 * @param {Object} datos
 * @returns {Object} Los datos nuevos.
 */
export function contestarTodosIgualLocal(datos) {
  return {
    ...datos,
    barberos: (datos.barberos ?? []).map((b) => ({ ...b, horario: IGUAL_LOCAL })),
    progreso: { ...datos.progreso, horarios_distintos: false },
  };
}

/**
 * pasarAHorarioPropio
 * Le da a un barbero su propio horario, precargado con el del local (partido
 * por la pausa). Si ya tenía uno propio, no lo toca.
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object} Los datos nuevos.
 */
export function pasarAHorarioPropio(datos, clave) {
  return cambiarHorarioDe(datos, clave, (horario) => (Array.isArray(horario) ? horario : bloquesDelLocal(datos)));
}

/**
 * contestarHorariosDistintos
 * "No": aparece el detalle por barbero. Con un solo barbero, "no" quiere
 * decir que él tiene otro horario: pasa directo a horario propio.
 * @param {Object} datos
 * @returns {Object} Los datos nuevos.
 */
export function contestarHorariosDistintos(datos) {
  const conMarca = { ...datos, progreso: { ...datos.progreso, horarios_distintos: true } };
  const barberos = datos.barberos ?? [];
  return barberos.length === 1 ? pasarAHorarioPropio(conMarca, barberos[0].clave) : conMarca;
}

/**
 * volverAlHorarioDelLocal
 * Un barbero con horario propio vuelve a 'igual_local' (sus bloques se borran).
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object} Los datos nuevos.
 */
export function volverAlHorarioDelLocal(datos, clave) {
  return cambiarHorarioDe(datos, clave, () => IGUAL_LOCAL);
}

/**
 * alternarDiaBarbero
 * Prende un día (con los bloques del local ese día) o lo apaga (borra todos
 * sus bloques de ese día).
 * @param {Object} datos
 * @param {string} clave
 * @param {number} dia - dia_semana
 * @returns {Object} Los datos nuevos.
 */
export function alternarDiaBarbero(datos, clave, dia) {
  return cambiarHorarioDe(datos, clave, (horario) => {
    const lista = Array.isArray(horario) ? horario : [];
    if (lista.some((b) => b?.dia_semana === dia)) return lista.filter((b) => b?.dia_semana !== dia);
    return ordenarBloques([...lista, ...bloquesDelLocalEnDia(datos, dia).map((r) => ({ dia_semana: dia, ...r }))]);
  });
}

/**
 * cambiarBloque
 * Cambia la entrada o la salida de un bloque, sin reordenar la lista.
 * @param {Object} datos
 * @param {string} clave
 * @param {number} indice - Posición del bloque en barbero.horario
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {Object} Los datos nuevos.
 */
export function cambiarBloque(datos, clave, indice, rango) {
  return cambiarHorarioDe(datos, clave, (horario) => {
    if (!Array.isArray(horario) || !horario[indice]) return horario;
    return horario.map((b, j) => (j === indice ? { ...b, ...soloRango(rango) } : b));
  });
}

/**
 * cortePara (interna)
 * Dónde partir un bloque en dos, dejando al menos PASO_MINUTOS de cada lado:
 * la pausa sugerida del local (13 a 14 si entra; si no, una hora en el medio,
 * pausaSugerida) y, en un bloque corto, media hora en el medio.
 * @param {{hora_inicio: string, hora_fin: string}} bloque
 * @returns {{hora_inicio: string, hora_fin: string}|null} null si no entra.
 */
function cortePara(bloque) {
  const inicio = aMinutos(bloque.hora_inicio);
  const fin = aMinutos(bloque.hora_fin);
  /** entra — el corte deja PASO_MINUTOS antes y después. */
  const entra = (corte) => aMinutos(corte.hora_inicio) - inicio >= PASO_MINUTOS
    && fin - aMinutos(corte.hora_fin) >= PASO_MINUTOS;

  const sugerida = pausaSugerida(bloque);
  if (entra(sugerida)) return sugerida;
  const medio = Math.floor((inicio + fin) / 2 / PASO_MINUTOS) * PASO_MINUTOS;
  const corto = { hora_inicio: aHora(medio), hora_fin: aHora(medio + PASO_MINUTOS) };
  return entra(corto) ? corto : null;
}

/**
 * sePuedePartir
 * @param {{hora_inicio: string, hora_fin: string}} bloque
 * @returns {boolean} true si el bloque es lo bastante largo para partirlo con una pausa.
 */
export const sePuedePartir = (bloque) => cortePara(bloque) !== null;

/**
 * partirJornada
 * Parte un bloque en dos, con una pausa en el medio (cortePara). El cliente
 * después ajusta las horas.
 * @param {Object} datos
 * @param {string} clave
 * @param {number} indice - Posición del bloque en barbero.horario
 * @returns {Object} Los datos nuevos (los mismos si el bloque es muy corto).
 */
export function partirJornada(datos, clave, indice) {
  return cambiarHorarioDe(datos, clave, (horario) => {
    const bloque = Array.isArray(horario) ? horario[indice] : null;
    const corte = bloque && esBloqueValido(bloque) ? cortePara(bloque) : null;
    if (!corte) return horario;
    const partes = [
      { dia_semana: bloque.dia_semana, hora_inicio: bloque.hora_inicio, hora_fin: corte.hora_inicio },
      { dia_semana: bloque.dia_semana, hora_inicio: corte.hora_fin, hora_fin: bloque.hora_fin },
    ];
    return ordenarBloques([...horario.filter((_, j) => j !== indice), ...partes]);
  });
}

/**
 * trabajarDeCorrido
 * Junta los bloques de un día en uno solo, de la primera entrada a la última
 * salida (cubre la pausa, D11).
 * @param {Object} datos
 * @param {string} clave
 * @param {number} dia - dia_semana
 * @returns {Object} Los datos nuevos (los mismos si ese día tiene uno o ningún bloque).
 */
export function trabajarDeCorrido(datos, clave, dia) {
  return cambiarHorarioDe(datos, clave, (horario, barbero) => {
    const delDia = bloquesDelDia(barbero, dia);
    if (delDia.length < 2) return horario;
    const desde = Math.min(...delDia.map((b) => aMinutos(b.hora_inicio)));
    const hasta = Math.max(...delDia.map((b) => aMinutos(b.hora_fin)));
    return ordenarBloques([
      ...horario.filter((b) => b?.dia_semana !== dia),
      { dia_semana: dia, hora_inicio: aHora(desde), hora_fin: aHora(hasta) },
    ]);
  });
}

/**
 * copiarDiaATodos
 * "Usar en todos sus días": los bloques de un día pasan a los demás días que
 * trabaja el barbero, recortados al horario del local de cada día (un pedazo
 * que queda de menos de PASO_MINUTOS se descarta). Un día que el local no abre
 * recibe la copia sin recortar (la validación lo marca).
 * @param {Object} datos
 * @param {string} clave
 * @param {number} dia - El día que se copia
 * @returns {Object} Los datos nuevos.
 */
export function copiarDiaATodos(datos, clave, dia) {
  const { porDia } = leerHorarioLocal(datos);
  return cambiarHorarioDe(datos, clave, (horario, barbero) => {
    const modelo = bloquesDelDia(barbero, dia);
    if (modelo.length === 0) return horario;
    const otros = diasDelBarbero(barbero).filter((d) => d !== dia);
    const copias = otros.flatMap((otro) => {
      const local = porDia.get(otro);
      return modelo.flatMap((b) => {
        const desde = local ? Math.max(aMinutos(b.hora_inicio), aMinutos(local.hora_inicio)) : aMinutos(b.hora_inicio);
        const hasta = local ? Math.min(aMinutos(b.hora_fin), aMinutos(local.hora_fin)) : aMinutos(b.hora_fin);
        return hasta - desde >= PASO_MINUTOS ? [{ dia_semana: otro, hora_inicio: aHora(desde), hora_fin: aHora(hasta) }] : [];
      });
    });
    const quedan = horario.filter((b) => !otros.includes(b?.dia_semana));
    return ordenarBloques([...quedan, ...copias]);
  });
}

/**
 * diaDelError
 * El día de un error del horario de un barbero ('barberos.0.horario.3.hora_fin'
 * → el dia_semana del bloque 3), para abrir ese día al mostrarlo.
 * @param {Object} barbero
 * @param {string} campo - El `campo` del error
 * @returns {number|null} null si el error es del horario entero ('barberos.0.horario').
 */
export function diaDelError(barbero, campo) {
  const posicion = Number(campo.split('.')[3]);
  if (!Number.isInteger(posicion)) return null;
  const dia = barbero?.horario?.[posicion]?.dia_semana;
  return Number.isInteger(dia) ? dia : null;
}
