// /frontend-landing/src/content/faq.js
// Preguntas frecuentes de la landing: una sola fuente de datos (D9 del plan de
// la landing). Las lee la sección FAQ y, en el build, el JSON-LD (FAQPage) y el
// llms.txt, que tienen que coincidir con lo visible. Son datos puros: strings,
// sin JSX. El precio se arma desde PRECIO (config), nunca con el número escrito.

import { PRECIO } from '../config/landing.js';
import { fmtPesos } from '../utils/formato.js';

/**
 * respuestaPrecio
 * Arma la respuesta de "¿Cuánto cuesta?" con el precio de la config. Si
 * PRECIO.mensual es null, devuelve una versión sin monto (igual que el Plan,
 * que muestra "consultanos el precio").
 * @returns {string} Texto de la respuesta
 */
function respuestaPrecio() {
  if (PRECIO.mensual == null) {
    return 'El primer mes es gratis. Después, una suscripción mensual con todo incluido, sin importar cuántos barberos tengas: consultanos el precio. Sin contrato: cancelás cuando quieras.';
  }
  return `El primer mes es gratis. Después, ${fmtPesos(PRECIO.mensual)} por mes con todo incluido, sin importar cuántos barberos tengas. Sin contrato: cancelás cuando quieras.`;
}

/**
 * FAQS — preguntas y respuestas, en el orden en que se muestran.
 * @type {{ pregunta: string, respuesta: string }[]}
 */
export const FAQS = [
  {
    pregunta: '¿Qué es BarberManager?',
    respuesta: 'Un sistema de gestión para barberías de Argentina. Junta el turnero online para tus clientes, la app de cada barbero y el panel donde cargás cortes, ventas y gastos y ves la caja del día, las planillas y el balance del mes.',
  },
  {
    pregunta: '¿Cuánto cuesta?',
    respuesta: respuestaPrecio(),
  },
  {
    pregunta: '¿Hay límite de barberos?',
    respuesta: 'No. Cargás todos los que tengas sin pagar más. Cada uno tiene su agenda, sus horarios y sus días libres, y vos ves todo el local junto.',
  },
  {
    pregunta: '¿Qué incluye el sistema de gestión?',
    respuesta: 'Registro de cortes, ventas y gastos; caja del día separada en efectivo y Mercado Pago; planillas semanales y mensuales con lo que le toca a cada barbero (comisión y propinas), exportables a Excel; y el balance del mes con la ganancia, los aportes y los retiros.',
  },
  {
    pregunta: '¿En qué se diferencia de Fresha, Booksy o Setmore?',
    respuesta: 'Esas apps cobran según la cantidad de miembros del equipo, y Booksy y Setmore en dólares. BarberManager cobra un precio fijo en pesos con barberos ilimitados, e incluye turnero, app para barberos y la gestión del negocio.',
  },
  {
    pregunta: '¿Para qué barberías sirve?',
    respuesta: 'Para barberías de Argentina de cualquier tamaño, desde un barbero solo hasta equipos grandes, que hoy toman turnos por WhatsApp y llevan la caja en papel o en Excel.',
  },
  {
    pregunta: '¿Sirve si tengo varias sucursales?',
    respuesta: 'Cada suscripción cubre un local. Si tenés varias sucursales, cada una funciona con su propia suscripción.',
  },
  {
    pregunta: '¿Cómo reservan mis clientes?',
    respuesta: 'Con un link que compartís en Instagram o WhatsApp. El cliente elige barbero, servicio y horario, recibe la confirmación al instante y un recordatorio por email la noche anterior.',
  },
  {
    pregunta: '¿Necesito instalar algo? ¿Funciona en el celular?',
    respuesta: 'No instalás nada: funciona desde el navegador. El turnero y la app del barbero andan en el celular; el panel de gestión está pensado para iPad, tablet o computadora.',
  },
  {
    pregunta: '¿Qué pasa con mis datos?',
    respuesta: 'Son tuyos. Quedan guardados de forma segura, los consultás cuando quieras y podés exportar las planillas a Excel.',
  },
  {
    pregunta: '¿Cómo empiezo?',
    respuesta: 'Nos escribís por WhatsApp o email, damos de alta tu barbería y arrancás el primer mes gratis. Te ayudamos a cargar barberos, servicios y horarios.',
  },
];
