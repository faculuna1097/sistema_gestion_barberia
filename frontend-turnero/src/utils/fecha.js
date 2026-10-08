// /frontend-turnero/src/utils/fecha.js
// Helpers de fecha/hora. Todo en zona local del navegador.
// Convención del proyecto: el backend manda ISO y YYYY-MM-DD; el front muestra siempre en es-AR.

import { capitalizar } from './formato.js';

/**
 * DIAS_RESERVABLES
 * Cuántos días hacia adelante (contando hoy) puede elegir el cliente, tanto al
 * reservar como al reprogramar. Un solo número para los dos flujos.
 */
export const DIAS_RESERVABLES = 15;

/**
 * fechaLocalISO
 * Devuelve el YYYY-MM-DD de un Date según la zona local del navegador.
 * No usar `toISOString().slice(0, 10)`: eso da la fecha UTC, que en Argentina
 * (UTC-3) ya es "mañana" a partir de las 21:00.
 * @param {Date} date - Fecha/instante a convertir
 * @returns {string} Ej: '2026-05-19'
 */
export function fechaLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * fechaDeISO
 * Devuelve el YYYY-MM-DD local de un instante ISO (con offset o con Z).
 * Red defensiva: no depende de que el backend mande el offset local, a
 * diferencia de recortar el string con `slice(0, 10)`.
 * @param {string} iso - ISO timestamp (ej. '2026-10-07T00:30:00.000Z')
 * @returns {string} Ej: '2026-10-06' (en Argentina)
 */
export function fechaDeISO(iso) {
  return fechaLocalISO(new Date(iso));
}

/**
 * generarProximosDias
 * Array de strings YYYY-MM-DD desde hoy (inclusive) por N días.
 * @param {number} cantidad - Cantidad de días a generar
 * @returns {Array<string>} Ej: ['2026-05-19', '2026-05-20', ...]
 */
export function generarProximosDias(cantidad) {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    dias.push(fechaLocalISO(d));
  }
  return dias;
}

/**
 * fmtFechaCorta
 * Formato corto de fecha YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "lun 19/05"
 */
export function fmtFechaCorta(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dia = date.toLocaleDateString('es-AR', { weekday: 'short' });
  return `${dia.replace('.', '')} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * fmtFechaLarga
 * Formato largo de fecha YYYY-MM-DD con día de semana y mes completo. El día
 * va sin cero adelante, como en la grilla de días ("8", no "08").
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "jueves, 8 de octubre"
 */
export function fmtFechaLarga(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * fmtHora
 * Convierte un ISO timestamp a HH:mm 24hs.
 * @param {string} iso - ISO timestamp
 * @returns {string} Ej: "15:30"
 */
export function fmtHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * fmtFechaHora
 * Combina fecha larga y hora desde un ISO.
 * @param {string} iso - ISO timestamp
 * @returns {string} Ej: "lunes, 19 de mayo · 15:30 hs"
 */
export function fmtFechaHora(iso) {
  return `${fmtFechaLarga(fechaDeISO(iso))} · ${fmtHora(iso)} hs`;
}

/**
 * sumarMinutos
 * Suma minutos a un instante (ej. el fin de un turno: inicio + duración).
 * @param {string} iso - ISO timestamp
 * @param {number} minutos
 * @returns {string} ISO en UTC (ej. '2026-10-08T19:00:00.000Z')
 */
export function sumarMinutos(iso, minutos) {
  return new Date(new Date(iso).getTime() + minutos * 60000).toISOString();
}

/**
 * diaSemana
 * Devuelve la letra del día de semana (narrow) para un YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "L"
 */
export function diaSemana(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'narrow' });
}

/**
 * diaNumero
 * Devuelve el día del mes como número (sin padding).
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {number} Ej: 19
 */
export function diaNumero(fechaStr) {
  return Number(fechaStr.split('-')[2]);
}

/**
 * nombreMes
 * Devuelve el nombre corto del mes para un YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "may"
 */
export function nombreMes(fechaStr) {
  const [y, m] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
}

/**
 * fmtMes
 * Nombre completo del mes con mayúscula inicial, sin el año.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "Octubre"
 */
export function fmtMes(fechaStr) {
  const [y, m] = fechaStr.split('-').map(Number);
  return capitalizar(new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' }));
}

/**
 * fmtDiaAccesible
 * Fecha para leer en voz alta (aria-label) o para ir dentro de una oración
 * ("Te esperamos el martes 6 de octubre"): día de la semana, número y mes,
 * sin la coma que agrega el formato de es-AR.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "martes 6 de octubre"
 */
export function fmtDiaAccesible(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const diaSemana = fecha.toLocaleDateString('es-AR', { weekday: 'long' });
  const mes = fecha.toLocaleDateString('es-AR', { month: 'long' });
  return `${diaSemana} ${d} de ${mes}`;
}

/**
 * esHoy
 * True si fechaStr corresponde al día de hoy local.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function esHoy(fechaStr) {
  return fechaStr === fechaLocalISO(new Date());
}

/**
 * diaDeSemana
 * Devuelve el índice del día de la semana para un YYYY-MM-DD.
 * Convención 0-6 (0=domingo), la misma que usa el backend en `horario_atencion`.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {number} 0=domingo, 1=lunes, ..., 6=sábado
 */
export function diaDeSemana(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
