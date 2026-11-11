// /backend/src/utils/validarSolicitudAlta.js
// Validación completa del `datos` de una solicitud de alta (formulario de alta de
// clientes, plan_alta_clientes.md §5.4 y §5.6), que corre al enviar. Devuelve
// todos los errores juntos, cada uno con la ruta del campo ('barberos.1.comision')
// y un mensaje en español para mostrarle al cliente tal cual, en el orden en que
// aparecen en el formulario: así el front puede llevar al primero.
//
// Además normaliza: recorta los textos, pasa los números a number y se queda solo
// con las claves conocidas. Lo que se guarda al enviar es ese resultado, así lo
// validado es exactamente lo que queda en la DB.
//
// frontend-alta tiene su copia de estas reglas (src/utils/validaciones.js): si
// cambian acá, cambian allá.

import { esEmailValido, esTelefonoE164, esUrlHttps, MAX_NOMBRE } from './validarTexto.js';
import { esMontoPositivo, esEnteroNoNegativo, esCantidadValida, MONTO_MAXIMO } from './validarNumero.js';
import { esHoraValida } from './validarFecha.js';
import { motivoFormatoSubdominio, subdominioOcupado, MENSAJES_SUBDOMINIO } from './subdominio.js';

// Versión de la forma de `datos` que entiende este validador.
export const VERSION_DATOS = 1;
// Largos de turno que se pueden elegir (tenant.duracion_slot_minutos): de
// TURNO_MINIMO a TURNO_MAXIMO minutos, de a PASO_TURNO (10, 15, …, 60). El
// front los elige con una barra que salta de a 5.
export const TURNO_MINIMO = 10;
export const TURNO_MAXIMO = 60;
export const PASO_TURNO = 5;
export const DURACIONES_TURNO = Array.from(
  { length: (TURNO_MAXIMO - TURNO_MINIMO) / PASO_TURNO + 1 },
  (_, i) => TURNO_MINIMO + i * PASO_TURNO,
);

const LARGO_NOMBRE_NEGOCIO = { min: 2, max: 60 };
const LARGO_DIRECCION = { min: 5, max: 120 };
const LARGO_NOMBRE_PERSONA = { min: 2, max: MAX_NOMBRE };
const LARGO_NOMBRE_ITEM = { min: 2, max: 40 };
const COMISION_MAXIMA = 100;
const SLOTS_MAXIMOS = 20; // servicio.cantidad_slots
// Los precios son enteros: el mayor que entra en numeric(10,2).
const PRECIO_MAXIMO = Math.floor(MONTO_MAXIMO);
const PRECIO_MAXIMO_TEXTO = PRECIO_MAXIMO.toLocaleString('es-AR');
// Atención mínima que tiene que quedar antes y después de la pausa del mediodía.
const MARGEN_PAUSA_MINUTOS = 30;

// dia_semana como en la DB: 0 = domingo.
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Orden en que se nombran los días en los mensajes: de lunes a domingo.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

/**
 * esObjetoPlano
 * Indica si un valor es un objeto JSON: ni null ni array.
 * @param {*} valor
 * @returns {boolean} true si es un objeto plano.
 */
export function esObjetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/**
 * mayuscula
 * Pone en mayúscula la primera letra de un texto (para armar mensajes desde una etiqueta).
 * @param {string} texto
 * @returns {string} El texto con la primera letra en mayúscula.
 */
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * recortar
 * Recorta un texto y lo trata como faltante si queda vacío.
 * @param {*} valor
 * @returns {string|null} El texto recortado, o null si no es texto o queda vacío.
 */
const recortar = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null);

/**
 * faltaValor
 * Indica si un campo opcional vino vacío.
 * @param {*} valor
 * @returns {boolean} true si es undefined, null o un texto vacío (o solo espacios).
 */
const faltaValor = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

/**
 * aMinutos
 * Pasa una hora 'HH:MM' a minutos desde la medianoche.
 * @param {string} hora - Hora ya validada.
 * @returns {number}
 */
const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * esDiaSemana
 * @param {*} valor
 * @returns {boolean} true si es un entero de 0 (domingo) a 6 (sábado).
 */
const esDiaSemana = (valor) => Number.isInteger(valor) && valor >= 0 && valor <= 6;

