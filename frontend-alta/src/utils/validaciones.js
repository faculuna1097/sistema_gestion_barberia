// /frontend-alta/src/utils/validaciones.js
// Validación del formulario de alta en el front (plan_alta_clientes.md §5.4).
// Es un puerto fiel de backend/src/utils/validarSolicitudAlta.js: mismas reglas,
// mismos `campo` ('barberos.1.comision') y MISMOS mensajes, en el mismo orden.
// Así un error que marca el backend al enviar y uno que marca el front se ven
// iguales, y el `campo` de un 400 del backend lleva a su pantalla
// (pantallaDeCampo). Si cambia una regla allá, cambia acá.
//
// Lo único que no está: el chequeo de "ocupado" del subdominio, que lo hace la
// consulta al endpoint (consultarSubdominio). Las reglas de formato y la
// sugerencia del subdominio están en utils/subdominio.js.
//
// Cada regla dice de qué parte del backend es copia. Los helpers de abajo son
// copias de los validadores reusables del backend (validarTexto.js,
// validarNumero.js y validarFecha.js).
// Funciones puras (sin React) para poder probarlas con Node.

import { PANTALLA } from '../config/pantallas.js';
import { motivoFormatoSubdominio, MENSAJES_SUBDOMINIO } from './subdominio.js';
import { VERSION_DATOS } from './datosSolicitud.js';

// ─── Copias de los validadores reusables del backend ────────────────────────

// Copia de MAX_NOMBRE (backend/src/utils/validarTexto.js).
const MAX_NOMBRE = 80;

// Copia de REGEX_EMAIL (validarTexto.js): local@dominio.tld sin espacios ni @
// extra, con un TLD alfabético de al menos 2 caracteres.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * esEmailValido — copia de esEmailValido (validarTexto.js).
 * @param {*} email
 * @returns {boolean} true si es un string con forma de email válida (tras recortar).
 */
function esEmailValido(email) {
  return typeof email === 'string' && REGEX_EMAIL.test(email.trim());
}

// Copia de REGEX_TELEFONO_E164 (validarTexto.js): "+", código de país sin 0
// inicial y 8 a 15 dígitos en total, sin espacios ni guiones.
const REGEX_TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;

/**
 * esTelefonoE164 — copia de esTelefonoE164 (validarTexto.js).
 * @param {*} telefono
 * @returns {boolean} true si es un string con forma E.164 (tras recortar).
 */
function esTelefonoE164(telefono) {
  return typeof telefono === 'string' && REGEX_TELEFONO_E164.test(telefono.trim());
}

/**
 * esUrlHttps — copia de esUrlHttps (validarTexto.js).
 * @param {*} valor
 * @returns {boolean} true si es un string con una URL https válida (tras recortar).
 */
function esUrlHttps(valor) {
  if (typeof valor !== 'string') return false;
  try {
    return new URL(valor.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

// Copia de MONTO_MAXIMO y ENTERO_MAXIMO (backend/src/utils/validarNumero.js).
const MONTO_MAXIMO = 99999999.99;
const ENTERO_MAXIMO = 2147483647;

/**
 * esMontoPositivo — copia de esMontoPositivo (validarNumero.js).
 * @param {*} valor - number o string numérico
 * @returns {boolean} true si es un número finito > 0.
 */
function esMontoPositivo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isFinite(n) && n > 0;
}

/**
 * esEnteroPositivo — copia de esEnteroPositivo (validarNumero.js).
 * @param {*} valor - number o string numérico
 * @returns {boolean} true si es un entero >= 1.
 */
function esEnteroPositivo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1;
}

/**
 * esCantidadValida — copia de esCantidadValida (validarNumero.js).
 * @param {*} valor - number o string numérico
 * @returns {boolean} true si es un entero entre 1 y ENTERO_MAXIMO.
 */
function esCantidadValida(valor) {
  return esEnteroPositivo(valor) && Number(valor) <= ENTERO_MAXIMO;
}

/**
 * esEnteroNoNegativo — copia de esEnteroNoNegativo (validarNumero.js).
 * @param {*} valor - number o string numérico
 * @returns {boolean} true si es un entero entre 0 y ENTERO_MAXIMO.
 */
function esEnteroNoNegativo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= ENTERO_MAXIMO;
}

