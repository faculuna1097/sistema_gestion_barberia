// /frontend-alta/src/screens/Formulario.jsx
// El formulario mientras la solicitud está en borrador: una pantalla por paso,
// con el encabezado (volver, capítulo y guardado), la tarjeta "Tu barbería" y
// el "Seguir" fijo abajo (plan §5.2). Solo el contenido de cada pantalla entra
// con la transición (al-pantalla); lo demás queda quieto.
//
// La pantalla actual vive en el historial (useNavegacion) y se guarda en
// `datos.progreso.pantalla`, para retomar ahí al recargar o desde otro
// dispositivo.
//
// Contrato de cada pantalla (CONTENIDO_POR_PANTALLA): recibe `datos`,
// `actualizar`, `onSeguir` (el mismo "Seguir" del pie, para el Enter de los
// campos de texto) y un `ref` donde expone `intentarSeguir()`. Esa función
// valida la pantalla (useErroresDePantalla), y si hay errores los muestra,
// lleva el foco al primero y devuelve false. Una pantalla sin ref (ej. la
// bienvenida) siempre deja seguir.
//
// Modo Editar (desde la Revisión): "Editar" apila la primera pantalla del
// bloque. Mientras la Revisión quede debajo en la pila (enEdicion), el "Seguir"
// recorre solo las pantallas de ese bloque y, en la última, vuelve a la
// Revisión sacando del historial lo de en medio (volverA). El progreso guardado
// sigue en la Revisión. Se lee del historial: sobrevive a una recarga en la
// misma pestaña y el "atrás" lo deshace solo.
//
// El envío (pantalla 13, "Enviar"):
//   1. validarDatos del front: con errores, lleva a la pantalla del primero.
//   2. useSolicitud.enviar (pausa el autoguardado y manda el POST).
//   3. 200: App pasa a "Listo". 400 datos_invalidos: los errores del backend se
//      guardan (ErroresServidorContext), cada pantalla los suma a los suyos, y
//      se lleva a la del primero. Sin red / 429 / 500: aviso con "Reintentar".
//      409 / 404: el estado del link cambia solo.
//   Al llegar a la pantalla de un error, se le pide intentarSeguir(): así lo
//   muestra y lleva el foco al campo, igual que su propio "Seguir".

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { TOKEN } from '../services/api.js';
import {
  PANTALLAS, PANTALLA, ULTIMA_PANTALLA_GUARDABLE, caminoHasta, enEdicion, siguienteEnEdicion, textoDe,
  textoSeguirEnEdicion,
} from '../config/pantallas.js';
import { primerError, validarDatos } from '../utils/validaciones.js';
import { registrarErroresServidor } from '../utils/erroresServidor.js';
import { useNavegacion } from '../hooks/useNavegacion.js';
import { useLibTelefono } from '../hooks/useLibTelefono.js';
import { precargarLibTelefono } from '../utils/libTelefono.js';
import { RESULTADOS_ENVIO } from '../hooks/useSolicitud.js';
import { ErroresServidorContext } from '../hooks/useErroresDePantalla.js';
import { PageContainer, StickyFooter, Button, Skeleton } from '../components/ui';
import EncabezadoFormulario from '../components/formulario/EncabezadoFormulario.jsx';
import TarjetaBarberia from '../components/TarjetaBarberia.jsx';
import PantallaBienvenida from './pantallas/PantallaBienvenida.jsx';
import PantallaNombre from './pantallas/PantallaNombre.jsx';
import PantallaDireccion from './pantallas/PantallaDireccion.jsx';
import PantallaDias from './pantallas/PantallaDias.jsx';
import PantallaHorario from './pantallas/PantallaHorario.jsx';
import PantallaBarberos from './pantallas/PantallaBarberos.jsx';
import PantallaDuenios from './pantallas/PantallaDuenios.jsx';
import PantallaHorariosEquipo from './pantallas/PantallaHorariosEquipo.jsx';
import PantallaLargoTurno from './pantallas/PantallaLargoTurno.jsx';
import PantallaServicios from './pantallas/PantallaServicios.jsx';
import PantallaProductos from './pantallas/PantallaProductos.jsx';
import PantallaContactoLocal from './pantallas/PantallaContactoLocal.jsx';
import PantallaContactoDuenio from './pantallas/PantallaContactoDuenio.jsx';

/**
 * CONTENIDO_POR_PANTALLA
 * El componente de cada pantalla con campos. La Revisión (13) la arma
 * Formulario (la tarjeta completa con "Editar"); "Listo" (14) es de App.
 */
