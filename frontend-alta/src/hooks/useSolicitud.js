// /frontend-alta/src/hooks/useSolicitud.js
// La solicitud del link: la carga, el estado del link y el guardado automático.
// El motor del guardado (debounce, un pedido en vuelo, reintentos) vive en
// utils/autoguardado.js; este hook lo conecta con React y con los eventos del
// navegador (online, página oculta).

import { useCallback, useEffect, useRef, useState } from 'react';
import { TOKEN, enviarSolicitud, guardarSolicitud, obtenerSolicitud } from '../services/api.js';
import { CODIGOS, mensajeDeError } from '../utils/errores.js';
import { completarDatos } from '../utils/datosSolicitud.js';
import { crearAutoguardado, ESTADOS_GUARDADO } from '../utils/autoguardado.js';

/**
 * ESTADOS_LINK
 * En qué está el link, según lo que respondió el backend (plan §5.3):
 * - CARGANDO: todavía no respondió.
 * - BORRADOR: se puede completar.
 * - LISTO: se acaba de enviar desde esta pestaña (pantalla 14, "Listo"). No
 *   se relee la solicitud (plan §7.1): releída, ya es ENVIADA.
 * - ENVIADA / CARGADA: ya se envió (y Facundo quizás ya la cargó); sin edición.
 * - NO_ENCONTRADA: no existe, venció o el token está mal formado (404), o no hay token.
 * - ERROR_CARGA: no se pudo cargar (sin red, servidor caído, 500, 429); se puede reintentar.
 */
export const ESTADOS_LINK = {
  CARGANDO: 'cargando',
  BORRADOR: 'borrador',
  LISTO: 'listo',
  ENVIADA: 'enviada',
  CARGADA: 'cargada',
  NO_ENCONTRADA: 'no_encontrada',
  ERROR_CARGA: 'error_carga',
};

/**
 * RESULTADOS_ENVIO
 * Qué pasó con enviar() (la pantalla decide qué mostrar):
 * - ENVIADA: 200. El estado del link pasa a LISTO.
 * - ERRORES: 400 datos_invalidos; trae `errores` del backend para mostrar en sus campos.
 * - FALLO: no se pudo (sin red, 429, 500…); trae `mensaje`. Se puede reintentar.
 * - CERRADA: ya no se puede enviar (409: ya se envió; 404: venció). El estado
 *   del link ya cambió solo (a "Ya enviada" o al link vencido).
 */
export const RESULTADOS_ENVIO = {
  ENVIADA: 'enviada',
  ERRORES: 'errores',
  FALLO: 'fallo',
  CERRADA: 'cerrada',
};

/**
 * estadoDeSolicitud (interna)
 * Pasa el `estado` de la fila al estado del link.
 * @param {string} estado - 'borrador' | 'enviada' | 'cargada'
 * @returns {string} Uno de ESTADOS_LINK.
 */
function estadoDeSolicitud(estado) {
  if (estado === 'borrador') return ESTADOS_LINK.BORRADOR;
  if (estado === 'cargada') return ESTADOS_LINK.CARGADA;
  return ESTADOS_LINK.ENVIADA;
}

/**
 * useSolicitud
 * Carga la solicitud del token del path y la mantiene guardada mientras el
 * cliente la completa.
 *
 * Guardado: `actualizar` cambia los datos en memoria al instante y programa el
 * PUT (debounce de ~800 ms, un solo pedido en vuelo). Sin red o con error, lo
 * cargado queda en memoria y se reintenta con `reintentarGuardado`, al volver la
 * conexión y en el próximo cambio. Al ocultarse la página, lo pendiente sale de
 * inmediato con keepalive. Un 409 relee la solicitud (pasa a "Ya enviada") y un
 * 404 la da por vencida.
 *
 * @returns {{
 *   estado: string,
 *   datos: Object|null,
 *   venceEn: string|null,
 *   errorCarga: Error|null,
 *   recargar: () => Promise<void>,
 *   actualizar: (cambio: Object|Function) => void,
 *   guardado: string,
 *   reintentarGuardado: () => void,
 *   enviar: () => Promise<{tipo: string, errores?: Array, mensaje?: string}>,
 * }}
 *   `estado`: uno de ESTADOS_LINK. `datos`: la forma completa
 *   (utils/datosSolicitud.js), null hasta que carga. `errorCarga`: el error de la
 *   última carga fallida. `actualizar` recibe los datos nuevos o una función
 *   (datosActuales) => datosNuevos. `guardado`: uno de ESTADOS_GUARDADO.
 *   `enviar`: el envío final (ver la función); devuelve uno de RESULTADOS_ENVIO.
 */