// Copia de REGEX_HORA (backend/src/utils/validarFecha.js).
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * esHoraValida — copia de esHoraValida (validarFecha.js).
 * @param {*} valor
 * @returns {boolean} true si es string 'HH:MM' o 'HH:MM:SS' y la hora existe.
 */
function esHoraValida(valor) {
  return typeof valor === 'string' && REGEX_HORA.test(valor);
}

// ─── Constantes de validarSolicitudAlta.js ──────────────────────────────────

// Copia de TURNO_MINIMO, TURNO_MAXIMO, PASO_TURNO y DURACIONES_TURNO: largos de
// turno que se pueden elegir, de 10 a 60 minutos de a 5.
export const TURNO_MINIMO = 10;
export const TURNO_MAXIMO = 60;
export const PASO_TURNO = 5;
export const DURACIONES_TURNO = Array.from(
  { length: (TURNO_MAXIMO - TURNO_MINIMO) / PASO_TURNO + 1 },
  (_, i) => TURNO_MINIMO + i * PASO_TURNO,
);

// Copia de los largos y topes de validarSolicitudAlta.js.
export const LARGO_NOMBRE_NEGOCIO = { min: 2, max: 60 };
export const LARGO_DIRECCION = { min: 5, max: 120 };
export const LARGO_NOMBRE_PERSONA = { min: 2, max: MAX_NOMBRE };
export const LARGO_NOMBRE_ITEM = { min: 2, max: 40 };
export const COMISION_MAXIMA = 100;
export const SLOTS_MAXIMOS = 20; // servicio.cantidad_slots
// Los precios son enteros: el mayor que entra en numeric(10,2).
export const PRECIO_MAXIMO = Math.floor(MONTO_MAXIMO);
const PRECIO_MAXIMO_TEXTO = PRECIO_MAXIMO.toLocaleString('es-AR');
// Atención mínima que tiene que quedar antes y después de la pausa del mediodía.
export const MARGEN_PAUSA_MINUTOS = 30;

// dia_semana como en la DB: 0 = domingo.
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Orden en que se nombran los días en los mensajes: de lunes a domingo.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

// ─── Helpers de validarSolicitudAlta.js ─────────────────────────────────────

/**
 * esObjetoPlano — copia de esObjetoPlano (validarSolicitudAlta.js).
 * @param {*} valor
 * @returns {boolean} true si es un objeto JSON: ni null ni array.
 */
function esObjetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/**
 * mayuscula — copia de mayuscula (validarSolicitudAlta.js).
 * @param {string} texto
 * @returns {string} El texto con la primera letra en mayúscula.
 */
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * recortar — copia de recortar (validarSolicitudAlta.js).
 * @param {*} valor
 * @returns {string|null} El texto recortado, o null si no es texto o queda vacío.
 */
const recortar = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null);

/**
 * faltaValor — copia de faltaValor (validarSolicitudAlta.js).
 * @param {*} valor
 * @returns {boolean} true si es undefined, null o un texto vacío (o solo espacios).
 */
const faltaValor = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

/**
 * aMinutos — copia de aMinutos (validarSolicitudAlta.js).
 * @param {string} hora - Hora 'HH:MM' ya validada.
 * @returns {number} Minutos desde la medianoche.
 */
const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * esDiaSemana — copia de esDiaSemana (validarSolicitudAlta.js).
 * @param {*} valor
 * @returns {boolean} true si es un entero de 0 (domingo) a 6 (sábado).
 */
const esDiaSemana = (valor) => Number.isInteger(valor) && valor >= 0 && valor <= 6;

