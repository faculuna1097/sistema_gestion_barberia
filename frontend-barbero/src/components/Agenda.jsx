// /frontend-barbero/src/components/Agenda.jsx
// Vista de agenda tipo calendario mobile: timeline vertical con franjas horarias
// y bloques de turno posicionados por hora. Navegable por día.
// Al tocar un bloque se abre el detalle del turno; las acciones pasan por ConfirmDialog.
//
// Props:
//   barbero — { id, nombre }

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { getTurnos, patchEstadoTurno, cancelarTurno } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtHora, fmtFechaLarga } from '../utils/fecha.js';

import {
  ScreenHeader,
  Skeleton,
  Button,
  ConfirmDialog,
  StatusPill,
} from './ui';

// ─── Constantes del timeline ────────────────────────────────────────────────
const PX_POR_HORA = 80;           // alto en px de cada franja horaria
const HORA_INICIO = 7;            // primera hora visible (deuda: debería ser por tenant)
const HORA_FIN    = 22;           // última hora visible
const ALTO_TOTAL  = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
const OFFSET_IZQ   = 56;          // ancho reservado para las labels de hora

// Mapa estado → tokens del sistema. La barra lateral usa el color fuerte;
// el fondo del bloque, su variante soft.
const ESTILO_ESTADO = {
  reservado:  { fuerte: theme.accent,  soft: theme.accentSoft  },
  completado: { fuerte: theme.success, soft: theme.successSoft },
  no_asistio: { fuerte: theme.warning, soft: theme.warningSoft },
};

