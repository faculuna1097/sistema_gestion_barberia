// /frontend/src/utils/descansos.js
// Textos de los bloques de descanso y de las ausencias que comparten el detalle
// de un bloque en la agenda del Turnero y el registro de descansos de Planillas.
// Los estados son los del backend (descansosService → armarBloque).

import { formatHora } from './fecha';

// Texto de cada estado de un descanso o una ausencia.
const TEXTO_ESTADO_BLOQUE = {
  pendiente: 'Todavía no empezó',
  en_curso: 'En curso',
  cumplido: 'Cumplido',
  terminado_antes: 'Terminado antes',
  liberado: 'Liberado antes de empezar',
};

/**
 * textoEstadoBloque
 * El estado de un descanso o una ausencia como texto. Si terminó antes, dice a
 * qué hora.
 * @param {'pendiente'|'en_curso'|'cumplido'|'terminado_antes'|'liberado'} estado
 * @param {string} hasta - ISO del fin efectivo
 * @returns {string} Ej: 'Cumplido', 'Terminado antes · a las 13:40'
 */
export function textoEstadoBloque(estado, hasta) {
  if (estado === 'terminado_antes') return `${TEXTO_ESTADO_BLOQUE.terminado_antes} · a las ${formatHora(hasta)}`;
  return TEXTO_ESTADO_BLOQUE[estado];
}
