// /frontend-barbero/src/components/agenda/HojaReservar.jsx
// Atajo de la Agenda: reservar un turno que arranca en el primer slot elegido,
// sin pasar por el wizard. Se elige el servicio y el cliente (buscar, nuevo o
// "Sin datos"). Si el servicio no entra (409/422), lo dice sin perder lo cargado.

import { useCallback, useEffect, useState } from 'react';
import { CalendarX } from 'lucide-react';

import { getServicios, crearTurnoAdmin } from '../../services/api.js';
import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';
import { fmtHora } from '../../utils/fecha.js';
import { CLIENTE_VACIO, datosClienteParaApi } from '../../utils/clienteTurno.js';
import { HojaInferior, Skeleton, Button, AvisoError, EmptyState } from '../ui';
import SelectorCliente from '../cliente/SelectorCliente.jsx';
import BotonSinDatos from '../cliente/BotonSinDatos.jsx';
import Separador from '../cliente/Separador.jsx';

// Rótulo mono en mayúsculas de cada bloque de la hoja (el mismo de Field).
const ESTILO_ROTULO = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};

/**
 * mensajeDeError
 * El texto para el barbero cuando la reserva falla.
 * @param {Error & { status?: number }} err
 * @returns {string}
 */
function mensajeDeError(err) {
  if (err.status === 409) return 'Ese horario ya no está libre: se ocupó o no entra el servicio. Elegí otro servicio u otro horario.';
  if (err.status && err.status < 500) return err.message;
  return 'No se pudo reservar el turno. Probá de nuevo.';
}

/**
 * OpcionServicio
 * Un servicio de la lista de la hoja: nombre y duración. Elegido, con borde y
 * fondo de acento (aria-pressed). Touch target de 48 px de alto.
 * @param {{ nombre: string, duracion_minutos?: number }} props.servicio
 * @param {boolean} props.elegido
 * @param {boolean} props.deshabilitado - mientras se reserva
 * @param {() => void} props.onElegir
 * @returns {JSX.Element}
 */
function OpcionServicio({ servicio, elegido, deshabilitado, onElegir }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      onClick={onElegir}
      disabled={deshabilitado}
      aria-pressed={elegido}
      {...eventosHover}
      style={{
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 14px',
        background: elegido ? theme.accentSoft : theme.surface,
        border: `1px solid ${elegido ? theme.accent : (hover ? theme.mutedSoft : theme.hairline)}`,
        borderRadius: theme.radius,
        cursor: deshabilitado ? 'default' : 'pointer',
        textAlign: 'left',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
        {servicio.nombre}
      </span>
      {servicio.duracion_minutos ? (
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, flexShrink: 0 }}>
          {servicio.duracion_minutos} min
        </span>
      ) : null}
    </button>
  );
}

/**
 * HojaReservar
 * Hoja del atajo "Reservar turno". El servicio no viene elegido, salvo que el
 * local tenga uno solo. Al reservar queda en "Reservando…" hasta que la agenda
 * se recargó (la respuesta del alta no alcanza para dibujar el turno), y recién
 * ahí se cierra (convenciones §8).
 * @param {string} props.barberoId - el barbero de la sesión (el servidor igual usa el del token)
 * @param {string} props.inicioIso - inicio del primer slot elegido
 * @param {() => void} props.onCerrar
 * @param {() => Promise<void>} props.onReservado - recarga la agenda; la hoja espera a que termine
 * @param {() => void} props.onConflicto - el horario se ocupó (409): recarga por detrás
 * @returns {JSX.Element}
 */
export default function HojaReservar({ barberoId, inicioIso, onCerrar, onReservado, onConflicto }) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [servicio, setServicio] = useState(null);
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  // Qué envío está en curso: 'sin_datos' (el botón destacado), 'cliente' o null.
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState(null);

  /**
   * cargarServicios
   * Trae los servicios del local. Con uno solo, queda elegido.
   */
  const cargarServicios = useCallback(async () => {
    setCargando(true);
    setErrorCarga(false);
    try {
      const data = await getServicios();
      setServicios(data);
      if (data.length === 1) setServicio(data[0]);
    } catch (err) {
      console.error('[HojaReservar] Error cargando servicios:', err.message);
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarServicios(); }, [cargarServicios]);

  /**
   * reservar
   * Crea el turno con el servicio y el cliente elegidos (o "Sin datos").
   * @param {boolean} sinCliente - true desde el botón "Sin datos"
   */
  const reservar = async (sinCliente) => {
    const datosCliente = sinCliente ? { sin_cliente: true } : datosClienteParaApi(cliente);
    if (!servicio || !datosCliente) return;
    setEnviando(sinCliente ? 'sin_datos' : 'cliente');
    setError(null);
    try {
      await crearTurnoAdmin({
        servicio_id: servicio.id,
        barbero_id: barberoId,
        inicio: inicioIso,
        ...datosCliente,
      });
    } catch (err) {
      console.error('[HojaReservar] Error al reservar:', err.message);
      setError(mensajeDeError(err));
      setEnviando(null);
      if (err.status === 409) onConflicto();
      return;
    }
    // La hoja la cierra quien la abrió, cuando la agenda ya muestra el turno.
    await onReservado();
  };

  const fin = servicio?.duracion_minutos
    ? new Date(Date.parse(inicioIso) + servicio.duracion_minutos * 60000).toISOString()
    : null;
  const puedeReservar = Boolean(servicio && datosClienteParaApi(cliente));

  return (
    <HojaInferior
      titulo={`Reservar turno a las ${fmtHora(inicioIso)}`}
      subtitulo={fin ? `Termina ${fmtHora(fin)}` : 'Elegí el servicio'}
      bloqueada={Boolean(enviando)}
      onCerrar={onCerrar}
      pie={
        <>
          {error && <AvisoError>{error}</AvisoError>}
          <Button variant="primary" onClick={() => reservar(false)} disabled={Boolean(enviando) || !puedeReservar}>
            {enviando === 'cliente' ? 'Reservando…' : 'Reservar turno'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Servicio */}
        <div role="group" aria-label="Servicio" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={ESTILO_ROTULO}>Servicio</span>
          {cargando && Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={46} radius={theme.radius} />
          ))}
          {!cargando && errorCarga && (
            <EmptyState
              glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
              title="No pudimos cargar los servicios"
              action={<Button variant="secondary" full={false} onClick={cargarServicios}>Reintentar</Button>}
            />
          )}
          {!cargando && !errorCarga && servicios.map((s) => (
            <OpcionServicio
              key={s.id}
              servicio={s}
              elegido={servicio?.id === s.id}
              deshabilitado={Boolean(enviando)}
              onElegir={() => { setServicio(s); setError(null); }}
            />
          ))}
        </div>

        {/* Cliente */}
        <BotonSinDatos
          onClick={() => reservar(true)}
          procesando={enviando === 'sin_datos'}
          deshabilitado={!servicio || enviando === 'cliente'}
        />
        <Separador texto="o cargá el cliente" />
        <SelectorCliente valor={cliente} onCambiar={setCliente} deshabilitado={Boolean(enviando)} />
      </div>
    </HojaInferior>
  );
}
