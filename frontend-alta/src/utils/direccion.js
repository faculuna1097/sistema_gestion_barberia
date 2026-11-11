// /frontend-alta/src/utils/direccion.js
// La dirección del local en partes (pantalla 2): calle, altura (o "sin
// número"), piso o local, provincia y ciudad (o barrio, en CABA).
//
// En `datos` (plan §5.6) la dirección es un solo texto, local.direccion: es lo
// que guarda el backend, lo que muestra el turnero y lo que busca su "Cómo
// llegar". Las partes son de la interfaz y van en progreso.direccion (el
// backend descarta cualquier otra clave); local.direccion se arma con ellas en
// cada cambio: "Av. Corrientes 1234, Local 5, Palermo, CABA".
//
// Los errores de cada parte son propios del front: el backend solo valida el
// texto armado (validaciones.js → local.direccion, de 5 a 120 caracteres).
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * PROVINCIAS
 * Las 24 jurisdicciones, en orden alfabético. `valor` es lo que va en el texto
 * armado; `etiqueta`, lo que se ve en el selector.
 */
export const PROVINCIAS = [
  { valor: 'Buenos Aires', etiqueta: 'Buenos Aires' },
  { valor: 'CABA', etiqueta: 'Ciudad de Buenos Aires (CABA)' },
  { valor: 'Catamarca', etiqueta: 'Catamarca' },
  { valor: 'Chaco', etiqueta: 'Chaco' },
  { valor: 'Chubut', etiqueta: 'Chubut' },
  { valor: 'Córdoba', etiqueta: 'Córdoba' },
  { valor: 'Corrientes', etiqueta: 'Corrientes' },
  { valor: 'Entre Ríos', etiqueta: 'Entre Ríos' },
  { valor: 'Formosa', etiqueta: 'Formosa' },
  { valor: 'Jujuy', etiqueta: 'Jujuy' },
  { valor: 'La Pampa', etiqueta: 'La Pampa' },
  { valor: 'La Rioja', etiqueta: 'La Rioja' },
  { valor: 'Mendoza', etiqueta: 'Mendoza' },
  { valor: 'Misiones', etiqueta: 'Misiones' },
  { valor: 'Neuquén', etiqueta: 'Neuquén' },
  { valor: 'Río Negro', etiqueta: 'Río Negro' },
  { valor: 'Salta', etiqueta: 'Salta' },
  { valor: 'San Juan', etiqueta: 'San Juan' },
  { valor: 'San Luis', etiqueta: 'San Luis' },
  { valor: 'Santa Cruz', etiqueta: 'Santa Cruz' },
  { valor: 'Santa Fe', etiqueta: 'Santa Fe' },
  { valor: 'Santiago del Estero', etiqueta: 'Santiago del Estero' },
  { valor: 'Tierra del Fuego', etiqueta: 'Tierra del Fuego' },
  { valor: 'Tucumán', etiqueta: 'Tucumán' },
];

/**
 * LARGOS_DIRECCION
 * Topes de cada parte (maxLength de los campos). La altura, hasta 5 dígitos.
 * Sumados con las comas y la provincia más larga ("Santiago del Estero") dan
 * 120: el texto armado nunca pasa el tope del backend (validaciones.js →
 * LARGO_DIRECCION.max).
 */
export const LARGOS_DIRECCION = { calle: 44, altura: 5, piso: 15, ciudad: 30 };

// En CABA, la "ciudad" es el barrio.
const PROVINCIA_CABA = 'CABA';

/**
 * esCaba
 * @param {string} provincia - `valor` de PROVINCIAS
 * @returns {boolean} true si es la Ciudad de Buenos Aires (el campo de ciudad pasa a ser el barrio).
 */
export function esCaba(provincia) {
  return provincia === PROVINCIA_CABA;
}

/**
 * partesVacias
 * @returns {{calle: string, altura: string, sin_numero: boolean, piso: string, provincia: string, ciudad: string}}
 */
export function partesVacias() {
  return { calle: '', altura: '', sin_numero: false, piso: '', provincia: '', ciudad: '' };
}

/**
 * texto (interna)
 * @param {*} valor
 * @returns {string} El valor si es texto; si no, ''.
 */
const texto = (valor) => (typeof valor === 'string' ? valor : '');

