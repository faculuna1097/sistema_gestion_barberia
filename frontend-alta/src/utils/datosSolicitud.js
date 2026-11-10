// /frontend-alta/src/utils/datosSolicitud.js
// La forma de `datos` de una solicitud de alta (plan_alta_clientes.md §5.6):
// un único objeto que viaja entero en cada guardado. Al enviar, el backend
// guarda solo estas claves: un dato de interfaz que haya que conservar (ej. "es
// el mismo número") va dentro de `progreso`.
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * VERSION_DATOS
 * Versión de la forma. El backend rechaza el envío de otra versión
 * (validarSolicitudAlta.js, VERSION_DATOS).
 */
export const VERSION_DATOS = 1;

/**
 * esObjeto (interna)
 * @param {*} valor
 * @returns {boolean} true si es un objeto JSON: ni null ni array.
 */
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

/**
 * datosIniciales
 * El formulario vacío, como lo arranca un link nuevo (el backend crea la
 * solicitud con `datos = {}`). Los textos arrancan en '' (los inputs son
 * controlados) y lo que todavía no se eligió, en null o en una lista vacía.
 * Las horas van en 'HH:MM' y dia_semana de 0 a 6 (0 = domingo), como en la DB.
 * @returns {Object} Un objeto nuevo en cada llamada.
 */
export function datosIniciales() {
  return {
    version: VERSION_DATOS,
    local: {
      nombre: '',
      subdominio: '',
      direccion: '',
      telefono: '',
      whatsapp: '',
      resena_url: '',
      horario: [],      // [{ dia_semana, hora_inicio, hora_fin }]
      pausa: null,      // { hora_inicio, hora_fin } | null
    },
    turno: { duracion_minutos: null },
    // [{ clave, nombre, comision, email, es_duenio, horario: 'igual_local' | [{ dia_semana, hora_inicio, hora_fin }] }]
    barberos: [],
    duenios_sin_corte: [],   // [{ nombre }]
    servicios: [],           // [{ nombre, precio, cantidad_slots }]
    productos: [],           // [{ nombre, precio, stock, stock_minimo }]
    contacto: { nombre: '', celular: '', email: '' },
    // Para retomar donde quedó, y los datos de interfaz que haya que conservar.
    progreso: { pantalla: 0 },
  };
}

/**
 * completarDatos
 * Lleva lo que vino del backend a la forma completa: arranca de
 * datosIniciales y le pone encima lo guardado, sección por sección. Así el
 * formulario puede leer `datos.local.nombre` aunque el link sea nuevo
 * (`datos = {}`) o lo guardado sea de antes de sumar un campo. Lo que no tiene
 * el tipo esperado (ej. una lista que no es lista) queda con el valor inicial.
 * @param {*} guardados - El `datos` de GET /api/alta/:token
 * @returns {Object} Los datos completos, con version = VERSION_DATOS.
 */
export function completarDatos(guardados) {
  const base = datosIniciales();
  const g = esObjeto(guardados) ? guardados : {};
  const lista = (valor) => (Array.isArray(valor) ? valor : []);
  const local = esObjeto(g.local) ? g.local : {};

  return {
    ...base,
    version: VERSION_DATOS,
    local: {
      ...base.local,
      ...local,
      horario: lista(local.horario),
      pausa: esObjeto(local.pausa) ? local.pausa : null,
    },
    turno: { ...base.turno, ...(esObjeto(g.turno) ? g.turno : {}) },
    barberos: lista(g.barberos),
    duenios_sin_corte: lista(g.duenios_sin_corte),
    servicios: lista(g.servicios),
    productos: lista(g.productos),
    contacto: { ...base.contacto, ...(esObjeto(g.contacto) ? g.contacto : {}) },
    progreso: { ...base.progreso, ...(esObjeto(g.progreso) ? g.progreso : {}) },
  };
}
