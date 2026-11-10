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
      if (vuelo !== enviado) return;   // lo reemplazó otro (guardarUrgente)
      vuelo = null;
      if (detenido || err?.name === 'AbortError') return;
      setEstado(ESTADOS_GUARDADO.ERROR);
      if (esErrorFinal?.(err)) detener();
      alFallar?.(err);
      return;
    }
    if (vuelo !== enviado) return;
    vuelo = null;
    versionGuardada = Math.max(versionGuardada, enviado.version);
    if (detenido) return;
    if (hayPendiente()) {
      // Hubo cambios mientras viajaba: si el debounce sigue corriendo, el
      // cliente sigue escribiendo y sale cuando termine; si no, sale ya.
      if (temporizador === null) lanzar();
    } else {
      setEstado(ESTADOS_GUARDADO.GUARDADO);
    }
  };

  /**
   * guardarYa
   * Guarda lo pendiente sin esperar el debounce. Si hay uno en vuelo, no manda
   * otro: lo pendiente sale cuando ese termine. Sin nada pendiente, no hace nada.
   * Es el "Reintentar", el evento `online` y el final del debounce.
   */
  const guardarYa = () => {
    cancelarTemporizador();
    if (detenido || vuelo || !hayPendiente()) return;
    lanzar();
  };

  /**
   * cambiar
   * Registra los datos nuevos y reprograma el guardado (debounce).
   * @param {Object} datos - El formulario completo, ya con el cambio
   */
  const cambiar = (datos) => {
    if (detenido) return;
    ultimo = datos;
    version += 1;
    setEstado(ESTADOS_GUARDADO.GUARDANDO);
    cancelarTemporizador();
    temporizador = setTimeout(guardarYa, esperaMs);
  };

  /**
   * guardarUrgente
   * Para cuando la página se oculta o se cierra: lo pendiente sale ya. Si el que
   * está en vuelo ya lleva lo último, se lo deja terminar; si lleva datos
   * viejos, se lo cancela y sale el último (ver el encabezado del archivo).
   */
  const guardarUrgente = () => {
    cancelarTemporizador();
    if (detenido || !hayPendiente()) return;
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
  };

  return { cambiar, guardarYa, guardarUrgente, detener, hayPendiente };
}
