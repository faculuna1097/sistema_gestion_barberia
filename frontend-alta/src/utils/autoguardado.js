// /frontend-alta/src/utils/autoguardado.js
// Motor del guardado automático del formulario (lo usa hooks/useSolicitud.js).
// JS puro, sin React: así se prueba con Node y no depende de los renders.
//
// Reglas (plan_alta_clientes.md §5.2 y §5.3):
//   - Cada cambio reprograma un guardado para dentro de ~800 ms (debounce).
//   - Un solo pedido en vuelo a la vez. Si hay cambios mientras uno viaja, al
//     terminar sale otro con lo último. Nunca dos en paralelo: así una
//     respuesta vieja no pisa una nueva.
//   - Cada pedido lleva todo `datos` (el PUT reemplaza entero), así que no hay
//     nada que acumular: alcanza con mandar lo último.
//   - Si falla, lo cargado queda en memoria. Se reintenta con `guardarYa`: el
//     botón "Reintentar", el evento `online` y el próximo cambio.
//   - Al ocultarse la página (`guardarUrgente`) lo pendiente sale de inmediato,
//     sin esperar el debounce. Si justo hay uno en vuelo con datos viejos, ese
//     se cancela y sale el último en su lugar: en el celular el cliente cierra
//     WhatsApp y puede no haber un "después" para mandarlo. El cancelado ya
//     había salido antes, así que si el backend llegó a recibirlo, lo recibió
//     antes que el nuevo.
//   - Envío final (fase 5): el POST de enviar no puede convivir con un PUT. Un
//     PUT que llega después del envío da 409, y useSolicitud lo leería como "se
//     envió desde otro lado". `pausar` corta el debounce, espera el PUT en vuelo
//     (si hay) y, mientras dura la pausa, no sale ningún guardado: los cambios
//     se anotan pero no se mandan. Si el envío falla, `reanudar` vuelve a
//     guardar (y manda lo pendiente); si sale bien, `detener`.
//
// Versiones: cada cambio suma 1 a `version`. `versionGuardada` es la última que
// el backend confirmó. Hay algo pendiente mientras version > versionGuardada.

/**
 * ESTADOS_GUARDADO
 * Lo que muestra el indicador: nada todavía, "Guardando…", "Guardado" o
 * "No pudimos guardar".
 */
export const ESTADOS_GUARDADO = {
  INACTIVO: 'inactivo',
  GUARDANDO: 'guardando',
  GUARDADO: 'guardado',
  ERROR: 'error',
};

/**
 * ESPERA_GUARDADO_MS
 * Debounce del guardado: cuánto se espera después del último cambio.
 */
export const ESPERA_GUARDADO_MS = 800;

/**
 * crearAutoguardado
 * Arma un autoguardado. No guarda nada hasta el primer `cambiar`.
 * @param {Object} opciones
 * @param {Function} opciones.enviar - (datos, { signal }) => Promise. El PUT
 *   (services/api.js → guardarSolicitud). Si rechaza con un AbortError, se
 *   ignora (lo canceló el propio autoguardado).
 * @param {Function} opciones.alCambiarEstado - Recibe cada ESTADOS_GUARDADO nuevo.
 * @param {Function} [opciones.alFallar] - Recibe el error de un guardado que
 *   falló (después de pasar a ERROR).
 * @param {Function} [opciones.esErrorFinal] - (err) => boolean. true si después
 *   de ese error no tiene sentido seguir guardando (ej. un 409: ya se envió):
 *   el autoguardado se detiene solo antes de llamar a alFallar.
 * @param {number} [opciones.esperaMs=ESPERA_GUARDADO_MS] - Debounce
 * @returns {{
 *   cambiar: (datos: Object) => void,
 *   guardarYa: () => void,
 *   guardarUrgente: () => void,
 *   detener: () => void,
 *   pausar: () => Promise<boolean>,
 *   reanudar: () => void,
 *   hayPendiente: () => boolean,
 * }}
 */