/**
 * crearValidador — copia de crearValidador (validarSolicitudAlta.js).
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
   * texto — copia de `texto`: texto obligatorio con largo mínimo y máximo.
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
   * telefono — copia de `telefono`: teléfono obligatorio en E.164.
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
   * email — copia de `email`: mail, obligatorio u opcional.
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
   * hora — copia de `hora`: 'HH:MM' en punto o y media (los botones van de a 30 min).
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
   * precio — copia de `precio`: entero mayor a 0, hasta PRECIO_MAXIMO.
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

// ─── Reglas por bloque (copias de validarSolicitudAlta.js) ──────────────────

/**
 * validarHorarioLocal — copia de validarHorarioLocal.
 * Al menos un día, sin días repetidos, y en cada día un cierre posterior a la apertura.
 * @param {Object} v - Validador (crearValidador).
 * @param {*} horario - local.horario crudo.
 * @returns {{ horario: Array, diasDeclarados: Set<number>, rangos: Map<number, {inicio: string, fin: string}> }}
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
 * validarPausa — copia de validarPausa.
 * La pausa del mediodía (opcional, la misma para todos los días): si viene,
 * dentro del rango de cada día abierto, con MARGEN_PAUSA_MINUTOS de cada lado.
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
 * validarHorarioBarbero — copia de validarHorarioBarbero.
 * 'igual_local', o bloques (al menos uno), cada uno dentro del horario del local
 * ese día y sin superponerse con otro del mismo día (pegados sí).
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
 * validarBarberos — copia de validarBarberos.
 * Al menos uno, nombres y mails sin repetir (sin importar mayúsculas) y comisión
 * entera de 0 a 100. El horario queda crudo: lo valida validarHorariosEquipo.
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
 * validarDuenios — copia de validarDuenios.
 * Los dueños que no cortan y que haya al menos un dueño en total. Los nombres no
 * se repiten entre los barberos dueños y los que no cortan (socio tiene UNIQUE
 * (tenant_id, nombre)), sin importar mayúsculas.
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
 * validarHorariosEquipo — copia de validarHorariosEquipo.
 * Valida y normaliza el horario de cada barbero, sobre los ya normalizados.
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
 * validarServicios — copia de validarServicios.
 * Al menos uno, nombre sin repetir, precio y duración en turnos (1 a 20).
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
 * validarProductos — copia de validarProductos.
 * Opcionales: nombre sin repetir, precio, y stock y stock mínimo enteros >= 0.
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
 * validarDatosSolicitud — copia de validarDatosSolicitud.
 * Valida y normaliza `datos` con todas las reglas de §5.4, en el orden del
 * formulario. Sin el chequeo de "ocupado" del subdominio (lo hace el endpoint).
 * `progreso` no se valida.
 * @param {Object} datos - El formulario completo.
 * @returns {{ errores: Array<{campo: string, mensaje: string}>, datos: Object }}
 *   Los errores (vacío si pasa) y el datos normalizado (sirve solo si no hay errores).
 */
