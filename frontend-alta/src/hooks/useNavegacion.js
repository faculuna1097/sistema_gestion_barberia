// /frontend-alta/src/hooks/useNavegacion.js
// Navegación del formulario: una pila de pantallas integrada con el historial
// del navegador (history.pushState / popstate).
// Adaptado de frontend-turnero/src/hooks/useNavegacion.js.
//
// Por qué con el historial: el "atrás" del celular (gesto o botón de Android)
// tiene que volver un paso, no sacar al cliente del formulario.
//
// Modelo (igual que el turnero):
// - Cada pantalla que se apila es una entrada del historial, en la misma URL
//   (/<token>): la pantalla va en el estado del historial, no en la URL. La
//   entrada guarda en `history.state.al` el token y la pila completa hasta ella
//   (números de pantalla). El historial manda; el estado de React lo refleja.
// - "Volver" es history.back(): el mismo camino que el "atrás" del sistema.
//
// Qué cambia respecto del turnero: acá los datos no se pierden al recargar
// (están guardados en el backend), así que no se rebobina a la primera
// pantalla. Al cargar:
// - si la entrada actual ya es de este formulario (una recarga en la misma
//   pestaña), se retoma su pila;
// - si no (el link recién abierto, o desde otro dispositivo), se rearma el
//   historial con `pilaInicial` (el camino hasta datos.progreso.pantalla), una
//   entrada por pantalla, para que el "atrás" vuelva de a un paso.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * leerPilaDelHistorial
 * La pila que guarda la entrada actual del historial, si es de este link.
 * @param {string} token - Token del link
 * @returns {number[]|null} La pila, o null si la entrada no es de este formulario.
 */
function leerPilaDelHistorial(token) {
  const al = history.state?.al;
  if (!al || al.token !== token || !Array.isArray(al.pila) || al.pila.length === 0) return null;
  return al.pila;
}

/**
 * useNavegacion
 * Pila de pantallas del formulario, sincronizada con el historial.
 * @param {Object} opciones
 * @param {string} opciones.token - Token del link (se guarda en cada entrada)
 * @param {number[]} opciones.pilaInicial - Pila para un historial que no es de
 *   este formulario (caminoHasta(progreso.pantalla)). Se lee solo al montar.
 * @returns {{
 *   pantalla: number,
 *   profundidad: number,
 *   direccion: 'adelante'|'atras'|null,
 *   irA: (pantalla: number) => void,
 *   volver: () => void,
 * }} `pantalla` es la de arriba de la pila; `profundidad`, el largo de la
 *   pila; `direccion`, la del último movimiento (null en la primera carga)
 */
export function useNavegacion({ token, pilaInicial }) {
  // Si la entrada actual ya es del formulario, se retoma su pila (sin flash: se
  // decide en el primer render). Leer el historial no tiene efectos.
  const [nav, setNav] = useState(() => ({
    pila: leerPilaDelHistorial(token) ?? pilaInicial,
    direccion: null,
  }));

  // El historial se arma una sola vez por carga de la página. En desarrollo
  // StrictMode corre los efectos dos veces; el ref se conserva entre las dos.
  const inicializadoRef = useRef(false);

  useEffect(() => {
    if (!inicializadoRef.current) {
      inicializadoRef.current = true;
      // El scroll lo maneja el hook (arriba en cada cambio de pantalla): la
      // restauración automática del navegador pelea con el render de React.
      history.scrollRestoration = 'manual';
      if (!leerPilaDelHistorial(token)) {
        // Una entrada por pantalla del camino: la actual pasa a ser la primera
        // y se apilan las demás. pushState no dispara popstate.
        const pila = nav.pila;
        history.replaceState({ al: { token, pila: pila.slice(0, 1) } }, '');
        for (let i = 2; i <= pila.length; i += 1) {
          history.pushState({ al: { token, pila: pila.slice(0, i) } }, '');
        }
      }
    }

    /**
     * alCambiarHistorial
     * Handler de popstate ("atrás"/"adelante" del navegador o history.back()).
     * Refleja la entrada nueva en la pila. Una entrada que no es de este
     * formulario (no debería haber: todas las de esta URL se escriben acá) se
     * ignora.
     * @param {PopStateEvent} e
     */
    function alCambiarHistorial(e) {
      const al = e.state?.al;
      if (!al || al.token !== token || !Array.isArray(al.pila) || al.pila.length === 0) return;
      setNav((prev) => {
        if (prev.pila.length === al.pila.length
          && prev.pila[prev.pila.length - 1] === al.pila[al.pila.length - 1]) {
          return prev;
        }
        return {
          pila: al.pila,
          direccion: al.pila.length < prev.pila.length ? 'atras' : 'adelante',
        };
      });
    }

    window.addEventListener('popstate', alCambiarHistorial);
    return () => window.removeEventListener('popstate', alCambiarHistorial);
    // nav.pila se lee solo en la primera corrida (para armar el historial).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Cada cambio de pantalla arranca arriba de todo (antes de pintar).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [nav.pila]);

  /**
   * irA
   * Apila una pantalla (entrada nueva en el historial). Puede saltear pasos:
   * "Volver" regresa a la pantalla desde la que se llegó.
   * @param {number} pantalla - Número de la pantalla destino
   */
  const irA = (pantalla) => {
    const pila = [...nav.pila, pantalla];
    history.pushState({ al: { token, pila } }, '');
    setNav({ pila, direccion: 'adelante' });
  };

  /**
   * volver
   * Vuelve una pantalla: mismo camino que el "atrás" del sistema (popstate).
   * En la primera pantalla no hace nada (history.back sacaría al cliente).
   */
  const volver = () => {
    if (nav.pila.length > 1) history.back();
  };

  return {
    pantalla: nav.pila[nav.pila.length - 1],
    profundidad: nav.pila.length,
    direccion: nav.direccion,
    irA,
    volver,
  };
}
