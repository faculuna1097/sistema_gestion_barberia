// /backend/src/services/recuperacionService.js
// Recuperación de la contraseña del iPad (modo operativo) y del PIN de admin por
// mail (plan_mejoras_operativas.md, F6). Acá vive todo lo que no es HTTP: el token,
// su hash, el link, el mail enmascarado y las tres queries sobre token_recuperacion.
// El controller es controllers/authRecuperar.js.
//
// El token: 32 bytes aleatorios en base64url (43 caracteres). En la DB se guarda solo
// su SHA-256 (token_hash, UNIQUE): quien lea la tabla no puede usar los links. No hace
// falta un hash lento (bcrypt) porque el token no es una contraseña elegida por una
// persona: 256 bits aleatorios no se adivinan por fuerza bruta.
//
// El link lleva el token en el fragmento (#recuperar=…), nunca en la ruta ni en la
// query: el navegador no manda el fragmento al servidor, así que no queda en los logs
// de Vercel ni de Railway.

import crypto from 'node:crypto';
import { query } from '../config/db.js';

// Las credenciales que se pueden recuperar (mismo CHECK que token_recuperacion.tipo).
export const TIPOS_RECUPERACION = ['operativo', 'pin_admin'];

// Freno anti-spam: si ya se emitió un link de ese tenant y tipo hace menos de esto, no
// se manda otro mail.
const MINUTOS_ENTRE_MAILS = 2;

// 32 bytes en base64url sin relleno = 43 caracteres de [A-Za-z0-9_-].
const REGEX_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * generarToken
 * @returns {string} Un token nuevo: 32 bytes aleatorios en base64url.
 */
export const generarToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * hashToken
 * @param {string} token - El token del link.
 * @returns {string} Su SHA-256 en hexadecimal (lo que se guarda en token_hash).
 */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * esFormatoToken
 * Chequeo de forma antes de tocar la DB (un token mal formado no puede existir).
 * @param {*} token - Lo que llegó en el body.
 * @returns {boolean} true si tiene la forma de un token generado por generarToken.
 */
export const esFormatoToken = (token) => typeof token === 'string' && REGEX_TOKEN.test(token);

/**
 * enmascararEmail
 * Tapa la mayor parte del usuario del mail para mostrarlo en pantalla (y en el log):
 * 'kingsai@gmail.com' → 'ki•••@gmail.com'. Con un usuario de 1 o 2 letras deja solo
 * la primera.
 * @param {string} email - Mail completo.
 * @returns {string} El mail enmascarado.
 */
export const enmascararEmail = (email) => {
  const arroba = email.lastIndexOf('@');
  const usuario = email.slice(0, arroba);
  const dominio = email.slice(arroba + 1);
  const visible = usuario.length > 2 ? usuario.slice(0, 2) : usuario.slice(0, 1);
  return `${visible}•••@${dominio}`;
};

/**
 * construirLinkRecuperacion
 * Link al panel del tenant con el token en el fragmento. Sin subdominio (desarrollo
 * local) usa PANEL_BASE_URL, o el puerto del panel en dev. Mismo criterio que
 * construirLinkGestion (services/turnosService.js) para el turnero.
 * @param {string|undefined} subdominio - Header X-Tenant-Subdomain del request.
 * @param {string} token - Token del link (en texto plano).
 * @returns {string} URL completa, ej. 'https://kings.barbermanager.app/#recuperar=<token>'.
 */
export const construirLinkRecuperacion = (subdominio, token) => {
  const base = subdominio
    ? `https://${subdominio}.barbermanager.app`
    : (process.env.PANEL_BASE_URL ?? 'http://localhost:5173');
  return `${base}/#recuperar=${token}`;
};

/**
 * armarLinkRecuperacion
 * Arma el link leyendo el subdominio del request (como armarLinkGestion).
 * @param {Object} req - Request de Express.
 * @param {string} token - Token del link.
 * @returns {string} URL completa.
 */
export const armarLinkRecuperacion = (req, token) =>
  construirLinkRecuperacion(req.headers['x-tenant-subdomain'], token);

/**
 * emitirToken
 * En una sola sentencia: si no hay un link de ese tenant y tipo creado hace menos de
 * MINUTOS_ENTRE_MAILS, anula los anteriores sin usar (les pone vence_en = now(): se
 * conservan, pero dejan de valer) y guarda el nuevo. Si lo hay, no hace nada.
 * Las tres partes ven la misma foto de la tabla: el UPDATE no toca la fila nueva.
 * @param {string} tenantId - UUID del tenant.
 * @param {'operativo'|'pin_admin'} tipo
 * @param {string} tokenHash - hashToken(token).
 * @returns {Promise<boolean>} true si guardó el token nuevo; false si lo frenó el
 *   anti-spam (hay que responder lo mismo, sin mandar el mail).
 */
