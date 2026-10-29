// /frontend-barbero/src/components/agenda/datosAgenda.js
// Datos de la Agenda: pasan la respuesta de GET /admin/agenda a lo que dibuja el
// timeline (cada instante en ms y en minutos desde la medianoche del día
// visible), y suman un cambio sin esperar la recarga. Funciones puras, sin React
// ni px (la geometría está en geometria.js).

/**
 * limitesDelDia
 * Medianoche (hora local) del día y del día siguiente, en ms. Es el origen con
 * el que se ubica cualquier instante en el timeline.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {{ inicioDia: number, finDia: number }} ms epoch
 */
export function limitesDelDia(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return {
    inicioDia: new Date(y, m - 1, d).getTime(),
    finDia: new Date(y, m - 1, d + 1).getTime(),
  };
}

/**
 * prepararAgenda
 * Pasa la respuesta de GET /admin/agenda a lo que dibuja el timeline: cada
 * instante como ms epoch y como minutos desde la medianoche del día visible.
 * Los instantes llegan en dos formatos (la grilla con '-03:00'; turnos y
 * suspensiones en UTC con 'Z'): se parsean como fechas, nunca se comparan como texto.
 * - turnos: sin los cancelados (no se dibujan).
 * - slots: la grilla, conservando el ISO original, que es lo que se manda al
 *   crear un descanso.
 * - bloques: descansos y ausencias, recortados al día visible (una ausencia de
 *   varios días llega entera). Conservan su rango completo en desdeMs/hastaMs.
 * - fueraDeHorario: las horas del local en las que el barbero no tiene slots,
 *   en celdas grises (celdasFueraDeHorario), cada una con el ISO de su inicio
 *   para mostrar la hora.
 * Función pura.
 * @param {Object} data - respuesta de getAgenda
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {{ turnos: Array, slots: Array, bloques: Array, fueraDeHorario: Array,
 *   horarioDia: Object|null, duracionSlot: number|null }}
 */
export function prepararAgenda(data, fecha) {
  const { inicioDia } = limitesDelDia(fecha);
  const aMinutos = (ms) => (ms - inicioDia) / 60000;

  const turnos = data.turnos
    .filter((t) => t.estado !== 'cancelado')
    .map((t) => ({
      ...t,
      minInicio: aMinutos(Date.parse(t.inicio)),
      minFin: aMinutos(Date.parse(t.fin)),
    }));

  const slots = data.grilla.map((s) => {
    const inicioMs = Date.parse(s.inicio);
    const finMs = Date.parse(s.fin);
    return {
      inicioIso: s.inicio,
      finIso: s.fin,
      inicioMs,
      finMs,
      minInicio: aMinutos(inicioMs),
      minFin: aMinutos(finMs),
      estado: s.estado,
    };
  });

  const bloques = data.suspensiones
    .map((s) => aBloque(s, fecha))
    .filter((b) => b.minFin > b.minInicio);

  const fueraDeHorario = celdasFueraDeHorario(data.horario_atencion, slots, data.duracion_slot_minutos)
    .map((c) => ({ ...c, inicioIso: new Date(inicioDia + c.minInicio * 60000).toISOString() }));

  return {
    turnos,
    slots,
    bloques,
    fueraDeHorario,
    horarioDia: data.horario_atencion,
    duracionSlot: data.duracion_slot_minutos,
  };
}

/**
 * aMinutosDelDia
 * Una hora 'HH:MM' (o 'HH:MM:SS') en minutos desde la medianoche.
 * @param {string} hora
 * @returns {number}
 */