export function useSolicitud() {
  const [estado, setEstado] = useState(TOKEN ? ESTADOS_LINK.CARGANDO : ESTADOS_LINK.NO_ENCONTRADA);
  const [datos, setDatos] = useState(null);
  const [venceEn, setVenceEn] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardado, setGuardado] = useState(ESTADOS_GUARDADO.INACTIVO);

  // Los datos más nuevos: `actualizar` calcula sobre ellos, sin esperar un render.
  const datosRef = useRef(null);

  /**
   * cargar
   * Pide la solicitud y refleja el estado del link. Lo usan el montaje, el
   * "Reintentar" de la pantalla de error y el 409 de un guardado.
   * @returns {Promise<void>}
   */
  const cargar = useCallback(async () => {
    setEstado(ESTADOS_LINK.CARGANDO);
    try {
      const solicitud = await obtenerSolicitud();
      const completos = completarDatos(solicitud.datos);
      datosRef.current = completos;
      setDatos(completos);
      setVenceEn(solicitud.vence_en ?? null);
      setErrorCarga(null);
      setEstado(estadoDeSolicitud(solicitud.estado));
    } catch (err) {
      if (err.status === 404) {
        setEstado(ESTADOS_LINK.NO_ENCONTRADA);
        return;
      }
      console.error('[useSolicitud] Error en cargar:', err.message);
      setErrorCarga(err);
      setEstado(ESTADOS_LINK.ERROR_CARGA);
    }
  }, []);

  // El último guardado que falló: lo atiende el efecto de abajo.
  const [falloGuardado, setFalloGuardado] = useState(null);

  // Un solo autoguardado por carga de la página (el initializer corre una vez).
  // Solo recibe setters: el qué hacer con un error vive en el efecto de abajo.
  const [autoguardado] = useState(() => crearAutoguardado({
    enviar: guardarSolicitud,
    alCambiarEstado: setGuardado,
    alFallar: setFalloGuardado,
    // Después de un 409 (ya se envió) o un 404 (venció) no se guarda más.
    esErrorFinal: (err) => err.status === 409 || err.status === 404,
  }));

  // Qué hacer con un guardado que falló.
  useEffect(() => {
    if (!falloGuardado) return;
    if (falloGuardado.status === 409 || falloGuardado.codigo === CODIGOS.YA_ENVIADA) {
      // Se envió desde otro dispositivo (o en otra pestaña): se relee y pasa a "Ya enviada".
      console.warn('[useSolicitud] la solicitud ya se envió: se relee');
      cargar();
    } else if (falloGuardado.status === 404) {
      console.warn('[useSolicitud] el link venció mientras se completaba');
      setEstado(ESTADOS_LINK.NO_ENCONTRADA);
    } else {
      // Sin red, servidor caído, 429, 413…: lo cargado queda en memoria y se reintenta.
      console.error('[useSolicitud] Error en guardar:', falloGuardado.message);
    }
  }, [falloGuardado, cargar]);

  // Carga inicial (sin token no hay nada que pedir: ya arranca en NO_ENCONTRADA).
  useEffect(() => {
    if (TOKEN) cargar();
  }, [cargar]);

  // Mientras se puede completar: reintento al volver la conexión y guardado
  // inmediato al ocultarse o cerrarse la página.
  useEffect(() => {
    if (estado !== ESTADOS_LINK.BORRADOR) return undefined;

    /** alVolverConexion — el evento `online`: lo pendiente sale ya. */
    const alVolverConexion = () => autoguardado.guardarYa();

    /** alCambiarVisibilidad — al ocultarse la página, lo pendiente sale con keepalive. */
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'hidden') autoguardado.guardarUrgente();
    };

    /** alOcultarPagina — `pagehide`: en iOS, a veces llega sin visibilitychange. */
    const alOcultarPagina = () => autoguardado.guardarUrgente();

    window.addEventListener('online', alVolverConexion);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('pagehide', alOcultarPagina);
    return () => {
      window.removeEventListener('online', alVolverConexion);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('pagehide', alOcultarPagina);
    };
  }, [estado, autoguardado]);

  /**
   * actualizar
   * Cambia los datos en memoria y programa el guardado. Solo mientras la
   * solicitud está en borrador.
   * @param {Object|Function} cambio - Los datos nuevos, o (datosActuales) => datosNuevos
   */
  const actualizar = useCallback((cambio) => {
    if (datosRef.current === null) return;
    const nuevos = typeof cambio === 'function' ? cambio(datosRef.current) : cambio;
    if (nuevos === datosRef.current) return;
    datosRef.current = nuevos;
    setDatos(nuevos);
    autoguardado.cambiar(nuevos);
  }, [autoguardado]);

  /**
   * enviar
   * El envío final (POST /enviar) con los datos más nuevos. No puede convivir
   * con un guardado: un PUT que llega después del envío da 409 y se leería como
   * "se envió desde otro lado". Por eso primero pausa el autoguardado (corta el
   * debounce y espera el PUT en vuelo, si hay). Lo que no se llegó a guardar
   * viaja en el POST, que lo guarda junto con el cambio a 'enviada'.
   *   - 200: el autoguardado se detiene y el estado pasa a LISTO, sin releer.
   *   - 409: ya se envió (desde otro lado): se relee y queda "Ya enviada".
   *   - 404: venció.
   *   - 400 datos_invalidos, sin red, 429, 500: el autoguardado vuelve a andar.
   * @returns {Promise<{tipo: string, errores?: Array<{campo: string, mensaje: string}>, mensaje?: string}>}
   *   `tipo`: uno de RESULTADOS_ENVIO.
   */
  const enviar = useCallback(async () => {
    const sePuede = await autoguardado.pausar();
    // El PUT que viajaba dio 409 o 404: el efecto de falloGuardado ya cambia el estado.
    if (!sePuede) return { tipo: RESULTADOS_ENVIO.CERRADA };
    try {
      await enviarSolicitud(datosRef.current);
    } catch (err) {
      if (err.status === 409 || err.codigo === CODIGOS.YA_ENVIADA) {
        console.warn('[useSolicitud] la solicitud ya se había enviado: se relee');
        autoguardado.detener();
        cargar();
        return { tipo: RESULTADOS_ENVIO.CERRADA };
      }
      if (err.status === 404) {
        console.warn('[useSolicitud] el link venció antes de enviar');
        autoguardado.detener();
        setEstado(ESTADOS_LINK.NO_ENCONTRADA);
        return { tipo: RESULTADOS_ENVIO.CERRADA };
      }
      autoguardado.reanudar();
      if (err.status === 400 && err.codigo === CODIGOS.DATOS_INVALIDOS && Array.isArray(err.errores)) {
        return { tipo: RESULTADOS_ENVIO.ERRORES, errores: err.errores };
      }
      console.error('[useSolicitud] Error en enviar:', err.message);
      return { tipo: RESULTADOS_ENVIO.FALLO, mensaje: mensajeDeError(err) };
    }
    autoguardado.detener();
    setEstado(ESTADOS_LINK.LISTO);
    return { tipo: RESULTADOS_ENVIO.ENVIADA };
  }, [autoguardado, cargar]);

  return {
    enviar,
    estado,
    datos,
    venceEn,
    errorCarga,
    recargar: cargar,
    actualizar,
    guardado,
    reintentarGuardado: autoguardado.guardarYa,
  };
}