/**
 * leerPartesDireccion
 * Las partes guardadas en progreso.direccion. Si no hay (datos de antes de
 * pedirla en partes) pero sí un texto en local.direccion, ese texto queda en
 * la calle, para no perderlo.
 * @param {Object} datos - El formulario completo
 * @returns {Object} Las partes (forma de partesVacias).
 */
export function leerPartesDireccion(datos) {
  const guardadas = datos.progreso?.direccion;
  if (guardadas && typeof guardadas === 'object' && !Array.isArray(guardadas)) {
    return {
      calle: texto(guardadas.calle),
      altura: texto(guardadas.altura),
      sin_numero: guardadas.sin_numero === true,
      piso: texto(guardadas.piso),
      provincia: PROVINCIAS.some((p) => p.valor === guardadas.provincia) ? guardadas.provincia : '',
      ciudad: texto(guardadas.ciudad),
    };
  }
  return { ...partesVacias(), calle: texto(datos.local?.direccion) };
}

/**
 * comparable (interna)
 * Un texto listo para comparar sin importar mayúsculas, tildes ni espacios de más.
 * @param {*} texto
 * @returns {string}
 */
const comparable = (texto) => (typeof texto === 'string' ? texto : '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/**
 * armarDireccion
 * El texto de la dirección: "Calle Altura, Piso o local, Ciudad, Provincia".
 * Sin número, la altura va como "s/n". Las partes vacías no dejan comas de más.
 * Si la ciudad es la misma provincia (ej. "caba" con CABA, "Córdoba" con
 * Córdoba), no se repite.
 * @param {Object} partes
 * @returns {string} Ej.: "Av. Corrientes 1234, Local 5, Palermo, CABA".
 */
export function armarDireccion(partes) {
  const calle = partes.calle.trim();
  const numero = partes.sin_numero ? 's/n' : partes.altura.trim();
  // Sin calle, la altura sola no dice nada: no se pone.
  let primera = '';
  if (calle) primera = numero ? `${calle} ${numero}` : calle;
  const ciudad = partes.ciudad.trim();
  const repiteProvincia = ciudad !== '' && comparable(ciudad) === comparable(partes.provincia);
  return [primera, partes.piso.trim(), repiteProvincia ? '' : ciudad, partes.provincia]
    .filter(Boolean)
    .join(', ');
}

/**
 * cambiarPartesDireccion
 * Guarda las partes en progreso y el texto armado en local.direccion.
 * @param {Object} datos - El formulario completo
 * @param {Object} cambios - Las partes que cambian (ej. { altura: '1234' })
 * @returns {Object} Los datos nuevos.
 */
export function cambiarPartesDireccion(datos, cambios) {
  const partes = { ...leerPartesDireccion(datos), ...cambios };
  return {
    ...datos,
    local: { ...datos.local, direccion: armarDireccion(partes) },
    progreso: { ...datos.progreso, direccion: partes },
  };
}

/**
 * soloDigitos
 * Lo que queda de la altura escrita: solo los números, hasta LARGOS_DIRECCION.altura.
 * @param {string} valor
 * @returns {string}
 */
export function soloDigitos(valor) {
  return texto(valor).replace(/\D/g, '').slice(0, LARGOS_DIRECCION.altura);
}

/**
 * erroresDeDireccion
 * Los errores de cada parte (propios del front), en el orden de los campos.
 * Los `campo` son 'direccion.<parte>': no son rutas de `datos`.
 * @param {Object} partes
 * @returns {Array<{campo: string, mensaje: string}>} Vacío si están todas bien.
 */
export function erroresDeDireccion(partes) {
  const errores = [];
  if (partes.calle.trim().length < 2) errores.push({ campo: 'direccion.calle', mensaje: 'Completá la calle.' });
  if (!partes.sin_numero && partes.altura.trim() === '') {
    errores.push({ campo: 'direccion.altura', mensaje: 'Completá la altura, o marcá "Sin número".' });
  }
  if (!partes.provincia) errores.push({ campo: 'direccion.provincia', mensaje: 'Elegí la provincia.' });
  if (partes.ciudad.trim().length < 2) {
    errores.push({ campo: 'direccion.ciudad', mensaje: esCaba(partes.provincia) ? 'Completá el barrio.' : 'Completá la ciudad o localidad.' });
  }
  return errores;
}

/**
 * direccionCompleta
 * @param {Object} partes
 * @returns {boolean} true si no le falta nada (ya se puede buscar en un mapa).
 */
export function direccionCompleta(partes) {
  return erroresDeDireccion(partes).length === 0;
}
