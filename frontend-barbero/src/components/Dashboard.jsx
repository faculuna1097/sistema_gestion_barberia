// /frontend-barbero/src/components/Dashboard.jsx
// Pantalla principal post-login ("Hoy").
// Muestra:
//   - Header con fecha del día.
//   - Card destacada con el próximo turno (si existe).
//   - 3 KPIs: pendientes, completados, no asistieron (+ nota chica de cancelados).
//   - Botón primario "Nuevo turno".
//   - Lista de turnos del día con acciones (todas con ConfirmDialog).
//
// Props:
//   barbero       — { id, nombre }
//   onCrearTurno  — callback al wizard de crear turno
//   onVerAgenda   — callback a la agenda (se usa desde la card "próximo")

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, CalendarX } from 'lucide-react';

import { getTurnos, patchEstadoTurno, cancelarTurno } from '../services/api.js';
import { fmtHora, fmtFechaLarga } from '../utils/fecha.js';
import { theme } from '../theme/tokens.js';

import {
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  ConfirmDialog,
  KPI,
  TurnoListItem,
  AvatarIniciales,
} from './ui';

// ─── Helpers locales ────────────────────────────────────────────────────────

/**
 * fechaHoyISO
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local).
 * @returns {string}
 */
function fechaHoyISO() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes  = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia  = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Configuración del ConfirmDialog según la acción a ejecutar.
// Centralizar acá evita 3 if/else en el render.
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

// ─── Componente principal ───────────────────────────────────────────────────

/**
 * Dashboard
 * Pantalla "Hoy" — orquesta la carga de turnos, KPIs, próximo turno y acciones.
 */
