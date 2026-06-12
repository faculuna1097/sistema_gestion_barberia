// /backend/src/services/horariosService.js
// Lógica de negocio de horarios semanales de barberos.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/horarios).

import { query } from '../config/db.js';

/**
 * Normaliza una fila de barbero_horario para la respuesta de la API: recorta
 * hora_inicio/hora_fin de 'HH:MM:SS' (TIME crudo de la DB) a 'HH:MM', el formato
 * canónico que consumen los <input type="time"> y las comparaciones de rango del
 * frontend. Normalización en el borde de lectura del backend (convenciones §4):
 * la API expone 'HH:MM', no el TIME crudo de pg.
 * @param {{ id, dia_semana, hora_inicio, hora_fin }} fila - fila cruda de la DB
 * @returns {{ id, dia_semana, hora_inicio, hora_fin }} fila con horas en 'HH:MM'
 */
const normalizarBloque = (fila) => ({
  id: fila.id,
  dia_semana: fila.dia_semana,
  hora_inicio: fila.hora_inicio.slice(0, 5),
  hora_fin: fila.hora_fin.slice(0, 5),
});

/**
 * Obtiene los bloques horarios de un barbero.
 * @param {string} barberoId
 * @param {string} tenantId
 * @returns {Promise<Array>} bloques ordenados por dia_semana, hora_inicio
 */
export const obtenerHorarios = async (barberoId, tenantId) => {
  const result = await query(
    `SELECT id, dia_semana, hora_inicio, hora_fin
     FROM barbero_horario
     WHERE barbero_id = $1 AND tenant_id = $2
     ORDER BY dia_semana ASC, hora_inicio ASC`,
    [barberoId, tenantId]
  );
  return result.rows.map(normalizarBloque);
};

/**
 * Valida que no haya solapamiento entre bloques del mismo día.
 * Dos bloques se solapan si a.hora_inicio < b.hora_fin AND b.hora_inicio < a.hora_fin.
 * @param {Array} bloques - [{ dia_semana, hora_inicio, hora_fin }, ...]
 * @returns {{ valido: boolean, error?: string }}
 */
export const validarNoSolapamiento = (bloques) => {
  const porDia = {};
  for (const b of bloques) {
    if (!porDia[b.dia_semana]) porDia[b.dia_semana] = [];
    porDia[b.dia_semana].push(b);
  }

  for (const [dia, lista] of Object.entries(porDia)) {
    lista.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    for (let i = 0; i < lista.length - 1; i++) {
      if (lista[i].hora_fin > lista[i + 1].hora_inicio) {
        return {
          valido: false,
          error: `Solapamiento en día ${dia}: bloque ${lista[i].hora_inicio}–${lista[i].hora_fin} se pisa con ${lista[i + 1].hora_inicio}–${lista[i + 1].hora_fin}`,
        };
      }
    }
  }

  return { valido: true };
};

/**
 * Reemplaza completo el horario semanal de un barbero.
 * Borra todos los bloques existentes e inserta los nuevos.
 * @param {string} barberoId
 * @param {string} tenantId
 * @param {Array} bloques - [{ dia_semana, hora_inicio, hora_fin }, ...]
 * @returns {Promise<Array>} bloques insertados con id
 */
export const reemplazarHorarios = async (barberoId, tenantId, bloques) => {
  // DELETE existentes
  await query(
    `DELETE FROM barbero_horario WHERE barbero_id = $1 AND tenant_id = $2`,
    [barberoId, tenantId]
  );

  if (bloques.length === 0) return [];

  // INSERT nuevos — uno por uno (Session Pooler no soporta transacciones,
  // pero el DELETE + INSERTs secuenciales es aceptable acá)
  const insertados = [];
  for (const b of bloques) {
    const result = await query(
      `INSERT INTO barbero_horario (tenant_id, barbero_id, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, dia_semana, hora_inicio, hora_fin`,
      [tenantId, barberoId, b.dia_semana, b.hora_inicio, b.hora_fin]
    );
    insertados.push(normalizarBloque(result.rows[0]));
  }

  return insertados;
};
