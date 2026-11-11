// /frontend-alta/src/utils/mapa.js
// Link a un mapa que busca una dirección. Sin estado, sin dependencias.
// Copia idéntica de linkMapa (frontend-turnero/src/utils/mapa.js): es el mismo
// link que abre el "Cómo llegar" del turnero, así el dueño ve en el formulario
// exactamente lo que van a ver sus clientes.

/**
 * linkMapa
 * Link de Google Maps que busca una dirección. En el celular abre la app de
 * mapas (Google Maps, o la web si no está instalada); en una computadora, la web.
 * @param {string} direccion - Dirección del local, tal como está cargada
 * @returns {string} Ej: 'https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234'
 */
export function linkMapa(direccion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}
