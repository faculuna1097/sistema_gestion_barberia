// /frontend-turnero/src/screens/GestionTurno.jsx
// Gestión del turno desde el link del mail (fuera del flujo de reserva).
// Carga el turno por token y permite: ver, agregarlo al calendario, cancelar
// (con confirm dialog) o reprogramar.

import { useState, useEffect } from 'react';
import { getTurnoPorToken, cancelarTurno, reprogramarTurno } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import {
  fmtFechaLarga, fmtHora, fmtFechaHora, fechaDeISO, DIAS_RESERVABLES,
} from '../utils/fecha.js';
import { RUTA_TURNERO, urlGestion } from '../utils/rutas.js';
import { eventoDeTurno } from '../utils/calendario.js';
import { useDisponibilidad } from '../hooks/useDisponibilidad.js';
import {
  PageContainer, ScreenHeader, Button, EmptyState, Skeleton,
  StatusPill, SummaryRow, AvatarIniciales, ConfirmDialog,
  SelectorDiaHorario, IconoAlerta, AgregarAlCalendario,
} from '../components/ui';

/**
 * GestionTurno
 * Pantalla autónoma que se monta cuando la URL es /turnos/gestionar/:token.
 * @param {string} props.token - Token de gestión del turno
 * @param {Object} props.tenant - Datos del tenant (para mostrar contexto)
 */