function aMinutosDelDia(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * celdasFueraDeHorario
 * Las horas del horario del local en las que el barbero no tiene slots, para
 * dibujarlas en gris: no trabaja (antes, entre o después de sus bloques, o el
 * día entero), o es el final de un bloque donde no entra un turno. Cortadas en
 * celdas del largo de un slot, que siguen el ritmo de los slots del barbero
 * para quedar pegadas a ellos:
 * - un tramo que empieza donde termina un slot se corta desde ahí, hacia adelante;
 * - el tramo de antes del primer slot, desde ese slot hacia atrás;
 * - un día sin slots, desde la apertura del local.
 * Lo que sobra (menos de un slot) queda en el otro extremo del tramo: si mide
 * menos de medio slot se suma a la celda de al lado; si no, es una celda más.
 * Una celda de menos de medio slot (un tramo así de corto) va sin hora
 * (`conHora: false`): no hay lugar para el texto.
 * Función pura.
 * @param {{ hora_inicio: string, hora_fin: string }|null} horarioDia - horario
 *   del local ese día ('HH:MM'); null si no abre
 * @param {Array<{ minInicio: number, minFin: number }>} slots - grilla del
 *   barbero, ordenada por inicio
 * @param {number|null} duracionSlot - minutos por slot del negocio
 * @returns {Array<{ minInicio: number, minFin: number, conHora: boolean }>}
 *   ordenadas; vacío si el local no abre ese día
 */
export function celdasFueraDeHorario(horarioDia, slots, duracionSlot) {
  if (!horarioDia || !duracionSlot) return [];
  const apertura = aMinutosDelDia(horarioDia.hora_inicio);
  const cierre = aMinutosDelDia(horarioDia.hora_fin);
  if (cierre <= apertura) return [];

  // Tramos del horario del local que no cubre ningún slot.
  const tramos = [];
  let cursor = apertura;
  let vieneDeSlot = false;
  for (const s of slots) {
    if (s.minFin <= cursor) continue;     // antes de la apertura, o ya cubierto
    if (s.minInicio >= cierre) break;     // de acá en adelante, el local ya cerró
    if (s.minInicio > cursor) tramos.push({ desde: cursor, hasta: s.minInicio, vieneDeSlot, vaASlot: true });
    cursor = s.minFin;
    vieneDeSlot = true;
  }
  if (cursor < cierre) tramos.push({ desde: cursor, hasta: cierre, vieneDeSlot, vaASlot: false });

  return tramos
    .flatMap((t) => cortarTramo(t, duracionSlot))
    .map((c) => ({ ...c, conHora: c.minFin - c.minInicio >= duracionSlot / 2 }));
}

/**
 * cortarTramo
 * Corta un tramo sin slots en celdas de `duracion` minutos (reglas en
 * celdasFueraDeHorario). Hacia atrás solo el tramo de antes del primer slot,
 * para que la última celda quede pegada a ese slot.
 * @param {{ desde: number, hasta: number, vieneDeSlot: boolean, vaASlot: boolean }} tramo
 * @param {number} duracion - minutos por slot
 * @returns {Array<{ minInicio: number, minFin: number }>} ordenadas
 */
function cortarTramo({ desde, hasta, vieneDeSlot, vaASlot }, duracion) {
  const haciaAtras = !vieneDeSlot && vaASlot;
  const celdas = [];
  if (haciaAtras) {
    for (let fin = hasta; fin - duracion >= desde; fin -= duracion) {
      celdas.unshift({ minInicio: fin - duracion, minFin: fin });
    }
  } else {
    for (let ini = desde; ini + duracion <= hasta; ini += duracion) {
      celdas.push({ minInicio: ini, minFin: ini + duracion });
    }
  }

  const sobra = (hasta - desde) % duracion;
  if (sobra === 0) return celdas;

  if (celdas.length > 0 && sobra < duracion / 2) {
    // Se suma a la celda del extremo donde sobra.
    if (haciaAtras) celdas[0] = { ...celdas[0], minInicio: desde };
    else celdas[celdas.length - 1] = { ...celdas[celdas.length - 1], minFin: hasta };
  } else if (haciaAtras) {
    celdas.unshift({ minInicio: desde, minFin: desde + sobra });
  } else {
    celdas.push({ minInicio: hasta - sobra, minFin: hasta });
  }
  return celdas;
}

/**
 * aBloque
 * Una fila de suspensión o descanso (de GET /admin/agenda, o el descanso que
 * devuelve POST /admin/descansos: tienen la misma forma) como bloque del
 * timeline: el rango completo en ms y recortado al día visible en minutos.
 * Función pura.
 * @param {{ id, tipo, origen, motivo, desde: string, hasta: string }} s - `hasta` es el fin efectivo
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {Object} { id, tipo, origen, motivo, desdeIso, hastaIso, desdeMs, hastaMs, minInicio, minFin }
 */
function aBloque(s, fecha) {
  const { inicioDia, finDia } = limitesDelDia(fecha);
  const desdeMs = Date.parse(s.desde);
  const hastaMs = Date.parse(s.hasta);
  return {
    id: s.id,
    tipo: s.tipo,
    origen: s.origen,
    motivo: s.motivo,
    desdeIso: s.desde,
    hastaIso: s.hasta,
    desdeMs,
    hastaMs,
    minInicio: (Math.max(desdeMs, inicioDia) - inicioDia) / 60000,
    minFin: (Math.min(hastaMs, finDia) - inicioDia) / 60000,
  };
}

/**
 * agregarDescanso
 * Suma a la agenda ya preparada el descanso que acaba de devolver
 * POST /admin/descansos: su bloque, y sus slots pasan a 'descanso' (dejan de
 * ser tocables). Así aparece al instante, sin esperar la recarga, que después
 * lo confirma con los datos del servidor. Función pura.
 * @param {Object} agenda - de prepararAgenda
 * @param {Object} descanso - la fila que devolvió el servidor
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {Object} la agenda nueva (no muta la recibida)
 */
export function agregarDescanso(agenda, descanso, fecha) {
  const bloque = aBloque(descanso, fecha);
  return {
    ...agenda,
    bloques: [...agenda.bloques, bloque],
    slots: agenda.slots.map((s) => (
      s.inicioMs < bloque.hastaMs && s.finMs > bloque.desdeMs ? { ...s, estado: 'descanso' } : s
    )),
  };
}

/**
 * aplicarEstadoDeTurno
 * Aplica a la agenda ya preparada el estado nuevo de un turno, tal como lo
 * devolvió el servidor: PATCH /admin/turnos/:id/estado y DELETE /admin/turnos/:id
 * responden los dos { id, estado }. Así el cambio se ve al instante, sin esperar
 * la recarga, que después lo confirma. Función pura.
 * - 'cancelado': el turno sale (los cancelados no se dibujan, como en prepararAgenda).
 * - otro estado ('no_asistio'): el turno queda con ese estado.
 * Los slots que ocupaba y estaban en 'turno' pasan a 'libre' si ya no los ocupa
 * ningún turno reservado: la grilla del servidor solo marca 'turno' en los
 * reservados (un completado o un "no asistió" deja su slot libre).
 * @param {Object} agenda - de prepararAgenda
 * @param {{ id: string, estado: string }} cambio - la respuesta del servidor
 * @returns {Object} la agenda nueva (no muta la recibida); la misma si el turno
 *   no está en la agenda
 */
export function aplicarEstadoDeTurno(agenda, { id, estado }) {
  const turno = agenda.turnos.find((t) => t.id === id);
  if (!turno) return agenda;

  const turnos = estado === 'cancelado'
    ? agenda.turnos.filter((t) => t.id !== id)
    : agenda.turnos.map((t) => (t.id === id ? { ...t, estado } : t));

  const solapa = (a, b) => a.minInicio < b.minFin && a.minFin > b.minInicio;
  const reservados = turnos.filter((t) => t.estado === 'reservado');
  const slots = agenda.slots.map((s) => (
    s.estado === 'turno' && solapa(s, turno) && !reservados.some((t) => solapa(s, t))
      ? { ...s, estado: 'libre' }
      : s
  ));

  return { ...agenda, turnos, slots };
}

/**
 * unirDescansosSeguidos
 * Junta en un solo bloque los descansos pegados (uno termina justo cuando
 * empieza el otro) del mismo origen: marcar 13:00 y después 13:30 se ve y se
 * comporta igual que marcar 13:00–14:00 de una vez.
 * En la base siguen siendo filas separadas, cada una con su antelación (el
 * registro del dueño, plan D10): el bloque unido las lleva en `partes`, y
 * liberarlo libera cada una.
 * No une descansos de distinto origen (el barbero no puede liberar los del
 * admin) ni ausencias. Función pura.
 * @param {Array} bloques - de prepararAgenda, sin unir
 * @returns {Array} las ausencias tal cual y los descansos unidos; cada descanso
 *   con `partes: [{ id, desdeMs, hastaMs }]`
 */
export function unirDescansosSeguidos(bloques) {
  const ausencias = bloques.filter((b) => b.tipo !== 'descanso');
  const descansos = bloques
    .filter((b) => b.tipo === 'descanso')
    .sort((a, b) => a.desdeMs - b.desdeMs);

  const unidos = [];
  for (const d of descansos) {
    const parte = { id: d.id, desdeMs: d.desdeMs, hastaMs: d.hastaMs };
    const anterior = unidos[unidos.length - 1];
    if (anterior && anterior.origen === d.origen && anterior.hastaMs === d.desdeMs) {
      unidos[unidos.length - 1] = {
        ...anterior,
        hastaIso: d.hastaIso,
        hastaMs: d.hastaMs,
        minFin: d.minFin,
        partes: [...anterior.partes, parte],
      };
    } else {
      unidos.push({ ...d, partes: [parte] });
    }
  }
  return [...ausencias, ...unidos];
}
