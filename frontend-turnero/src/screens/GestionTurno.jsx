// /frontend-turnero/src/screens/GestionTurno.jsx
// Pantalla 8: gestión del turno desde link del mail.
// Carga el turno por token y permite: ver, cancelar (con confirm dialog) o reprogramar.

import { useState, useEffect } from 'react';
import {
  getTurnoPorToken, cancelarTurno, reprogramarTurno, getDisponibilidad,
  getDiasDisponibles,
} from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fmtFechaLarga, fmtHora, fmtFechaHora, generarProximosDias } from '../utils/fecha.js';
import {
  PageContainer, ScreenHeader, Button, EmptyState, Skeleton,
  StatusPill, SummaryRow, AvatarIniciales, ConfirmDialog,
  MiniCalendario, SlotChip, IconoAlerta,
} from '../components/ui';

// Días hacia adelante que se muestran en el sub-flow de reprogramación.
const DIAS_REPROG = 14;

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

  // ── Estado del sub-flow de reprogramación ───────────────────
  const [reprogramando, setReprogramando] = useState(false);
  const [fechaReprog, setFechaReprog] = useState(null);
  const [slotsReprog, setSlotsReprog] = useState([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [slotElegido, setSlotElegido] = useState(null); // ISO del slot pre-seleccionado (aún sin confirmar)

  // ── Estado de los días disponibles del calendario de reprogramación ──
  const [diasReprog, setDiasReprog] = useState([]);
  const [cargandoDiasReprog, setCargandoDiasReprog] = useState(false);
  const [errorDiasReprog, setErrorDiasReprog] = useState(false);

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
   * abrirReprogramacion
   * Abre el sub-flow de reprogramación y carga los días con disponibilidad
   * para el barbero y servicio del turno (para grisar el calendario).
   */
  const abrirReprogramacion = async () => {
    setReprogramando(true);
    setCargandoDiasReprog(true);
    setErrorDiasReprog(false);
    const dias = generarProximosDias(DIAS_REPROG);
    try {
      const { dias: disponibles } = await getDiasDisponibles(
        datos.barbero.id, datos.servicio.id, dias[0], dias[dias.length - 1],
      );
      setDiasReprog(disponibles);
    } catch (err) {
      console.error('[GestionTurno] Error cargando días disponibles:', err.message);
      setErrorDiasReprog(true);
    } finally {
      setCargandoDiasReprog(false);
    }
  };

  /**
   * handleSeleccionarFechaReprog
   * Carga los slots disponibles para la nueva fecha elegida.
   * @param {string} fecha - YYYY-MM-DD
   */
  const handleSeleccionarFechaReprog = async (fecha) => {
    setFechaReprog(fecha);
    setSlotElegido(null); // al cambiar de fecha, se descarta el slot pre-elegido
    setCargandoSlots(true);
    setSlotsReprog([]);
    try {
      const data = await getDisponibilidad(datos.barbero.id, datos.servicio.id, fecha);
      setSlotsReprog(data.slots);
    } catch (err) {
      console.error('[GestionTurno] Error cargando slots:', err.message);
      setSlotsReprog([]);
    } finally {
      setCargandoSlots(false);
    }
  };

  /**
   * handleConfirmarReprogramacion
   * Confirma la reprogramación al slot pre-elegido. Solo se llama desde el botón de confirmar.
   */
  const handleConfirmarReprogramacion = async () => {
    if (!slotElegido) return;
    setProcesando(true);
    try {
      const res = await reprogramarTurno(token, slotElegido);
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
   * Cancela el sub-flow de reprogramación sin guardar nada.
   */
  const cerrarReprogramacion = () => {
    setReprogramando(false);
    setFechaReprog(null);
    setSlotsReprog([]);
    setSlotElegido(null);
  };

  /**
   * irAHome
   * Navega al inicio del turnero (limpia la URL del token).
   */
  const irAHome = () => {
    window.location.href = '/';
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

  return (
    <PageContainer>
      <ScreenHeader
        eyebrow="Tu turno"
        title={tenant?.nombre || 'Gestioná tu reserva'}
        subtitle="Revisá los datos, reprogramá o cancelá tu reserva."
      />

      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        {/* Banner de mensaje (post-acción) */}
        {mensaje && <BannerMensaje kind={mensaje.kind} text={mensaje.text}/>}

        {/* ── Card principal con el turno ─────────────────── */}
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 16,
        }}>
          {/* Eyebrow: status pill + #id */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <StatusPill estado={turno.estado}/>
            <div style={{
              fontFamily: theme.mono,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeMicro,
              letterSpacing: '0.04em',
              color: theme.mutedSoft,
            }}>#{turno.id}</div>
          </div>

          {/* Fecha + hora grande */}
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
          }}>{fmtFechaLarga(turno.inicio.slice(0, 10))}</div>

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
                fontSize: 13,
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

        {/* ── Datos del cliente ────────────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <SummaryRow label="A nombre de" value={cliente.nombre}/>
          <SummaryRow label="Email"       value={cliente.email}/>
          <SummaryRow label="Teléfono"    value={cliente.telefono}/>
        </div>

        {/* ── Acciones (si está reservado y no en reprog) ── */}
        {esReservado && !reprogramando && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={abrirReprogramacion} disabled={procesando}>
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
            fechaReprog={fechaReprog}
            slotsReprog={slotsReprog}
            cargandoSlots={cargandoSlots}
            diasDisponibles={diasReprog}
            cargandoDias={cargandoDiasReprog}
            errorDias={errorDiasReprog}
            procesando={procesando}
            slotElegido={slotElegido}
            onSeleccionarFecha={handleSeleccionarFechaReprog}
            onSeleccionarSlot={setSlotElegido}
            onConfirmar={handleConfirmarReprogramacion}
            onCerrar={cerrarReprogramacion}
            onReintentarDias={abrirReprogramacion}
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
 * Panel inline que aparece al apretar "Reprogramar".
 * Flujo: elegir fecha → elegir slot (pre-selección) → confirmar reprogramación.
 */
function ReprogramarPanel({
  fechaReprog,
  slotsReprog,
  cargandoSlots,
  diasDisponibles,
  cargandoDias,
  errorDias,
  procesando,
  slotElegido,
  onSeleccionarFecha,
  onSeleccionarSlot,
  onConfirmar,
  onCerrar,
  onReintentarDias,
}) {
  const dias = generarProximosDias(DIAS_REPROG);

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

      {errorDias ? (
        <EmptyState
          glyph={<IconoAlerta/>}
          title="No pudimos cargar las fechas"
          body="Revisá tu conexión e intentá de nuevo."
          action={
            <Button variant="secondary" onClick={onReintentarDias} full={false}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <MiniCalendario
          dias={dias}
          diasDisponibles={diasDisponibles}
          cargando={cargandoDias}
          seleccionada={fechaReprog}
          onSeleccionar={onSeleccionarFecha}
        />
      )}

      {/* Slots de la fecha elegida */}
      {fechaReprog && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
            marginBottom: 8,
          }}>Nuevo horario</div>

          {cargandoSlots ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <Skeleton key={i} height={48}/>
              ))}
            </div>
          ) : slotsReprog.length === 0 ? (
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
              textAlign: 'center',
              padding: '16px 0',
            }}>
              Sin disponibilidad para esa fecha.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}>
              {slotsReprog.map(iso => (
                <SlotChip
                  key={iso}
                  iso={iso}
                  selected={iso === slotElegido}
                  onClick={() => !procesando && onSeleccionarSlot(iso)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer del panel — confirmar (sólo aparece cuando hay slot pre-elegido) */}
      {slotElegido && (
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
          }}>{fmtFechaHora(slotElegido)}</div>

          <Button onClick={onConfirmar} disabled={procesando}>
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
      fontSize: 13,
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