const CONTENIDO_POR_PANTALLA = {
  [PANTALLA.BIENVENIDA]: PantallaBienvenida,
  [PANTALLA.NOMBRE]: PantallaNombre,
  [PANTALLA.DIRECCION]: PantallaDireccion,
  [PANTALLA.DIAS]: PantallaDias,
  [PANTALLA.HORARIO]: PantallaHorario,
  [PANTALLA.BARBEROS]: PantallaBarberos,
  [PANTALLA.DUENIOS]: PantallaDuenios,
  [PANTALLA.HORARIOS_EQUIPO]: PantallaHorariosEquipo,
  [PANTALLA.LARGO_TURNO]: PantallaLargoTurno,
  [PANTALLA.SERVICIOS]: PantallaServicios,
  [PANTALLA.PRODUCTOS]: PantallaProductos,
  [PANTALLA.CONTACTO_LOCAL]: PantallaContactoLocal,
  [PANTALLA.CONTACTO_DUENIO]: PantallaContactoDuenio,
};

/**
 * PANTALLAS_CON_TELEFONO
 * Las que necesitan libphonenumber-js (utils/libTelefono.js) para dibujarse:
 * sin ella, en su lugar va EsperaTelefonos.
 */
const PANTALLAS_CON_TELEFONO = new Set([PANTALLA.CONTACTO_LOCAL, PANTALLA.CONTACTO_DUENIO]);

/**
 * PANTALLA_PRECARGA_TELEFONO
 * Desde dónde se precarga libphonenumber-js: el comienzo de "Tus servicios",
 * dos o tres pantallas antes de Contacto. Así, en el uso normal, ya está
 * cuando el cliente llega y no nota la espera.
 */
const PANTALLA_PRECARGA_TELEFONO = PANTALLA.LARGO_TURNO;

/**
 * EsperaTelefonos
 * Lo que va en lugar de una pantalla de Contacto mientras llega
 * libphonenumber-js (casi nunca se ve: se precarga antes), o si no se pudo
 * bajar: un aviso con "Reintentar" (lo cargado sigue guardado).
 * @param {Error|null} props.error
 * @param {Function} props.onReintentar
 * @returns {JSX.Element}
 */
function EsperaTelefonos({ error, onReintentar }) {
  if (error) {
    return (
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.5, color: theme.inkSoft, textWrap: 'pretty' }}>
          No pudimos cargar esta parte del formulario. Revisá tu conexión y probá de nuevo: lo que cargaste está guardado.
        </p>
        <Button variant="secondary" full={false} onClick={onReintentar}>Reintentar</Button>
      </div>
    );
  }
  return (
    <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skeleton width={120} height={12} />
      <Skeleton height={48} radius={theme.radius} />
    </div>
  );
}

/**
 * ESTADOS_ENVIO
 * El botón de la Revisión: listo para enviar, enviando (no acepta otro
 * toque) o un envío que falló sin respuesta útil (aviso y "Reintentar").
 */
const ESTADOS_ENVIO = { INACTIVO: 'inactivo', ENVIANDO: 'enviando', FALLO: 'fallo' };

/**
 * AvisoEnvio
 * El aviso de un envío que no salió (sin red, 429, 500…), arriba del botón.
 * Lo cargado no se pierde: sigue guardado y en memoria.
 * @param {string} props.mensaje - mensajeDeError del pedido
 * @returns {JSX.Element}
 */
function AvisoEnvio({ mensaje }) {
  return (
    <div role="alert" style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 12,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      lineHeight: 1.4,
      color: theme.danger,
    }}>
      <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ textWrap: 'pretty' }}>{`No se envió. ${mensaje} No se perdió nada.`}</span>
    </div>
  );
}

/**
 * Formulario
 * @param {Object} props.solicitud - Lo que devuelve useSolicitud (estado BORRADOR)
 * @returns {JSX.Element}
 */
