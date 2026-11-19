// /frontend-barbero/src/components/CrearTurno.jsx
// Wizard de creación de turno manual (3 pasos):
//   0. Servicio  →  1. Día y horario  →  2. Cliente (o "Sin datos") + confirmación
// Más una pantalla de éxito final.
//
// Props:
//   barbero   — { id, nombre }
//   onVolver  — callback para salir del wizard (volver al Dashboard)
//   onExito   — callback al confirmar el turno y tocar "Volver al inicio"

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, CalendarX, ChevronRight, CalendarDays } from 'lucide-react';

import {
  getServicios,
  getDisponibilidad,
  getDiasDisponibles,
  crearTurnoAdmin,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos, capitalizar, textoCliente } from '../utils/formato.js';
import { fmtHora, fmtFechaLarga, fechaHoyISO, sumarDias } from '../utils/fecha.js';
import { useHover } from '../hooks/useHover.js';

import {
  TopBar,
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  SummaryRow,
  AvisoError,
} from './ui';
import SelectorCliente from './cliente/SelectorCliente.jsx';
import { CLIENTE_VACIO, datosClienteParaApi, nombreDelCliente } from '../utils/clienteTurno.js';
import BotonSinDatos from './cliente/BotonSinDatos.jsx';
import Separador from './cliente/Separador.jsx';

const TOTAL_PASOS = 3;
const TITULOS_PASO = ['Elegí el servicio', 'Elegí el día y el horario', 'Datos del cliente'];

// Cuántos días se ofrecen en chips, desde hoy. Para uno más lejano está "Otra
// fecha" (el calendario del celular).
const DIAS_EN_CHIPS = 14;

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CrearTurno
 * Orquesta el wizard: estado de la reserva, navegación entre pasos y envío final.
 * @param {{ id: string, nombre: string }} props.barbero
 * @param {() => void} props.onVolver
 * @param {() => void} props.onExito
 * @returns {JSX.Element}
 */
