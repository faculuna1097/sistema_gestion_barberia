// /frontend-barbero/src/components/Agenda.jsx
// Vista de agenda tipo calendario mobile: timeline vertical con el horario del
// local, la grilla de slots del barbero (una celda por slot), en gris las horas
// en que no tiene slots, los turnos y los bloques de descanso y de ausencia.
// Navegable por día.
// Todo sale de una sola llamada por día, GET /api/admin/agenda
// (decisiones_descansos.md).
// - Al tocar un turno se abre su detalle; las acciones pasan por ConfirmDialog.
// - Los slots libres y futuros se pueden tocar (reglas en
//   utils/seleccionSlots.js); con algo elegido aparece un footer con dos
//   acciones: "Reservar turno" (abre HojaReservar, que arranca en el primer slot
//   elegido) y "Marcar descanso" (confirma con ConfirmDialog).
// - Un turno sin cliente ofrece "Asignar cliente" en su detalle (abre
//   HojaAsignarCliente).
// - Al tocar un descanso propio se abre su detalle, con "Liberar" (si no empezó)
//   o "Terminar descanso" (si está en curso). Las ausencias se ven, sin acciones:
//   se gestionan en Más → Gestión → Suspensiones.
//
// - Con la app visible, se recarga sola por detrás cada INTERVALO_REFRESCO_MS y
//   al volver al primer plano: un turno que entró por otro lado (turnero, panel)
//   aparece sin tocar nada, sin perder lo elegido ni cerrar lo abierto.
//
// Este archivo orquesta: estado, carga, reloj, refresco, selección, acciones,
// layout y footer. Las piezas viven en components/agenda/: datosAgenda.js y geometria.js
// (funciones puras), NavegadorDia, Timeline y sus bloques (BloquesTimeline) y
// los modales de detalle.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CalendarOff, X } from 'lucide-react';

import {
  getAgenda, patchEstadoTurno, cancelarTurno, crearDescanso, liberarSuspension,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtHora, fechaHoyISO, sumarDias } from '../utils/fecha.js';
import { esSlotTocable, tocarSlot, depurarSeleccion } from '../utils/seleccionSlots.js';

import {
  Skeleton,
  Button,
  ConfirmDialog,
  StickyFooter,
  EmptyState,
  AvisoError,
} from './ui';

import {
  prepararAgenda, agregarDescanso, aplicarEstadoDeTurno, aplicarClienteDeTurno,
} from './agenda/datosAgenda.js';
import {
  PADDING_VERTICAL, ALTO_SKELETON, calcularPxPorHora, calcularRango,
} from './agenda/geometria.js';
import NavegadorDia from './agenda/NavegadorDia.jsx';
import Timeline from './agenda/Timeline.jsx';
import DetalleTurnoModal from './agenda/DetalleTurnoModal.jsx';
import DetalleDescansoModal from './agenda/DetalleDescansoModal.jsx';
import HojaReservar from './agenda/HojaReservar.jsx';
import HojaAsignarCliente from './agenda/HojaAsignarCliente.jsx';

// ─── Constantes ─────────────────────────────────────────────────────────────

// Cada cuánto se actualiza "ahora" con la pantalla abierta: mueve la línea roja
// y deja de ofrecer los slots que ya empezaron.
const INTERVALO_AHORA_MS = 30 * 1000;

// Cada cuánto se recarga la agenda por detrás con la app visible.
const INTERVALO_REFRESCO_MS = 30 * 1000;

// Cuánto queda a la vista un aviso de error en el footer.
const DURACION_AVISO_MS = 5000;