/**
 * crearValidador
 * Arma el acumulador de errores y los validadores de campo que lo usan. Cada
 * validador agrega su error (si hay) y devuelve el valor normalizado.
 * @returns {Object} { errores, agregar, texto, telefono, email, hora, precio }
 */
function crearValidador() {
  const errores = [];

  /**
   * agregar — suma un error.
   * @param {string} campo - Ruta del campo desde la raíz de datos.
   * @param {string} mensaje - Texto para el cliente.
   */
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });

  /**
   * texto — texto obligatorio con largo mínimo y máximo.
   * @param {string} campo
   * @param {*} valor
   * @param {Object} opciones - { etiqueta ('el nombre del barbero'), min, max, unidad ('letras' o 'caracteres') }
   * @returns {string|null} El texto recortado, o null si falta.
   */
  const texto = (campo, valor, { etiqueta, min, max, unidad = 'letras' }) => {
    const recortado = recortar(valor);
    if (recortado === null) {
      agregar(campo, `Completá ${etiqueta}.`);
    } else if (recortado.length < min) {
      agregar(campo, `${mayuscula(etiqueta)} tiene que tener al menos ${min} ${unidad}.`);
    } else if (recortado.length > max) {
      agregar(campo, `${mayuscula(etiqueta)} puede tener hasta ${max} ${unidad}.`);
    }
    return recortado;
  };

  /**
   * telefono — teléfono obligatorio en E.164 (el front lo formatea con libphonenumber-js).
   * @param {string} campo
   * @param {*} valor
   * @param {string} etiqueta - Ej. 'el WhatsApp del local'.
   * @returns {string|null} El teléfono recortado, o null si falta.
   */
  const telefono = (campo, valor, etiqueta) => {
    const recortado = recortar(valor);
    if (recortado === null) agregar(campo, `Completá ${etiqueta}.`);
    else if (!esTelefonoE164(recortado)) agregar(campo, `${mayuscula(etiqueta)} no es un número válido.`);
    return recortado;
  };

  /**
   * email — mail, obligatorio u opcional.
   * @param {string} campo
   * @param {*} valor
   * @param {string} etiqueta - Ej. 'tu mail'.
   * @param {boolean} requerido
   * @returns {string|null} El mail recortado, o null si falta.
   */
  const email = (campo, valor, etiqueta, requerido) => {
    if (faltaValor(valor)) {
      if (requerido) agregar(campo, `Completá ${etiqueta}.`);
      return null;
    }
    const recortado = typeof valor === 'string' ? valor.trim() : null;
    if (!esEmailValido(recortado)) agregar(campo, `${mayuscula(etiqueta)} no es válido.`);
    return recortado;
  };

  /**
   * hora — hora 'HH:MM' en punto o y media (los botones del formulario van de a 30 min).
   * @param {string} campo
   * @param {*} valor
   * @param {string} etiqueta - Ej. 'la hora de apertura'.
   * @returns {string|null} La hora si es válida, o null.
   */
  const hora = (campo, valor, etiqueta) => {
    if (faltaValor(valor)) {
      agregar(campo, `Elegí ${etiqueta}.`);
      return null;
    }
    // esHoraValida también acepta 'HH:MM:SS': acá se exige la forma corta.
    if (!esHoraValida(valor) || valor.length !== 5) {
      agregar(campo, `${mayuscula(etiqueta)} no es válida.`);
      return null;
    }
    if (!valor.endsWith(':00') && !valor.endsWith(':30')) {
      agregar(campo, `${mayuscula(etiqueta)} tiene que ser en punto o y media.`);
      return null;
    }
    return valor;
  };

  /**
   * precio — entero mayor a 0, hasta PRECIO_MAXIMO.
   * @param {string} campo
   * @param {*} valor
   * @returns {number|null} El precio como number, o null si no es válido.
   */
  const precio = (campo, valor) => {
    if (faltaValor(valor)) {
      agregar(campo, 'Completá el precio.');
      return null;
    }
    if (!esMontoPositivo(valor) || !Number.isInteger(Number(valor))) {
      agregar(campo, 'El precio tiene que ser un número entero mayor a 0.');
      return null;
    }
    if (Number(valor) > PRECIO_MAXIMO) {
      agregar(campo, `El precio no puede superar $ ${PRECIO_MAXIMO_TEXTO}.`);
      return null;
    }
    return Number(valor);
  };

  return { errores, agregar, texto, telefono, email, hora, precio };
}

