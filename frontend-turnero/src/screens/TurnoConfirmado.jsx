// /frontend-turnero/src/screens/TurnoConfirmado.jsx
// Éxito de la reserva: el turno ya está creado. Dice cuándo lo esperan y
// ofrece lo que el cliente puede querer hacer después: agregarlo al
// calendario, ver cómo llegar, ver o cambiar el turno, o reservar otro.

import { theme } from '../theme/tokens.js';
import { fechaDeISO, fmtDiaAccesible, fmtHora, sumarMinutos } from '../utils/fecha.js';
import { eventoDeTurno } from '../utils/calendario.js';
import { rutaGestion, urlGestion } from '../utils/rutas.js';
import { linkMapa } from '../utils/mapa.js';
import {
  PageContainer, Button, ResumenTurno, AgregarAlCalendario,
} from '../components/ui';

/**
 * primerNombre
 * Primera palabra del nombre que escribió el cliente, para saludarlo.
 * @param {string} nombre - Ej: "Diego Pereyra"
 * @returns {string} Ej: "Diego" ('' si no hay nombre)
 */
function primerNombre(nombre) {
  return (nombre || '').trim().split(/\s+/)[0];
}

/**
 * TurnoConfirmado
 * Pantalla de éxito. Sin "Volver": el flujo ya se cerró (el "atrás" del
 * celular lleva a la landing, ver useNavegacion#cerrarFlujo).
 * @param {Object} props.reserva - Reserva confirmada: servicio, barbero,
 *   barberoAsignado, horario, nombre, email
 * @param {Object} props.tenant - { nombre, direccion }
 * @param {Object} props.resultado - Respuesta del POST: { turno_id, token_gestion }
 * @param {Function} props.onNuevaReserva - "Reservar otro turno": vuelve a la landing
 */
function TurnoConfirmado({ reserva, tenant, resultado, onNuevaReserva }) {
  const { servicio, barbero, horario } = reserva;
  const nombre = primerNombre(reserva.nombre);

  const evento = eventoDeTurno({
    turnoId: resultado.turno_id,
    servicio: servicio.nombre,
    local: tenant.nombre,
    barbero: barbero.nombre,
    direccion: tenant.direccion,
    inicio: horario,
    fin: sumarMinutos(horario, servicio.duracion_minutos),
    urlGestion: urlGestion(resultado.token_gestion),
  });

  return (
    <PageContainer>
      <div style={{
        flex: 1,
        padding: '32px 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* ── Mensaje principal ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <SuccessGlyph/>

          <h2 style={{
            margin: '16px 0 0',
            fontFamily: theme.body,
            color: theme.ink,
          }}>
            <span style={{
              display: 'block',
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeTitle,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}>{nombre ? `Listo, ${nombre}.` : 'Listo.'}</span>
            <span style={{
              display: 'block',
              marginTop: 8,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeHeading,
              letterSpacing: '-0.01em',
              lineHeight: 1.35,
            }}>
              Te esperamos el {fmtDiaAccesible(fechaDeISO(horario))} a las {fmtHora(horario)}.
            </span>
          </h2>

          <p style={{
            marginTop: 12,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
          }}>
            Te mandamos el detalle a{' '}
            <span style={{ color: theme.ink, fontWeight: theme.weightMedium, overflowWrap: 'anywhere' }}>
              {reserva.email}
            </span>
            .
          </p>

          {/* Recordatorio anti-spam: el mail de confirmación suele caer en
              "correo no deseado", sobre todo en Outlook/Hotmail. */}
          <p style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 4,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            textAlign: 'left',
          }}>
            <IconoInfo/>
            <span>Si no lo ves, revisá spam o correo no deseado.</span>
          </p>
        </div>

        {/* ── Resumen ───────────────────────────────────────── */}
        <ResumenTurno
          servicio={servicio}
          barbero={barbero}
          barberoAsignado={reserva.barberoAsignado}
          direccion={tenant.direccion}
        />

        {/* ── Acciones ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AgregarAlCalendario evento={evento}/>
          {tenant.direccion && (
            <Button variant="secondary" href={linkMapa(tenant.direccion)} externo>
              Cómo llegar
            </Button>
          )}
          <Button variant="secondary" href={rutaGestion(resultado.token_gestion)}>
            Ver o cambiar mi turno
          </Button>
          <Button variant="ghost" onClick={onNuevaReserva}>
            Reservar otro turno
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * IconoInfo
 * SVG chico de información, para el aviso de spam. Decorativo.
 */
function IconoInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="0.75" fill="currentColor"/>
    </svg>
  );
}

/**
 * SuccessGlyph
 * Círculo verde con una tilde que se dibuja. Entra con `om-pop` (fundido y
 * escala, sin rebote, ease-out) y la tilde con `om-stroke`. Con "reducir
 * movimiento", `om-pop` queda en un fundido (index.css). Decorativo.
 */
function SuccessGlyph() {
  return (
    <div aria-hidden="true" style={{
      width: 64,
      height: 64,
      borderRadius: 999,
      background: theme.successSoft,
      color: theme.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'om-pop .3s cubic-bezier(0.25, 1, 0.5, 1) both',
    }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5 L10 17.5 L19 7.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: 30,
            animation: 'om-stroke .4s .15s ease-out forwards',
          }}
        />
      </svg>
    </div>
  );
}

export default TurnoConfirmado;
