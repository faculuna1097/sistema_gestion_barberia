// /frontend-alta/src/utils/subdominio.js
// Reglas del subdominio de la barbería (el `kings` de kings.barbermanager.app):
// formato, nombres reservados y la sugerencia que se arma desde el nombre.
// Copia de las reglas de backend/src/utils/subdominio.js (los fronts no comparten
// código con el backend): si cambian allá, cambian acá. Sin `subdominioOcupado`:
// si lo usa otra barbería lo dice GET /api/alta/:token/subdominio/:valor
// (services/api.js → consultarSubdominio).
// Funciones puras (sin React) para poder probarlas con Node.

// Copia de SUBDOMINIO_MIN y SUBDOMINIO_MAX (backend/src/utils/subdominio.js).
export const SUBDOMINIO_MIN = 3;
export const SUBDOMINIO_MAX = 30;

// Copia de REGEX_SUBDOMINIO: letras minúsculas y dígitos, con guiones solo entre
// medio (ni al principio, ni al final, ni dos seguidos).
const REGEX_SUBDOMINIO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Copia de SUBDOMINIOS_RESERVADOS: los que usa (o puede usar) la plataforma.
export const SUBDOMINIOS_RESERVADOS = new Set([
  'www', 'alta', 'api', 'app', 'admin', 'send', 'mail', 'turnos', 'barbero', 'demo',
]);

// Copia de MENSAJES_SUBDOMINIO: mensaje para el cliente según el motivo.
export const MENSAJES_SUBDOMINIO = {
  formato: `El link tiene que tener de ${SUBDOMINIO_MIN} a ${SUBDOMINIO_MAX} letras minúsculas o números, y puede llevar guiones entre medio.`,
  reservado: 'Ese link está reservado. Probá con otro.',
  ocupado: 'Ese link ya lo usa otra barbería. Probá con otro.',
};

/**
 * motivoFormatoSubdominio
 * Copia de motivoFormatoSubdominio (backend/src/utils/subdominio.js).
 * Revisa el formato y los reservados de un subdominio. No recorta ni pasa a
 * minúsculas: el valor tiene que llegar ya normalizado.
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
 * sugerirSubdominio
 * Copia de sugerirSubdominio (backend/src/utils/subdominio.js).
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
    .replace(/['’]/g, '')            // apóstrofo recto y tipográfico
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMINIO_MAX)
    .replace(/-+$/, '');
}