/**
 * validarHorarioLocal
 * Valida local.horario: al menos un día, sin días repetidos, y en cada día un
 * cierre posterior a la apertura.
 * @param {Object} v - Validador (crearValidador).
 * @param {*} horario - local.horario crudo.
 * @returns {{ horario: Array, diasDeclarados: Set<number>, rangos: Map<number, {inicio: string, fin: string}> }}
 *   El horario normalizado, los días que el local dice abrir (aunque su rango tenga
 *   errores) y los rangos válidos por día, para validar la pausa y a los barberos.
 */
function validarHorarioLocal(v, horario) {
  const diasDeclarados = new Set();
  const rangos = new Map();
  if (!Array.isArray(horario) || horario.length === 0) {
    v.agregar('local.horario', 'Elegí al menos un día de atención.');
    return { horario: [], diasDeclarados, rangos };
  }

  const normalizado = horario.map((dia, i) => {
    const base = `local.horario.${i}`;
    if (!esObjetoPlano(dia)) {
      v.agregar(base, 'El horario de este día no es válido.');
      return null;
    }
    let diaValido = esDiaSemana(dia.dia_semana);
    if (!diaValido) {
      v.agregar(`${base}.dia_semana`, 'El día no es válido.');
    } else if (diasDeclarados.has(dia.dia_semana)) {
      v.agregar(`${base}.dia_semana`, `El ${NOMBRES_DIA[dia.dia_semana]} está repetido.`);
      diaValido = false;
    } else {
      diasDeclarados.add(dia.dia_semana);
    }
    const inicio = v.hora(`${base}.hora_inicio`, dia.hora_inicio, 'la hora de apertura');
    const fin = v.hora(`${base}.hora_fin`, dia.hora_fin, 'la hora de cierre');
    if (inicio && fin && fin <= inicio) {
      v.agregar(`${base}.hora_fin`, 'El cierre tiene que ser después de la apertura.');
    } else if (diaValido && inicio && fin) {
      rangos.set(dia.dia_semana, { inicio, fin });
    }
    return { dia_semana: dia.dia_semana, hora_inicio: inicio, hora_fin: fin };
  });

  return { horario: normalizado, diasDeclarados, rangos };
}

/**
 * validarPausa
 * Valida la pausa del mediodía (opcional, la misma para todos los días): si
 * viene, tiene que quedar dentro del rango de cada día abierto, dejando al menos
 * MARGEN_PAUSA_MINUTOS de atención antes y después.
 * @param {Object} v - Validador.
 * @param {*} pausa - local.pausa cruda (null si no cierran al mediodía).
 * @param {Map} rangos - Rangos válidos del local por día (validarHorarioLocal).
 * @returns {{hora_inicio: string, hora_fin: string}|null} La pausa normalizada, o null.
 */
function validarPausa(v, pausa, rangos) {
  if (pausa === undefined || pausa === null) return null;
  if (!esObjetoPlano(pausa)) {
    v.agregar('local.pausa', 'La pausa del mediodía no es válida.');
    return null;
  }
  const inicio = v.hora('local.pausa.hora_inicio', pausa.hora_inicio, 'el inicio de la pausa');
  const fin = v.hora('local.pausa.hora_fin', pausa.hora_fin, 'el fin de la pausa');
  if (!inicio || !fin) return null;
  if (fin <= inicio) {
    v.agregar('local.pausa.hora_fin', 'La pausa tiene que terminar después de empezar.');
    return null;
  }

  // Se nombra el primer día (de lunes a domingo) en el que no entra.
  const diaQueNoEntra = ORDEN_DIAS.find((dia) => {
    const rango = rangos.get(dia);
    if (!rango) return false;
    return aMinutos(inicio) - aMinutos(rango.inicio) < MARGEN_PAUSA_MINUTOS
      || aMinutos(rango.fin) - aMinutos(fin) < MARGEN_PAUSA_MINUTOS;
  });
  if (diaQueNoEntra !== undefined) {
    const rango = rangos.get(diaQueNoEntra);
    v.agregar('local.pausa', `La pausa tiene que quedar dentro del horario del ${NOMBRES_DIA[diaQueNoEntra]} `
      + `(${rango.inicio} a ${rango.fin}), con al menos ${MARGEN_PAUSA_MINUTOS} minutos de atención antes y después.`);
  }
  return { hora_inicio: inicio, hora_fin: fin };
}

