// /frontend-turnero/src/hooks/useNavegacion.js
// Navegación del flujo de reserva: una pila de pantallas integrada con el
// historial del navegador (history.pushState / popstate).
//
// Por qué con el historial: el "atrás" del celular (gesto o botón de Android)
// tiene que volver un paso, no sacar al cliente del turnero.
//
// Modelo:
// - Cada pantalla que se apila es una entrada del historial, en la misma URL.
//   La entrada guarda en `history.state.tt` la pila completa hasta ella
//   (`pila`, nombres de pantalla) y el id del flujo de reserva (`flujo`).
//   El historial manda; el estado de React lo refleja para renderizar.
// - "Volver" es history.back(): el mismo camino que el "atrás" del sistema.
// - Un flujo es la vida de una reserva en memoria. Las entradas de otro flujo
//   (de antes de recargar la página, o de una reserva ya confirmada) apuntan
//   a pantallas cuyos datos ya no existen. Al caer en una, se muestra la
//   landing y se rebobina el historial hasta la landing de ese flujo, que está
//   `pila.length - 1` entradas atrás.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Pantalla base de la pila: la única que no necesita datos de la reserva.
const PANTALLA_INICIO = 'landing';

/**
 * nuevoIdFlujo
 * Id corto y único por flujo. No usa crypto.randomUUID porque no existe fuera
 * de contextos seguros (ej. probar desde el celular por la IP de la red local).
 * @returns {string} Ej: 'lz3k9a-4f8q2c'
 */
function nuevoIdFlujo() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * marcarInicio
 * Marca la entrada actual del historial como la landing del flujo dado.
 * @param {string} flujo - Id del flujo actual
 */
function marcarInicio(flujo) {
  history.replaceState({ tt: { flujo, pila: [PANTALLA_INICIO] } }, '');
}

/**
 * useNavegacion
 * Pila de pantallas del flujo de reserva, sincronizada con el historial.
 * @param {Object} [opciones]
 * @param {boolean} [opciones.activa=true] - false en las rutas que no usan el
 *   flujo (gestión del turno): el hook no toca el historial
 * @param {Function} [opciones.alReiniciar] - Se llama cuando el cliente vuelve
 *   a la landing desde un flujo cerrado o viejo (ej. "atrás" desde el éxito):
 *   ahí hay que descartar la reserva en memoria
 * @returns {{
 *   pantalla: string,
 *   profundidad: number,
 *   direccion: 'adelante'|'atras'|null,
 *   irA: (pantalla: string) => void,
 *   volver: () => void,
 *   cerrarFlujo: (pantalla: string) => void,
 *   volverAlInicio: () => void,
 * }} `pantalla` es la de arriba de la pila; `profundidad`, el largo de la
 *   pila; `direccion`, la del último movimiento (null en la primera carga)
 */
