// /backend/src/config/jwt.js
// Manejo centralizado de JWT. Único módulo que lee JWT_SECRET y llama a
// jsonwebtoken; los controllers de auth y el authMiddleware usan estos helpers.
// Centralizar acá garantiza dos propiedades en todos los flujos a la vez:
//   1. Validación al boot: si JWT_SECRET falta en producción, el proceso
//      aborta al arrancar con un error explícito, en vez de fallar recién en
//      el primer login (jwt.sign/verify lanzan si el secreto es undefined —
//      el sistema falla cerrado, pero tarde y con un error críptico).
//   2. Algoritmo fijado: firmar y verificar quedan clavados en HS256. Con
//      secreto simétrico el riesgo de confusión de algoritmo es bajo
//      (jsonwebtoken v9 ya rechaza alg:none), pero fijarlo es el estándar.

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Igual que db.js: este módulo puede ser el primero en importarse según el
// punto de entrada, así que carga .env por su cuenta (config() es idempotente).
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Algoritmo único de firma/verificación. HS256 (HMAC con secreto simétrico).
const ALGORITMO = 'HS256';

// Vigencia de todos los tokens del sistema (admin, barbero y operativo).
// La revocación anticipada del operativo va por token_version, no por acá.
const EXPIRACION = '30d';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[jwt] JWT_SECRET no está definida — el servidor no puede arrancar sin secreto de firma.');
  }
  // En desarrollo se permite arrancar sin secreto (p. ej. scripts que no tocan
  // auth), pero cualquier login va a lanzar al firmar. Se avisa una sola vez.
  console.warn('[jwt] JWT_SECRET no está definida — los logins van a fallar hasta setearla en .env');
}

/**
 * firmarToken
 * Firma un JWT con el secreto del sistema, algoritmo HS256 y vigencia de 30 días.
 * @param {Object} payload - Claims del token (tenant_id, rol, barbero_id?, tv?).
 * @returns {string} El JWT firmado.
 * @throws Si JWT_SECRET no está definida (solo posible en desarrollo).
 */
export function firmarToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: ALGORITMO, expiresIn: EXPIRACION });
}

/**
 * verificarFirmaToken
 * Verifica firma y expiración de un JWT, aceptando únicamente HS256.
 * @param {string} token - El JWT crudo (sin el prefijo "Bearer ").
 * @returns {Object} El payload decodificado.
 * @throws Si el token está vencido, manipulado, con firma inválida o con otro algoritmo.
 */
export function verificarFirmaToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [ALGORITMO] });
}