/**
 * validarHorarioBarbero
 * Valida el horario de un barbero: 'igual_local', o una lista de bloques con al
 * menos uno, cada uno dentro del horario del local ese día y sin superponerse con
 * otro bloque del mismo día (pegados sí: uno termina 13:00 y el otro empieza 13:00).
 * @param {Object} v - Validador.
 * @param {string} campo - Ruta del horario ('barberos.0.horario').
 * @param {*} horario - Horario crudo del barbero.
 * @param {Object} local - { diasDeclarados, rangos } de validarHorarioLocal.
 * @returns {string|Array|null} 'igual_local', los bloques normalizados, o null si no es válido.
 */
function validarHorarioBarbero(v, campo, horario, { diasDeclarados, rangos }) {
  if (horario === 'igual_local') return 'igual_local';
  if (!Array.isArray(horario)) {
    v.agregar(campo, 'Elegí el horario de este barbero.');
    return null;
  }
  if (horario.length === 0) {
    v.agregar(campo, 'Elegí al menos un día para este barbero.');
    return [];
  }

  const bloquesPorDia = new Map();
  const normalizado = horario.map((bloque, j) => {
    const base = `${campo}.${j}`;
    if (!esObjetoPlano(bloque)) {
      v.agregar(base, 'Este horario no es válido.');
      return null;
    }
    const dia = bloque.dia_semana;
    const diaValido = esDiaSemana(dia);
    if (!diaValido) v.agregar(`${base}.dia_semana`, 'El día no es válido.');
    const inicio = v.hora(`${base}.hora_inicio`, bloque.hora_inicio, 'la hora de entrada');
    const fin = v.hora(`${base}.hora_fin`, bloque.hora_fin, 'la hora de salida');

    if (inicio && fin && fin <= inicio) {
      v.agregar(`${base}.hora_fin`, 'La salida tiene que ser después de la entrada.');
    } else if (diaValido && !diasDeclarados.has(dia)) {
      v.agregar(`${base}.dia_semana`, `El local no abre el ${NOMBRES_DIA[dia]}.`);
    } else if (diaValido && inicio && fin && rangos.has(dia)) {
      // Si el rango del local ese día tiene errores, ya se marcaron allá: no se repiten acá.
      const local = rangos.get(dia);
      const fuera = `Tiene que estar dentro del horario del local el ${NOMBRES_DIA[dia]} (${local.inicio} a ${local.fin}).`;
      if (inicio < local.inicio) v.agregar(`${base}.hora_inicio`, fuera);
      else if (fin > local.fin) v.agregar(`${base}.hora_fin`, fuera);
      else {
        if (!bloquesPorDia.has(dia)) bloquesPorDia.set(dia, []);
        bloquesPorDia.get(dia).push({ inicio, fin, j });
      }
    }
    return { dia_semana: dia, hora_inicio: inicio, hora_fin: fin };
  });

  // Superposición: ordenados por inicio, un bloque choca si empieza antes de que
  // termine alguno anterior del mismo día. Se marca el que choca.
  for (const bloques of bloquesPorDia.values()) {
    bloques.sort((a, b) => a.inicio.localeCompare(b.inicio));
    let finMaximo = null;
    for (const bloque of bloques) {
      if (finMaximo !== null && bloque.inicio < finMaximo) {
        v.agregar(`${campo}.${bloque.j}`, 'Se superpone con otro horario del mismo día.');
      }
      if (finMaximo === null || bloque.fin > finMaximo) finMaximo = bloque.fin;
    }
  }

  return normalizado;
}

/**
 * validarBarberos
 * Valida la lista de barberos: al menos uno, nombres y mails sin repetir (sin
 * importar mayúsculas) y comisión entera de 0 a 100. El horario de cada uno queda
 * crudo: lo valida validarHorariosEquipo.
 * @param {Object} v - Validador.
 * @param {*} barberos - datos.barberos crudo.
 * @returns {Array} Los barberos normalizados (null en los que no son un objeto).
 */
