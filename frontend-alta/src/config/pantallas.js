// /frontend-alta/src/config/pantallas.js
// Las 15 pantallas del formulario y sus 4 capítulos (plan_alta_clientes.md §5.2).
// Una sola fuente para el número de cada pantalla: la navegación, el indicador
// de capítulos, el "Seguir" y el mapa de campo → pantalla de utils/validaciones.js.

/**
 * PANTALLA
 * Número de cada pantalla, para no escribir números sueltos. Es el que se guarda
 * en `datos.progreso.pantalla`.
 */
export const PANTALLA = {
  BIENVENIDA: 0,
  NOMBRE: 1,
  DIRECCION: 2,
  DIAS: 3,
  HORARIO: 4,
  BARBEROS: 5,
  DUENIOS: 6,
  HORARIOS_EQUIPO: 7,
  LARGO_TURNO: 8,
  SERVICIOS: 9,
  PRODUCTOS: 10,
  CONTACTO_LOCAL: 11,
  CONTACTO_DUENIO: 12,
  REVISION: 13,
  LISTO: 14,
};

/**
 * CAPITULOS
 * Los cuatro capítulos, en orden. El indicador muestra el de la pantalla actual
 * en lugar de "paso N de 13". `resumen` es lo que se pregunta en cada uno: lo
 * muestra la bienvenida.
 */
export const CAPITULOS = [
  { id: 'local',     nombre: 'Tu local',      resumen: 'Nombre, link, dirección y horario.' },
  { id: 'equipo',    nombre: 'Tu equipo',     resumen: 'Quiénes cortan y quiénes son los dueños.' },
  { id: 'servicios', nombre: 'Tus servicios', resumen: 'Cada cuánto das turnos, servicios y productos.' },
  { id: 'contacto',  nombre: 'Contacto',      resumen: 'Cómo te encuentran tus clientes y cómo te ubicamos.' },
];

/**
 * tituloHorariosEquipo (interna)
 * El título de la pantalla 7: en singular, con su nombre, si hay un solo barbero.
 * @param {Object} [datos] - El formulario completo
 * @returns {string}
 */
function tituloHorariosEquipo(datos) {
  const barberos = Array.isArray(datos?.barberos) ? datos.barberos : [];
  const nombre = barberos.length === 1 ? (barberos[0]?.nombre ?? '').trim() : '';
  if (barberos.length === 1) return nombre ? `¿${nombre} trabaja el horario del local?` : '¿Trabaja el horario del local?';
  return '¿Todos trabajan el horario del local?';
}

/**
 * PANTALLAS
 * Una entrada por pantalla, indexada por su número.
 * - capitulo: id de CAPITULOS, o null (Bienvenida, Revisión y Listo no muestran
 *   capítulo ni la tarjeta "Tu barbería" arriba).
 * - titulo / subtitulo: el encabezado de la pantalla, un texto o una función
 *   (datos) => texto si depende de lo cargado (ej. la 7, en singular con un
 *   solo barbero). Se leen con textoDe.
 * - textoSeguir: el texto del botón de abajo, o null si la pantalla no lo tiene.
 *   En el modo Editar de la Revisión lo cambia textoSeguirEnEdicion.
 */