export default function Dashboard({ barbero, onCrearTurno, onVerAgenda }) {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Banner inline para errores de acción (reemplaza alert() del MD §2).
  const [errorAccion, setErrorAccion] = useState(null);

  // Estado del modal de confirmación. accion ∈ ACCIONES, turno = objeto turno.
  const [confirma, setConfirma] = useState({ open: false, accion: null, turno: null });
  const [procesando, setProcesando] = useState(false);

  const hoy = fechaHoyISO();

  /**
   * cargarTurnos
   * Carga los turnos del día del barbero autenticado.
   */
  const cargarTurnos = useCallback(async () => {
    try {
      const data = await getTurnos({ fecha: hoy });
      setTurnos(data);
      setErrorCarga(null);
    } catch (err) {
      console.error('[Dashboard] Error cargando turnos:', err.message);
      setErrorCarga('No se pudieron cargar los turnos.');
    } finally {
      setCargando(false);
    }
  }, [hoy]);

  useEffect(() => { cargarTurnos(); }, [cargarTurnos]);

  /**
   * mostrarErrorAccion
   * Setea un mensaje temporal arriba de la lista (4s). Reemplaza alert().
   */
  const mostrarErrorAccion = useCallback((msg) => {
    setErrorAccion(msg);
    setTimeout(() => setErrorAccion(null), 4000);
  }, []);

  /**
   * pedirConfirmacion
   * Abre el ConfirmDialog con la acción y el turno seleccionados.
   */
  const pedirConfirmacion = (turno, accion) => {
    setConfirma({ open: true, accion, turno });
  };

  /**
   * ejecutarAccion
   * Handler del onConfirm del modal. Despacha al endpoint correcto según `accion`.
   */
  const ejecutarAccion = async () => {
    const { accion, turno } = confirma;
    setProcesando(true);
    try {
      if (accion === 'cancelar') {
        await cancelarTurno(turno.id);
      } else {
        // 'completar' → 'completado', 'no_asistio' → 'no_asistio'
        const nuevoEstado = accion === 'completar' ? 'completado' : 'no_asistio';
        await patchEstadoTurno(turno.id, nuevoEstado);
      }
      setConfirma({ open: false, accion: null, turno: null });
      await cargarTurnos();
    } catch (err) {
      console.error('[Dashboard] Error en ejecutarAccion:', err.message);
      setConfirma({ open: false, accion: null, turno: null });
      mostrarErrorAccion(`Error: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  // ─── Datos derivados ──────────────────────────────────────────────────────
  const turnosOrdenados = [...turnos].sort(
    (a, b) => new Date(a.inicio) - new Date(b.inicio)
  );

  const reservados   = turnos.filter((t) => t.estado === 'reservado');
  const completados  = turnos.filter((t) => t.estado === 'completado');
  const noAsistieron = turnos.filter((t) => t.estado === 'no_asistio');
  const cancelados   = turnos.filter((t) => t.estado === 'cancelado');

  const ahora = new Date();
  const proximo = reservados
    .filter((t) => new Date(t.inicio) > ahora)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '16px 16px 24px',
    }}>
      <ScreenHeader
        eyebrow="Hoy"
        title={fmtFechaLarga(hoy)}
        subtitle={
          cargando
            ? 'Cargando turnos del día…'
            : `${turnos.length} turnos · Hola, ${barbero?.nombre?.split(' ')[0] ?? ''}`
        }
      />

      {/* Banner inline de errores de acción (reemplaza alert) */}
      {errorAccion && (
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
          {errorAccion}
        </div>
      )}

      {/* Card destacada: próximo turno */}
      {!cargando && proximo && (
        <Card padding={14} style={{ borderRadius: theme.radiusLg }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.accent,
            marginBottom: 8,
          }}>
            Próximo turno
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarIniciales nombre={proximo.cliente_nombre || '?'} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: theme.body,
                fontWeight: theme.weightHeading,
                fontSize: theme.sizeTitle,
                letterSpacing: '-0.02em',
                color: theme.ink,
                lineHeight: 1.1,
              }}>
                {fmtHora(proximo.inicio)}
              </div>
              <div style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: theme.inkSoft,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {proximo.cliente_nombre || 'Sin nombre'}
                {proximo.servicio_nombre && (
                  <span style={{ color: theme.muted }}> · {proximo.servicio_nombre}</span>
                )}
              </div>
            </div>
            <Button variant="ghost" full={false} onClick={onVerAgenda}>
              Ver agenda
            </Button>
          </div>
        </Card>
      )}

      {/* Grilla 3 KPIs */}
      {!cargando && !errorCarga && turnos.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}>
            <KPI label="Pendientes"  value={reservados.length}   tone="accent" />
            <KPI label="Completados" value={completados.length}  tone="success" />
            <KPI label="No vinieron" value={noAsistieron.length} tone="warning" />
          </div>
          {cancelados.length > 0 && (
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeMicro + 1,
              color: theme.muted,
              marginTop: -8,
            }}>
              {cancelados.length} cancelado{cancelados.length === 1 ? '' : 's'}
            </div>
          )}
        </>
      )}

      {/* Acción primaria */}
      <Button variant="primary" onClick={onCrearTurno}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        Nuevo turno
      </Button>

      {/* Header de la lista + botón refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
      }}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
        }}>
          Turnos del día
        </div>
        <Button variant="ghost" full={false} onClick={cargarTurnos}>
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      {/* Lista */}
      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={80} radius={theme.radius} />
          ))}
        </div>
      )}

      {!cargando && errorCarga && (
        <EmptyState
          glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No pudimos cargar la agenda"
          body={errorCarga}
          action={
            <Button variant="secondary" full={false} onClick={cargarTurnos}>
              Reintentar
            </Button>
          }
        />
      )}

      {!cargando && !errorCarga && turnos.length === 0 && (
        <EmptyState
          glyph={<CalendarX size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No hay turnos para hoy"
          body="Aprovechá y descansá un rato, o creá uno manualmente con el botón de arriba."
        />
      )}

      {!cargando && !errorCarga && turnos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {turnosOrdenados.map((turno) => {
            // Un turno que todavía no empezó no puede marcarse como completado
            // ni como "no vino" — esas acciones sólo aplican a turnos ya transcurridos.
            const esFuturo = new Date(turno.inicio) > new Date();
            return (
              <TurnoListItem
                key={turno.id}
                turno={turno}
                onCompletar={esFuturo ? undefined : () => pedirConfirmacion(turno, 'completar')}
                onNoAsistio={esFuturo ? undefined : () => pedirConfirmacion(turno, 'no_asistio')}
                onCancelar={() => pedirConfirmacion(turno, 'cancelar')}
                bloqueado={procesando && confirma.turno?.id === turno.id}
              />
            );
          })}
        </div>
      )}

      {/* Modal de confirmación — config por acción */}
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
