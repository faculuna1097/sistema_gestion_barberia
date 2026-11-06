// /backend/src/utils/constantes.js
// Constantes compartidas del backend. Centralizar acá cualquier valor mágico
// que se repita en más de un archivo o que tenga sentido configurar a futuro.

// Timezone canónica del sistema. Todas las queries SQL con AT TIME ZONE y
// todo el cómputo de fechas en JS (luxon) debe usar esta constante en lugar
// de hardcodear el string.
export const TZ = 'America/Argentina/Buenos_Aires';

// Margen mínimo entre "ahora" y el primer slot reservable cuando la fecha
// consultada es hoy. Evita reservas para "dentro de un minuto" que el cliente
// no llega a cumplir. Mencionado en decisiones_turnero.md.
// En el futuro podría volverse configurable por tenant.
export const ANTELACION_MINIMA_MINUTOS = 5;

// Tope de días (extremos inclusive) del rango de GET /api/turnero/dias-disponibles.
// El endpoint es público y recorre el rango día por día en memoria: sin tope, un
// rango de años bloquea el proceso durante segundos. Los fronts piden 15 días;
// 62 (dos meses) deja margen para un calendario mensual sin habilitar abusos.
export const DIAS_MAXIMOS_RANGO_DISPONIBILIDAD = 62;

// Cuántos días hacia adelante se puede reservar o reprogramar desde el turnero
// público, contando hoy como el día 1 (el último es hoy + 14). Tiene que coincidir
// con DIAS_RESERVABLES de frontend-turnero/src/utils/fecha.js. No aplica a
// POST /api/admin/turnos: el admin y el barbero pueden cargar más adelante.
export const DIAS_RESERVABLES = 15;

// Largo máximo de la descripción de un gasto. El iPad corta en el mismo número
// (frontend/src/screens/flows/FlujoGasto.jsx).
export const MAX_DESCRIPCION_GASTO = 200;

// Valores de barbero_suspension.tipo (mismo CHECK que la DB). Un descanso es una
// suspensión corta que el barbero marca sobre slots libres (decisiones_descansos.md).
export const TIPOS_SUSPENSION = ['suspension', 'descanso'];

// Hora local (ART) a la que se envía el lote de recordatorios. Hoy la respeta
// el schedule del cron (Railway corre en UTC: 20:30 ART = 23:30 UTC). Se deja
// acá como referencia única; el envío no la lee en runtime todavía.
export const RECORDATORIO_HORA_ENVIO = '20:30';

// Días de anticipación del recordatorio respecto del turno. 1 = la noche
// anterior. Lo usa el cálculo de la fecha objetivo del lote (luxon).
export const RECORDATORIO_DIAS_ANTES = 1;
