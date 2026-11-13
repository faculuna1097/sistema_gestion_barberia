// /frontend-barbero/src/utils/pantalla.js
// Medidas de la pantalla para las superficies a pantalla completa (hoy,
// FondoLocal del login). Copia de /frontend/src/utils/pantalla.js (los fronts
// no comparten código, sistema_de_disenio.md §8).

/**
 * ALTO_VISIBLE
 * Alto del área visible de la pantalla, como unidad CSS: '100dvh' si el
 * navegador la soporta, si no '100vh'.
 *
 * En Safari (iPhone y iPad), `100vh` mide el alto SIN las barras del
 * navegador, así que una caja de `100vh` queda más alta que lo que se ve y su
 * borde de abajo cae debajo de la barra. `100dvh` mide lo que se ve. En un
 * estilo inline no se puede declarar un valor de respaldo, y un Safari anterior
 * a iOS 15.4 descarta `dvh`: por eso se elige una vez, al cargar.
 *
 * @type {string}
 */
export const ALTO_VISIBLE =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('height', '100dvh')
    ? '100dvh'
    : '100vh';