export const PANTALLAS = [
  { numero: 0,  capitulo: null,        titulo: 'Armemos tu barbería', subtitulo: 'Son unos 5 minutos y se guarda solo.', textoSeguir: 'Empezar' },
  { numero: 1,  capitulo: 'local',     titulo: '¿Cómo se llama tu barbería?', subtitulo: 'Con el nombre armamos el link de tu barbería.', textoSeguir: 'Seguir' },
  { numero: 2,  capitulo: 'local',     titulo: '¿Dónde queda?', subtitulo: 'La ven tus clientes cuando sacan turno.', textoSeguir: 'Seguir' },
  { numero: 3,  capitulo: 'local',     titulo: '¿Qué días abren?', subtitulo: 'Tocá los días que atienden.', textoSeguir: 'Seguir' },
  { numero: 4,  capitulo: 'local',     titulo: '¿En qué horario?', subtitulo: 'Si algún día es distinto, tocalo en la semana.', textoSeguir: 'Seguir' },
  { numero: 5,  capitulo: 'equipo',    titulo: '¿Quiénes cortan?', subtitulo: 'Sumá a cada barbero con su nombre.', textoSeguir: 'Seguir' },
  { numero: 6,  capitulo: 'equipo',    titulo: '¿Quiénes son los dueños?', subtitulo: 'Tocá a los que son dueños. Pueden ser varios.', textoSeguir: 'Seguir' },
  { numero: 7,  capitulo: 'equipo',    titulo: tituloHorariosEquipo, textoSeguir: 'Seguir' },
  { numero: 8,  capitulo: 'servicios', titulo: '¿Cada cuánto das turnos?', subtitulo: 'Es el espacio más chico de la agenda. Cada servicio ocupa uno o más turnos.', textoSeguir: 'Seguir' },
  { numero: 9,  capitulo: 'servicios', titulo: '¿Qué servicios ofrecés?', subtitulo: 'Tocá los que hacés y poné el precio de cada uno.', textoSeguir: 'Seguir' },
  { numero: 10, capitulo: 'servicios', titulo: '¿Vendés productos?', subtitulo: 'Ceras, shampoos, aceites: lo que vendés en el mostrador.', textoSeguir: 'Seguir' },
  { numero: 11, capitulo: 'contacto',  titulo: '¿Cómo te contactan tus clientes?', subtitulo: 'Lo ven en la página donde sacan turno.', textoSeguir: 'Seguir' },
  { numero: 12, capitulo: 'contacto',  titulo: '¿Cómo te contactamos a vos?', subtitulo: 'Para avisarte cuando tu barbería esté lista.', textoSeguir: 'Revisar' },
  { numero: 13, capitulo: null,        titulo: 'Revisá tu barbería', subtitulo: 'Si algo no está bien, tocá Editar. Cuando esté todo, enviala.', textoSeguir: 'Enviar' },
  { numero: 14, capitulo: null,        titulo: '¡Listo!', textoSeguir: null },
];

/**
 * ULTIMA_PANTALLA_GUARDABLE
 * Hasta dónde se guarda el progreso: "Listo" existe solo después de enviar,
 * así que al recargar nunca se retoma ahí.
 */
export const ULTIMA_PANTALLA_GUARDABLE = PANTALLA.REVISION;

/**
 * textoDe
 * El título o el subtítulo de una pantalla, resuelto con los datos si es una función.
 * @param {string|Function|undefined} valor - pantalla.titulo o pantalla.subtitulo
 * @param {Object} datos - El formulario completo
 * @returns {string|undefined}
 */
export function textoDe(valor, datos) {
  return typeof valor === 'function' ? valor(datos) : valor;
}

/**
 * indiceCapitulo
 * Posición (0 a 3) del capítulo de una pantalla.
 * @param {number} numero - Número de pantalla
 * @returns {number} El índice en CAPITULOS, o -1 si la pantalla no tiene capítulo.
 */
export function indiceCapitulo(numero) {
  const capitulo = PANTALLAS[numero]?.capitulo;
  return CAPITULOS.findIndex((c) => c.id === capitulo);
}

/**
 * esPantallaValida
 * @param {*} valor
 * @returns {boolean} true si es el número de una pantalla que se puede retomar.
 */
export function esPantallaValida(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= ULTIMA_PANTALLA_GUARDABLE;
}