// Config del ConfirmDialog por acción (mismo patrón que Dashboard). `message`
// puede ser una función del rango elegido ({ desde, hasta } en 'HH:MM').
const ACCIONES = {
  marcar_descanso: {
    title: 'Marcar descanso',
    message: ({ desde, hasta }) =>
      `De ${desde} a ${hasta}. Mientras dure, el turnero no ofrece esos horarios.`,
    confirmLabel: 'Sí, marcar',
    confirmVariant: 'primary',
  },
  no_asistio: {
    title: 'Marcar como no asistió',
    message: 'El cliente no se presentó al turno. ¿Confirmás?',
    confirmLabel: 'Sí, no asistió',
    confirmVariant: 'primary',
  },
  cancelar: {
    title: 'Cancelar turno',
    message: 'El turno se cancela y el cliente queda libre. Esta acción no se puede deshacer.',
    confirmLabel: 'Sí, cancelar',
    confirmVariant: 'danger',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agenda
 * Orquesta la carga de la agenda del día, los modales de detalle/confirmación y
 * las hojas de reservar y de asignar cliente. La agenda la pide el backend con el
 * barbero del JWT; `barbero` se usa solo para el alta del turno.
 * @param {{ id: string, nombre: string }} props.barbero - el barbero de la sesión
 * @returns {JSX.Element}
 */
export default function Agenda({ barbero }) {
  const [fecha, setFecha] = useState(fechaHoyISO());
  // Agenda del día visible, ya preparada para dibujar (prepararAgenda), o null
  // antes de la primera carga.
  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // "Ahora" en ms, refrescado cada INTERVALO_AHORA_MS: el tiempo corre con la
  // pantalla abierta.
  const [ahora, setAhora] = useState(() => Date.now());

  // Slots elegidos para un descanso (reglas en utils/seleccionSlots.js). Se usa
  // siempre depurada contra lo que se puede tocar ahora (seleccionVigente).
  const [seleccion, setSeleccion] = useState([]);

  // Aviso efímero de error de una acción. Va en el footer y no arriba: así se ve
  // aunque el barbero haya scrolleado. Va aparte de errorCarga para no tapar el
  // timeline.
  const [aviso, setAviso] = useState(null);
  const refTimerAviso = useRef(null);

  const [detalle, setDetalle] = useState(null);                 // turno expandido
  const [descansoDetalle, setDescansoDetalle] = useState(null); // descanso expandido
  const [confirma, setConfirma] = useState({ open: false, accion: null, turno: null });
  const [procesando, setProcesando] = useState(false);
  // Hoja del atajo: el inicio del primer slot elegido al abrirla, o null.
  const [reservaEn, setReservaEn] = useState(null);
  // Hoja de "Asignar cliente": el turno, o null.
  const [asignarA, setAsignarA] = useState(null);

  const refAhora = useRef(null);  // para auto-scroll al indicador de "ahora"
  // Número del último pedido de agenda: si el barbero cambia de día rápido, la
  // respuesta de un pedido viejo se descarta en vez de pisar la del día visible.
  const refPedido = useRef(0);
  // Hay un pedido de agenda en curso: el refresco automático no arranca otro.
  const refCargando = useRef(false);
  // Espejo de `procesando` para el refresco automático (lee el valor del momento,
  // no el del render en que se armó el intervalo).
  const refProcesando = useRef(false);
  useEffect(() => { refProcesando.current = procesando; }, [procesando]);

  const esHoy = fecha === fechaHoyISO();

  /**
   * cargarAgenda
   * Trae la agenda del día seleccionado (turnos, descansos/ausencias y grilla).
   * Si el detalle de un turno está abierto, lo actualiza con lo que llegó (ej. el
   * cliente lo canceló desde el turnero), sin cerrarlo.
   * @param {Object} [opciones]
   * @param {boolean} [opciones.silenciosa=false] - si es true, no muestra el
   *   skeleton (recarga después de una acción o refresco automático, sin que el
   *   timeline parpadee). Si falla, deja lo que se ve y no muestra error: un
   *   corte de señal no tapa la agenda (la acción ya avisa su propio error).
   */
  const cargarAgenda = useCallback(async ({ silenciosa = false } = {}) => {
    const pedido = ++refPedido.current;
    refCargando.current = true;
    if (!silenciosa) {
      setCargando(true);
      setErrorCarga(null);
    }
    try {
      const data = await getAgenda(fecha);
      if (pedido !== refPedido.current) return;
      setAgenda(prepararAgenda(data, fecha));
      setErrorCarga(null);
      setDetalle((abierto) => {
        if (!abierto) return abierto;
        const actual = data.turnos.find((t) => t.id === abierto.id);
        return actual ? { ...abierto, ...actual } : abierto;
      });
    } catch (err) {
      if (pedido !== refPedido.current) return;
      if (silenciosa) {
        console.warn('[Agenda] No se pudo recargar la agenda; queda la anterior:', err.message);
      } else {
        console.error('[Agenda] Error cargando la agenda:', err.message);
        setErrorCarga('No se pudo cargar la agenda.');
      }
    } finally {
      if (pedido === refPedido.current) {
        setCargando(false);
        refCargando.current = false;
      }
    }
  }, [fecha]);

  // Última versión de cargarAgenda, para el refresco automático (que se arma una
  // sola vez y tiene que cargar el día visible de ahora).
  const refCargarAgenda = useRef(cargarAgenda);
  useEffect(() => { refCargarAgenda.current = cargarAgenda; }, [cargarAgenda]);

  /**
   * irADia
   * Cambia el día visible y pone el skeleton en el mismo render que la fecha
   * nueva. La carga corre en un efecto, después de pintar: sin esto, por un
   * instante se dibujaba el timeline del día anterior bajo la fecha nueva, y al
   * volver a hoy el auto-scroll a "ahora" arrancaba sobre ese timeline viejo y
   * se repetía al terminar la carga.
   * @param {string} nuevaFecha - 'YYYY-MM-DD'
   */
  const irADia = (nuevaFecha) => {
    if (nuevaFecha === fecha) return;  // misma fecha: no hay carga que apague el skeleton
    setCargando(true);
    setFecha(nuevaFecha);
  };

  // Al cambiar de día: cargar y olvidar lo que estaba abierto o elegido.
  useEffect(() => {
    cargarAgenda();
    setDetalle(null);
    setDescansoDetalle(null);
    setSeleccion([]);
    setReservaEn(null);
    setAsignarA(null);
  }, [cargarAgenda]);

  // Reloj de "ahora".
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), INTERVALO_AHORA_MS);
    return () => clearInterval(id);
  }, []);

  // Refresco automático: cada INTERVALO_REFRESCO_MS con la app visible y al
  // volver al primer plano. No arranca si ya hay una carga en curso o una acción
  // en "Procesando…" (esa acción recarga al terminar).
  useEffect(() => {
    /**
     * refrescar
     * Recarga silenciosa del día visible, si la app está a la vista y no hay
     * otra carga ni una acción en curso.
     */
    const refrescar = () => {
      if (document.visibilityState !== 'visible') return;
      if (refCargando.current || refProcesando.current) return;
      refCargarAgenda.current({ silenciosa: true });
    };
    /**
     * alVolver
     * Al volver la app al primer plano: actualiza "ahora" y recarga.
     */
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      setAhora(Date.now());
      refrescar();
    };
    const id = setInterval(refrescar, INTERVALO_REFRESCO_MS);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  // Al desmontar, cortar el timer del aviso.
  useEffect(() => () => clearTimeout(refTimerAviso.current), []);

  // Auto-scroll al indicador de "ahora" cuando se ve el día de hoy. Corre al
  // terminar una carga con skeleton, no en cada tick del reloj.
  useEffect(() => {
    if (!cargando && esHoy && refAhora.current) {
      refAhora.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [cargando, esHoy]);

  // Slots que se pueden tocar ahora (libres y futuros) y la selección
  // depurada contra ellos: si un slot elegido empezó o se ocupó, sale solo.
  const iniciosTocables = useMemo(
    () => new Set(
      (agenda?.slots ?? []).filter((s) => esSlotTocable(s, ahora)).map((s) => s.inicioMs),
    ),
    [agenda, ahora],
  );
  const seleccionVigente = depurarSeleccion(seleccion, iniciosTocables);
  const rangoSeleccion = seleccionVigente.length > 0
    ? {
      desde: fmtHora(seleccionVigente[0].inicioIso),
      hasta: fmtHora(seleccionVigente[seleccionVigente.length - 1].finIso),
    }
    : null;

  /**
   * mostrarAviso
   * Aviso de error efímero en el footer (DURACION_AVISO_MS). Un aviso nuevo
   * reemplaza al anterior y reinicia el tiempo.
   * @param {string} msg
   */
  const mostrarAviso = useCallback((msg) => {
    clearTimeout(refTimerAviso.current);
    setAviso(msg);
    refTimerAviso.current = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
  }, []);

  /**
   * tocarSlotLibre
   * Suma o saca un slot de la selección con las reglas de utils/seleccionSlots.js.
   * @param {Object} slot - slot tocable de la grilla
   */
  const tocarSlotLibre = (slot) => setSeleccion(tocarSlot(seleccionVigente, slot));

  /**
   * pedirConfirmacion
   * Cierra el detalle y abre el ConfirmDialog (evita modal anidado).
   * @param {Object|null} turno - el turno de la acción; null para marcar un descanso
   * @param {string} accion - clave de ACCIONES
   */
  const pedirConfirmacion = (turno, accion) => {
    setDetalle(null);
    setConfirma({ open: true, accion, turno });
  };

  /**
   * cerrarConfirma
   * Cierra el ConfirmDialog.
   */
  const cerrarConfirma = () => setConfirma({ open: false, accion: null, turno: null });

  /**
   * ejecutarAccion
   * Despacha la acción confirmada al endpoint correspondiente y recarga la
   * agenda sin skeleton. El diálogo queda en "Procesando…" mientras responde el
   * servidor, y apenas responde el cambio se dibuja con esa respuesta, sin un
   * rato con la pantalla vieja mientras se recarga (convenciones §8):
   * - marcar un descanso → agregarDescanso. 409 → "Ese horario se acaba de
   *   ocupar" + recarga; 400 → el mensaje del servidor.
   * - no asistió, cancelar → aplicarEstadoDeTurno. Si falla, el mensaje del
   *   servidor + recarga: el turno pudo haber cambiado por otro lado (ej. el
   *   cliente lo canceló desde el turnero).
   */
  const ejecutarAccion = async () => {
    const { accion, turno } = confirma;
    const esDescanso = accion === 'marcar_descanso';

    // Todos los slots elegidos empezaron mientras el diálogo estaba abierto.
    if (esDescanso && seleccionVigente.length === 0) {
      cerrarConfirma();
      mostrarAviso('Esos horarios ya empezaron. Elegí otros.');
      return;
    }

    let exito = false;
    setProcesando(true);
    try {
      if (esDescanso) {
        const { descanso, bloque } = await crearDescanso({
          desde: seleccionVigente[0].inicioIso,
          hasta: seleccionVigente[seleccionVigente.length - 1].finIso,
        });
        setAgenda((actual) => (actual ? agregarDescanso(actual, bloque ?? descanso, fecha) : actual));
        setSeleccion([]);
      } else {
        const cambio = accion === 'cancelar'
          ? await cancelarTurno(turno.id)
          : await patchEstadoTurno(turno.id, 'no_asistio');
        setAgenda((actual) => (actual ? aplicarEstadoDeTurno(actual, cambio) : actual));
      }
      exito = true;
    } catch (err) {
      console.error('[Agenda] Error en ejecutarAccion:', err.message);
      cerrarConfirma();
      if (!esDescanso) {
        mostrarAviso(`Error: ${err.message}`);
        await cargarAgenda({ silenciosa: true });
      } else if (err.status === 409) {
        // Entre la carga de la agenda y ahora, alguien reservó (o se cargó otro
        // bloqueo) en algún slot elegido.
        setSeleccion([]);
        mostrarAviso('Ese horario se acaba de ocupar');
        await cargarAgenda({ silenciosa: true });
      } else if (err.status === 400) {
        mostrarAviso(err.message);
      } else {
        mostrarAviso('No se pudo marcar el descanso. Probá de nuevo.');
      }
    } finally {
      setProcesando(false);
    }

    if (exito) {
      cerrarConfirma();
      await cargarAgenda({ silenciosa: true });
    }
  };

  /**
   * turnoReservado
   * El alta del atajo salió bien: recarga la agenda (la respuesta del alta no
   * alcanza para dibujar el turno) y recién con el turno a la vista cierra la
   * hoja y suelta la selección. La hoja queda en "Reservando…" mientras tanto.
   */
  const turnoReservado = async () => {
    await cargarAgenda({ silenciosa: true });
    setSeleccion([]);
    setReservaEn(null);
  };

  /**
   * abrirAsignarCliente
   * Cierra el detalle del turno y abre la hoja de "Asignar cliente".
   * @param {Object} turno
   */
  const abrirAsignarCliente = (turno) => {
    setDetalle(null);
    setAsignarA(turno);
  };

  /**
   * clienteAsignado
   * Dibuja el cliente con lo que devolvió el servidor, cierra la hoja y recarga
   * por detrás para confirmar (convenciones §8).
   * @param {Object} respuesta - { id, cliente_id, cliente_nombre, cliente_email, cliente_telefono }
   */
  const clienteAsignado = (respuesta) => {
    setAgenda((actual) => (actual ? aplicarClienteDeTurno(actual, respuesta) : actual));
    setAsignarA(null);
    cargarAgenda({ silenciosa: true });
  };

  /**
   * conflictoAlAsignar
   * El turno cambió mientras se elegía el cliente (409): cierra la hoja, avisa y
   * recarga para mostrar cómo quedó.
   * @param {Error & { codigo?: string }} err
   */
  const conflictoAlAsignar = (err) => {
    setAsignarA(null);
    mostrarAviso(err.codigo === 'turno_con_cliente'
      ? 'Otro ya le cargó el cliente a este turno.'
      : err.message);
    cargarAgenda({ silenciosa: true });
  };

  /**
   * liberarDescanso
   * Libera el descanso abierto en el detalle (POST /admin/suspensiones/:id/liberar): si
   * no empezó lo anula entero; si está en curso, lo termina ahora. Un
   * descanso unido (varias partes pegadas) son varias filas: se liberan todas las
   * partes que todavía no terminaron (una ya terminada daría 409).
   * El detalle queda en "Procesando…" hasta que la agenda recargada ya no muestra
   * el descanso. Recarga también si falla: pudo haber cambiado (ya liberado, ya terminado).
   */
  const liberarDescanso = async () => {
    const partes = descansoDetalle.partes.filter((p) => p.hastaMs > Date.now());
    setProcesando(true);
    try {
      const resultados = await Promise.allSettled(partes.map((p) => liberarSuspension(p.id)));
      const fallo = resultados.find((r) => r.status === 'rejected');
      if (fallo) {
        const err = fallo.reason;
        console.error('[Agenda] Error en liberarDescanso:', err.message);
        // 4xx: el mensaje del servidor ya es para el usuario ("El descanso ya terminó").
        mostrarAviso(err.status && err.status < 500
          ? err.message
          : 'No se pudo liberar el descanso. Probá de nuevo.');
      }
      await cargarAgenda({ silenciosa: true });
    } finally {
      setProcesando(false);
      setDescansoDetalle(null);
    }
  };

  // Rango vertical y escala del día mostrado. `rango` es null si el local no abre
  // ese día y no hay turnos. Un día que el barbero no trabaja y el local abre sí
  // tiene rango: se ve entero en gris. Sin rango, el alto por defecto solo
  // dimensiona el skeleton.
  const rango = useMemo(
    () => (agenda ? calcularRango(agenda.turnos, agenda.slots, agenda.fueraDeHorario) : null),
    [agenda],
  );
  const pxPorHora = calcularPxPorHora(agenda?.duracionSlot);
  const altoTotal = rango
    ? 2 * PADDING_VERTICAL + ((rango.minFin - rango.minInicio) / 60) * pxPorHora
    : ALTO_SKELETON;

  // Texto del ConfirmDialog: fijo, o armado con el rango elegido.
  const configConfirma = ACCIONES[confirma.accion];
  let mensajeConfirma = configConfirma?.message || '';
  if (typeof mensajeConfirma === 'function') {
    mensajeConfirma = rangoSeleccion ? mensajeConfirma(rangoSeleccion) : '';
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 16px 24px',
      }}>
        <NavegadorDia
          fecha={fecha}
          esHoy={esHoy}
          onAnterior={() => irADia(sumarDias(fecha, -1))}
          onSiguiente={() => irADia(sumarDias(fecha, 1))}
          onHoy={() => irADia(fechaHoyISO())}
        />

        {cargando && <Skeleton height={altoTotal} radius={theme.radius} />}

        {!cargando && errorCarga && (
          <AvisoError>
            {errorCarga}
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" full={false} onClick={() => cargarAgenda()}>
                Reintentar
              </Button>
            </div>
          </AvisoError>
        )}

        {/* El local no abre y no hay turnos: no hay timeline que dibujar. El
            aviso se centra en el espacio que queda debajo del navegador de días
            (flex: 1). */}
        {!cargando && !errorCarga && agenda && !rango && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <EmptyState
              glyph={<CalendarOff size={28} strokeWidth={1.5} aria-hidden="true" />}
              title="El local no abre este día"
            />
          </div>
        )}

        {!cargando && !errorCarga && agenda && rango && (
          <Timeline
            agenda={agenda}
            fecha={fecha}
            ahora={ahora}
            esHoy={esHoy}
            rango={rango}
            pxPorHora={pxPorHora}
            altoTotal={altoTotal}
            refAhora={refAhora}
            iniciosTocables={iniciosTocables}
            seleccion={seleccionVigente}
            onTocarSlot={tocarSlotLibre}
            onTocarTurno={setDetalle}
            onTocarDescanso={setDescansoDetalle}
          />
        )}
      </div>

      {/* Footer: los slots elegidos con sus dos acciones y/o el aviso de error
          de una acción. El rango va en su propio renglón, con la X para soltarlo:
          en 375 px no entran las dos acciones y el "Cancelar" en una fila. */}
      {(rangoSeleccion || aviso) && (
        <StickyFooter sobreBottomNav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aviso && <AvisoError>{aviso}</AvisoError>}
            {rangoSeleccion && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    fontFamily: theme.body,
                    fontSize: theme.sizeBody,
                    fontWeight: theme.weightMedium,
                    color: theme.ink,
                  }}>
                    {`${rangoSeleccion.desde}–${rangoSeleccion.hasta}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSeleccion([])}
                    aria-label="Soltar los horarios elegidos"
                    style={{
                      width: 44,
                      height: 44,
                      margin: '-8px -12px -8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      color: theme.muted,
                    }}
                  >
                    <X size={20} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Button variant="primary" onClick={() => setReservaEn(seleccionVigente[0].inicioIso)}>
                      Reservar turno
                    </Button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Button variant="secondary" onClick={() => pedirConfirmacion(null, 'marcar_descanso')}>
                      Marcar descanso
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </StickyFooter>
      )}

      {/* Modal de detalle del turno */}
      <DetalleTurnoModal
        turno={detalle}
        onCerrar={() => setDetalle(null)}
        onAccion={pedirConfirmacion}
        onAsignarCliente={abrirAsignarCliente}
      />

      {/* Hoja del atajo "Reservar turno" */}
      {reservaEn && (
        <HojaReservar
          barberoId={barbero.id}
          inicioIso={reservaEn}
          onCerrar={() => setReservaEn(null)}
          onReservado={turnoReservado}
          onConflicto={() => cargarAgenda({ silenciosa: true })}
        />
      )}

      {/* Hoja de "Asignar cliente" */}
      {asignarA && (
        <HojaAsignarCliente
          turno={asignarA}
          onCerrar={() => setAsignarA(null)}
          onAsignado={clienteAsignado}
          onConflicto={conflictoAlAsignar}
        />
      )}

      {/* Modal de detalle del descanso */}
      <DetalleDescansoModal
        descanso={descansoDetalle}
        ahora={ahora}
        procesando={procesando}
        onLiberar={liberarDescanso}
        onCerrar={() => setDescansoDetalle(null)}
      />

      {/* Modal de confirmación de acción */}
      <ConfirmDialog
        open={confirma.open}
        title={configConfirma?.title || ''}
        message={mensajeConfirma}
        confirmLabel={configConfirma?.confirmLabel || 'Confirmar'}
        confirmVariant={configConfirma?.confirmVariant || 'primary'}
        loading={procesando}
        onConfirm={ejecutarAccion}
        onCancel={cerrarConfirma}
      />
    </div>
  );
}
