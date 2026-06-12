// /frontend-landing/src/config/landing.js
// Configuración editable de la landing en UN solo lugar: datos de contacto,
// precio y flags. Cambiar el precio o el WhatsApp se hace acá, no en los
// componentes. Si algún valor es null, la UI lo maneja (ver utils/contacto.js
// y la sección Plan).

/**
 * MARCA — identidad de texto del producto.
 */
export const MARCA = {
  nombre:   'BarberManager',
  tagline:  'Software de gestión para barberías',
  dominio:  'barbermanager.app',
};

/**
 * CONTACTO — canales de contacto y mensajes pre-cargados.
 * `whatsapp` va en formato internacional sin "+" ni espacios (lo que pide la
 * API wa.me). 549 = Argentina móvil, 11 = área, resto = número.
 */
export const CONTACTO = {
  whatsapp:        '5491133111686',
  whatsappDisplay: '+54 9 11 3311-1686',
  email:           'facundolunagrebe@gmail.com',

  // Mensajes que se abren ya escritos para bajar la fricción del contacto.
  mensajeWhatsApp: 'Hola, tengo una barbería y quiero probar BarberManager durante el primer mes gratis.',
  asuntoEmail:     'Quiero probar BarberManager — primer mes gratis',
  cuerpoEmail:     'Hola, tengo una barbería y quiero probar BarberManager durante el primer mes gratis. Mi barbería es:',
};

/**
 * PRECIO — valor de la suscripción mensual.
 * `mensual` es un número en la moneda indicada, o null para mostrar
 * "Consultanos el precio" en vez de un monto.
 */
export const PRECIO = {
  mensual: 40000,
  moneda:  'ARS',
};

/**
 * FLAGS — interruptores de secciones opcionales.
 * `mostrarTestimonios`: la sección queda maquetada pero oculta hasta tener
 * testimonios reales (no publicar placeholders inventados).
 */
export const FLAGS = {
  mostrarTestimonios: false,
};

/**
 * CAPTURAS — rutas de los screenshots del producto.
 * Subí las imágenes a `public/screenshots/` y poné acá la ruta (empezando con
 * "/"). Mientras el valor sea null, la UI muestra un placeholder neutro en su
 * lugar (no rompe). Ejemplo: panel: '/screenshots/panel-inicio.png'.
 */
export const CAPTURAS = {
  planillas: '/screenshots/seccionPlanillas.jpg', // Hero — pantalla de Planillas (reemplaza el registro en papel)
};

/**
 * VIDEOS — fuentes de los videos del producto.
 * Cada entrada acepta:
 *   - src: ruta a un MP4 en public/videos/ (ej. '/videos/turnero.mp4'), o
 *   - youtubeId: id de un video "No listado" de YouTube (ej. 'dQw4w9WgXcQ').
 *   - poster: imagen de portada (ej. '/videos/turnero.jpg'). Opcional pero recomendada.
 *   - aspect: relación de aspecto del marco ('16 / 9' apaisado, '9 / 16' vertical).
 * Mientras src e youtubeId sean null, la UI muestra un placeholder (no rompe).
 */
export const VIDEOS = {
  turnero: { src: null, poster: null, youtubeId: null, aspect: '16 / 9' },
  barbero: { src: null, poster: null, youtubeId: null, aspect: '16 / 9' },
  gestion: { src: null, poster: null, youtubeId: null, aspect: '16 / 9' },
};