/**
 * caminoHasta
 * Las pantallas por las que se pasa para llegar a `numero`, desde la
 * bienvenida. Al retomar el formulario se rearma el historial con este camino,
 * así el "atrás" vuelve de a un paso aunque se haya recargado.
 * Hoy es 0, 1, …, numero: ninguna pantalla se saltea. Los horarios del equipo
 * (7) tampoco, porque su primera parte es la pregunta "¿Todos trabajan el
 * horario del local?" (fase 4). Si alguna se saltea, el salto va acá.
 * @param {number} numero - Pantalla donde quedó (datos.progreso.pantalla)
 * @returns {number[]} El camino, que siempre empieza en la bienvenida.
 */
export function caminoHasta(numero) {
  const destino = esPantallaValida(numero) ? numero : PANTALLA.BIENVENIDA;
  return Array.from({ length: destino + 1 }, (_, i) => i);
}

// ─── Revisión y modo Editar ─────────────────────────────────────────────────

/**
 * BLOQUES_REVISION
 * Los bloques de la tarjeta completa de la Revisión, cada uno con las
 * pantallas donde se cargan sus datos. "Editar" lleva a la primera.
 */
export const BLOQUES_REVISION = [
  { id: 'local',     titulo: 'Tu local',              pantallas: [PANTALLA.NOMBRE, PANTALLA.DIRECCION] },
  { id: 'horario',   titulo: 'Horario',               pantallas: [PANTALLA.DIAS, PANTALLA.HORARIO] },
  { id: 'equipo',    titulo: 'Equipo',                pantallas: [PANTALLA.BARBEROS, PANTALLA.DUENIOS, PANTALLA.HORARIOS_EQUIPO] },
  { id: 'servicios', titulo: 'Servicios y productos', pantallas: [PANTALLA.LARGO_TURNO, PANTALLA.SERVICIOS, PANTALLA.PRODUCTOS] },
  { id: 'contacto',  titulo: 'Contacto',              pantallas: [PANTALLA.CONTACTO_LOCAL, PANTALLA.CONTACTO_DUENIO] },
];

/**
 * enEdicion
 * El modo Editar: se llegó a la pantalla actual desde la Revisión (con
 * "Editar", o llevado a corregir un error del envío). Se lee de la pila del
 * historial (useNavegacion), así sobrevive a una recarga en la misma pestaña y
 * el "atrás" lo deshace solo.
 * @param {number[]} pila - La pila de pantallas, la actual al final
 * @returns {boolean}
 */
export function enEdicion(pila) {
  if (!Array.isArray(pila) || pila.length < 2) return false;
  const actual = pila[pila.length - 1];
  return actual !== PANTALLA.REVISION && actual !== PANTALLA.LISTO && pila.slice(0, -1).includes(PANTALLA.REVISION);
}

/**
 * siguienteEnEdicion
 * A dónde lleva el "Seguir" en el modo Editar: a la pantalla que sigue dentro
 * del mismo bloque, o de vuelta a la Revisión si era la última del bloque. Así
 * no hace falta recorrer el resto del formulario.
 * @param {number} pantalla - La actual
 * @returns {number} La pantalla siguiente del bloque, o PANTALLA.REVISION.
 */
export function siguienteEnEdicion(pantalla) {
  const bloque = BLOQUES_REVISION.find((b) => b.pantallas.includes(pantalla));
  if (!bloque) return PANTALLA.REVISION;
  const i = bloque.pantallas.indexOf(pantalla);
  return bloque.pantallas[i + 1] ?? PANTALLA.REVISION;
}

/**
 * textoSeguirEnEdicion
 * El texto del botón de abajo según el modo: en Editar, la última pantalla del
 * bloque vuelve a la Revisión y lo dice.
 * @param {number} pantalla
 * @param {boolean} editando - enEdicion(pila)
 * @returns {string|null}
 */
export function textoSeguirEnEdicion(pantalla, editando) {
  if (editando && siguienteEnEdicion(pantalla) === PANTALLA.REVISION) return 'Volver a la revisión';
  return PANTALLAS[pantalla]?.textoSeguir ?? null;
}