export async function emitirToken(tenantId, tipo, tokenHash) {
  const resultado = await query(
    `WITH reciente AS (
       SELECT EXISTS (
         SELECT 1 FROM token_recuperacion
         WHERE tenant_id = $1 AND tipo = $2
           AND created_at > now() - make_interval(mins => $4)
       ) AS hay
     ),
     anulados AS (
       UPDATE token_recuperacion SET vence_en = now()
       WHERE tenant_id = $1 AND tipo = $2 AND usado_en IS NULL AND vence_en > now()
         AND NOT (SELECT hay FROM reciente)
       RETURNING id
     ),
     nuevo AS (
       INSERT INTO token_recuperacion (tenant_id, tipo, token_hash)
       SELECT $1, $2, $3 WHERE NOT (SELECT hay FROM reciente)
       RETURNING id
     )
     SELECT (SELECT count(*) FROM nuevo) AS creados, (SELECT count(*) FROM anulados) AS anulados`,
    [tenantId, tipo, tokenHash, MINUTOS_ENTRE_MAILS]
  );
  return Number(resultado.rows[0].creados) === 1;
}

/**
 * leerTipoTokenVigente
 * Busca un token sin usar ni vencido del tenant. No lo consume.
 * @param {string} tenantId - UUID del tenant del request.
 * @param {string} tokenHash - hashToken(token).
 * @returns {Promise<'operativo'|'pin_admin'|null>} Su tipo, o null si no sirve
 *   (inexistente, de otro tenant, usado o vencido: todos dan lo mismo a propósito).
 */
export async function leerTipoTokenVigente(tenantId, tokenHash) {
  const resultado = await query(
    `SELECT tipo FROM token_recuperacion
     WHERE token_hash = $1 AND tenant_id = $2 AND usado_en IS NULL AND vence_en > now()`,
    [tokenHash, tenantId]
  );
  return resultado.rows[0]?.tipo ?? null;
}

// Cambio de credencial por tipo: la columna del hash y la de su token_version (que
// cierra las otras sesiones de ese rol). Constantes internas, nunca input del usuario.
const COLUMNAS_POR_TIPO = {
  operativo: { hash: 'operativo_password_hash', version: 'operativo_token_version' },
  pin_admin: { hash: 'pin_admin', version: 'admin_token_version' },
};

/**
 * usarToken
 * Consume el token y cambia la credencial en una sola sentencia: el CTE marca el
 * token como usado (solo si sigue sin usar y sin vencer) y el UPDATE del tenant corre
 * solo para la fila que devolvió ese CTE. O pasan las dos cosas o ninguna.
 * Con dos requests a la vez con el mismo token, Postgres hace esperar al segundo en
 * la fila del token y, cuando el primero termina, vuelve a evaluar
 * `usado_en IS NULL`: ya no se cumple, el CTE no devuelve nada y el segundo no cambia
 * la credencial.
 * @param {string} tenantId - UUID del tenant del request.
 * @param {string} tokenHash - hashToken(token).
 * @param {'operativo'|'pin_admin'} tipo - El tipo leído antes con leerTipoTokenVigente.
 * @param {string} hashNuevo - La credencial nueva ya hasheada con bcrypt.
 * @returns {Promise<boolean>} true si cambió la credencial; false si el token dejó de
 *   servir entre la lectura y este momento (otro request lo usó, o venció).
 */
export async function usarToken(tenantId, tokenHash, tipo, hashNuevo) {
  const columnas = COLUMNAS_POR_TIPO[tipo];
  const resultado = await query(
    `WITH usado AS (
       UPDATE token_recuperacion SET usado_en = now()
       WHERE token_hash = $1 AND tenant_id = $2 AND tipo = $3
         AND usado_en IS NULL AND vence_en > now()
       RETURNING tenant_id
     )
     UPDATE tenant
     SET ${columnas.hash} = $4,
         ${columnas.version} = ${columnas.version} + 1
     WHERE id = (SELECT tenant_id FROM usado)
     RETURNING id`,
    [tokenHash, tenantId, tipo, hashNuevo]
  );
  return resultado.rows.length === 1;
}
