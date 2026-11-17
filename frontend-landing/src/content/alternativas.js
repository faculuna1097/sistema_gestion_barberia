// /frontend-landing/src/content/alternativas.js
// Bloque "¿Y frente a una app de turnos?" de la sección Comparación: una sola
// fuente de datos (D9 del plan de la landing). Lo lee la UI y, en el build, el
// llms.txt. Son datos puros: strings, sin JSX ni íconos (el ícono de cada punto
// lo asigna el componente, por posición).
// Los puntos hablan solo de BarberManager: no se afirma nada de otras apps
// (nombres, precios ni funciones), así no hay datos de terceros que puedan
// quedar viejos. Si alguna vez vuelve una nota al pie, la UI y el llms.txt la
// muestran solas.

/**
 * ALTERNATIVAS — título, puntos (en orden) y nota al pie opcional del bloque.
 * @type {{ titulo: string, puntos: { titulo: string, texto: string }[], nota: string | null }}
 */
export const ALTERNATIVAS = {
  titulo: '¿Y frente a una app de turnos?',
  puntos: [
    {
      titulo: 'Además de la agenda, la plata.',
      texto: 'Una app de turnos te ordena la agenda. BarberManager además arma la caja del día, registra los gastos y calcula lo que le toca a cada barbero.',
    },
    {
      titulo: 'Barberos ilimitados.',
      texto: 'El precio es el mismo con un barbero o con diez: no pagás por cada uno que sumás.',
    },
    {
      titulo: 'Todo en una sola suscripción, en pesos.',
      texto: 'Turnero, app para barberos, caja, planillas y balance del mes, sin complementos pagos ni comisiones por reserva.',
    },
    {
      titulo: 'Te acompañamos.',
      texto: 'Te ayudamos a dejar todo configurado y te atendemos por WhatsApp.',
    },
  ],
  nota: null,
};