export default function CrearTurno({ barbero, onVolver, onExito }) {
  const [paso, setPaso] = useState(0);
  const [reserva, setReserva] = useState({
    servicio: null,
    fecha: '',
    horario: null,
  });
  const [cliente, setCliente] = useState(CLIENTE_VACIO);

  const [servicios, setServicios] = useState([]);
  const [slots, setSlots] = useState([]);

  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [errorServicios, setErrorServicios] = useState(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [errorSlots, setErrorSlots] = useState(null);
  // Número del último pedido de horarios: al cambiar de día rápido, la
  // respuesta de un día anterior se descarta.
  const refPedidoSlots = useRef(0);

  // Qué envío está en curso: 'sin_datos' (el botón destacado) o 'cliente'.
  const [enviando, setEnviando] = useState(null);
  const [errorConfirm, setErrorConfirm] = useState(null);
  // Nombre del cliente del turno creado (null = "Sin datos"); undefined mientras
  // no se creó.
  const [creado, setCreado] = useState(undefined);

  /**
   * actualizar
   * Merge parcial sobre el estado de reserva.
   * @param {Object} datos
   */
  const actualizar = (datos) => setReserva((prev) => ({ ...prev, ...datos }));

  /**
   * cargarServicios
   * Trae los servicios del tenant (paso 0).
   */
  const cargarServicios = useCallback(async () => {
    setCargandoServicios(true);
    setErrorServicios(null);
    try {
      const data = await getServicios();
      setServicios(data);
    } catch (err) {
      console.error('[CrearTurno] Error cargando servicios:', err.message);
      setErrorServicios('No se pudieron cargar los servicios.');
    } finally {
      setCargandoServicios(false);
    }
  }, []);

  useEffect(() => { cargarServicios(); }, [cargarServicios]);

  /**
   * cargarSlots
   * Trae los horarios libres para (barbero, servicio, fecha elegida).
   */
  const cargarSlots = useCallback(async () => {
    if (!reserva.fecha || !reserva.servicio) return;
    const pedido = ++refPedidoSlots.current;
    setCargandoSlots(true);
    setSlots([]);
    setErrorSlots(null);
    try {
      const data = await getDisponibilidad(barbero.id, reserva.servicio.id, reserva.fecha);
      if (pedido !== refPedidoSlots.current) return;
      setSlots(data.slots || []);
    } catch (err) {
      if (pedido !== refPedidoSlots.current) return;
      console.error('[CrearTurno] Error cargando disponibilidad:', err.message);
      setErrorSlots('No se pudieron cargar los horarios.');
    } finally {
      if (pedido === refPedidoSlots.current) setCargandoSlots(false);
    }
  }, [barbero.id, reserva.fecha, reserva.servicio]);

  useEffect(() => {
    if (paso === 1) cargarSlots();
  }, [paso, cargarSlots]);

  /**
   * confirmar
   * Envía el turno al backend con el cliente elegido, uno nuevo o ninguno.
   * @param {boolean} sinCliente - true desde el botón "Sin datos"
   */
  const confirmar = async (sinCliente) => {
    const datosCliente = sinCliente ? { sin_cliente: true } : datosClienteParaApi(cliente);
    if (!datosCliente) return;
    setEnviando(sinCliente ? 'sin_datos' : 'cliente');
    setErrorConfirm(null);
    try {
      await crearTurnoAdmin({
        servicio_id: reserva.servicio.id,
        barbero_id: barbero.id,
        inicio: reserva.horario,
        ...datosCliente,
      });
      setCreado(sinCliente ? null : nombreDelCliente(cliente));
    } catch (err) {
      console.error('[CrearTurno] Error al crear turno:', err.message);
      setErrorConfirm(err.message);
    } finally {
      setEnviando(null);
    }
  };

  // ─── Pantalla de éxito ────────────────────────────────────────────────────
  if (creado !== undefined) {
    return <PantallaExito reserva={reserva} nombreCliente={creado} onExito={onExito} />;
  }

  /**
   * retroceder
   * Vuelve un paso, o sale del wizard si estamos en el paso 0.
   */
  const retroceder = () => {
    if (enviando) return;
    setErrorConfirm(null);
    if (paso === 0) onVolver();
    else setPaso((p) => p - 1);
  };

  return (
    <>
      <TopBar onVolver={retroceder} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '0 16px 24px',
      }}>
        <StepperBarras pasoActual={paso} total={TOTAL_PASOS} />

        <ScreenHeader
          eyebrow={`Paso ${paso + 1} de ${TOTAL_PASOS}`}
          title={TITULOS_PASO[paso]}
        />

        {paso === 0 && (
          <PasoServicio
            servicios={servicios}
            cargando={cargandoServicios}
            error={errorServicios}
            onReintentar={cargarServicios}
            onElegir={(s) => {
              // Otro servicio cambia qué días y horarios hay: se vuelven a elegir.
              if (s.id !== reserva.servicio?.id) actualizar({ servicio: s, fecha: '', horario: null });
              setPaso(1);
            }}
          />
        )}

        {paso === 1 && (
          <PasoDiaHorario
            barberoId={barbero.id}
            servicioId={reserva.servicio.id}
            fecha={reserva.fecha}
            horario={reserva.horario}
            slots={slots}
            cargandoSlots={cargandoSlots}
            errorSlots={errorSlots}
            onReintentarSlots={cargarSlots}
            onCambiarFecha={(f) => actualizar({ fecha: f, horario: null })}
            onElegirHorario={(slot) => { actualizar({ horario: slot }); setPaso(2); }}
          />
        )}

        {paso === 2 && (
          <PasoCliente
            reserva={reserva}
            cliente={cliente}
            onCambiarCliente={setCliente}
            enviando={enviando}
            errorConfirm={errorConfirm}
            onConfirmar={confirmar}
          />
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// StepperBarras — indicador de progreso (sub-componente local)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * StepperBarras
 * N segmentos horizontales. Los <= pasoActual se pintan en accent.
 * @param {number} props.pasoActual - índice 0-based del paso activo
 * @param {number} props.total
 * @returns {JSX.Element}
 */
function StepperBarras({ pasoActual, total }) {
  return (
    <div
      style={{ display: 'flex', gap: 4, paddingTop: 4 }}
      role="progressbar"
      aria-valuenow={pasoActual + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Paso ${pasoActual + 1} de ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            background: i <= pasoActual ? theme.accent : theme.hairline,
            transition: `background ${theme.transitionMedium}`,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Paso 0 — Servicio
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PasoServicio
 * Lista de servicios como cards clickables.
 * @returns {JSX.Element}
 */
function PasoServicio({ servicios, cargando, error, onReintentar, onElegir }) {
  if (cargando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={64} radius={theme.radius} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
        title="No pudimos cargar los servicios"
        body={error}
        action={
          <Button variant="secondary" full={false} onClick={onReintentar}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (servicios.length === 0) {
    return (
      <EmptyState
        glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
        title="No hay servicios cargados"
        body="Pedile a tu admin que cargue los servicios del local."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {servicios.map((s) => (
        <Card key={s.id} onClick={() => onElegir(s)} padding={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: theme.weightMedium,
                color: theme.ink,
              }}>
                {s.nombre}
              </div>
              <div style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: theme.muted,
                marginTop: 2,
              }}>
                {fmtPesos(s.precio)}
                {s.duracion_minutos ? ` · ${s.duracion_minutos} min` : ''}
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.75} color={theme.mutedSoft} aria-hidden="true" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Paso 1 — Día y horario
// ═══════════════════════════════════════════════════════════════════════════

/**
 * rotuloDia
 * Rótulo corto de un día para su chip: "Hoy", "Mañana" o el día de la semana.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {string} hoy - 'YYYY-MM-DD' de hoy
 * @returns {string} Ej: "Hoy", "Mañana", "Sáb"
 */
function rotuloDia(fecha, hoy) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' });
  return capitalizar(dia.replace('.', ''));
}

/**
 * PasoDiaHorario
 * Días en chips (hoy y los DIAS_EN_CHIPS - 1 siguientes, más "Otra fecha") y,
 * debajo, los horarios libres del día elegido. Los días sin lugar se ven
 * grisados (GET /turnero/dias-disponibles); si esa consulta falla, se ofrecen
 * todos. Al entrar sin día elegido, queda marcado el primero con lugar. Tocar un
 * horario avanza.
 * @param {string} props.barberoId
 * @param {string} props.servicioId
 * @param {string} props.fecha - día elegido ('' si todavía ninguno)
 * @param {string|null} props.horario - horario elegido antes (al volver del paso 2)
 * @param {string[]} props.slots - horarios libres del día (ISO)
 * @param {boolean} props.cargandoSlots
 * @param {string|null} props.errorSlots
 * @param {() => void} props.onReintentarSlots
 * @param {(fecha: string) => void} props.onCambiarFecha
 * @param {(slot: string) => void} props.onElegirHorario
 * @returns {JSX.Element}
 */
function PasoDiaHorario({
  barberoId, servicioId, fecha, horario, slots, cargandoSlots, errorSlots,
  onReintentarSlots, onCambiarFecha, onElegirHorario,
}) {
  const hoy = fechaHoyISO();
  const dias = Array.from({ length: DIAS_EN_CHIPS }, (_, i) => sumarDias(hoy, i));
  const ultimoDia = dias[dias.length - 1];

  // Días con lugar: null mientras carga; un Set; o 'todos' si la consulta falló.
  const [disponibles, setDisponibles] = useState(null);
  const refFechaInput = useRef(null);
  const refChipElegido = useRef(null);

  // Días con lugar de la ventana de chips. Si no hay día elegido, marca el
  // primero con lugar (o hoy, si la consulta falló o no hay ninguno).
  useEffect(() => {
    let vigente = true;
    (async () => {
      let conLugar = 'todos';
      try {
        conLugar = new Set(await getDiasDisponibles(barberoId, servicioId, hoy, ultimoDia));
      } catch (err) {
        console.warn('[CrearTurno] No se pudieron leer los días con lugar; se ofrecen todos:', err.message);
      }
      if (!vigente) return;
      setDisponibles(conLugar);
      if (!fecha) {
        const primero = conLugar === 'todos' ? hoy : dias.find((d) => conLugar.has(d));
        onCambiarFecha(primero || hoy);
      }
    })();
    return () => { vigente = false; };
    // Solo al entrar al paso o al cambiar de servicio: `fecha` cambia al elegir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberoId, servicioId]);

  // El chip elegido queda a la vista (ej. al volver del paso 2 con un día lejano).
  useEffect(() => {
    refChipElegido.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [fecha, disponibles]);

  /**
   * abrirCalendario
   * Abre el calendario nativo para elegir un día fuera de los chips.
   */
  const abrirCalendario = () => {
    const input = refFechaInput.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Navegador sin showPicker: el foco en el input abre el selector en el celular.
      input.focus();
      input.click();
    }
  };

  const fechaLejana = fecha && !dias.includes(fecha) ? fecha : null;
  const tieneLugar = (d) => disponibles === null || disponibles === 'todos' || disponibles.has(d);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chips de días: scroll de costado, de borde a borde */}
      <div
        role="group"
        aria-label="Día del turno"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          margin: '0 -16px',
          padding: '2px 16px 6px',
          scrollbarWidth: 'none',
        }}
      >
        {dias.map((d) => (
          <ChipDia
            key={d}
            refElegido={d === fecha ? refChipElegido : undefined}
            rotulo={rotuloDia(d, hoy)}
            numero={Number(d.slice(8, 10))}
            etiqueta={capitalizar(fmtFechaLarga(d))}
            elegido={d === fecha}
            cargando={disponibles === null}
            sinLugar={!tieneLugar(d)}
            onClick={() => onCambiarFecha(d)}
          />
        ))}
        {fechaLejana && (
          <ChipDia
            refElegido={refChipElegido}
            rotulo={rotuloDia(fechaLejana, hoy)}
            numero={Number(fechaLejana.slice(8, 10))}
            etiqueta={capitalizar(fmtFechaLarga(fechaLejana))}
            elegido
            onClick={() => {}}
          />
        )}
        <ChipOtraFecha onClick={abrirCalendario} />
        {/* Calendario nativo para "Otra fecha": oculto, se abre desde el chip. */}
        <input
          ref={refFechaInput}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          min={hoy}
          onChange={(e) => { if (e.target.value) onCambiarFecha(e.target.value); }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </div>

      {fecha && (
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.inkSoft,
        }}>
          {capitalizar(fmtFechaLarga(fecha))}
        </div>
      )}

      {/* Sin día todavía: se está buscando el primero con lugar. */}
      {!fecha && (
        <>
          <Skeleton height={21} width={180} radius={theme.radiusSm} />
          <ListaHorarios cargando />
        </>
      )}

      {fecha && (
        <ListaHorarios
          fecha={fecha}
          horario={horario}
          slots={slots}
          cargando={cargandoSlots || disponibles === null}
          error={errorSlots}
          onReintentar={onReintentarSlots}
          onElegir={onElegirHorario}
        />
      )}
    </div>
  );
}

/**
 * ChipDia
 * Chip de un día: el rótulo ("Hoy", "Mañana", "Sáb") en mono y el número del
 * día. Un día sin lugar se ve grisado y no se puede tocar. Touch target 64×64.
 * @param {string} props.rotulo
 * @param {number} props.numero
 * @param {string} props.etiqueta - nombre accesible ("Sábado, 15 de noviembre")
 * @param {boolean} props.elegido
 * @param {boolean} [props.cargando=false] - todavía no se sabe si tiene lugar
 * @param {boolean} [props.sinLugar=false]
 * @param {Object} [props.refElegido] - ref para traer el chip elegido a la vista
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function ChipDia({ rotulo, numero, etiqueta, elegido, cargando = false, sinLugar = false, refElegido, onClick }) {
  const [hover, eventosHover] = useHover();
  const inactivo = sinLugar || cargando;

  let fondo = theme.surface;
  let borde = theme.hairline;
  let colorTexto = theme.ink;
  let colorRotulo = theme.muted;
  if (elegido) {
    fondo = theme.accent;
    borde = theme.accent;
    colorTexto = theme.accentInk;
    colorRotulo = theme.accentInk;
  } else if (sinLugar) {
    fondo = 'transparent';
    borde = theme.hairlineSoft;
    colorTexto = theme.mutedSoft;
    colorRotulo = theme.mutedSoft;
  } else if (hover && !inactivo) {
    fondo = theme.accentSoft;
    borde = theme.accent;
  }

  return (
    <button
      ref={refElegido}
      type="button"
      onClick={onClick}
      disabled={sinLugar}
      aria-pressed={elegido}
      aria-label={sinLugar ? `${etiqueta}, sin horarios` : etiqueta}
      {...eventosHover}
      style={{
        flexShrink: 0,
        width: 64,
        height: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: fondo,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        cursor: inactivo ? 'default' : 'pointer',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: colorRotulo,
      }}>
        {rotulo}
      </span>
      <span style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: colorTexto,
        lineHeight: 1.1,
      }}>
        {numero}
      </span>
    </button>
  );
}

/**
 * ChipOtraFecha
 * Último chip de la fila: abre el calendario para un día más lejano.
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function ChipOtraFecha({ onClick }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      style={{
        flexShrink: 0,
        height: 64,
        padding: '0 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: hover ? theme.accentSoft : theme.surface,
        border: `1px dashed ${hover ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        cursor: 'pointer',
        color: theme.inkSoft,
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      <CalendarDays size={20} strokeWidth={1.75} aria-hidden="true" />
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        Otra fecha
      </span>
    </button>
  );
}

/**
 * ListaHorarios
 * Horarios libres del día elegido. Cada uno avanza al tocarlo.
 * @returns {JSX.Element}
 */
function ListaHorarios({ fecha, horario, slots, cargando, error, onReintentar, onElegir }) {
  if (cargando) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={44} width={80} radius={theme.radius} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
        title="No pudimos cargar los horarios"
        body={error}
        action={
          <Button variant="secondary" full={false} onClick={onReintentar}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
        title="Sin horarios disponibles"
        body={`No hay turnos libres el ${fmtFechaLarga(fecha)}. Probá con otro día.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {slots.map((slot) => (
        <ChipHora
          key={slot}
          hora={fmtHora(slot)}
          elegido={slot === horario}
          onClick={() => onElegir(slot)}
        />
      ))}
    </div>
  );
}

/**
 * ChipHora
 * Chip clickable con una hora. Hover solo con mouse (useHover). Touch target
 * ≥ 44px.
 * @param {string} props.hora - 'HH:MM'
 * @param {boolean} [props.elegido=false] - el horario elegido antes
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function ChipHora({ hora, elegido = false, onClick }) {
  const [hover, eventosHover] = useHover();
  const marcado = elegido || hover;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={elegido}
      {...eventosHover}
      style={{
        minWidth: 80,
        height: 44,
        padding: '0 16px',
        background: marcado ? theme.accentSoft : theme.surface,
        border: `1px solid ${marcado ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        cursor: 'pointer',
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      {hora}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Paso 2 — Cliente + confirmación
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PasoCliente
 * Resumen del turno, el botón "Sin datos" (confirma en el acto) y, debajo, el
 * cliente: buscar uno existente o cargar uno nuevo, con "Confirmar turno".
 * @param {Object} props.reserva - { servicio, fecha, horario }
 * @param {Object} props.cliente - valor de SelectorCliente
 * @param {(valor: Object) => void} props.onCambiarCliente
 * @param {'sin_datos'|'cliente'|null} props.enviando
 * @param {string|null} props.errorConfirm
 * @param {(sinCliente: boolean) => void} props.onConfirmar
 * @returns {JSX.Element}
 */
function PasoCliente({ reserva, cliente, onCambiarCliente, enviando, errorConfirm, onConfirmar }) {
  const puedeConfirmar = Boolean(datosClienteParaApi(cliente));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ResumenTurno reserva={reserva} />

      <BotonSinDatos
        onClick={() => onConfirmar(true)}
        procesando={enviando === 'sin_datos'}
        deshabilitado={enviando === 'cliente'}
      />

      <Separador texto="o cargá el cliente" />

      <SelectorCliente valor={cliente} onCambiar={onCambiarCliente} deshabilitado={Boolean(enviando)} />

      {errorConfirm && <AvisoError>{errorConfirm}</AvisoError>}

      <Button variant="primary" onClick={() => onConfirmar(false)} disabled={Boolean(enviando) || !puedeConfirmar}>
        {enviando === 'cliente' ? 'Creando turno…' : 'Confirmar turno'}
      </Button>
    </div>
  );
}

/**
 * ResumenTurno
 * El turno que se está por crear, en una card compacta: servicio, día y hora.
 * @param {Object} props.reserva - { servicio, fecha, horario }
 * @returns {JSX.Element}
 */
function ResumenTurno({ reserva }) {
  return (
    <Card padding={12} style={{ background: theme.surfaceAlt, borderColor: theme.surfaceAlt }}>
      <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
        {reserva.servicio?.nombre}
      </div>
      <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft, marginTop: 2 }}>
        {capitalizar(fmtFechaLarga(reserva.fecha))} · {fmtHora(reserva.horario)} hs
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Pantalla de éxito
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PantallaExito
 * Confirmación visual del turno creado. No muestra el turno_id crudo —
 * muestra el resumen útil para el barbero.
 * @param {Object} props.reserva - { servicio, fecha, horario }
 * @param {string|null} props.nombreCliente - null = turno "Sin datos"
 * @param {() => void} props.onExito
 * @returns {JSX.Element}
 */
function PantallaExito({ reserva, nombreCliente, onExito }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '48px 24px 24px',
      gap: 8,
    }}>
      {/* Check verde animado con keyframe om-pop (definido en index.css) */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 999,
        background: theme.successSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.success,
        marginBottom: 8,
        animation: 'om-pop .35s ease-out both',
      }}>
        <Check size={36} strokeWidth={2.5} aria-hidden="true" />
      </div>

      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeTitle,
        letterSpacing: '-0.02em',
        color: theme.ink,
      }}>
        Turno creado
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        maxWidth: 280,
      }}>
        {nombreCliente
          ? 'El turno quedó agendado correctamente.'
          : 'El turno quedó agendado. El cliente lo podés cargar desde la Agenda.'}
      </div>

      {/* Resumen del turno creado */}
      <Card padding={14} style={{ width: '100%', marginTop: 16, textAlign: 'left' }}>
        <SummaryRow label="Servicio" value={reserva.servicio?.nombre || '—'} />
        <SummaryRow label="Fecha"    value={reserva.fecha ? fmtFechaLarga(reserva.fecha) : '—'} />
        <SummaryRow label="Hora"     value={reserva.horario ? `${fmtHora(reserva.horario)} hs` : '—'} />
        <SummaryRow label="Cliente"  value={textoCliente(nombreCliente)} />
      </Card>

      <div style={{ width: '100%', marginTop: 16 }}>
        <Button variant="primary" onClick={onExito}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
