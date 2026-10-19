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
 * Función pura.
 * @param {Object} data - respuesta de getAgenda
 * @param {string} fecha - 'YYYY-MM-DD' del día visible
 * @returns {{ turnos: Array, slots: Array, bloques: Array, horarioDia: Object|null, duracionSlot: number|null }}
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

  return {
    turnos,
    slots,
    bloques,
    horarioDia: data.horario_atencion,
    duracionSlot: data.duracion_slot_minutos,
  };
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
 * - otro estado ('completado', 'no_asistio'): el turno queda con ese estado.
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
