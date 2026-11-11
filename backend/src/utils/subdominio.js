// /backend/src/utils/subdominio.js
// Reglas del subdominio de un tenant (el `kings` de kings.barbermanager.app), para
// el formulario de alta de clientes: formato, nombres reservados, si ya lo usa un
// tenant y la sugerencia que se arma desde el nombre del negocio.
// frontend-alta tiene su copia de las reglas de formato y de la sugerencia (los
// fronts no comparten código con el backend): si cambian acá, cambian allá.

import { query } from '../config/db.js';

export const SUBDOMINIO_MIN = 3;
export const SUBDOMINIO_MAX = 30;

// Letras minúsculas y dígitos, con guiones solo entre medio (ni al principio, ni
// al final, ni dos seguidos).
const REGEX_SUBDOMINIO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Subdominios que usa (o puede usar) la plataforma: no se le dan a un cliente.
export const SUBDOMINIOS_RESERVADOS = new Set([
  'www', 'alta', 'api', 'app', 'admin', 'send', 'mail', 'turnos', 'barbero', 'demo',
]);

// Mensaje para el cliente según el motivo por el que un subdominio no está disponible.
export const MENSAJES_SUBDOMINIO = {
  formato: `El link tiene que tener de ${SUBDOMINIO_MIN} a ${SUBDOMINIO_MAX} letras minúsculas o números, y puede llevar guiones entre medio.`,
  reservado: 'Ese link está reservado. Probá con otro.',
  ocupado: 'Ese link ya lo usa otra barbería. Probá con otro.',
};

/**
 * motivoFormatoSubdominio
 * Revisa el formato y los reservados de un subdominio, sin mirar la DB. No recorta
 * ni pasa a minúsculas: el valor tiene que llegar ya normalizado.
 * @param {*} valor - Subdominio pedido.
 * @returns {null|'formato'|'reservado'} null si el formato es válido y no está reservado.
 */
export function motivoFormatoSubdominio(valor) {
  if (typeof valor !== 'string') return 'formato';
  if (valor.length < SUBDOMINIO_MIN || valor.length > SUBDOMINIO_MAX) return 'formato';
  if (!REGEX_SUBDOMINIO.test(valor)) return 'formato';
  if (SUBDOMINIOS_RESERVADOS.has(valor)) return 'reservado';
  return null;
}

/**
 * subdominioOcupado
 * Indica si algún tenant, activo o no, ya tiene ese subdominio. Compara sin
 * distinguir mayúsculas, por si una fila vieja se cargó a mano con alguna.
 * @param {string} subdominio - Subdominio con formato ya validado (motivoFormatoSubdominio).
 * @returns {Promise<boolean>} true si ya lo usa un tenant.
 */
export async function subdominioOcupado(subdominio) {
  const result = await query(
    'SELECT EXISTS (SELECT 1 FROM tenant WHERE lower(subdominio) = $1) AS ocupado',
    [subdominio.toLowerCase()]
  );
  return result.rows[0].ocupado;
}

/**
 * sugerirSubdominio
 * Arma un subdominio a partir del nombre del negocio: sin tildes (la ñ pasa a n),
 * sin apóstrofos, en minúsculas y con guiones en lugar de espacios y símbolos,
 * recortado a SUBDOMINIO_MAX. Ej.: "Kings Barber's Club" → "kings-barbers-club".
 * No garantiza que esté disponible: puede salir corto, reservado u ocupado.
 * @param {*} nombre - Nombre del negocio tal como lo escribió el cliente.
 * @returns {string} La sugerencia (string vacío si no queda nada usable).
 */
export function sugerirSubdominio(nombre) {
  if (typeof nombre !== 'string') return '';
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de tilde que deja NFD (á → a + U+0301)
    .toLowerCase()
    .replace(/['’]/g, '')       // apóstrofo recto y tipográfico
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMINIO_MAX)
    .replace(/-+$/, '');
}