function validarDatosSolicitud(datos) {
  const v = crearValidador();
  if (!esObjetoPlano(datos)) {
    // El backend responde este caso antes de validar (formato_invalido, 400).
    v.agregar('version', 'El formulario está desactualizado. Recargá la página y probá de nuevo.');
    return { errores: v.errores, datos: null };
  }

  if (datos.version !== VERSION_DATOS) {
    v.agregar('version', 'El formulario está desactualizado. Recargá la página y probá de nuevo.');
  }

  // ── Tu local ──────────────────────────────────────────────────────────────
  const local = esObjetoPlano(datos.local) ? datos.local : {};
  const nombreNegocio = v.texto('local.nombre', local.nombre, { etiqueta: 'el nombre del negocio', ...LARGO_NOMBRE_NEGOCIO });

  // Copia del chequeo de local.subdominio, sin "ocupado" (lo dice el endpoint).
  const subdominio = recortar(local.subdominio);
  if (subdominio === null) {
    v.agregar('local.subdominio', 'Elegí el link de tu barbería.');
  } else {
    const motivo = motivoFormatoSubdominio(subdominio);
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

// ─── API del front ──────────────────────────────────────────────────────────

/**
 * validarDatos
 * Todos los errores del formulario, con las reglas del backend (sin "ocupado").
 * @param {Object} datos - El formulario completo (utils/datosSolicitud.js)
 * @returns {Array<{campo: string, mensaje: string}>} En el orden del formulario; vacío si pasa.
 */
export function validarDatos(datos) {
  return validarDatosSolicitud(datos).errores;
}

/**
 * normalizarDatos
 * Los datos como los guardaría el backend al enviar: textos recortados, números
 * como number y solo las claves conocidas. Sirve solo si validarDatos no da errores.
 * @param {Object} datos - El formulario completo
 * @returns {Object|null} Los datos normalizados (null si `datos` no es un objeto).
 */
export function normalizarDatos(datos) {
  return validarDatosSolicitud(datos).datos;
}

// Primer tramo del `campo` → pantalla donde se corrige. Los de local.* se
// resuelven aparte (pantallaDeCampo), porque local reparte sus campos en cuatro
// pantallas.
const PANTALLA_POR_SECCION = {
  turno: PANTALLA.LARGO_TURNO,
  servicios: PANTALLA.SERVICIOS,
  productos: PANTALLA.PRODUCTOS,
  contacto: PANTALLA.CONTACTO_DUENIO,
  duenios_sin_corte: PANTALLA.DUENIOS,
};

// Segundo tramo de un campo local.* → pantalla.
const PANTALLA_POR_CAMPO_LOCAL = {
  nombre: PANTALLA.NOMBRE,
  subdominio: PANTALLA.NOMBRE,
  direccion: PANTALLA.DIRECCION,
  pausa: PANTALLA.HORARIO,
  whatsapp: PANTALLA.CONTACTO_LOCAL,
  telefono: PANTALLA.CONTACTO_LOCAL,
  resena_url: PANTALLA.CONTACTO_LOCAL,
};

/**
 * pantallaDeCampo
 * En qué pantalla se corrige un campo con error (el `campo` de validarDatos o
 * de un 400 del backend). Así, en la fase 5, el envío lleva a la pantalla y al
 * campo del primer error.
 *   local.nombre, local.subdominio            → Nombre
 *   local.direccion                           → Dirección
 *   local.horario (ningún día), local.horario.i.dia_semana, local.horario.i → Días
 *   local.horario.i.hora_*, local.pausa*      → Horario
 *   barberos, barberos.i.(nombre|comision|email) → Barberos
 *   duenios_sin_corte*                        → Dueños
 *   barberos.i.horario*                       → Horarios del equipo
 *   turno.*                                   → Largo del turno
 *   servicios*, productos*                    → Servicios, Productos
 *   local.whatsapp, local.telefono, local.resena_url → Contacto del local
 *   contacto.*                                → Contacto del dueño
 * @param {string} campo - Ruta del campo, ej. 'barberos.1.comision'
 * @returns {number|null} El número de pantalla, o null si el campo no es de
 *   ninguna ('version': hay que recargar).
 */
export function pantallaDeCampo(campo) {
  if (typeof campo !== 'string') return null;
  const partes = campo.split('.');
  const [seccion, segundo] = partes;

  if (seccion === 'local') {
    if (segundo === 'horario') {
      // 'local.horario.i.hora_inicio' se corrige en Horario. Sin días, un día
      // repetido o un día mal formado se corrige eligiendo los días.
      const hora = partes[3];
      return hora === 'hora_inicio' || hora === 'hora_fin' ? PANTALLA.HORARIO : PANTALLA.DIAS;
    }
    return PANTALLA_POR_CAMPO_LOCAL[segundo] ?? null;
  }
  if (seccion === 'barberos') {
    // 'barberos.i.horario…' va en Horarios del equipo; el resto, en Barberos.
    return partes[2] === 'horario' ? PANTALLA.HORARIOS_EQUIPO : PANTALLA.BARBEROS;
  }
  return PANTALLA_POR_SECCION[seccion] ?? null;
}

/**
 * erroresDePantalla
 * Los errores de una pantalla, para el "Seguir": las mismas reglas de
 * validarDatos, filtradas por pantallaDeCampo. Una pantalla sin campos
 * (Bienvenida, Revisión, Listo) no tiene errores.
 * @param {number} pantalla - Número de pantalla (config/pantallas.js → PANTALLA)
 * @param {Object} datos - El formulario completo
 * @returns {Array<{campo: string, mensaje: string}>} En el orden del formulario; vacío si pasa.
 */
export function erroresDePantalla(pantalla, datos) {
  return validarDatos(datos).filter((error) => pantallaDeCampo(error.campo) === pantalla);
}

/**
 * primerError
 * El primer error de una lista (el del backend o el de validarDatos) con la
 * pantalla donde se corrige: para llevar ahí al cliente.
 * @param {Array<{campo: string, mensaje: string}>} errores
 * @returns {{campo: string, mensaje: string, pantalla: number|null}|null} null si no hay errores.
 */
export function primerError(errores) {
  if (!Array.isArray(errores) || errores.length === 0) return null;
  const [error] = errores;
  return { ...error, pantalla: pantallaDeCampo(error.campo) };
}
