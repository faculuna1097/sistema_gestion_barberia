// /frontend-landing/src/content/alternativas.js
// Bloque "¿Y frente a otras apps de turnos?" de la sección Comparación: una
// sola fuente de datos (D9 del plan de la landing). Lo lee la UI y, en el
// build, el llms.txt. Son datos puros: strings, sin JSX ni íconos (el ícono de
// cada punto lo asigna el componente, por posición).
// Cada afirmación sobre un competidor tiene que ser verdadera y estar fechada
// (D8): si cambia la nota al pie, revisar los puntos.

/**
 * ALTERNATIVAS — título, puntos (en orden) y nota al pie del bloque.
 * @type {{ titulo: string, puntos: { titulo: string, texto: string }[], nota: string }}
 */
export const ALTERNATIVAS = {
  titulo: '¿Y frente a otras apps de turnos?',
  puntos: [
    {
      titulo: 'No pagás por barbero.',
      texto: 'Fresha, Booksy y Setmore cobran según cuántos miembros tenga tu equipo. En BarberManager el precio es fijo: sumás todos los barberos que quieras sin pagar más.',
    },
    {
      titulo: 'En pesos, sin sorpresas con el dólar.',
      texto: 'Booksy y Setmore cobran en dólares. BarberManager se paga en pesos.',
    },
    {
      titulo: 'Todo en el mismo precio.',
      texto: 'Turnero online, app para barberos, caja, gastos, planillas de cada barbero y balance del mes. Sin complementos pagos.',
    },
    {
      titulo: 'Te acompañamos.',
      texto: 'Te ayudamos a dejar todo configurado y te atendemos por WhatsApp.',
    },
  ],
  nota: 'Datos de Fresha, Booksy y Setmore según sus páginas de precios oficiales al 1 de octubre de 2026.',
};
