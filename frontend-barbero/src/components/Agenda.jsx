// /frontend-barbero/src/components/Agenda.jsx
// Vista de agenda tipo calendario mobile: timeline vertical con franjas horarias,
// la grilla de slots del barbero (línea punteada en cada inicio de slot), los
// turnos y los bloques de descanso y de ausencia. Navegable por día.
// Todo sale de una sola llamada por día, GET /api/admin/agenda
// (plan_app_barbero.md, Feature 1, fases 3 y 4).
// - Al tocar un turno se abre su detalle; las acciones pasan por ConfirmDialog.
// - Los slots libres y futuros se pueden tocar para elegir un descanso (reglas
//   en utils/seleccionSlots.js); con algo elegido aparece un footer para
//   marcarlo, que confirma con ConfirmDialog.
// - Al tocar un descanso propio se abre su detalle, con "Liberar" (si no empezó)
//   o "Terminar descanso" (si está en curso). Las ausencias se ven, sin acciones:
//   se gestionan en Más → Gestión → Suspensiones.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Check, UserX, Coffee, CalendarOff } from 'lucide-react';

import {
  getAgenda, patchEstadoTurno, cancelarTurno, crearDescanso, liberarSuspension,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtHora, fmtFechaLarga } from '../utils/fecha.js';
import { esSlotTocable, tocarSlot, depurarSeleccion } from '../utils/seleccionSlots.js';

import {
  Skeleton,
  Button,
  ConfirmDialog,
  StatusPill,
  StickyFooter,
  EmptyState,
} from './ui';

// ─── Constantes del timeline ────────────────────────────────────────────────
// La escala vertical (px por hora) depende de la duración del slot del negocio:
// ver calcularPxPorHora.
const PX_POR_HORA_MIN = 80;       // escala de siempre; con slots largos no cambia
const ALTO_MIN_SLOT   = 48;       // alto mínimo de un slot: área táctil ≥ 44 (sistema_de_disenio §5.4)
                                  // y un turno de un solo slot muestra sus dos renglones
const OFFSET_IZQ      = 56;       // ancho reservado para los horarios de los slots
const PADDING_VERTICAL = 8;       // aire arriba y abajo del timeline (la primera celda no queda pegada al borde)
const SEPARACION_CELDAS = 2;      // px entre dos celdas seguidas (slots, turnos, bloques): 1 arriba y 1 abajo

// Alto del skeleton antes de la primera carga (no se sabe todavía el rango del
// día): 15 horas a la escala de siempre.
const ALTO_SKELETON = 15 * PX_POR_HORA_MIN;

// Cada cuánto se actualiza "ahora" con la pantalla abierta: mueve la línea roja
// y deja de ofrecer los slots que ya empezaron.
const INTERVALO_AHORA_MS = 30 * 1000;

// Fondo rayado de las ausencias: lo que las distingue de un descanso además del
// texto y el ícono. Rayas finas en `hairline` sobre `surfaceAlt`.
const FONDO_AUSENCIA = `repeating-linear-gradient(135deg, ${theme.surfaceAlt} 0 8px, ${theme.hairline} 8px 10px)`;

// Si el dispositivo tiene hover de verdad (mouse). En pantallas táctiles iOS
// dispara mouseenter al tocar y el hover queda "pegado" (sistema_de_disenio §9
// #19): los slots y los descansos solo usan hover si esto es true.
const PUEDE_HOVER = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(hover: hover)').matches;

// Cuánto queda a la vista un aviso de error en el footer.
const DURACION_AVISO_MS = 5000;

// Caja de error (carga de la agenda y avisos de acciones).
const ESTILO_ALERTA = {
  background: theme.dangerSoft,
  border: `1px solid ${theme.danger}`,
  borderRadius: theme.radius,
  padding: '10px 12px',
  color: theme.danger,
  fontSize: theme.sizeBody,
};

// Mapa estado → tokens del sistema. La barra lateral usa el color fuerte;
// el fondo del bloque, su variante soft.
const ESTILO_ESTADO = {
  reservado:  { fuerte: theme.accent,  soft: theme.accentSoft  },
  completado: { fuerte: theme.success, soft: theme.successSoft },
  no_asistio: { fuerte: theme.warning, soft: theme.warningSoft },
};