export function useNavegacion({ activa = true, alReiniciar } = {}) {
  const [nav, setNav] = useState({ pila: [PANTALLA_INICIO], direccion: null });

  // Id del flujo actual. Vive en un ref: solo lo leen los handlers.
  const flujoRef = useRef(null);

  // Última versión de alReiniciar (el listener de popstate se registra una vez).
  const alReiniciarRef = useRef(alReiniciar);
  useEffect(() => { alReiniciarRef.current = alReiniciar; });

  useEffect(() => {
    if (!activa) return undefined;

    // Inicialización del historial, una sola vez por carga de la página.
    // En desarrollo StrictMode corre los efectos dos veces; los refs se
    // conservan entre las dos corridas, así que el `if` alcanza.
    if (flujoRef.current === null) {
      flujoRef.current = nuevoIdFlujo();
      // El scroll lo maneja el hook (arriba en cada cambio de pantalla): la
      // restauración automática del navegador pelea con el render de React.
      history.scrollRestoration = 'manual';
      const previa = history.state?.tt;
      if (previa && previa.pila.length > 1) {
        // Recarga a mitad del flujo: la memoria se perdió. Se muestra la
        // landing (estado inicial) y se rebobina hasta la landing de antes.
        history.go(-(previa.pila.length - 1));
      } else {
        marcarInicio(flujoRef.current);
      }
    }

    /**
     * alCambiarHistorial
     * Handler de popstate ("atrás"/"adelante" del navegador o history.back()).
     * Refleja la entrada nueva en la pila, o lleva a la landing si es de otro flujo.
     * @param {PopStateEvent} e
     */
    function alCambiarHistorial(e) {
      const tt = e.state?.tt;

      if (tt && tt.flujo === flujoRef.current) {
        setNav((prev) => {
          // Misma pantalla (ej. la llegada a la landing tras volverAlInicio): sin cambios.
          if (prev.pila.length === tt.pila.length
            && prev.pila[prev.pila.length - 1] === tt.pila[tt.pila.length - 1]) {
            return prev;
          }
          return {
            pila: tt.pila,
            direccion: tt.pila.length < prev.pila.length ? 'atras' : 'adelante',
          };
        });
        return;
      }

      // Entrada de otro flujo (o sin datos nuestros): se va a la landing.
      if (tt && tt.pila.length > 1) {
        history.go(-(tt.pila.length - 1));   // rebobina hasta la landing de ese flujo
      } else {
        marcarInicio(flujoRef.current);      // ya es una landing: pasa a ser la del flujo actual
      }
      setNav((prev) => (prev.pila.length === 1
        ? prev
        : { pila: [PANTALLA_INICIO], direccion: 'atras' }));
      alReiniciarRef.current?.();
    }

    window.addEventListener('popstate', alCambiarHistorial);
    return () => window.removeEventListener('popstate', alCambiarHistorial);
  }, [activa]);

  // Cada cambio de pantalla arranca arriba de todo (antes de pintar).
  useLayoutEffect(() => {
    if (activa) window.scrollTo(0, 0);
  }, [activa, nav.pila]);

  /**
   * irA
   * Apila una pantalla (entrada nueva en el historial). Puede saltear pasos:
   * "Volver" regresa a la pantalla desde la que se llegó.
   * @param {string} pantalla - Nombre de la pantalla destino
   */
  const irA = (pantalla) => {
    const pila = [...nav.pila, pantalla];
    history.pushState({ tt: { flujo: flujoRef.current, pila } }, '');
    setNav({ pila, direccion: 'adelante' });
  };

  /**
   * volver
   * Vuelve una pantalla: mismo camino que el "atrás" del sistema (popstate).
   */
  const volver = () => {
    history.back();
  };

  /**
   * cerrarFlujo
   * Reemplaza la pantalla actual por `pantalla` y abre un flujo nuevo. Las
   * entradas anteriores quedan de un flujo viejo: el "atrás" desde acá lleva a
   * la landing sin pasar por ellas. Se usa al confirmar el turno, para que no
   * se pueda volver a la confirmación ni reenviarla.
   * @param {string} pantalla - Pantalla que reemplaza a la actual (ej. 'exito')
   */
  const cerrarFlujo = (pantalla) => {
    flujoRef.current = nuevoIdFlujo();
    const pila = [...nav.pila.slice(0, -1), pantalla];
    history.replaceState({ tt: { flujo: flujoRef.current, pila } }, '');
    setNav({ pila, direccion: 'adelante' });
  };

  /**
   * volverAlInicio
   * Vuelve a la landing rebobinando el historial (no apila una landing nueva).
   * El caller descarta la reserva en memoria si corresponde.
   */
  const volverAlInicio = () => {
    const distancia = nav.pila.length - 1;
    if (distancia > 0) history.go(-distancia);
    setNav({ pila: [PANTALLA_INICIO], direccion: 'atras' });
  };

  return {
    pantalla: nav.pila[nav.pila.length - 1],
    profundidad: nav.pila.length,
    direccion: nav.direccion,
    irA,
    volver,
    cerrarFlujo,
    volverAlInicio,
  };
}
