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
 *   Los descansos llegan ya como bloques (los pegados, unidos en uno: la regla
 *   vive en el backend, descansosService → unirDescansos); los liberados antes
 *   de empezar no se dibujan.
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

  const bloques = [
    ...data.suspensiones.map((s) => aBloque(s, 'suspension', fecha)),
    ...data.descansos
      .filter((d) => d.estado !== 'liberado')
      .map((d) => aBloque(d, 'descanso', fecha)),
  ].filter((b) => b.minFin > b.minInicio);

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
 * Una ausencia, un bloque de descanso (de GET /admin/agenda o de
 * POST /admin/descansos) o, si el servidor no pudo devolver el bloque, la fila
 * del descanso recién creado, como bloque del timeline: el rango completo en ms
 * y recortado al día visible en minutos. `partes` son las filas que hay que
 * liberar para liberar el bloque: las del bloque de descanso, o la fila misma.
 * Función pura.
 * @param {{ id, origen, motivo?, desde: string, hasta: string, partes? }} s - `hasta` es el fin efectivo
 * @param {'suspension'|'descanso'} tipo
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {Object} { id, tipo, origen, motivo, desdeIso, hastaIso, desdeMs, hastaMs,
 *   minInicio, minFin, partes: [{ id, desdeMs, hastaMs }] }
 */
function aBloque(s, tipo, fecha) {
  const { inicioDia, finDia } = limitesDelDia(fecha);
  const desdeMs = Date.parse(s.desde);
  const hastaMs = Date.parse(s.hasta);
  const partes = s.partes
    ? s.partes.map((p) => ({ id: p.id, desdeMs: Date.parse(p.desde), hastaMs: Date.parse(p.hasta) }))
    : [{ id: s.id, desdeMs, hastaMs }];
  return {
    id: s.id,
    tipo,
    partes,
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
 * POST /admin/descansos: el bloque que lo contiene (ya unido con los descansos
 * pegados por el servidor) reemplaza a los bloques que absorbió, y sus slots
 * pasan a 'descanso' (dejan de ser tocables). Así aparece al instante y ya
 * unido, sin esperar la recarga, que después lo confirma. Si el servidor no
 * devolvió el bloque, se dibuja la fila sola hasta la recarga. Función pura.
 * @param {Object} agenda - de prepararAgenda
 * @param {Object} bloqueOFila - `bloque` de la respuesta o, si vino null, `descanso`
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {Object} la agenda nueva (no muta la recibida)
 */
export function agregarDescanso(agenda, bloqueOFila, fecha) {
  const bloque = aBloque(bloqueOFila, 'descanso', fecha);
  const absorbido = (b) => b.tipo === 'descanso' && bloque.partes.some((p) => p.id === b.id);
  return {
    ...agenda,
    bloques: [...agenda.bloques.filter((b) => !absorbido(b)), bloque],
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
