// /frontend-alta/src/utils/resumen.js
// Textos del resumen de la tarjeta "Tu barbería" que no tienen otra casa: el
// horario de cada barbero, los servicios y productos en pocas palabras, y el
// contacto. Los usan la tarjeta del formulario, la Revisión y "Ya enviada".
// Funciones puras (sin React) para poder probarlas con Node.

import { fmtRango } from './horas.js';
import { resumirDias } from './semana.js';
import { unirNombres } from './equipo.js';
import { bloquesDelDia, diasDelBarbero, tieneHorarioPropio } from './horarioEquipo.js';
import { fmtTelefono } from './telefono.js';
import { duracionTurno, leerProductos, leerServicios, nombresDeItems } from './servicios.js';

/**
 * resumirHorarioBarbero
 * El horario de un barbero en renglones: "Horario del local", o un renglón por
 * grupo de días con los mismos bloques ("Lun a vie · 10:00 a 14:00 y 15:00 a 20:00").
 * @param {Object} barbero
 * @returns {string[]}
 */
export function resumirHorarioBarbero(barbero) {
  if (!tieneHorarioPropio(barbero)) return ['Horario del local'];
  const grupos = [];
  diasDelBarbero(barbero).forEach((dia) => {
    const texto = bloquesDelDia(barbero, dia).map(fmtRango).join(' y ');
    const grupo = grupos.find((g) => g.texto === texto);
    if (grupo) grupo.dias.push(dia);
    else grupos.push({ texto, dias: [dia] });
  });
  if (grupos.length === 0) return ['Sin días elegidos'];
  return grupos
    .map((g) => ({ ...g, resumen: resumirDias(g.dias) }))
    .sort((a, b) => b.dias.length - a.dias.length)
    .map((g) => `${g.resumen} · ${g.texto}`);
}

/**
 * resumirServicios
 * Los servicios para la tarjeta del formulario: hasta `tope` nombres y "y N más".
 * @param {Object} datos
 * @param {number} [tope=3]
 * @returns {string} '' si no hay servicios con nombre.
 */
export function resumirServicios(datos, tope = 3) {
  const nombres = nombresDeItems(leerServicios(datos));
  if (nombres.length <= tope) return unirNombres(nombres);
  return `${nombres.slice(0, tope).join(', ')} y ${nombres.length - tope} más`;
}

/**
 * detalleServicios
 * El renglón de abajo de los servicios en la tarjeta: el turno y los productos
 * ("Turnos de 30 min · 3 productos").
 * @param {Object} datos
 * @returns {string} '' si no hay nada que decir.
 */
export function detalleServicios(datos) {
  const turno = duracionTurno(datos);
  const productos = leerProductos(datos).length;
  return [
    turno ? `Turnos de ${turno} min` : null,
    productos > 0 ? `${productos} ${productos === 1 ? 'producto' : 'productos'}` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * fmtTelefonoGuardado
 * Un teléfono de `datos` para leer: con formato si ya es un número completo
 * (E.164); si no, '' (un número a medio escribir no se muestra).
 * @param {string} valor
 * @returns {string}
 */
export function fmtTelefonoGuardado(valor) {
  if (typeof valor !== 'string' || !/^\+[1-9]\d{7,14}$/.test(valor.trim())) return '';
  return fmtTelefono(valor.trim());
}

/**
 * linkCorto
 * El link de reseñas, corto: solo el dominio y el comienzo del camino
 * ("g.page/r/CbX…"), para que entre en un renglón.
 * @param {string} url
 * @param {number} [largo=32] - Tope de caracteres
 * @returns {string} '' si no es un link.
 */
export function linkCorto(url, largo = 32) {
  if (typeof url !== 'string' || url.trim() === '') return '';
  let texto;
  try {
    const u = new URL(url.trim());
    texto = `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    texto = url.trim();
  }
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}