function validarBarberos(v, barberos) {
  if (!Array.isArray(barberos) || barberos.length === 0) {
    v.agregar('barberos', 'Agregá al menos un barbero.');
    return [];
  }
  const nombres = new Set();
  const emails = new Set();

  return barberos.map((barbero, i) => {
    const base = `barberos.${i}`;
    if (!esObjetoPlano(barbero)) {
      v.agregar(base, 'Los datos de este barbero no son válidos.');
      return null;
    }

    const nombre = v.texto(`${base}.nombre`, barbero.nombre, { etiqueta: 'el nombre del barbero', ...LARGO_NOMBRE_PERSONA });
    if (nombre) {
      const clave = nombre.toLocaleLowerCase('es');
      if (nombres.has(clave)) v.agregar(`${base}.nombre`, 'Ya hay un barbero con ese nombre.');
      nombres.add(clave);
    }

    const comisionValida = esEnteroNoNegativo(barbero.comision) && Number(barbero.comision) <= COMISION_MAXIMA;
    if (!comisionValida) {
      v.agregar(`${base}.comision`, `La comisión tiene que ser un número entero de 0 a ${COMISION_MAXIMA}.`);
    }

    const email = v.email(`${base}.email`, barbero.email, 'el mail del barbero', false);
    if (email && esEmailValido(email)) {
      const clave = email.toLowerCase();
      if (emails.has(clave)) v.agregar(`${base}.email`, 'Ese mail ya lo tiene otro barbero.');
      emails.add(clave);
    }

    return {
      clave: barbero.clave,
      nombre,
      comision: comisionValida ? Number(barbero.comision) : null,
      email,
      es_duenio: barbero.es_duenio === true,
      // El horario se valida aparte (validarHorariosEquipo): va después de los dueños en el formulario.
      horario: barbero.horario,
    };
  });
}

/**
 * validarDuenios
 * Valida los dueños que no cortan y que haya al menos un dueño en total (barberos
 * con es_duenio más duenios_sin_corte). Cada dueño es un socio, y socio tiene
 * UNIQUE (tenant_id, nombre): los nombres no se repiten entre los barberos dueños
 * y los que no cortan, sin importar mayúsculas.
 * @param {Object} v - Validador.
 * @param {*} duenios - datos.duenios_sin_corte crudo (puede faltar).
 * @param {Array} barberos - Barberos ya normalizados (validarBarberos).
 * @returns {Array} Los dueños que no cortan, normalizados.
 */
function validarDuenios(v, duenios, barberos) {
  const lista = duenios === undefined || duenios === null ? [] : duenios;
  if (!Array.isArray(lista)) {
    v.agregar('duenios_sin_corte', 'La lista de dueños no es válida.');
    return [];
  }

  const barberosDuenios = barberos.filter((b) => b?.es_duenio);
  // Los nombres repetidos entre barberos ya se marcan en validarBarberos.
  const nombres = new Set(barberosDuenios.filter((b) => b.nombre).map((b) => b.nombre.toLocaleLowerCase('es')));

  const normalizado = lista.map((duenio, k) => {
    const base = `duenios_sin_corte.${k}`;
    if (!esObjetoPlano(duenio)) {
      v.agregar(base, 'Los datos de este dueño no son válidos.');
      return null;
    }
    const nombre = v.texto(`${base}.nombre`, duenio.nombre, { etiqueta: 'el nombre del dueño', ...LARGO_NOMBRE_PERSONA });
    if (nombre) {
      const clave = nombre.toLocaleLowerCase('es');
      if (nombres.has(clave)) v.agregar(`${base}.nombre`, 'Ese dueño ya está cargado.');
      nombres.add(clave);
    }
    return { nombre };
  });

  if (barberosDuenios.length + lista.length === 0) {
    v.agregar('duenios_sin_corte', 'Marcá al menos un dueño.');
  }
  return normalizado;
}

/**
 * validarHorariosEquipo
 * Valida y normaliza el horario de cada barbero (validarHorarioBarbero), sobre
 * los barberos ya normalizados.
 * @param {Object} v - Validador.
 * @param {Array} barberos - Barberos de validarBarberos (se modifican en el lugar).
 * @param {Object} local - { diasDeclarados, rangos } de validarHorarioLocal.
 */
function validarHorariosEquipo(v, barberos, local) {
  barberos.forEach((barbero, i) => {
    if (barbero) barbero.horario = validarHorarioBarbero(v, `barberos.${i}.horario`, barbero.horario, local);
  });
}