// Config del ConfirmDialog por acción (mismo patrón que Dashboard). `message`
// puede ser una función del rango elegido ({ desde, hasta } en 'HH:MM').
const ACCIONES = {
  marcar_descanso: {
    title: 'Marcar descanso',
    message: ({ desde, hasta }) =>
      `De ${desde} a ${hasta}. Mientras dure, el turnero no ofrece esos horarios.`,
    confirmLabel: 'Sí, marcar',
    confirmVariant: 'primary',
  },
  completar: {
    title: 'Marcar como completado',
    message: '¿Confirmás que ya atendiste este turno?',
    confirmLabel: 'Sí, completar',
    confirmVariant: 'primary',
  },
  no_asistio: {
    title: 'Marcar como no asistió',
    message: 'El cliente no se presentó al turno. ¿Confirmás?',
    confirmLabel: 'Sí, no asistió',
    confirmVariant: 'primary',
  },
  cancelar: {
    title: 'Cancelar turno',
    message: 'El turno se cancela y el cliente queda libre. Esta acción no se puede deshacer.',
    confirmLabel: 'Sí, cancelar',
    confirmVariant: 'danger',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * fechaHoyISO
 * @returns {string} 'YYYY-MM-DD' de hoy en zona local.
 */
function fechaHoyISO() {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
}

/**
 * sumarDias
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {number} dias
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * calcularPxPorHora
 * Escala vertical del timeline. Es la de siempre (80 px/h), salvo que con ella
 * un slot quede más bajo que ALTO_MIN_SLOT: ahí se estira para que cada slot
 * mida al menos eso. `duracion_slot_minutos` es configurable por negocio.
 * Ej.: slots de 15 min → 192 px/h; de 30 → 96; de 45 o más → 80.
 * @param {number|null} duracionSlotMin - duración del slot del negocio, en minutos
 * @returns {number} px por hora
 */
function calcularPxPorHora(duracionSlotMin) {
  if (!duracionSlotMin || duracionSlotMin <= 0) return PX_POR_HORA_MIN;
  return Math.max(PX_POR_HORA_MIN, Math.ceil((ALTO_MIN_SLOT * 60) / duracionSlotMin));
}

/**
 * limitesDelDia
 * Medianoche (hora local) del día y del día siguiente, en ms. Es el origen con
 * el que se ubica cualquier instante en el timeline.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {{ inicioDia: number, finDia: number }} ms epoch
 */
function limitesDelDia(fecha) {
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
function prepararAgenda(data, fecha) {
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
function agregarDescanso(agenda, descanso, fecha) {
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
function unirDescansosSeguidos(bloques) {
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

/**
 * topDesdeMinutos
 * Convierte minutos-del-día a coordenada `top` dentro del timeline.
 * @param {number} minutos - minutos desde la medianoche del día visible
 * @param {number} origen - minuto del día que queda arriba de todo (rango.minInicio)
 * @param {number} pxPorHora - escala vertical (calcularPxPorHora)
 * @returns {number} px
 */
function topDesdeMinutos(minutos, origen, pxPorHora) {
  return PADDING_VERTICAL + ((minutos - origen) / 60) * pxPorHora;
}

/**
 * cajaVertical
 * Posición vertical de algo que va de minInicio a minFin (una celda de slot, un
 * turno, un bloque, la selección), con SEPARACION_CELDAS repartida arriba y
 * abajo: así dos cosas seguidas quedan separadas y cada slot se lee como un bloque.
 * @param {number} minInicio - minutos del día
 * @param {number} minFin - minutos del día
 * @param {number} origen - minuto del día que queda arriba de todo
 * @param {number} pxPorHora - escala vertical
 * @returns {{ top: number, height: number }} px
 */
function cajaVertical(minInicio, minFin, origen, pxPorHora) {
  const margen = SEPARACION_CELDAS / 2;
  return {
    top: topDesdeMinutos(minInicio, origen, pxPorHora) + margen,
    height: ((minFin - minInicio) / 60) * pxPorHora - SEPARACION_CELDAS,
  };
}

/**
 * calcularRango
 * Rango vertical del timeline, en minutos del día: del primer slot (o turno) al
 * último. La agenda se ordena por los slots del barbero: no hay horas en punto
 * ni margen alrededor del horario del local. Los turnos lo agrandan si quedan
 * afuera de la grilla (uno cargado a mano fuera del horario sigue visible). Los
 * descansos y las ausencias no lo agrandan: se recortan (una ausencia de varios
 * días lo estiraría a 24 h).
 * @param {Array<{minInicio: number, minFin: number}>} turnos - turnos visibles del día (no cancelados)
 * @param {Array<{minInicio: number, minFin: number}>} slots - grilla del barbero
 * @returns {{ minInicio: number, minFin: number }|null} null si no hay ni slots ni
 *   turnos (el barbero no trabaja ese día: no hay timeline que dibujar)
 */
function calcularRango(turnos, slots) {
  const tramos = [...turnos, ...slots];
  if (tramos.length === 0) return null;
  return {
    minInicio: Math.max(0, Math.min(...tramos.map((t) => t.minInicio))),
    minFin: Math.min(24 * 60, Math.max(...tramos.map((t) => t.minFin))),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agenda
 * Orquesta la carga de la agenda del día y los modales de detalle/confirmación.
 * No recibe props: el backend toma al barbero del JWT.
 */
export default function Agenda() {
  const [fecha, setFecha] = useState(fechaHoyISO());
  // Agenda del día visible, ya preparada para dibujar (prepararAgenda), o null
  // antes de la primera carga.
  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // "Ahora" en ms, refrescado cada INTERVALO_AHORA_MS: el tiempo corre con la
  // pantalla abierta.
  const [ahora, setAhora] = useState(() => Date.now());

  // Slots elegidos para un descanso (reglas en utils/seleccionSlots.js). Se usa
  // siempre depurada contra lo que se puede tocar ahora (seleccionVigente).
  const [seleccion, setSeleccion] = useState([]);

  // Aviso efímero de error de una acción. Va en el footer y no arriba: así se ve
  // aunque el barbero haya scrolleado. Va aparte de errorCarga para no tapar el
  // timeline.
  const [aviso, setAviso] = useState(null);
  const refTimerAviso = useRef(null);

  const [detalle, setDetalle] = useState(null);                 // turno expandido
  const [descansoDetalle, setDescansoDetalle] = useState(null); // descanso expandido
  const [confirma, setConfirma] = useState({ open: false, accion: null, turno: null });
  const [procesando, setProcesando] = useState(false);

  const refAhora = useRef(null);  // para auto-scroll al indicador de "ahora"
  // Número del último pedido de agenda: si el barbero cambia de día rápido, la
  // respuesta de un pedido viejo se descarta en vez de pisar la del día visible.
  const refPedido = useRef(0);

  const esHoy = fecha === fechaHoyISO();

  /**
   * cargarAgenda
   * Trae la agenda del día seleccionado (turnos, descansos/ausencias y grilla).
   * @param {Object} [opciones]
   * @param {boolean} [opciones.silenciosa=false] - si es true, no muestra el
   *   skeleton (recarga después de una acción, sin que el timeline parpadee)
   */
  const cargarAgenda = useCallback(async ({ silenciosa = false } = {}) => {
    const pedido = ++refPedido.current;
    if (!silenciosa) {
      setCargando(true);
      setErrorCarga(null);
    }
    try {
      const data = await getAgenda(fecha);
      if (pedido !== refPedido.current) return;
      setAgenda(prepararAgenda(data, fecha));
      setErrorCarga(null);
    } catch (err) {
      if (pedido !== refPedido.current) return;
      console.error('[Agenda] Error cargando la agenda:', err.message);
      setErrorCarga('No se pudo cargar la agenda.');
    } finally {
      if (pedido === refPedido.current) setCargando(false);
    }
  }, [fecha]);

  // Al cambiar de día: cargar y olvidar lo que estaba abierto o elegido.
  useEffect(() => {
    cargarAgenda();
    setDetalle(null);
    setDescansoDetalle(null);
    setSeleccion([]);
  }, [cargarAgenda]);

  // Reloj de "ahora".
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), INTERVALO_AHORA_MS);
    return () => clearInterval(id);
  }, []);

  // Al desmontar, cortar el timer del aviso.
  useEffect(() => () => clearTimeout(refTimerAviso.current), []);

  // Auto-scroll al indicador de "ahora" cuando se ve el día de hoy. Corre al
  // terminar una carga con skeleton, no en cada tick del reloj.
  useEffect(() => {
    if (!cargando && esHoy && refAhora.current) {
      refAhora.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [cargando, esHoy]);

  // Slots que se pueden tocar ahora (libres y futuros, D3) y la selección
  // depurada contra ellos: si un slot elegido empezó o se ocupó, sale solo.
  const iniciosTocables = useMemo(
    () => new Set(
      (agenda?.slots ?? []).filter((s) => esSlotTocable(s, ahora)).map((s) => s.inicioMs),
    ),
    [agenda, ahora],
  );
  const seleccionVigente = depurarSeleccion(seleccion, iniciosTocables);
  const rangoSeleccion = seleccionVigente.length > 0
    ? {
      desde: fmtHora(seleccionVigente[0].inicioIso),
      hasta: fmtHora(seleccionVigente[seleccionVigente.length - 1].finIso),
    }
    : null;

  /**
   * mostrarAviso
   * Aviso de error efímero en el footer (DURACION_AVISO_MS). Un aviso nuevo
   * reemplaza al anterior y reinicia el tiempo.
   * @param {string} msg
   */
  const mostrarAviso = useCallback((msg) => {
    clearTimeout(refTimerAviso.current);
    setAviso(msg);
    refTimerAviso.current = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
  }, []);

  /**
   * tocarSlotLibre
   * Suma o saca un slot de la selección con las reglas de D4.
   * @param {Object} slot - slot tocable de la grilla
   */
  const tocarSlotLibre = (slot) => setSeleccion(tocarSlot(seleccionVigente, slot));

  /**
   * pedirConfirmacion
   * Cierra el detalle y abre el ConfirmDialog (evita modal anidado).
   * @param {Object|null} turno - el turno de la acción; null para marcar un descanso
   * @param {string} accion - clave de ACCIONES
   */
  const pedirConfirmacion = (turno, accion) => {
    setDetalle(null);
    setConfirma({ open: true, accion, turno });
  };

  /**
   * cerrarConfirma
   * Cierra el ConfirmDialog.
   */
  const cerrarConfirma = () => setConfirma({ open: false, accion: null, turno: null });

  /**
   * ejecutarAccion
   * Despacha la acción confirmada al endpoint correspondiente y recarga la
   * agenda sin skeleton. El diálogo queda en "Procesando…" mientras responde el
   * servidor.
   * Marcar un descanso: apenas responde el servidor, el descanso se dibuja con
   * esa respuesta (agregarDescanso), sin un rato con el slot vacío mientras se
   * recarga. 409 → "Ese horario se acaba de ocupar" + recarga; 400 → el mensaje
   * del servidor.
   */
  const ejecutarAccion = async () => {
    const { accion, turno } = confirma;
    const esDescanso = accion === 'marcar_descanso';

    // Todos los slots elegidos empezaron mientras el diálogo estaba abierto.
    if (esDescanso && seleccionVigente.length === 0) {
      cerrarConfirma();
      mostrarAviso('Esos horarios ya empezaron. Elegí otros.');
      return;
    }

    let exito = false;
    setProcesando(true);
    try {
      if (esDescanso) {
        const { descanso } = await crearDescanso({
          desde: seleccionVigente[0].inicioIso,
          hasta: seleccionVigente[seleccionVigente.length - 1].finIso,
        });
        setAgenda((actual) => (actual ? agregarDescanso(actual, descanso, fecha) : actual));
        setSeleccion([]);
      } else if (accion === 'cancelar') {
        await cancelarTurno(turno.id);
      } else {
        const nuevoEstado = accion === 'completar' ? 'completado' : 'no_asistio';
        await patchEstadoTurno(turno.id, nuevoEstado);
      }
      exito = true;
    } catch (err) {
      console.error('[Agenda] Error en ejecutarAccion:', err.message);
      cerrarConfirma();
      if (!esDescanso) {
        mostrarAviso(`Error: ${err.message}`);
      } else if (err.status === 409) {
        // Entre la carga de la agenda y ahora, alguien reservó (o se cargó otro
        // bloqueo) en algún slot elegido.
        setSeleccion([]);
        mostrarAviso('Ese horario se acaba de ocupar');
        await cargarAgenda({ silenciosa: true });
      } else if (err.status === 400) {
        mostrarAviso(err.message);
      } else {
        mostrarAviso('No se pudo marcar el descanso. Probá de nuevo.');
      }
    } finally {
      setProcesando(false);
    }

    if (exito) {
      cerrarConfirma();
      await cargarAgenda({ silenciosa: true });
    }
  };

  /**
   * liberarDescanso
   * Libera el descanso abierto en el detalle (DELETE /admin/suspensiones/:id): si
   * no empezó lo anula entero; si está en curso, lo termina ahora (D8). Un
   * descanso unido (unirDescansosSeguidos) son varias filas: se liberan todas las
   * partes que todavía no terminaron (una ya terminada daría 409).
   * El detalle queda en "Procesando…" hasta que la agenda recargada ya no muestra
   * el descanso. Recarga también si falla: pudo haber cambiado (ya liberado, ya terminado).
   */
  const liberarDescanso = async () => {
    const partes = descansoDetalle.partes.filter((p) => p.hastaMs > Date.now());
    setProcesando(true);
    try {
      const resultados = await Promise.allSettled(partes.map((p) => liberarSuspension(p.id)));
      const fallo = resultados.find((r) => r.status === 'rejected');
      if (fallo) {
        const err = fallo.reason;
        console.error('[Agenda] Error en liberarDescanso:', err.message);
        // 4xx: el mensaje del servidor ya es para el usuario ("El descanso ya terminó").
        mostrarAviso(err.status && err.status < 500
          ? err.message
          : 'No se pudo liberar el descanso. Probá de nuevo.');
      }
      await cargarAgenda({ silenciosa: true });
    } finally {
      setProcesando(false);
      setDescansoDetalle(null);
    }
  };

  // Rango vertical y escala del día mostrado. `rango` es null si el barbero no
  // trabaja ese día (sin slots ni turnos). Sin rango, el alto por defecto solo
  // dimensiona el skeleton.
  const rango = useMemo(
    () => (agenda ? calcularRango(agenda.turnos, agenda.slots) : null),
    [agenda],
  );
  const pxPorHora = calcularPxPorHora(agenda?.duracionSlot);
  const altoTotal = rango
    ? 2 * PADDING_VERTICAL + ((rango.minFin - rango.minInicio) / 60) * pxPorHora
    : ALTO_SKELETON;

  // Texto del ConfirmDialog: fijo, o armado con el rango elegido.
  const configConfirma = ACCIONES[confirma.accion];
  let mensajeConfirma = configConfirma?.message || '';
  if (typeof mensajeConfirma === 'function') {
    mensajeConfirma = rangoSeleccion ? mensajeConfirma(rangoSeleccion) : '';
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 16px 24px',
      }}>
        <NavegadorDia
          fecha={fecha}
          esHoy={esHoy}
          onAnterior={() => setFecha(sumarDias(fecha, -1))}
          onSiguiente={() => setFecha(sumarDias(fecha, 1))}
          onHoy={() => setFecha(fechaHoyISO())}
        />

        {/* Pista: solo si hay slots para tocar. Sigue visible con una selección
            hecha: si se fuera al tocar el primero, el timeline saltaría bajo el dedo. */}
        {!cargando && !errorCarga && iniciosTocables.size > 0 && (
          <p style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
          }}>
            Tocá un horario libre para marcar un descanso
          </p>
        )}

        {cargando && <Skeleton height={altoTotal} radius={theme.radius} />}

        {!cargando && errorCarga && (
          <div role="alert" style={ESTILO_ALERTA}>
            {errorCarga}
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" full={false} onClick={() => cargarAgenda()}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {/* Día sin slots ni turnos: no hay timeline que dibujar. El aviso se
            centra en el espacio que queda debajo del navegador de días (flex: 1). */}
        {!cargando && !errorCarga && agenda && !rango && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <EmptyState
              glyph={<CalendarOff size={28} strokeWidth={1.5} aria-hidden="true" />}
              title={agenda.horarioDia ? 'No tenés horario de trabajo este día' : 'El local no abre este día'}
            />
          </div>
        )}

        {!cargando && !errorCarga && agenda && rango && (
          <Timeline
            agenda={agenda}
            fecha={fecha}
            ahora={ahora}
            esHoy={esHoy}
            rango={rango}
            pxPorHora={pxPorHora}
            altoTotal={altoTotal}
            refAhora={refAhora}
            iniciosTocables={iniciosTocables}
            seleccion={seleccionVigente}
            onTocarSlot={tocarSlotLibre}
            onTocarTurno={setDetalle}
            onTocarDescanso={setDescansoDetalle}
          />
        )}
      </div>

      {/* Footer: el descanso elegido y/o el aviso de error de una acción */}
      {(rangoSeleccion || aviso) && (
        <StickyFooter sobreBottomNav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aviso && <div role="alert" style={ESTILO_ALERTA}>{aviso}</div>}
            {rangoSeleccion && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" full={false} onClick={() => setSeleccion([])}>
                  Cancelar
                </Button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Button variant="primary" onClick={() => pedirConfirmacion(null, 'marcar_descanso')}>
                    {`Marcar descanso · ${rangoSeleccion.desde}–${rangoSeleccion.hasta}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </StickyFooter>
      )}

      {/* Modal de detalle del turno */}
      <DetalleTurnoModal
        turno={detalle}
        onCerrar={() => setDetalle(null)}
        onAccion={pedirConfirmacion}
      />

      {/* Modal de detalle del descanso */}
      <DetalleDescansoModal
        descanso={descansoDetalle}
        ahora={ahora}
        procesando={procesando}
        onLiberar={liberarDescanso}
        onCerrar={() => setDescansoDetalle(null)}
      />

      {/* Modal de confirmación de acción */}
      <ConfirmDialog
        open={confirma.open}
        title={configConfirma?.title || ''}
        message={mensajeConfirma}
        confirmLabel={configConfirma?.confirmLabel || 'Confirmar'}
        confirmVariant={configConfirma?.confirmVariant || 'primary'}
        loading={procesando}
        onConfirm={ejecutarAccion}
        onCancel={cerrarConfirma}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NavegadorDia — navegación de fecha (sub-componente local)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * NavegadorDia
 * Flechas ← / → para moverse de a un día + label de fecha (siempre texto plano).
 * Cuando el día visible no es hoy, debajo aparece un botón "Volver a hoy".
 * @param {string} props.fecha
 * @param {boolean} props.esHoy
 * @param {() => void} props.onAnterior
 * @param {() => void} props.onSiguiente
 * @param {() => void} props.onHoy
 */
function NavegadorDia({ fecha, esHoy, onAnterior, onSiguiente, onHoy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: 4,
      }}>
        <FlechaDia onClick={onAnterior} aria="Día anterior">
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>

        <div style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          textTransform: 'capitalize',
        }}>
          {fmtFechaLarga(fecha)}
        </div>

        <FlechaDia onClick={onSiguiente} aria="Día siguiente">
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>
      </div>

      {/* Botón de retorno — sólo visible cuando el día mostrado no es hoy */}
      {!esHoy && (
        <button
          type="button"
          onClick={onHoy}
          style={{
            alignSelf: 'center',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.accent,
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            fontWeight: theme.weightMedium,
            padding: '0 12px',
            borderRadius: theme.radiusSm,
          }}
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}

/**
 * FlechaDia
 * Botón cuadrado 36×36 para las flechas. Hover con useState.
 */
function FlechaDia({ children, onClick, aria }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={aria}
      style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: 'pointer',
        color: theme.inkSoft,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Timeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timeline
 * Dibuja la grilla del barbero (una celda con borde por slot y, a la izquierda,
 * el horario de inicio de cada slot), los slots tocables, la selección, los
 * bloques de descanso y de ausencia, los turnos y el indicador de "ahora".
 * Los horarios de la izquierda son solo los de los slots: con slots de 50 min
 * desde las 08:00 se ve 08:00, 08:50, 09:40… No hay horas en punto.
 * Los turnos se dibujan desde `turnos`, no desde la grilla: la grilla solo marca
 * `turno` en los reservados, y un turno completado tiene que seguir viéndose.
 * @param {Object} props.agenda - de prepararAgenda: { turnos, slots, bloques }
 * @param {string} props.fecha - 'YYYY-MM-DD' del día visible
 * @param {number} props.ahora - "ahora" en ms epoch
 * @param {boolean} props.esHoy
 * @param {{ minInicio: number, minFin: number }} props.rango - de calcularRango
 * @param {number} props.pxPorHora - escala vertical (calcularPxPorHora)
 * @param {number} props.altoTotal - alto del timeline en px
 * @param {React.RefObject} props.refAhora - Ref que se ancla al indicador de ahora.
 * @param {Set<number>} props.iniciosTocables - inicioMs de los slots que se pueden tocar
 * @param {Array} props.seleccion - slots elegidos para un descanso (continuos, ordenados)
 * @param {(slot) => void} props.onTocarSlot
 * @param {(turno) => void} props.onTocarTurno
 * @param {(descanso) => void} props.onTocarDescanso
 */
function Timeline({
  agenda, fecha, ahora, esHoy, rango, pxPorHora, altoTotal, refAhora,
  iniciosTocables, seleccion, onTocarSlot, onTocarTurno, onTocarDescanso,
}) {
  const { turnos, slots, bloques } = agenda;
  const origen = rango.minInicio;
  const iniciosSeleccionados = new Set(seleccion.map((s) => s.inicioMs));

  // Descansos (los pegados, unidos en uno) y ausencias, recortados al rango
  // visible (no lo agrandan).
  const bloquesVisibles = unirDescansosSeguidos(bloques)
    .map((b) => ({
      ...b,
      minInicio: Math.max(b.minInicio, rango.minInicio),
      minFin: Math.min(b.minFin, rango.minFin),
    }))
    .filter((b) => b.minFin > b.minInicio);

  // Posición del indicador de "ahora": solo si cae dentro del rango.
  const minutosAhora = (ahora - limitesDelDia(fecha).inicioDia) / 60000;
  const mostrarAhora = esHoy && minutosAhora >= rango.minInicio && minutosAhora <= rango.minFin;
  const topAhora = topDesdeMinutos(minutosAhora, origen, pxPorHora);

  return (
    <div style={{
      position: 'relative',
      height: altoTotal,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
    }}>
      {/* Grilla: una celda con borde por slot, separada de la siguiente, y su
          horario de inicio a la izquierda (alineado con el primer renglón de un
          turno). Es la única referencia de hora del timeline. */}
      {slots.map((slot) => {
        const caja = cajaVertical(slot.minInicio, slot.minFin, origen, pxPorHora);
        return (
          <div key={`celda-${slot.inicioMs}`}>
            <span style={{
              position: 'absolute',
              left: 8,
              top: caja.top + 4,
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              color: theme.muted,
            }}>
              {fmtHora(slot.inicioIso)}
            </span>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                ...caja,
                left: OFFSET_IZQ + 4,
                right: 4,
                border: `1px solid ${theme.hairline}`,
                borderRadius: theme.radiusSm,
              }}
            />
          </div>
        );
      })}

      {/* Slots libres y futuros: se tocan para elegir un descanso */}
      {slots.filter((s) => iniciosTocables.has(s.inicioMs)).map((slot) => (
        <SlotTocable
          key={slot.inicioMs}
          slot={slot}
          seleccionado={iniciosSeleccionados.has(slot.inicioMs)}
          origen={origen}
          pxPorHora={pxPorHora}
          onTocar={() => onTocarSlot(slot)}
        />
      ))}

      {/* Selección: un solo bloque (fondo + borde de acento) encima de las
          celdas y debajo de los botones de slot: tapa la separación entre celdas,
          así el rango se lee como una pieza, como va a quedar el descanso. */}
      {seleccion.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            ...cajaVertical(seleccion[0].minInicio, seleccion[seleccion.length - 1].minFin, origen, pxPorHora),
            left: OFFSET_IZQ + 4,
            right: 4,
            background: theme.accentSoft,
            border: `2px solid ${theme.accent}`,
            borderRadius: theme.radiusSm,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Descansos y ausencias */}
      {bloquesVisibles.map((bloque) => (
        <BloqueNeutro
          key={bloque.id}
          bloque={bloque}
          origen={origen}
          pxPorHora={pxPorHora}
          onTocar={() => onTocarDescanso(bloque)}
        />
      ))}

      {/* Indicador de "ahora" */}
      {mostrarAhora && (
        <div
          ref={refAhora}
          style={{
            position: 'absolute',
            top: topAhora,
            left: OFFSET_IZQ,
            right: 0,
            borderTop: `2px solid ${theme.danger}`,
            zIndex: 3,
          }}
        >
          <div style={{
            position: 'absolute',
            left: -5,
            top: -5,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: theme.danger,
          }} />
        </div>
      )}

      {/* Bloques de turno */}
      {turnos.map((turno) => (
        <BloqueTurno
          key={turno.id}
          turno={turno}
          origen={origen}
          pxPorHora={pxPorHora}
          onClick={() => onTocarTurno(turno)}
        />
      ))}
    </div>
  );
}

/**
 * BloqueNeutro
 * Bloque de un descanso o de una ausencia (suspensión), posicionado por hora.
 * Neutro, sin color de estado, para no competir con los turnos. Se distinguen
 * entre sí por el texto ("Descanso" / "Ausencia · motivo"), el ícono y el fondo
 * (liso el descanso, rayado la ausencia): el color nunca va solo.
 * El descanso es un botón (abre su detalle); la ausencia no tiene acciones en la
 * Agenda, así que es un bloque sin interacción.
 * Usa la misma geometría que las celdas de la grilla (cajaVertical); el ícono y
 * el texto van centrados en el bloque. Un descanso unido (unirDescansosSeguidos)
 * es un solo bloque.
 * @param {Object} props.bloque - de prepararAgenda, ya recortado al rango visible
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onTocar - solo se usa en los descansos
 */
function BloqueNeutro({ bloque, origen, pxPorHora, onTocar }) {
  const [hover, setHover] = useState(false);
  const esDescanso = bloque.tipo === 'descanso';
  const Icono = esDescanso ? Coffee : CalendarOff;
  const texto = esDescanso
    ? 'Descanso'
    : `Ausencia${bloque.motivo ? ` · ${bloque.motivo}` : ''}`;

  const estilo = {
    position: 'absolute',
    ...cajaVertical(bloque.minInicio, bloque.minFin, origen, pxPorHora),
    left: OFFSET_IZQ + 4,
    right: 4,
    background: esDescanso ? theme.surfaceAlt : FONDO_AUSENCIA,
    border: 'none',
    borderLeft: `3px solid ${esDescanso ? theme.mutedSoft : theme.muted}`,
    borderRadius: theme.radiusSm,
    padding: '4px 8px',
    overflow: 'hidden',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: theme.inkSoft,
  };

  const contenido = (
    <>
      <Icono size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
      {/* minWidth 0: si el texto no entra (motivo largo), se achica con "…"
          en vez de desbordar a los dos lados del centro. */}
      <span style={{
        minWidth: 0,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {texto}
      </span>
    </>
  );

  if (!esDescanso) return <div style={estilo}>{contenido}</div>;

  return (
    <button
      type="button"
      onClick={onTocar}
      onMouseEnter={PUEDE_HOVER ? () => setHover(true) : undefined}
      onMouseLeave={PUEDE_HOVER ? () => setHover(false) : undefined}
      aria-label={`Descanso de ${fmtHora(bloque.desdeIso)} a ${fmtHora(bloque.hastaIso)}`}
      style={{
        ...estilo,
        cursor: 'pointer',
        boxShadow: hover ? theme.shadowSm : 'none',
        transition: `box-shadow ${theme.transitionFast}`,
      }}
    >
      {contenido}
    </button>
  );
}

/**
 * SlotTocable
 * Botón de un slot libre y futuro: tocarlo lo suma o lo saca de la selección
 * para marcar un descanso (reglas en utils/seleccionSlots.js). Ocupa todo el
 * alto del slot (≥ ALTO_MIN_SLOT), así el área táctil no baja de 44 px.
 * Por dentro va vacío: la hora ya está en la columna izquierda, y la pista de
 * arriba del timeline explica que se puede tocar. Elegido, muestra una tilde
 * (el fondo lo pone el bloque de la selección). La hora va en el aria-label.
 * El hover solo se activa en dispositivos con mouse (PUEDE_HOVER): en una
 * pantalla táctil quedaría pegado después de tocar.
 * Ocupa exactamente su celda (cajaVertical): el área táctil es el alto del slot
 * menos la separación entre celdas (≥ 46 px con ALTO_MIN_SLOT de 48).
 * @param {Object} props.slot - slot de la grilla (prepararAgenda)
 * @param {boolean} props.seleccionado
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onTocar
 */
function SlotTocable({ slot, seleccionado, origen, pxPorHora, onTocar }) {
  const [hover, setHover] = useState(false);
  const hora = fmtHora(slot.inicioIso);

  // Seleccionado: el fondo lo pone el bloque de la selección (Timeline).
  const fondo = hover && !seleccionado ? theme.surfaceAlt : 'transparent';

  return (
    <button
      type="button"
      onClick={onTocar}
      onMouseEnter={PUEDE_HOVER ? () => setHover(true) : undefined}
      onMouseLeave={PUEDE_HOVER ? () => setHover(false) : undefined}
      aria-label={`${hora}, libre`}
      aria-pressed={seleccionado}
      style={{
        position: 'absolute',
        ...cajaVertical(slot.minInicio, slot.minFin, origen, pxPorHora),
        left: OFFSET_IZQ + 4,
        right: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 12px',
        background: fondo,
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: 'pointer',
        color: theme.accent,
        outlineOffset: -2,
        zIndex: 1,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {seleccionado && <Check size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}

/**
 * BloqueTurno
 * Bloque clickable posicionado por hora. Fondo soft + barra lateral de color.
 * Usa la misma geometría que las celdas de la grilla (cajaVertical).
 * @param {Object} props.turno - con minInicio/minFin (prepararAgenda)
 * @param {number} props.origen - minuto del día que queda arriba del timeline
 * @param {number} props.pxPorHora - escala vertical
 * @param {() => void} props.onClick
 */
function BloqueTurno({ turno, origen, pxPorHora, onClick }) {
  const [hover, setHover] = useState(false);

  const caja = cajaVertical(turno.minInicio, turno.minFin, origen, pxPorHora);
  const top = caja.top;
  const alto = Math.max(caja.height, 28);

  const estilo = ESTILO_ESTADO[turno.estado] || ESTILO_ESTADO.reservado;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top,
        left: OFFSET_IZQ + 4,
        right: 4,
        height: alto,
        background: estilo.soft,
        borderLeft: `3px solid ${estilo.fuerte}`,
        borderRadius: theme.radiusSm,
        padding: '4px 8px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 1,
        boxShadow: hover ? theme.shadowSm : 'none',
        transition: `box-shadow ${theme.transitionFast}`,
      }}
    >
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeMicro + 1,
        fontWeight: theme.weightMedium,
        color: estilo.fuerte,
        whiteSpace: 'nowrap',
      }}>
        {fmtHora(turno.inicio)}
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeMicro + 1,
        color: theme.inkSoft,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {turno.cliente_nombre || 'Sin nombre'}
        {turno.servicio_nombre && ` · ${turno.servicio_nombre}`}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Modales de detalle (turno y descanso)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModalDetalle
 * Cáscara común de los detalles de la Agenda: overlay, tarjeta centrada,
 * encabezado con título + subtítulo y botón de cerrar. Cierra con Escape y con
 * click afuera, salvo que esté bloqueado (una acción en curso).
 * @param {string} props.etiqueta - aria-label del diálogo (ej. "Detalle del turno")
 * @param {string} props.titulo - título grande (ej. "15:00 – 16:00")
 * @param {ReactNode} [props.subtitulo] - debajo del título (pill, eyebrow)
 * @param {boolean} [props.bloqueado=false] - si es true, no se puede cerrar
 * @param {() => void} props.onCerrar
 * @param {ReactNode} props.children - cuerpo del detalle
 */
function ModalDetalle({ etiqueta, titulo, subtitulo, bloqueado = false, onCerrar, children }) {
  // Cerrar con Escape.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !bloqueado) onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bloqueado, onCerrar]);

  return (
    <div
      onClick={bloqueado ? undefined : onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={etiqueta}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 20,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
        }}
      >
        {/* Encabezado: título + cerrar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeTitle,
              letterSpacing: '-0.02em',
              color: theme.ink,
              lineHeight: 1.1,
            }}>
              {titulo}
            </div>
            {subtitulo && <div style={{ marginTop: 6 }}>{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: bloqueado ? 'not-allowed' : 'pointer',
              color: theme.muted,
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * DetalleTurnoModal
 * Overlay con los datos del turno y, si está reservado, las acciones.
 * No se renderiza si turno es null.
 * @param {Object|null} props.turno
 * @param {() => void} props.onCerrar
 * @param {(turno, accion) => void} props.onAccion
 */
function DetalleTurnoModal({ turno, onCerrar, onAccion }) {
  if (!turno) return null;

  const esReservado = turno.estado === 'reservado';
  // Un turno que aún no empezó sólo puede cancelarse: completarlo o marcarlo
  // como "no vino" no tiene sentido hasta que el turno haya transcurrido.
  const esFuturo = new Date(turno.inicio) > new Date();

  return (
    <ModalDetalle
      etiqueta="Detalle del turno"
      titulo={`${fmtHora(turno.inicio)} – ${fmtHora(turno.fin)}`}
      subtitulo={<StatusPill estado={turno.estado} />}
      onCerrar={onCerrar}
    >
      {/* Datos del turno */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DatoDetalle label="Cliente" valor={turno.cliente_nombre || 'Sin nombre'} />
        {turno.servicio_nombre && <DatoDetalle label="Servicio" valor={turno.servicio_nombre} />}
        {turno.cliente_telefono && (
          <DatoDetalle
            label="Teléfono"
            valor={<a href={`tel:${turno.cliente_telefono}`} style={{ color: theme.accent }}>{turno.cliente_telefono}</a>}
          />
        )}
        {turno.cliente_email && (
          <DatoDetalle
            label="Email"
            valor={<a href={`mailto:${turno.cliente_email}`} style={{ color: theme.accent }}>{turno.cliente_email}</a>}
          />
        )}
      </div>

      {/* Acciones — sólo si está reservado. Turnos futuros: sólo cancelar. */}
      {esReservado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {!esFuturo && (
            <Button variant="primary" onClick={() => onAccion(turno, 'completar')}>
              <Check size={16} strokeWidth={2} aria-hidden="true" />
              Completado
            </Button>
          )}
          {!esFuturo ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button variant="secondary" onClick={() => onAccion(turno, 'no_asistio')}>
                <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
                No asistió
              </Button>
              <Button variant="danger" onClick={() => onAccion(turno, 'cancelar')}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => onAccion(turno, 'cancelar')}>Cancelar</Button>
          )}
        </div>
      )}
    </ModalDetalle>
  );
}

/**
 * DetalleDescansoModal
 * Detalle de un descanso: rango, estado, quién lo marcó y la acción que
 * corresponde (plan_app_barbero.md D8 y D9):
 * - lo marcó el administrador → sin acciones (el barbero no lo puede liberar);
 * - no empezó → "Liberar": lo anula entero;
 * - en curso → "Terminar descanso": termina ahora y lo que queda se vuelve a ofrecer;
 * - ya terminó → sin acciones.
 * Las dos acciones son el mismo endpoint (liberar). No pasan por ConfirmDialog:
 * no tocan a ningún cliente, y tocar el botón dentro del detalle ya es un paso
 * deliberado.
 * No se renderiza si descanso es null.
 * @param {Object|null} props.descanso - bloque de tipo 'descanso' (prepararAgenda)
 * @param {number} props.ahora - "ahora" en ms epoch
 * @param {boolean} props.procesando - si la acción está en curso
 * @param {() => void} props.onLiberar
 * @param {() => void} props.onCerrar
 */
function DetalleDescansoModal({ descanso, ahora, procesando, onLiberar, onCerrar }) {
  if (!descanso) return null;

  const noEmpezo = descanso.desdeMs > ahora;
  const enCurso = !noEmpezo && descanso.hastaMs > ahora;
  const delAdmin = descanso.origen === 'admin';

  let estado = 'Terminó';
  if (noEmpezo) estado = 'Todavía no empezó';
  else if (enCurso) estado = 'En curso';

  const estiloNota = {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.muted,
    lineHeight: 1.5,
  };

  return (
    <ModalDetalle
      etiqueta="Detalle del descanso"
      titulo={`${fmtHora(descanso.desdeIso)} – ${fmtHora(descanso.hastaIso)}`}
      subtitulo={(
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.muted,
        }}>
          Descanso
        </span>
      )}
      bloqueado={procesando}
      onCerrar={onCerrar}
    >
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DatoDetalle label="Estado" valor={estado} />
        <DatoDetalle label="Lo marcó" valor={delAdmin ? 'El administrador' : 'Vos'} />
      </div>

      {delAdmin && (noEmpezo || enCurso) && (
        <p style={{ ...estiloNota, marginTop: 16 }}>
          Solo el administrador lo puede liberar.
        </p>
      )}

      {!delAdmin && (noEmpezo || enCurso) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <p style={estiloNota}>
            {noEmpezo
              ? 'Si lo liberás, esos horarios vuelven a estar disponibles para reservar.'
              : 'Si lo terminás ahora, los horarios que quedan vuelven a estar disponibles para reservar.'}
          </p>
          <Button variant="primary" onClick={onLiberar} disabled={procesando}>
            {procesando ? 'Procesando…' : (noEmpezo ? 'Liberar' : 'Terminar descanso')}
          </Button>
        </div>
      )}
    </ModalDetalle>
  );
}

/**
 * DatoDetalle
 * Fila label / valor dentro de un modal de detalle.
 * @param {string} props.label
 * @param {string|ReactNode} props.valor
 */
function DatoDetalle({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontFamily: theme.mono,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.ink,
        textAlign: 'right',
        wordBreak: 'break-word',
      }}>{valor}</span>
    </div>
  );
}
