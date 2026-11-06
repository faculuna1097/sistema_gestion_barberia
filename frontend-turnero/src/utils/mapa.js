// /frontend-turnero/src/utils/mapa.js
// Link a un mapa para llegar al local. Sin estado, sin dependencias.

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