/**
 * validarServicios
 * Valida los servicios: al menos uno, nombre sin repetir, precio y duración en
 * turnos (cantidad_slots de 1 a 20).
 * @param {Object} v - Validador.
 * @param {*} servicios - datos.servicios crudo.
 * @returns {Array} Los servicios normalizados.
 */
function validarServicios(v, servicios) {
  if (!Array.isArray(servicios) || servicios.length === 0) {
    v.agregar('servicios', 'Agregá al menos un servicio.');
    return [];
  }
  const nombres = new Set();
  return servicios.map((servicio, i) => {
    const base = `servicios.${i}`;
    if (!esObjetoPlano(servicio)) {
      v.agregar(base, 'Los datos de este servicio no son válidos.');
      return null;
    }
    const nombre = v.texto(`${base}.nombre`, servicio.nombre, { etiqueta: 'el nombre del servicio', ...LARGO_NOMBRE_ITEM });
    if (nombre) {
      const clave = nombre.toLocaleLowerCase('es');
      if (nombres.has(clave)) v.agregar(`${base}.nombre`, 'Ya hay un servicio con ese nombre.');
      nombres.add(clave);
    }
    const precio = v.precio(`${base}.precio`, servicio.precio);
    const slotsValidos = esCantidadValida(servicio.cantidad_slots) && Number(servicio.cantidad_slots) <= SLOTS_MAXIMOS;
    if (!slotsValidos) v.agregar(`${base}.cantidad_slots`, 'Elegí la duración del servicio.');
    return { nombre, precio, cantidad_slots: slotsValidos ? Number(servicio.cantidad_slots) : null };
  });
}

/**
 * validarProductos
 * Valida los productos (opcionales): nombre sin repetir, precio, y stock y stock
 * mínimo enteros de 0 en adelante.
 * @param {Object} v - Validador.
 * @param {*} productos - datos.productos crudo (puede faltar).
 * @returns {Array} Los productos normalizados.
 */
function validarProductos(v, productos) {
  if (productos === undefined || productos === null) return [];
  if (!Array.isArray(productos)) {
    v.agregar('productos', 'La lista de productos no es válida.');
    return [];
  }
  const nombres = new Set();
  return productos.map((producto, i) => {
    const base = `productos.${i}`;
    if (!esObjetoPlano(producto)) {
      v.agregar(base, 'Los datos de este producto no son válidos.');
      return null;
    }
    const nombre = v.texto(`${base}.nombre`, producto.nombre, { etiqueta: 'el nombre del producto', ...LARGO_NOMBRE_ITEM });
    if (nombre) {
      const clave = nombre.toLocaleLowerCase('es');
      if (nombres.has(clave)) v.agregar(`${base}.nombre`, 'Ya hay un producto con ese nombre.');
      nombres.add(clave);
    }
    const precio = v.precio(`${base}.precio`, producto.precio);
    const stockValido = esEnteroNoNegativo(producto.stock);
    if (!stockValido) v.agregar(`${base}.stock`, 'El stock tiene que ser un número entero, 0 o más.');
    const minimoValido = esEnteroNoNegativo(producto.stock_minimo);
    if (!minimoValido) v.agregar(`${base}.stock_minimo`, 'El stock mínimo tiene que ser un número entero, 0 o más.');
    return {
      nombre,
      precio,
      stock: stockValido ? Number(producto.stock) : null,
      stock_minimo: minimoValido ? Number(producto.stock_minimo) : null,
    };
  });
}

/**
 * validarDatosSolicitud
 * Valida y normaliza el `datos` de una solicitud con todas las reglas de §5.4,
 * sin tocar la DB: si el subdominio está ocupado lo recibe ya consultado.
 * `progreso` no se valida y se guarda como vino.
 * @param {Object} datos - El `datos` del body (ya se sabe que es un objeto plano).
 * @param {Object} opciones
 * @param {boolean} opciones.subdominioOcupado - Si un tenant ya usa local.subdominio.
 * @returns {{ errores: Array<{campo: string, mensaje: string}>, datos: Object }}
 *   Los errores (vacío si pasa) y el datos normalizado (sirve solo si no hay errores).
 */