// Config del ConfirmDialog por acción (mismo patrón que Dashboard).
const ACCIONES = {
  completar: {
    title: 'Marcar como completado',
    message: '¿Confirmás que ya atendiste este turno?',
    confirmLabel: 'Sí, completar',
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * fechaHoyISO
 * @returns {string} 'YYYY-MM-DD' de hoy en zona local.
 */
function fechaHoyISO() {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
}

/**
 * sumarDias
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {number} dias
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * minutosDelDia
 * Minutos transcurridos desde medianoche para un timestamp ISO.
 * @param {string} iso
 * @returns {number}
 */
function minutosDelDia(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * topDesdeMinutos
 * Convierte minutos-del-día a coordenada `top` dentro del timeline.
 * @param {number} minutos
 * @returns {number} px
 */
function topDesdeMinutos(minutos) {
  return (minutos / 60 - HORA_INICIO) * PX_POR_HORA;
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agenda
 * Orquesta la carga de turnos del día y los modales de detalle/confirmación.
 * No recibe props: el turno se filtra por el JWT del barbero en el backend.
 */
export default function Agenda() {
  const [fecha, setFecha] = useState(fechaHoyISO());
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [detalle, setDetalle] = useState(null);                       // turno expandido
  const [confirma, setConfirma] = useState({ open: false, accion: null, turno: null });
  const [procesando, setProcesando] = useState(false);

  const refAhora = useRef(null);  // para auto-scroll al indicador de "ahora"

  const esHoy = fecha === fechaHoyISO();

  /**
   * cargarTurnos
   * Trae los turnos del día seleccionado.
   */
  const cargarTurnos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await getTurnos({ fecha });
      setTurnos(data);
      console.log('[Agenda] cargarTurnos — completado |', fecha, '|', data.length);
    } catch (err) {
      console.error('[Agenda] Error cargando turnos:', err.message);
      setErrorCarga('No se pudieron cargar los turnos.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargarTurnos();
    setDetalle(null);
  }, [cargarTurnos]);

  // Auto-scroll al indicador de "ahora" cuando se ve el día de hoy.
  useEffect(() => {
    if (!cargando && esHoy && refAhora.current) {
      refAhora.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [cargando, esHoy]);

  /**
   * pedirConfirmacion
   * Cierra el detalle y abre el ConfirmDialog (evita modal anidado).
   */
  const pedirConfirmacion = (turno, accion) => {
    setDetalle(null);
    setConfirma({ open: true, accion, turno });
  };

  /**
   * ejecutarAccion
   * Despacha la acción confirmada al endpoint correspondiente.
   */
  const ejecutarAccion = async () => {
    const { accion, turno } = confirma;
    setProcesando(true);
    try {
      if (accion === 'cancelar') {
        await cancelarTurno(turno.id);
      } else {
        const nuevoEstado = accion === 'completar' ? 'completado' : 'no_asistio';
        await patchEstadoTurno(turno.id, nuevoEstado);
      }
      console.log('[Agenda] ejecutarAccion — OK |', turno.id, '→', accion);
      setConfirma({ open: false, accion: null, turno: null });
      await cargarTurnos();
    } catch (err) {
      console.error('[Agenda] Error en ejecutarAccion:', err.message);
      setConfirma({ open: false, accion: null, turno: null });
      setErrorCarga(`Error: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  // Turnos visibles en el timeline (los cancelados no se dibujan).
  const turnosVisibles = turnos.filter((t) => t.estado !== 'cancelado');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '16px 16px 24px',
    }}>
      <ScreenHeader eyebrow="Agenda" title="Mi agenda" />

      <NavegadorDia
        fecha={fecha}
        esHoy={esHoy}
        onAnterior={() => setFecha(sumarDias(fecha, -1))}
        onSiguiente={() => setFecha(sumarDias(fecha, 1))}
        onHoy={() => setFecha(fechaHoyISO())}
      />

      {cargando && <Skeleton height={ALTO_TOTAL} radius={theme.radius} />}

      {!cargando && errorCarga && (
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
          {errorCarga}
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" full={false} onClick={cargarTurnos}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {!cargando && !errorCarga && (
        <Timeline
          turnos={turnosVisibles}
          esHoy={esHoy}
          refAhora={refAhora}
          onTocarTurno={setDetalle}
        />
      )}

      {/* Modal de detalle del turno */}
      <DetalleTurnoModal
        turno={detalle}
        onCerrar={() => setDetalle(null)}
        onAccion={pedirConfirmacion}
      />

      {/* Modal de confirmación de acción */}
      <ConfirmDialog
        open={confirma.open}
        title={ACCIONES[confirma.accion]?.title || ''}
        message={ACCIONES[confirma.accion]?.message || ''}
        confirmLabel={ACCIONES[confirma.accion]?.confirmLabel || 'Confirmar'}
        confirmVariant={ACCIONES[confirma.accion]?.confirmVariant || 'primary'}
        loading={procesando}
        onConfirm={ejecutarAccion}
        onCancel={() => setConfirma({ open: false, accion: null, turno: null })}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NavegadorDia — navegación de fecha (sub-componente local)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * NavegadorDia
 * Flechas ← / → para moverse de a un día + label de fecha (siempre texto plano).
 * Cuando el día visible no es hoy, debajo aparece un botón "Volver a hoy".
 * @param {string} props.fecha
 * @param {boolean} props.esHoy
 * @param {() => void} props.onAnterior
 * @param {() => void} props.onSiguiente
 * @param {() => void} props.onHoy
 */
function NavegadorDia({ fecha, esHoy, onAnterior, onSiguiente, onHoy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: 4,
      }}>
        <FlechaDia onClick={onAnterior} aria="Día anterior">
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>

        <div style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          textTransform: 'capitalize',
        }}>
          {fmtFechaLarga(fecha)}
        </div>

        <FlechaDia onClick={onSiguiente} aria="Día siguiente">
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>
      </div>

      {/* Botón de retorno — sólo visible cuando el día mostrado no es hoy */}
      {!esHoy && (
        <button
          type="button"
          onClick={onHoy}
          style={{
            alignSelf: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.accent,
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            fontWeight: theme.weightMedium,
            padding: '2px 8px',
            borderRadius: theme.radiusSm,
          }}
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}

/**
 * FlechaDia
 * Botón cuadrado 36×36 para las flechas. Hover con useState.
 */
function FlechaDia({ children, onClick, aria }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={aria}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: 'pointer',
        color: theme.inkSoft,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Timeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timeline
 * Dibuja las franjas horarias, el indicador de "ahora" y los bloques de turno.
 * @param {Array} props.turnos - Turnos NO cancelados.
 * @param {boolean} props.esHoy
 * @param {React.RefObject} props.refAhora - Ref que se ancla al indicador de ahora.
 * @param {(turno) => void} props.onTocarTurno
 */
function Timeline({ turnos, esHoy, refAhora, onTocarTurno }) {
  // Horas a renderizar (inclusive).
  const horas = [];
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) horas.push(h);

  // Posición del indicador de "ahora".
  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const topAhora = topDesdeMinutos(minutosAhora);
  const mostrarAhora = esHoy && topAhora >= 0 && topAhora <= ALTO_TOTAL;

  return (
    <div style={{
      position: 'relative',
      height: ALTO_TOTAL,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
    }}>
      {/* Franjas horarias */}
      {horas.map((h) => {
        const top = (h - HORA_INICIO) * PX_POR_HORA;
        return (
          <div key={h} style={{ position: 'absolute', top, left: 0, right: 0 }}>
            <span style={{
              position: 'absolute',
              left: 8,
              top: -7,
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              color: theme.mutedSoft,
            }}>
              {String(h).padStart(2, '0')}:00
            </span>
            <div style={{
              position: 'absolute',
              left: OFFSET_IZQ,
              right: 0,
              top: 0,
              borderTop: `1px solid ${theme.hairlineSoft}`,
            }} />
          </div>
        );
      })}

      {/* Indicador de "ahora" */}
      {mostrarAhora && (
        <div
          ref={refAhora}
          style={{
            position: 'absolute',
            top: topAhora,
            left: OFFSET_IZQ,
            right: 0,
            borderTop: `2px solid ${theme.danger}`,
            zIndex: 3,
          }}
        >
          <div style={{
            position: 'absolute',
            left: -5,
            top: -5,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: theme.danger,
          }} />
        </div>
      )}

      {/* Bloques de turno */}
      {turnos.map((turno) => (
        <BloqueTurno key={turno.id} turno={turno} onClick={() => onTocarTurno(turno)} />
      ))}

      {/* Estado vacío — texto sutil centrado */}
      {turnos.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: OFFSET_IZQ,
          right: 0,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.mutedSoft,
        }}>
          Sin turnos este día
        </div>
      )}
    </div>
  );
}

/**
 * BloqueTurno
 * Bloque clickable posicionado por hora. Fondo soft + barra lateral de color.
 * @param {Object} props.turno
 * @param {() => void} props.onClick
 */
function BloqueTurno({ turno, onClick }) {
  const [hover, setHover] = useState(false);

  const minInicio = minutosDelDia(turno.inicio);
  const minFin = minutosDelDia(turno.fin);
  const top = topDesdeMinutos(minInicio);
  const alto = Math.max(((minFin - minInicio) / 60) * PX_POR_HORA, 28);

  const estilo = ESTILO_ESTADO[turno.estado] || ESTILO_ESTADO.reservado;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top,
        left: OFFSET_IZQ + 4,
        right: 4,
        height: alto,
        background: estilo.soft,
        borderLeft: `3px solid ${estilo.fuerte}`,
        borderRadius: theme.radiusSm,
        padding: '4px 8px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 1,
        boxShadow: hover ? theme.shadowSm : 'none',
        transition: `box-shadow ${theme.transitionFast}`,
      }}
    >
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeMicro + 1,
        fontWeight: theme.weightMedium,
        color: estilo.fuerte,
        whiteSpace: 'nowrap',
      }}>
        {fmtHora(turno.inicio)}
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeMicro + 1,
        color: theme.inkSoft,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {turno.cliente_nombre || 'Sin nombre'}
        {turno.servicio_nombre && ` · ${turno.servicio_nombre}`}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DetalleTurnoModal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DetalleTurnoModal
 * Overlay con los datos del turno y, si está reservado, las acciones.
 * No se renderiza si turno es null.
 * @param {Object|null} props.turno
 * @param {() => void} props.onCerrar
 * @param {(turno, accion) => void} props.onAccion
 */
function DetalleTurnoModal({ turno, onCerrar, onAccion }) {
  // Cerrar con Escape.
  useEffect(() => {
    if (!turno) return;
    const handler = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [turno, onCerrar]);

  if (!turno) return null;

  const esReservado = turno.estado === 'reservado';
  // Un turno que aún no empezó sólo puede cancelarse: completarlo o marcarlo
  // como "no vino" no tiene sentido hasta que el turno haya transcurrido.
  const esFuturo = new Date(turno.inicio) > new Date();

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Detalle del turno"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 20,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
        }}
      >
        {/* Encabezado: hora + cerrar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeTitle,
              letterSpacing: '-0.02em',
              color: theme.ink,
              lineHeight: 1.1,
            }}>
              {fmtHora(turno.inicio)} – {fmtHora(turno.fin)}
            </div>
            <div style={{ marginTop: 6 }}>
              <StatusPill estado={turno.estado} />
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              color: theme.muted,
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Datos del turno */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DatoTurno label="Cliente" valor={turno.cliente_nombre || 'Sin nombre'} />
          {turno.servicio_nombre && <DatoTurno label="Servicio" valor={turno.servicio_nombre} />}
          {turno.cliente_telefono && (
            <DatoTurno
              label="Teléfono"
              valor={<a href={`tel:${turno.cliente_telefono}`} style={{ color: theme.accent }}>{turno.cliente_telefono}</a>}
            />
          )}
          {turno.cliente_email && (
            <DatoTurno
              label="Email"
              valor={<a href={`mailto:${turno.cliente_email}`} style={{ color: theme.accent }}>{turno.cliente_email}</a>}
            />
          )}
        </div>

        {/* Acciones — sólo si está reservado. Turnos futuros: sólo cancelar. */}
        {esReservado && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: esFuturo ? '1fr' : '1fr 1fr 1fr',
            gap: 8,
            marginTop: 20,
          }}>
            {!esFuturo && (
              <Button variant="primary" onClick={() => onAccion(turno, 'completar')}>Completé</Button>
            )}
            {!esFuturo && (
              <Button variant="secondary" onClick={() => onAccion(turno, 'no_asistio')}>No vino</Button>
            )}
            <Button variant="danger" onClick={() => onAccion(turno, 'cancelar')}>Cancelar</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DatoTurno
 * Fila label / valor dentro del modal de detalle.
 * @param {string} props.label
 * @param {string|ReactNode} props.valor
 */
function DatoTurno({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontFamily: theme.mono,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.ink,
        textAlign: 'right',
        wordBreak: 'break-word',
      }}>{valor}</span>
    </div>
  );
}
