// /frontend-alta/src/utils/erroresServidor.js
// Los errores que marcó el backend al enviar (400 datos_invalidos, con
// `errores: [{ campo, mensaje }]`) y que el front no ve por su cuenta: por
// ejemplo, un link que otra barbería tomó mientras se completaba ("ocupado").
//
// Cómo viven:
//   - Al llegar el 400, Formulario los registra con el valor que tenía cada
//     campo en ese momento (registrarErroresServidor).
//   - Cada pantalla los suma a los suyos (hooks/useErroresDePantalla.js), y se
//     muestran igual que un error del front (al llegar, con el foco).
//   - Un error deja de valer apenas cambia el valor de su campo (es lo que el
//     cliente corrigió): no hace falta borrarlo a mano. El próximo envío los
//     reemplaza por los que diga el backend.
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * valorEnRuta
 * El valor de un campo de `datos` por su ruta: 'barberos.1.comision' →
 * datos.barberos[1].comision.
 * @param {Object} datos
 * @param {string} campo
 * @returns {*} El valor, o undefined si la ruta no existe.
 */
export function valorEnRuta(datos, campo) {
  if (typeof campo !== 'string' || campo === '') return undefined;
  return campo.split('.').reduce((actual, parte) => (actual === null || actual === undefined ? undefined : actual[parte]), datos);
}

/**
 * huella (interna)
 * El valor como texto, para compararlo sin importar si es un objeto o una lista.
 * @param {*} valor
 * @returns {string}
 */
const huella = (valor) => JSON.stringify(valor ?? null);

/**
 * registrarErroresServidor
 * Los errores del backend con la huella del valor de su campo al enviar.
 * @param {Array<{campo: string, mensaje: string}>} errores - Los del 400
 * @param {Object} datos - Los datos que se enviaron
 * @returns {Array<{campo: string, mensaje: string, huella: string}>}
 */
export function registrarErroresServidor(errores, datos) {
  if (!Array.isArray(errores)) return [];
  return errores
    .filter((e) => typeof e?.campo === 'string' && typeof e?.mensaje === 'string')
    .map((e) => ({ campo: e.campo, mensaje: e.mensaje, huella: huella(valorEnRuta(datos, e.campo)) }));
}

/**
 * erroresServidorVigentes
 * Los errores del backend cuyo campo sigue con el mismo valor que al enviar.
 * @param {Array<{campo: string, mensaje: string, huella: string}>} registrados
 * @param {Object} datos - Los datos actuales
 * @returns {Array<{campo: string, mensaje: string}>}
 */
export function erroresServidorVigentes(registrados, datos) {
  if (!Array.isArray(registrados)) return [];
  return registrados
    .filter((e) => e.huella === huella(valorEnRuta(datos, e.campo)))
    .map(({ campo, mensaje }) => ({ campo, mensaje }));
}

/**
 * combinarErrores
 * Los errores del front y, después, los del backend en campos donde el front
 * no marca nada (si los dos marcan el mismo campo, manda el del front, que
 * refleja lo que hay ahora).
 * @param {Array<{campo: string, mensaje: string}>} delFront
 * @param {Array<{campo: string, mensaje: string}>} delServidor
 * @returns {Array<{campo: string, mensaje: string}>}
 */
export function combinarErrores(delFront, delServidor) {
  const campos = new Set(delFront.map((e) => e.campo));
  return [...delFront, ...delServidor.filter((e) => !campos.has(e.campo))];
}