export function validarDatosSolicitud(datos, { subdominioOcupado: ocupado }) {
  const v = crearValidador();

  if (datos.version !== VERSION_DATOS) {
    v.agregar('version', 'El formulario está desactualizado. Recargá la página y probá de nuevo.');
  }

  // ── Tu local ──────────────────────────────────────────────────────────────
  const local = esObjetoPlano(datos.local) ? datos.local : {};
  const nombreNegocio = v.texto('local.nombre', local.nombre, { etiqueta: 'el nombre del negocio', ...LARGO_NOMBRE_NEGOCIO });

  const subdominio = recortar(local.subdominio);
  if (subdominio === null) {
    v.agregar('local.subdominio', 'Elegí el link de tu barbería.');
  } else {
    const motivo = motivoFormatoSubdominio(subdominio) ?? (ocupado ? 'ocupado' : null);
    if (motivo) v.agregar('local.subdominio', MENSAJES_SUBDOMINIO[motivo]);
  }

  const direccion = v.texto('local.direccion', local.direccion, { etiqueta: 'la dirección', ...LARGO_DIRECCION, unidad: 'caracteres' });
  const horarioLocal = validarHorarioLocal(v, local.horario);
  const pausa = validarPausa(v, local.pausa, horarioLocal.rangos);

  // ── Tu equipo ─────────────────────────────────────────────────────────────
  const barberos = validarBarberos(v, datos.barberos);
  const duenios = validarDuenios(v, datos.duenios_sin_corte, barberos);
  validarHorariosEquipo(v, barberos, horarioLocal);

  // ── Tus servicios ─────────────────────────────────────────────────────────
  const turno = esObjetoPlano(datos.turno) ? datos.turno : {};
  const duracionValida = (typeof turno.duracion_minutos === 'number' || typeof turno.duracion_minutos === 'string')
    && DURACIONES_TURNO.includes(Number(turno.duracion_minutos));
  if (!duracionValida) v.agregar('turno.duracion_minutos', 'Elegí cada cuánto das turnos.');
  const servicios = validarServicios(v, datos.servicios);
  const productos = validarProductos(v, datos.productos);

  // ── Contacto ──────────────────────────────────────────────────────────────
  const whatsapp = v.telefono('local.whatsapp', local.whatsapp, 'el WhatsApp del local');
  const telefono = v.telefono('local.telefono', local.telefono, 'el teléfono del local');
  let resenaUrl = null;
  if (!faltaValor(local.resena_url)) {
    resenaUrl = typeof local.resena_url === 'string' ? local.resena_url.trim() : null;
    if (!esUrlHttps(resenaUrl)) v.agregar('local.resena_url', 'El link de reseñas tiene que empezar con https://.');
  }
  const contacto = esObjetoPlano(datos.contacto) ? datos.contacto : {};
  const contactoNombre = v.texto('contacto.nombre', contacto.nombre, { etiqueta: 'tu nombre', ...LARGO_NOMBRE_PERSONA });
  const contactoCelular = v.telefono('contacto.celular', contacto.celular, 'tu celular');
  const contactoEmail = v.email('contacto.email', contacto.email, 'tu mail', true);

  return {
    errores: v.errores,
    datos: {
      version: VERSION_DATOS,
      local: {
        nombre: nombreNegocio,
        subdominio,
        direccion,
        telefono,
        whatsapp,
        resena_url: resenaUrl,
        horario: horarioLocal.horario,
        pausa,
      },
      turno: { duracion_minutos: duracionValida ? Number(turno.duracion_minutos) : null },
      barberos,
      duenios_sin_corte: duenios,
      servicios,
      productos,
      contacto: { nombre: contactoNombre, celular: contactoCelular, email: contactoEmail },
      progreso: datos.progreso,
    },
  };
}

/**
 * validarSolicitudAlta
 * Validación completa del envío: consulta si el subdominio ya lo usa un tenant
 * (solo si su formato es válido) y aplica todas las reglas (validarDatosSolicitud).
 * @param {Object} datos - El `datos` del body (ya se sabe que es un objeto plano).
 * @returns {Promise<{ errores: Array<{campo: string, mensaje: string}>, datos: Object }>}
 */
export async function validarSolicitudAlta(datos) {
  const subdominio = esObjetoPlano(datos.local) ? recortar(datos.local.subdominio) : null;
  const ocupado = subdominio !== null && motivoFormatoSubdominio(subdominio) === null
    ? await subdominioOcupado(subdominio)
    : false;
  return validarDatosSolicitud(datos, { subdominioOcupado: ocupado });
}