function GestionTurno({ token, tenant }) {
  // ── Estado de carga inicial ─────────────────────────────────
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // ── Estado de acciones (cancelar / reprogramar) ─────────────
  const [mensaje, setMensaje] = useState(null);     // { kind: 'ok'|'err', text }
  const [procesando, setProcesando] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ── Sub-flow de reprogramación (los días y horarios los maneja el panel) ──
  const [reprogramando, setReprogramando] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getTurnoPorToken(token);
        setDatos(data);
      } catch (err) {
        console.error('[GestionTurno] Error:', err.message);
        setErrorCarga('No pudimos cargar tu turno. El link puede estar vencido o ser inválido.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [token]);

  /**
   * handleCancelar
   * Cancela el turno. Disparado desde el ConfirmDialog.
   */
  const handleCancelar = async () => {
    setProcesando(true);
    try {
      await cancelarTurno(token);
      setDatos(prev => ({ ...prev, turno: { ...prev.turno, estado: 'cancelado' } }));
      setMensaje({ kind: 'ok', text: 'Turno cancelado. Te llegará un email de confirmación.' });
    } catch (err) {
      console.error('[GestionTurno] Error cancelando:', err.message);
      setMensaje({ kind: 'err', text: err.message });
    } finally {
      setProcesando(false);
      setConfirmCancel(false);
    }
  };

  /**
   * handleConfirmarReprogramacion
   * Reprograma el turno al horario elegido en el panel. Solo se llama desde
   * su botón de confirmar.
   * @param {string} inicio - ISO del horario nuevo
   */
  const handleConfirmarReprogramacion = async (inicio) => {
    setProcesando(true);
    try {
      const res = await reprogramarTurno(token, inicio);
      setDatos(prev => ({
        ...prev,
        turno: { ...prev.turno, inicio: res.turno.inicio, fin: res.turno.fin },
      }));
      cerrarReprogramacion();
      setMensaje({ kind: 'ok', text: 'Turno reprogramado correctamente.' });
    } catch (err) {
      console.error('[GestionTurno] Error reprogramando:', err.message);
      setMensaje({ kind: 'err', text: err.message });
    } finally {
      setProcesando(false);
    }
  };

  /**
   * cerrarReprogramacion
   * Cierra el sub-flow de reprogramación sin guardar nada. El panel se
   * desmonta y con él lo que se había elegido.
   */
  const cerrarReprogramacion = () => {
    setReprogramando(false);
  };

  /**
   * irAHome
   * Navega al inicio del turnero (limpia la URL del token). Usa RUTA_TURNERO
   * (`/turnos/`): en producción `/` es el panel de gestión, no el turnero.
   */
  const irAHome = () => {
    window.location.href = RUTA_TURNERO;
  };

  // ── Render: loading ───────────────────────────────────────
  if (cargando) {
    return (
      <PageContainer>
        <ScreenHeader
          eyebrow="Tu turno"
          title={tenant?.nombre || 'Cargando…'}
          subtitle="Gestioná tu reserva."
        />
        <div style={{ flex: 1, padding: '0 16px 24px' }}>
          <SkeletonGestion/>
        </div>
      </PageContainer>
    );
  }

  // ── Render: error de carga ────────────────────────────────
  if (errorCarga) {
    return (
      <PageContainer>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            glyph={<IconoAlerta/>}
            title="No encontramos tu turno"
            body={errorCarga}
            action={<Button variant="secondary" onClick={irAHome} full={false}>Ir al inicio</Button>}
          />
        </div>
      </PageContainer>
    );
  }

  // ── Render normal ─────────────────────────────────────────
  const { turno, barbero, servicio, cliente } = datos;
  const esReservado = turno.estado === 'reservado';

  // Evento para "Agregar al calendario": el mismo contenido que en el éxito de
  // la reserva y el mismo UID (turno.id), así agregarlo de nuevo después de
  // reprogramar actualiza el evento en vez de duplicarlo.
  const evento = eventoDeTurno({
    turnoId: turno.id,
    servicio: servicio.nombre,
    local: tenant?.nombre,
    barbero: barbero.nombre,
    direccion: tenant?.direccion,
    inicio: turno.inicio,
    fin: turno.fin,
    urlGestion: urlGestion(token),
  });

  return (
    <PageContainer>
      <ScreenHeader
        eyebrow="Tu turno"
        title={tenant?.nombre || 'Gestioná tu reserva'}
        subtitle="Revisá los datos, reprogramá o cancelá tu reserva."
      />

      {/* tt-aparecer: el contenido reemplaza al skeleton con un fundido corto */}
      <div className="tt-aparecer" style={{ flex: 1, padding: '0 16px 24px' }}>
        {/* Banner de mensaje (post-acción) */}
        {mensaje && <BannerMensaje kind={mensaje.kind} text={mensaje.text}/>}

        {/* ── Card principal con el turno ─────────────────── */}
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 16,
        }}>
          {/* Eyebrow: status pill */}
          <div style={{ marginBottom: 12 }}>
            <StatusPill estado={turno.estado}/>
          </div>

          {/* Fecha + hora grande */}
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
          }}>{fmtFechaLarga(fechaDeISO(turno.inicio))}</div>

          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: 28,
            color: theme.ink,
            letterSpacing: '-0.02em',
            marginTop: 4,
          }}>
            {fmtHora(turno.inicio)}
            <span style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightRegular,
              color: theme.muted,
              marginLeft: 4,
            }}>hs</span>
          </div>

          {/* Divider + barbero + servicio + precio */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${theme.hairlineSoft}`,
          }}>
            <AvatarIniciales nombre={barbero.nombre} size={36}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: theme.body,
                fontWeight: theme.weightMedium,
                fontSize: theme.sizeBody,
                color: theme.ink,
              }}>{barbero.nombre}</div>
              <div style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: theme.muted,
                marginTop: 1,
              }}>
                {servicio.nombre} · {servicio.duracion_minutos} min
              </div>
            </div>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeBody,
              color: theme.ink,
              whiteSpace: 'nowrap',
            }}>{fmtPesos(servicio.precio)}</div>
          </div>
        </div>

        {/* ── Agregar al calendario (solo si el turno sigue en pie) ── */}
        {esReservado && !reprogramando && (
          <div style={{ marginTop: 12 }}>
            <AgregarAlCalendario evento={evento} variant="secondary"/>
          </div>
        )}

        {/* ── Datos del cliente ────────────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <SummaryRow label="A nombre de" value={cliente.nombre}/>
        </div>

        {/* ── Acciones (si está reservado y no en reprog) ── */}
        {esReservado && !reprogramando && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setReprogramando(true)} disabled={procesando}>
              Reprogramar
            </Button>
            <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={procesando}>
              Cancelar turno
            </Button>
          </div>
        )}

        {/* ── Sub-flow de reprogramación ───────────────────── */}
        {reprogramando && (
          <ReprogramarPanel
            barbero={barbero}
            servicio={servicio}
            procesando={procesando}
            onConfirmar={handleConfirmarReprogramacion}
            onCerrar={cerrarReprogramacion}
          />
        )}

        {/* ── Link discreto para volver al inicio ─────────── */}
        {!reprogramando && (
          <div style={{
            marginTop: 32,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <Button variant="ghost" onClick={irAHome} full={false}>
              Reservar otro turno
            </Button>
          </div>
        )}
      </div>

      {/* ── Diálogo de confirmación para cancelar ──────────── */}
      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar este turno?"
        message="Se libera el horario para otro cliente. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        confirmVariant="danger"
        loading={procesando}
        onConfirm={handleCancelar}
        onCancel={() => setConfirmCancel(false)}
      />
    </PageContainer>
  );
}

// ═════════════════════════════════════════════════════════════
//  Sub-flow de reprogramación
// ═════════════════════════════════════════════════════════════

/**
 * ReprogramarPanel
 * Panel inline que aparece al apretar "Reprogramar": días y horarios libres
 * del mismo barbero y servicio (los próximos DIAS_RESERVABLES días), con el
 * primer día con lugar elegido al abrir. Tocar un horario lo pre-elige; recién
 * el botón de confirmar reprograma.
 * Monta su propia carga (useDisponibilidad): se pide al abrir el panel y se
 * descarta al cerrarlo.
 * @param {Object} props.barbero - Barbero del turno ({ id, nombre }), fijo
 * @param {Object} props.servicio - Servicio del turno ({ id, ... })
 * @param {boolean} props.procesando - True mientras se manda la reprogramación
 * @param {Function} props.onConfirmar - Recibe el ISO del horario elegido
 * @param {Function} props.onCerrar - Cierra el panel sin reprogramar
 */
function ReprogramarPanel({ barbero, servicio, procesando, onConfirmar, onCerrar }) {
  const agenda = useDisponibilidad({ servicioId: servicio.id, barberoId: barbero.id });

  // Horario pre-elegido (sin confirmar). Vale solo si está entre los horarios
  // del día que se ve: al cambiar de día, deja de estar marcado.
  const [slotElegido, setSlotElegido] = useState(null);
  const slotVigente = agenda.horarios.includes(slotElegido) ? slotElegido : null;

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
      }}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
          letterSpacing: '-0.01em',
        }}>Nueva fecha</div>
        <Button variant="ghost" onClick={onCerrar} full={false} disabled={procesando}>
          Cancelar
        </Button>
      </div>

      <SelectorDiaHorario
        dias={agenda.dias}
        diasDisponibles={agenda.diasDisponibles}
        estadoDias={agenda.estadoDias}
        onReintentarDias={agenda.reintentarDias}
        fecha={agenda.fecha}
        onElegirFecha={agenda.elegirFecha}
        horarios={agenda.horarios}
        estadoHorarios={agenda.estadoHorarios}
        onReintentarHorarios={agenda.reintentarHorarios}
        horario={slotVigente}
        onElegirHorario={(iso) => { if (!procesando) setSlotElegido(iso); }}
        textoSinDias={`${barbero.nombre} no tiene turnos libres en los próximos ${DIAS_RESERVABLES} días.`}
      />

      {/* Footer del panel — confirmar (sólo aparece cuando hay slot pre-elegido) */}
      {slotVigente && (
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: `1px solid ${theme.hairlineSoft}`,
        }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
            marginBottom: 4,
          }}>Reprogramar a</div>

          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeBody,
            color: theme.ink,
            marginBottom: 12,
          }}>{fmtFechaHora(slotVigente)}</div>

          <Button onClick={() => onConfirmar(slotVigente)} disabled={procesando}>
            {procesando ? 'Confirmando…' : 'Confirmar reprogramación'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * BannerMensaje
 * Banner verde (ok) o rojo (err) que aparece después de una acción.
 * @param {'ok'|'err'} props.kind
 * @param {string} props.text
 */
function BannerMensaje({ kind, text }) {
  const esOk = kind === 'ok';
  return (
    <div style={{
      background: esOk ? theme.successSoft : theme.dangerSoft,
      border: `1px solid ${(esOk ? theme.success : theme.danger)}33`,
      borderRadius: theme.radius,
      padding: '10px 12px',
      marginBottom: 12,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      color: esOk ? theme.success : theme.danger,
      lineHeight: 1.4,
    }}>{text}</div>
  );
}

/**
 * SkeletonGestion
 * Placeholder visual mientras carga el turno por token.
 */
function SkeletonGestion() {
  return (
    <div>
      {/* Card principal skeleton */}
      <div style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        padding: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton height={20} width={80} radius={999}/>
          <Skeleton height={12} width={50}/>
        </div>
        <Skeleton height={10} width={140} style={{ marginBottom: 8 }}/>
        <Skeleton height={28} width={120} style={{ marginBottom: 16 }}/>
        <div style={{ borderTop: `1px solid ${theme.hairlineSoft}`, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton height={36} width={36} radius={999}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton height={14} width="50%"/>
            <Skeleton height={11} width="70%"/>
          </div>
          <Skeleton height={14} width={60}/>
        </div>
      </div>

      {/* Summary rows skeleton */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${theme.hairlineSoft}` }}>
            <Skeleton height={10} width={80}/>
            <Skeleton height={12} width={140}/>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GestionTurno;
