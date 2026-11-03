// /frontend-turnero/src/screens/GestionTurno.jsx
// Gestión del turno desde el link del mail (fuera del flujo de reserva).
// Carga el turno por token y permite: ver, agregarlo al calendario, cancelar
// (con confirm dialog) o reprogramar.

import { useState, useEffect, useRef } from 'react';
import { getTurnoPorToken, cancelarTurno, reprogramarTurno } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { estiloEyebrow } from '../components/ui/estilos.js';
import { fmtPesos } from '../utils/formato.js';
import { mensajeDeError } from '../utils/errores.js';
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
      setMensaje({ kind: 'err', text: mensajeDeError(err) });
    } finally {
      setProcesando(false);
      setConfirmCancel(false);
    }
  };

  /**
   * handleConfirmarReprogramacion
   * Reprograma el turno al horario elegido en el panel. Solo se llama desde
   * su botón de confirmar. Si sale bien, cierra el panel y avisa arriba. Si
   * falla, relanza el error: lo muestra el panel, junto a su botón, que es
   * donde está mirando el cliente.
   * @param {string} inicio - ISO del horario nuevo
   * @throws {Error} El error de reprogramarTurno (con `status` si llegó al backend)
   */
  const handleConfirmarReprogramacion = async (inicio) => {
    setProcesando(true);
    setMensaje(null);
    try {
      const res = await reprogramarTurno(token, inicio);
      setDatos(prev => ({
        ...prev,
        turno: { ...prev.turno, inicio: res.turno.inicio, fin: res.turno.fin },
      }));
      cerrarReprogramacion();
      setMensaje({ kind: 'ok', text: 'Turno reprogramado correctamente.' });
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
          <div style={estiloEyebrow}>{fmtFechaLarga(fechaDeISO(turno.inicio))}</div>

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
 * Si la reprogramación falla (ej. 409: el horario se ocupó), el aviso aparece
 * al pie del panel, donde estaba el botón, y se vuelven a pedir los días y
 * los horarios: el horario ocupado deja de ofrecerse y deja de estar marcado.
 * @param {Object} props.barbero - Barbero del turno ({ id, nombre }), fijo
 * @param {Object} props.servicio - Servicio del turno ({ id, ... })
 * @param {boolean} props.procesando - True mientras se manda la reprogramación
 * @param {Function} props.onConfirmar - Recibe el ISO del horario elegido; devuelve
 *   una promesa que se rechaza si la reprogramación falla
 * @param {Function} props.onCerrar - Cierra el panel sin reprogramar
 */
function ReprogramarPanel({ barbero, servicio, procesando, onConfirmar, onCerrar }) {
  const agenda = useDisponibilidad({ servicioId: servicio.id, barberoId: barbero.id });

  // Horario pre-elegido (sin confirmar). Vale solo si está entre los horarios
  // del día que se ve: al cambiar de día, deja de estar marcado.
  const [slotElegido, setSlotElegido] = useState(null);
  const slotVigente = agenda.horarios.includes(slotElegido) ? slotElegido : null;

  // Error de la última confirmación; se borra al elegir otro horario.
  const [error, setError] = useState(null);
  const errorRef = useRef(null);
  // True desde que falla la confirmación hasta que el aviso se trae a la vista.
  const errorPorMostrar = useRef(false);

  // El aviso nuevo, a la vista, recién cuando terminan de recargarse días y
  // horarios: el aviso va debajo de los horarios, y al reemplazar el skeleton
  // (dos renglones) por los horarios reales el panel crece y lo empuja hacia
  // abajo. Una sola vez por error: si después el cliente cambia de día, la
  // pantalla no salta al aviso.
  useEffect(() => {
    if (!error || !errorPorMostrar.current) return;
    if (agenda.estadoDias === 'cargando' || agenda.estadoHorarios === 'cargando') return;
    errorPorMostrar.current = false;
    errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error, agenda.estadoDias, agenda.estadoHorarios]);

  /**
   * confirmar
   * Manda la reprogramación. Si falla, muestra el aviso y recarga días y
   * horarios (los dos: si solo se recargaran los días, el día elegido
   * volvería a mostrar los horarios de antes).
   */
  const confirmar = async () => {
    setError(null);
    try {
      await onConfirmar(slotVigente);
    } catch (err) {
      console.error('[GestionTurno] Error reprogramando:', err.message);
      setError(mensajeDeError(err));
      errorPorMostrar.current = true;
      agenda.reintentarDias();
      agenda.reintentarHorarios();
    }
  };

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
        onElegirHorario={(iso) => {
          if (procesando) return;
          setSlotElegido(iso);
          setError(null);
        }}
        textoSinDias={`${barbero.nombre} no tiene turnos libres en los próximos ${DIAS_RESERVABLES} días.`}
      />

      {/* Error de la confirmación: al pie del panel, aunque el horario
          elegido ya no esté y el botón de confirmar desaparezca. */}
      {error && (
        <div ref={errorRef} style={{ marginTop: 20 }}>
          <BannerMensaje kind="err" text={error}/>
        </div>
      )}

      {/* Footer del panel — confirmar (sólo aparece cuando hay slot pre-elegido) */}
      {slotVigente && (
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: `1px solid ${theme.hairlineSoft}`,
        }}>
          <div style={{
            ...estiloEyebrow,
            marginBottom: 4,
          }}>Reprogramar a</div>

          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeBody,
            color: theme.ink,
            marginBottom: 12,
          }}>{fmtFechaHora(slotVigente)}</div>

          <Button onClick={confirmar} disabled={procesando}>
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
 * Banner verde (ok) o rojo (err) que aparece después de una acción. El lector
 * de pantalla lo anuncia al aparecer (`role`: alert el error, status el ok).
 * @param {'ok'|'err'} props.kind
 * @param {string} props.text
 */
function BannerMensaje({ kind, text }) {
  const esOk = kind === 'ok';
  return (
    <div role={esOk ? 'status' : 'alert'} style={{
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
 * ALTO_BOTON
 * Alto de un Button medido en pantalla (12 px de padding arriba y abajo, el
 * texto y el borde). Lo usa el skeleton para reservar el lugar de cada botón.
 */
const ALTO_BOTON = 46.6;

/**
 * RenglonSkeleton
 * Un renglón de texto en skeleton: una caja del alto del renglón real con la
 * barra centrada, así el skeleton mide lo mismo que el texto que reemplaza.
 * @param {number} props.alto - Alto del renglón real (tamaño de letra × 1,5)
 * @param {number} props.barra - Alto de la barra
 * @param {number|string} props.width - Ancho de la barra
 * @param {number} [props.radius] - Radio de la barra
 */
function RenglonSkeleton({ alto, barra, width, radius }) {
  return (
    <div style={{ height: alto, display: 'flex', alignItems: 'center' }}>
      <Skeleton height={barra} width={width} radius={radius}/>
    </div>
  );
}

/**
 * SkeletonGestion
 * Silueta mientras carga el turno por token, con los mismos bloques y las
 * mismas alturas que la pantalla de un turno reservado (card del turno,
 * "Agregar al calendario" con su segunda opción, "A nombre de", Reprogramar y
 * Cancelar, y "Reservar otro turno"): el contenido no salta al llegar.
 */
function SkeletonGestion() {
  return (
    <div aria-hidden="true">
      {/* Card del turno: pill de estado, fecha, hora y barbero + servicio */}
      <div style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        padding: 16,
      }}>
        {/* 23 px: lo que mide el renglón de la pill real (inline-flex en un bloque) */}
        <div style={{ height: 23, display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <Skeleton height={21} width={96} radius={999}/>
        </div>
        <RenglonSkeleton alto={16.5} barra={10} width={140}/>
        <div style={{ marginTop: 4 }}>
          <RenglonSkeleton alto={42} barra={28} width={110}/>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${theme.hairlineSoft}`,
        }}>
          <Skeleton height={36} width={36} radius={999}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <RenglonSkeleton alto={21} barra={14} width="45%"/>
            <RenglonSkeleton alto={21} barra={14} width="70%"/>
          </div>
          <Skeleton height={14} width={56}/>
        </div>
      </div>

      {/* "Agregar al calendario" y, debajo, la otra opción */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Skeleton height={ALTO_BOTON} radius={theme.radius}/>
        <RenglonSkeleton alto={ALTO_BOTON} barra={14} width={150}/>
      </div>

      {/* "A nombre de" */}
      <div style={{
        marginTop: 16,
        padding: '10px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.hairlineSoft}`,
      }}>
        <RenglonSkeleton alto={21} barra={10} width={80}/>
        <RenglonSkeleton alto={21} barra={14} width={120}/>
      </div>

      {/* Reprogramar y Cancelar turno */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Skeleton height={ALTO_BOTON} radius={theme.radius}/>
        <Skeleton height={ALTO_BOTON} radius={theme.radius}/>
      </div>

      {/* "Reservar otro turno" */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <RenglonSkeleton alto={ALTO_BOTON} barra={14} width={140}/>
      </div>
    </div>
  );
}

export default GestionTurno;