function Formulario({ solicitud }) {
  const { datos, actualizar, guardado, reintentarGuardado, enviar } = solicitud;

  // Camino hasta donde quedó, leído una sola vez: después manda el historial.
  const [pilaInicial] = useState(() => caminoHasta(datos.progreso?.pantalla));
  const nav = useNavegacion({ token: TOKEN, pilaInicial });
  const pantalla = PANTALLAS[nav.pantalla];
  const editando = enEdicion(nav.pila);

  // Errores del último 400 del envío (registrarErroresServidor) y el estado del botón de enviar.
  const [erroresServidor, setErroresServidor] = useState([]);
  const [envio, setEnvio] = useState({ estado: ESTADOS_ENVIO.INACTIVO, mensaje: null });
  // La pantalla a la que se llevó por un error tiene que mostrarlo al montarse.
  const [mostrarErroresAlEntrar, setMostrarErroresAlEntrar] = useState(false);

  // Guarda dónde quedó cada vez que cambia la pantalla ("Seguir" o "atrás").
  // "Listo" no se guarda: existe solo después de enviar. En el modo Editar
  // queda la Revisión: es a donde se vuelve.
  const pantallaGuardada = datos.progreso?.pantalla;
  useEffect(() => {
    if (editando || nav.pantalla > ULTIMA_PANTALLA_GUARDABLE || nav.pantalla === pantallaGuardada) return;
    actualizar((d) => ({ ...d, progreso: { ...d.progreso, pantalla: nav.pantalla } }));
  }, [editando, nav.pantalla, pantallaGuardada, actualizar]);

  // La pantalla montada expone acá su intentarSeguir().
  const contenidoRef = useRef(null);

  // Al cambiar de pantalla ("Seguir", "Volver", el "atrás" del navegador), el
  // foco va al título de la nueva: el lector la anuncia y el Tab sigue desde su
  // contenido, no desde el "Seguir" de abajo (que queda montado) ni desde el
  // principio de la página (si el botón tocado desapareció). Si la pantalla ya
  // enfocó un campo (autoFocus), se deja. En la primera carga no se mueve.
  // Va antes del efecto de mostrarErroresAlEntrar: ese, si corresponde, lleva
  // el foco al campo del error.
  const mainRef = useRef(null);
  const tituloRef = useRef(null);
  const primeraPantallaRef = useRef(true);
  const enfocarTitulo = useCallback(() => tituloRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (primeraPantallaRef.current) {
      primeraPantallaRef.current = false;
      return;
    }
    if (mainRef.current?.contains(document.activeElement)) return;
    tituloRef.current?.focus({ preventScroll: true });
  }, [nav.pantalla, nav.profundidad]);

  // libphonenumber-js: se precarga desde "Tus servicios" y la necesitan las
  // pantallas de Contacto (ver utils/libTelefono.js).
  const telefonos = useLibTelefono(false);
  useEffect(() => {
    if (nav.pantalla >= PANTALLA_PRECARGA_TELEFONO) precargarLibTelefono();
  }, [nav.pantalla]);
  const esperandoTelefonos = PANTALLAS_CON_TELEFONO.has(nav.pantalla) && !telefonos.lista;
  const esperandoTelefonosRef = useRef(esperandoTelefonos);
  useEffect(() => {
    esperandoTelefonosRef.current = esperandoTelefonos;
  });

  // nav y datos cambian en cada render: el "Seguir" y el envío los leen de un
  // ref para ser estables (las pantallas usan el "Seguir" en efectos, ej. el
  // nombre cuando espera la consulta del link).
  const navRef = useRef(nav);
  const datosRef = useRef(datos);
  useEffect(() => {
    navRef.current = nav;
    datosRef.current = datos;
  });

  // Recién llegado a la pantalla de un error: que lo muestre y enfoque el campo.
  useEffect(() => {
    if (!mostrarErroresAlEntrar) return;
    setMostrarErroresAlEntrar(false);
    contenidoRef.current?.intentarSeguir?.();
  }, [mostrarErroresAlEntrar, nav.pantalla, nav.profundidad]);

  /**
   * llevarAlError
   * Lleva a la pantalla del primer error (del front o del backend), en modo
   * Editar (la Revisión queda debajo). Un error que no es de ninguna pantalla
   * (ej. 'version': hay que recargar) se muestra en la Revisión.
   * @param {Array<{campo: string, mensaje: string}>} errores
   */
  const llevarAlError = useCallback((errores) => {
    const primero = primerError(errores);
    if (!primero) return;
    if (primero.pantalla === null) {
      setEnvio({ estado: ESTADOS_ENVIO.FALLO, mensaje: primero.mensaje });
      return;
    }
    setEnvio({ estado: ESTADOS_ENVIO.INACTIVO, mensaje: null });
    setMostrarErroresAlEntrar(true);
    navRef.current.irA(primero.pantalla);
  }, []);

  // Un solo envío a la vez, aunque se toque dos veces antes del próximo render.
  const enviandoRef = useRef(false);

  /**
   * enviarSolicitud
   * El "Enviar" de la Revisión (ver el encabezado del archivo).
   * @returns {Promise<void>}
   */
  const enviarSolicitud = useCallback(async () => {
    if (enviandoRef.current) return;
    const actuales = datosRef.current;
    const erroresFront = validarDatos(actuales);
    if (erroresFront.length > 0) {
      llevarAlError(erroresFront);
      return;
    }
    enviandoRef.current = true;
    setEnvio({ estado: ESTADOS_ENVIO.ENVIANDO, mensaje: null });
    const resultado = await enviar();
    enviandoRef.current = false;
    if (resultado.tipo === RESULTADOS_ENVIO.ERRORES) {
      setErroresServidor(registrarErroresServidor(resultado.errores, actuales));
      llevarAlError(resultado.errores);
    } else if (resultado.tipo === RESULTADOS_ENVIO.FALLO) {
      setEnvio({ estado: ESTADOS_ENVIO.FALLO, mensaje: resultado.mensaje });
    }
    // ENVIADA y CERRADA: el estado del link cambió y App ya muestra otra pantalla.
  }, [enviar, llevarAlError]);

  /**
   * seguir
   * El "Seguir" del pie (y el Enter de los campos): le pregunta a la pantalla
   * si se puede avanzar y, si sí, va a la siguiente. En el modo Editar, la
   * siguiente del bloque o la Revisión; en la Revisión, envía.
   */
  const seguir = useCallback(() => {
    // Sin la pantalla dibujada no hay nada que validar: no se avanza.
    if (esperandoTelefonosRef.current) return;
    const puede = contenidoRef.current?.intentarSeguir?.() ?? true;
    if (!puede) return;
    const { pantalla: actual, pila, irA, volverA } = navRef.current;
    if (actual === PANTALLA.REVISION) {
      enviarSolicitud();
    } else if (enEdicion(pila)) {
      const siguiente = siguienteEnEdicion(actual);
      if (siguiente === PANTALLA.REVISION) volverA(PANTALLA.REVISION);
      else irA(siguiente);
    } else if (actual < PANTALLA.REVISION) {
      irA(actual + 1);
    }
  }, [enviarSolicitud]);

  /**
   * editarBloque — el "Editar" de un bloque de la Revisión: su primera pantalla.
   * @param {{pantallas: number[]}} bloque - De BLOQUES_REVISION
   */
  const editarBloque = (bloque) => {
    if (enviandoRef.current) return;
    setEnvio({ estado: ESTADOS_ENVIO.INACTIVO, mensaje: null });
    nav.irA(bloque.pantallas[0]);
  };

  const enRevision = nav.pantalla === PANTALLA.REVISION;
  const enviando = envio.estado === ESTADOS_ENVIO.ENVIANDO;
  const Contenido = CONTENIDO_POR_PANTALLA[nav.pantalla];
  const titulo = textoDe(pantalla.titulo, datos);
  const subtitulo = textoDe(pantalla.subtitulo, datos);
  let textoSeguir = textoSeguirEnEdicion(nav.pantalla, editando);
  if (enRevision && enviando) textoSeguir = 'Enviando…';
  else if (enRevision && envio.estado === ESTADOS_ENVIO.FALLO) textoSeguir = 'Reintentar';

  return (
    <ErroresServidorContext value={erroresServidor}>
      <PageContainer>
        {/* data-al-direccion: index.css elige con él la entrada del contenido. */}
        <div
          data-al-direccion={nav.direccion ?? undefined}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <EncabezadoFormulario
            pantalla={nav.pantalla}
            onVolver={nav.profundidad > 1 && !enviando ? nav.volver : null}
            guardado={guardado}
            onReintentar={reintentarGuardado}
            enfocarTitulo={enfocarTitulo}
          />

          {pantalla.capitulo && (
            <div style={{ padding: '16px 16px 0' }}>
              <TarjetaBarberia datos={datos} pantalla={nav.pantalla} />
            </div>
          )}

          {/* La key nueva en cada paso remonta el contenido y dispara su entrada. */}
          <main
            ref={mainRef}
            key={`${nav.profundidad}-${nav.pantalla}`}
            className="al-pantalla"
            style={{ flex: 1, padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* tabIndex -1: recibe el foco al cambiar de pantalla (no es un
                  control, así que sin anillo). */}
              <h1 ref={tituloRef} tabIndex={-1} style={{
                outline: 'none',
                fontFamily: theme.body,
                fontSize: theme.sizeTitle,
                fontWeight: theme.weightHeading,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                color: theme.ink,
                textWrap: 'balance',
              }}>
                {titulo}
              </h1>
              {subtitulo && (
                <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, textWrap: 'pretty' }}>
                  {subtitulo}
                </p>
              )}
            </div>

            {enRevision && <TarjetaBarberia datos={datos} completa onEditar={editarBloque} />}
            {Contenido && esperandoTelefonos && <EsperaTelefonos error={telefonos.error} onReintentar={telefonos.reintentar} />}
            {Contenido && !esperandoTelefonos && <Contenido ref={contenidoRef} datos={datos} actualizar={actualizar} onSeguir={seguir} />}
          </main>

          {textoSeguir && (
            <StickyFooter>
              {enRevision && envio.estado === ESTADOS_ENVIO.FALLO && <AvisoEnvio mensaje={envio.mensaje} />}
              <Button onClick={seguir} disabled={enRevision && enviando}>{textoSeguir}</Button>
            </StickyFooter>
          )}
        </div>
      </PageContainer>
    </ErroresServidorContext>
  );
}

export default Formulario;
