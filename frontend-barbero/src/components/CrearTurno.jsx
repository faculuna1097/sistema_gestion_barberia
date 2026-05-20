// /frontend-barbero/src/components/CrearTurno.jsx
// Wizard de creación de turno manual (4 pasos):
//   0. Servicio  →  1. Fecha  →  2. Horario  →  3. Datos del cliente + confirmación
// Más una pantalla de éxito final.
//
// Props:
//   barbero   — { id, nombre }
//   onVolver  — callback para salir del wizard (volver al Dashboard)
//   onExito   — callback al confirmar el turno y tocar "Volver al inicio"

import { useState, useEffect, useCallback } from 'react';
import { Check, CalendarX, ChevronRight } from 'lucide-react';

import {
  getServicios,
  getDisponibilidad,
  crearTurnoAdmin,
  buscarClientes,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fmtHora, fmtFechaLarga } from '../utils/fecha.js';

import {
  TopBar,
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  Field,
  SearchInput,
  SummaryRow,
} from './ui';

const TOTAL_PASOS = 4;
const TITULOS_PASO = ['Elegí el servicio', 'Elegí la fecha', 'Elegí el horario', 'Datos del cliente'];

/**
 * fechaHoyISO
 * @returns {string} 'YYYY-MM-DD' de hoy en zona local.
 */
