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
 * PANTALLAS
 * Una entrada por pantalla, indexada por su número.
 * - capitulo: id de CAPITULOS, o null (Bienvenida, Revisión y Listo no muestran
 *   capítulo ni la tarjeta "Tu barbería" arriba).
 * - titulo / subtitulo: el encabezado de la pantalla. Las fases 3 a 5 pueden
 *   ajustarlos al armar el contenido.
 * - textoSeguir: el texto del botón de abajo, o null si la pantalla no lo tiene.
 * - contenido: qué va en la pantalla (plan §5.2). Hasta que la arme su fase, el
 *   placeholder lo muestra.
 */
export const PANTALLAS = [
  { numero: 0,  capitulo: null,        titulo: 'Armemos tu barbería', subtitulo: 'Son unos 5 minutos y se guarda solo.', textoSeguir: 'Empezar',
    contenido: 'Bienvenida.' },
  { numero: 1,  capitulo: 'local',     titulo: '¿Cómo se llama tu barbería?', subtitulo: 'Con el nombre armamos el link de tu barbería.', textoSeguir: 'Seguir',
    contenido: 'Nombre del negocio y el link sugerido (kings.barbermanager.app) con su estado: disponible, ocupado o inválido.' },
  { numero: 2,  capitulo: 'local',     titulo: '¿Dónde queda?', subtitulo: 'La ven tus clientes cuando sacan turno.', textoSeguir: 'Seguir',
    contenido: 'La dirección, en un campo.' },
  { numero: 3,  capitulo: 'local',     titulo: '¿Qué días abren?', subtitulo: 'Tocá los días que atienden.', textoSeguir: 'Seguir',
    contenido: 'Siete botones que se prenden y apagan, más el atajo "Lunes a sábado".' },
  { numero: 4,  capitulo: 'local',     titulo: '¿En qué horario?', subtitulo: 'Si algún día es distinto, tocalo en la semana.', textoSeguir: 'Seguir',
    contenido: 'Abre y cierra con botones de +/- 30 min, la semana en barras y "¿Cierran al mediodía?".' },
  { numero: 5,  capitulo: 'equipo',    titulo: '¿Quiénes cortan?', textoSeguir: 'Seguir',
    contenido: 'Nombre de cada barbero con su avatar, la comisión y el mail opcional.' },
  { numero: 6,  capitulo: 'equipo',    titulo: '¿Quiénes son los dueños?', textoSeguir: 'Seguir',
    contenido: 'Se tocan los avatares de los dueños, más "un dueño que no corta".' },
  { numero: 7,  capitulo: 'equipo',    titulo: '¿Todos trabajan el horario del local?', textoSeguir: 'Seguir',
    contenido: 'Sí: se saltea. No: los días y horarios de cada barbero.' },
  { numero: 8,  capitulo: 'servicios', titulo: '¿Cada cuánto das turnos?', textoSeguir: 'Seguir',
    contenido: 'Botones de 15, 20, 30, 40, 45 y 60 minutos.' },
  { numero: 9,  capitulo: 'servicios', titulo: '¿Qué servicios ofrecés?', textoSeguir: 'Seguir',
    contenido: 'Los servicios comunes con su precio y duración, y "Agregar otro".' },
  { numero: 10, capitulo: 'servicios', titulo: '¿Vendés productos?', textoSeguir: 'Seguir',
    contenido: 'Productos con precio y stock, o "Ahora no".' },
  { numero: 11, capitulo: 'contacto',  titulo: '¿Cómo te contactan tus clientes?', textoSeguir: 'Seguir',
    contenido: 'WhatsApp, "es el mismo número para llamadas" y el link de reseñas.' },
  { numero: 12, capitulo: 'contacto',  titulo: '¿Cómo te contactamos a vos?', textoSeguir: 'Revisar',
    contenido: 'Tu nombre, celular y mail.' },
  { numero: 13, capitulo: null,        titulo: 'Revisá tu barbería', textoSeguir: 'Enviar',
    contenido: 'La tarjeta completa, con "Editar" por bloque.' },
  { numero: 14, capitulo: null,        titulo: '¡Listo!', textoSeguir: null,
    contenido: 'La tilde y qué pasa ahora.' },
];

/**
 * ULTIMA_PANTALLA_GUARDABLE
 * Hasta dónde se guarda el progreso: "Listo" existe solo después de enviar,
 * así que al recargar nunca se retoma ahí.
 */
export const ULTIMA_PANTALLA_GUARDABLE = PANTALLA.REVISION;

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
 * Hoy es 0, 1, …, numero. Cuando una pantalla se pueda saltear (ej. los
 * horarios del equipo si todos trabajan el del local, fase 4), el salto se
 * refleja acá.
 * @param {number} numero - Pantalla donde quedó (datos.progreso.pantalla)
 * @returns {number[]} El camino, que siempre empieza en la bienvenida.
 */
export function caminoHasta(numero) {
  const destino = esPantallaValida(numero) ? numero : PANTALLA.BIENVENIDA;
  return Array.from({ length: destino + 1 }, (_, i) => i);
}
