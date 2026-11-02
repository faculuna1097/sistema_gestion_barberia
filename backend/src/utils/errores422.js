// /backend/src/utils/errores422.js
// Cuerpo de los 422 de negocio: un turno o un bloque horario que cae fuera del
// horario de atención del local, o en un feriado.

/**
 * cuerpoError422
 * Arma el cuerpo de un 422 con la forma de todos los errores de la API:
 * { error, codigo }, más `limite` si la validación lo trae.
 *
 * @param {Object} validacion
 * @param {string} validacion.codigo - 'dia_cerrado' | 'fuera_de_rango' | 'feriado'
 * @param {string} validacion.mensaje - texto para el usuario
 * @param {{ hora_inicio: string, hora_fin: string }} [validacion.limite] - horario del local ese día
 * @returns {{ error: string, codigo: string, limite?: Object }}
 */
export const cuerpoError422 = ({ codigo, mensaje, limite }) => ({
  error: mensaje,
  codigo,
  ...(limite && { limite }),
});

// El mismo 422 para todo turno que cae en un feriado.
export const CUERPO_422_FERIADO = cuerpoError422({
  codigo: 'feriado',
  mensaje: 'El negocio está cerrado por feriado ese día',
});