export function crearAutoguardado({
  enviar, alCambiarEstado, alFallar, esErrorFinal, esperaMs = ESPERA_GUARDADO_MS,
}) {
  let ultimo = null;          // los datos más nuevos
  let version = 0;
  let versionGuardada = 0;
  let vuelo = null;           // { version, control } del pedido en vuelo
  let temporizador = null;
  let detenido = false;
  let pausado = false;
  let esperandoLibre = [];    // los `resolve` de las promesas de pausar()
  let estado = ESTADOS_GUARDADO.INACTIVO;

  /**
   * setEstado — avisa el estado nuevo, solo si cambió.
   * @param {string} nuevo - Uno de ESTADOS_GUARDADO
   */
  const setEstado = (nuevo) => {
    if (nuevo === estado) return;
    estado = nuevo;
    alCambiarEstado(nuevo);
  };

  /**
   * hayPendiente
   * @returns {boolean} true si hay cambios que el backend todavía no confirmó.
   */
  const hayPendiente = () => version > versionGuardada;

  /**
   * cancelarTemporizador — corta el debounce en curso, si hay.
   */
  const cancelarTemporizador = () => {
    clearTimeout(temporizador);
    temporizador = null;
  };

  /**
   * avisarLibre — si no queda ningún pedido en vuelo, resuelve las promesas de
   * pausar() que esperaban: true si se puede seguir, false si se detuvo.
   */
  const avisarLibre = () => {
    if (vuelo) return;
    const esperando = esperandoLibre;
    esperandoLibre = [];
    esperando.forEach((resolver) => resolver(!detenido));
  };

  /**
   * lanzar — manda `ultimo` y lo deja como el pedido en vuelo. Al terminar bien,
   * si hubo cambios mientras viajaba, sale otro con lo último.
   * @returns {Promise<void>}
   */
  const lanzar = async () => {
    const enviado = { version, control: new AbortController() };
    vuelo = enviado;
    setEstado(ESTADOS_GUARDADO.GUARDANDO);
    try {
      await enviar(ultimo, { signal: enviado.control.signal });
    } catch (err) {
      if (vuelo !== enviado) return;   // lo reemplazó otro (guardarUrgente) o lo cortó detener
      vuelo = null;
      if (detenido || err?.name === 'AbortError') {
        avisarLibre();
        return;
      }
      setEstado(ESTADOS_GUARDADO.ERROR);
      if (esErrorFinal?.(err)) detener();
      alFallar?.(err);
      avisarLibre();
      return;
    }
    if (vuelo !== enviado) return;
    vuelo = null;
    versionGuardada = Math.max(versionGuardada, enviado.version);
    if (detenido) {
      avisarLibre();
      return;
    }
    if (hayPendiente()) {
      // Hubo cambios mientras viajaba: si el debounce sigue corriendo, el
      // cliente sigue escribiendo y sale cuando termine; si no, sale ya. En
      // pausa no sale: lo lleva el envío (o reanudar, si el envío falla).
      if (pausado) avisarLibre();
      else if (temporizador === null) lanzar();
    } else {
      setEstado(ESTADOS_GUARDADO.GUARDADO);
      avisarLibre();
    }
  };

  /**
   * guardarYa
   * Guarda lo pendiente sin esperar el debounce. Si hay uno en vuelo, no manda
   * otro: lo pendiente sale cuando ese termine. Sin nada pendiente, no hace nada.
   * Es el "Reintentar", el evento `online` y el final del debounce. En pausa
   * no hace nada.
   */
  const guardarYa = () => {
    cancelarTemporizador();
    if (detenido || pausado || vuelo || !hayPendiente()) return;
    lanzar();
  };

  /**
   * cambiar
   * Registra los datos nuevos y reprograma el guardado (debounce). En pausa
   * solo los anota: salen con reanudar.
   * @param {Object} datos - El formulario completo, ya con el cambio
   */
  const cambiar = (datos) => {
    if (detenido) return;
    ultimo = datos;
    version += 1;
    setEstado(ESTADOS_GUARDADO.GUARDANDO);
    cancelarTemporizador();
    if (!pausado) temporizador = setTimeout(guardarYa, esperaMs);
  };

  /**
   * guardarUrgente
   * Para cuando la página se oculta o se cierra: lo pendiente sale ya. Si el que
   * está en vuelo ya lleva lo último, se lo deja terminar; si lleva datos
   * viejos, se lo cancela y sale el último (ver el encabezado del archivo).
   * En pausa no hace nada: el envío ya lleva lo último.
   */
  const guardarUrgente = () => {
    cancelarTemporizador();
    if (detenido || pausado || !hayPendiente()) return;
    if (vuelo) {
      if (vuelo.version === version) return;
      const viejo = vuelo;
      vuelo = null;
      viejo.control.abort();
    }
    lanzar();
  };

  /**
   * detener
   * Corta todo: el debounce, el pedido en vuelo y los próximos guardados. Para
   * cuando la solicitud dejó de ser editable (409) o el link venció (404).
   */
  const detener = () => {
    detenido = true;
    cancelarTemporizador();
    vuelo?.control.abort();
    vuelo = null;
    avisarLibre();
  };

  /**
   * pausar
   * Para el envío final: corta el debounce y deja de mandar guardados hasta
   * reanudar. Si hay un PUT en vuelo, no se lo corta (puede haber llegado al
   * backend): se espera a que termine, así el POST sale después.
   * @returns {Promise<boolean>} Se resuelve cuando no queda nada en vuelo: true
   *   si se puede enviar, false si el autoguardado se detuvo mientras tanto
   *   (ej. ese PUT dio 409: ya se había enviado desde otro lado).
   */
  const pausar = () => {
    pausado = true;
    cancelarTemporizador();
    if (detenido) return Promise.resolve(false);
    if (!vuelo) return Promise.resolve(true);
    return new Promise((resolver) => { esperandoLibre.push(resolver); });
  };

  /**
   * reanudar
   * Sale de la pausa (el envío falló): vuelve a guardar y, si quedó algo
   * pendiente, lo manda ya.
   */
  const reanudar = () => {
    pausado = false;
    guardarYa();
  };

  return { cambiar, guardarYa, guardarUrgente, detener, pausar, reanudar, hayPendiente };
}