function fechaHoyISO() {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CrearTurno
 * Orquesta el wizard: estado de la reserva, navegación entre pasos y envío final.
 */
export default function CrearTurno({ barbero, onVolver, onExito }) {
  const [paso, setPaso] = useState(0);
  const [reserva, setReserva] = useState({
    servicio: null,
    fecha: '',
    horario: null,
    nombre: '',
    telefono: '',
    email: '',
  });

  const [servicios, setServicios] = useState([]);
  const [slots, setSlots] = useState([]);

  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [errorConfirm, setErrorConfirm] = useState(null);
  const [resultado, setResultado] = useState(null);

  /**
   * actualizar
   * Merge parcial sobre el estado de reserva.
   */
  const actualizar = (datos) => setReserva((prev) => ({ ...prev, ...datos }));

  /**
   * cargarServicios
   * Trae los servicios del tenant (paso 0).
   */
  const cargarServicios = useCallback(async () => {
    setCargandoServicios(true);
    setErrorCarga(null);
    try {
      const data = await getServicios();
      setServicios(data);
      console.log('[CrearTurno] getServicios — cargados:', data.length);
    } catch (err) {
      console.error('[CrearTurno] Error cargando servicios:', err.message);
      setErrorCarga('No se pudieron cargar los servicios.');
    } finally {
      setCargandoServicios(false);
    }
  }, []);

  useEffect(() => { cargarServicios(); }, [cargarServicios]);

  /**
   * cargarSlots
   * Trae la disponibilidad para (barbero, servicio, fecha) — al entrar al paso 2.
   */
  const cargarSlots = useCallback(async () => {
    if (!reserva.fecha || !reserva.servicio) return;
    setCargandoSlots(true);
    setSlots([]);
    setErrorCarga(null);
    try {
      const data = await getDisponibilidad(barbero.id, reserva.servicio.id, reserva.fecha);
      setSlots(data.slots || []);
      console.log('[CrearTurno] getDisponibilidad — slots:', (data.slots || []).length);
    } catch (err) {
      console.error('[CrearTurno] Error cargando disponibilidad:', err.message);
      setErrorCarga('No se pudo cargar la disponibilidad.');
    } finally {
      setCargandoSlots(false);
    }
  }, [barbero.id, reserva.fecha, reserva.servicio]);

  useEffect(() => {
    if (paso === 2) cargarSlots();
  }, [paso, cargarSlots]);

  /**
   * confirmar
   * Envía el turno al backend. El nombre ya viene validado por el botón disabled.
   */
  const confirmar = async () => {
    setEnviando(true);
    setErrorConfirm(null);
    try {
      const datos = {
        servicio_id: reserva.servicio.id,
        barbero_id: barbero.id,
        inicio: reserva.horario,
        nombre: reserva.nombre.trim(),
        ...(reserva.telefono.trim() ? { telefono: reserva.telefono.trim() } : {}),
        ...(reserva.email.trim() ? { email: reserva.email.trim() } : {}),
      };
      const res = await crearTurnoAdmin(datos);
      console.log('[CrearTurno] confirmar — completado | turno_id:', res.turno_id);
      setResultado(res);
    } catch (err) {
      console.error('[CrearTurno] Error al crear turno:', err.message);
      setErrorConfirm(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── Pantalla de éxito ────────────────────────────────────────────────────
  if (resultado) {
    return <PantallaExito reserva={reserva} onExito={onExito} />;
  }

  /**
   * retroceder
   * Vuelve un paso, o sale del wizard si estamos en el paso 0.
   */
  const retroceder = () => {
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
            error={errorCarga}
            onReintentar={cargarServicios}
            onElegir={(s) => { actualizar({ servicio: s }); setPaso(1); }}
          />
        )}

        {paso === 1 && (
          <PasoFecha
            fecha={reserva.fecha}
            onCambiarFecha={(f) => actualizar({ fecha: f, horario: null })}
            onContinuar={() => setPaso(2)}
          />
        )}

        {paso === 2 && (
          <PasoHorario
            fecha={reserva.fecha}
            slots={slots}
            cargando={cargandoSlots}
            error={errorCarga}
            onReintentar={cargarSlots}
            onElegir={(slot) => { actualizar({ horario: slot }); setPaso(3); }}
          />
        )}

        {paso === 3 && (
          <PasoDatos
            reserva={reserva}
            actualizar={actualizar}
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
                fontSize: theme.sizeMicro + 1,
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
// Paso 1 — Fecha
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PasoFecha
 * Selector de fecha con input date nativo. Botón "Continuar" sólo si hay fecha.
 */
function PasoFecha({ fecha, onCambiarFecha, onContinuar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field
        label="Fecha del turno"
        type="date"
        value={fecha}
        min={fechaHoyISO()}
        onChange={onCambiarFecha}
      />

      {fecha && (
        <Card padding={12} style={{ background: theme.accentSoft, borderColor: theme.accentSoft }}>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.inkSoft,
            textTransform: 'capitalize',
          }}>
            {fmtFechaLarga(fecha)}
          </div>
        </Card>
      )}

      <Button variant="primary" onClick={onContinuar} disabled={!fecha}>
        Continuar
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Paso 2 — Horario
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PasoHorario
 * Grilla de slots disponibles. Cada slot avanza directo al tocarlo.
 */
function PasoHorario({ fecha, slots, cargando, error, onReintentar, onElegir }) {
  if (cargando) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={44} width={88} radius={theme.radius} />
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
        body={`No hay turnos libres para el ${fmtFechaLarga(fecha)}. Probá con otra fecha.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {slots.map((slot) => (
        <ChipHora key={slot} hora={fmtHora(slot)} onClick={() => onElegir(slot)} />
      ))}
    </div>
  );
}

/**
 * ChipHora
 * Chip clickable con una hora. Hover con useState. Touch target ≥ 44px.
 */
function ChipHora({ hora, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 80,
        height: 44,
        padding: '0 16px',
        background: hover ? theme.accentSoft : theme.surface,
        border: `1px solid ${hover ? theme.accent : theme.hairline}`,
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
// Paso 3 — Datos del cliente + confirmación
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PasoDatos
 * Buscador de cliente existente + form de datos + resumen + confirmación.
 */
function PasoDatos({ reserva, actualizar, enviando, errorConfirm, onConfirmar }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  // Búsqueda con debounce de 300ms — evita una request por tecla.
  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const data = await buscarClientes(texto);
        setResultados(data);
      } catch (err) {
        console.error('[CrearTurno] Error buscando clientes:', err.message);
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  /**
   * elegirCliente
   * Autocompleta el form con un cliente existente y cierra el dropdown.
   */
  const elegirCliente = (cliente) => {
    actualizar({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
    });
    setBusqueda('');
    setResultados([]);
  };

  const nombreValido = reserva.nombre.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Buscador de cliente existente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar cliente existente…"
          ariaLabel="Buscar cliente existente"
        />
        {buscando && (
          <div style={{ fontSize: theme.sizeMicro + 1, color: theme.muted }}>
            Buscando…
          </div>
        )}
        {resultados.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 180,
            overflowY: 'auto',
          }}>
            {resultados.map((c) => (
              <Card key={c.id} onClick={() => elegirCliente(c)} padding={10}>
                <div style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                  fontWeight: theme.weightMedium,
                  color: theme.ink,
                }}>
                  {c.nombre}
                </div>
                {(c.telefono || c.email) && (
                  <div style={{
                    fontFamily: theme.body,
                    fontSize: theme.sizeMicro + 1,
                    color: theme.muted,
                    marginTop: 2,
                  }}>
                    {[c.telefono, c.email].filter(Boolean).join(' · ')}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form de datos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          label="Nombre del cliente *"
          value={reserva.nombre}
          onChange={(v) => actualizar({ nombre: v })}
          placeholder="Nombre y apellido"
        />
        <Field
          label="Teléfono (opcional)"
          type="tel"
          value={reserva.telefono}
          onChange={(v) => actualizar({ telefono: v })}
        />
        <Field
          label="Email (opcional)"
          type="email"
          value={reserva.email}
          onChange={(v) => actualizar({ email: v })}
        />
      </div>

      {/* Resumen del turno */}
      <Card padding={14}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
          marginBottom: 6,
        }}>
          Resumen
        </div>
        <SummaryRow label="Servicio" value={reserva.servicio?.nombre || '—'} />
        <SummaryRow label="Fecha"    value={reserva.fecha ? fmtFechaLarga(reserva.fecha) : '—'} />
        <SummaryRow label="Hora"     value={reserva.horario ? `${fmtHora(reserva.horario)} hs` : '—'} />
        <SummaryRow label="Cliente"  value={reserva.nombre.trim() || '—'} />
      </Card>

      {errorConfirm && (
        <div
          role="alert"
          style={{
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}`,
            borderRadius: theme.radius,
            padding: '10px 12px',
            color: theme.danger,
            fontSize: theme.sizeBody,
          }}
        >
          {errorConfirm}
        </div>
      )}

      <Button variant="primary" onClick={onConfirmar} disabled={enviando || !nombreValido}>
        {enviando ? 'Creando turno…' : 'Confirmar turno'}
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Pantalla de éxito
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PantallaExito
 * Confirmación visual del turno creado. No muestra el turno_id crudo —
 * muestra el resumen útil para el barbero.
 */
function PantallaExito({ reserva, onExito }) {
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
        El turno quedó agendado correctamente.
      </div>

      {/* Resumen del turno creado */}
      <Card padding={14} style={{ width: '100%', marginTop: 16, textAlign: 'left' }}>
        <SummaryRow label="Servicio" value={reserva.servicio?.nombre || '—'} />
        <SummaryRow label="Fecha"    value={reserva.fecha ? fmtFechaLarga(reserva.fecha) : '—'} />
        <SummaryRow label="Hora"     value={reserva.horario ? `${fmtHora(reserva.horario)} hs` : '—'} />
        <SummaryRow label="Cliente"  value={reserva.nombre.trim() || '—'} />
      </Card>

      <div style={{ width: '100%', marginTop: 16 }}>
        <Button variant="primary" onClick={onExito}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
