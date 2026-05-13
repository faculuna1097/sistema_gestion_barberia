// /backend/src/utils/constantes.js
// Constantes compartidas del backend. Centralizar acá cualquier valor mágico
// que se repita en más de un archivo o que tenga sentido configurar a futuro.

// Timezone canónica del sistema. Todas las queries SQL con AT TIME ZONE y
// todo el cómputo de fechas en JS (luxon) debe usar esta constante en lugar
// de hardcodear el string.
export const TZ = 'America/Argentina/Buenos_Aires';

// Margen mínimo entre "ahora" y el primer slot reservable cuando la fecha
// consultada es hoy. Evita reservas para "dentro de un minuto" que el cliente
// no llega a cumplir. Mencionado en plan_turnero_v2.md sección 7.
// En el futuro podría volverse configurable por tenant.
export const ANTELACION_MINIMA_MINUTOS = 5;
