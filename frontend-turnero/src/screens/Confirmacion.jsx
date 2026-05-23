// /frontend-turnero/src/screens/Confirmacion.jsx
// Pantalla 7: resumen final + confirmación de la reserva.
// Dos modos: "revisar" (antes de POST) y "confirmado" (después de POST exitoso).

import { useState } from 'react';
import { crearTurno } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fmtFechaLarga, fmtFechaHora, fmtHora } from '../utils/fecha.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Button, StickyFooter, SummaryRow, AvatarIniciales,
} from '../components/ui';

/**
 * Confirmacion
 * @param {Object} props.reserva - Estado completo del wizard
 * @param {Object} props.tenant - Datos del tenant
 * @param {Function} props.onExito - Callback con { turno_id, token_gestion }
 * @param {Function} props.onVolver - Callback para retroceder
 * @param {Object|null} props.resultado - Si está presente, se renderiza el modo confirmado
 * @param {Function} props.onNuevaReserva - Callback para resetear y arrancar de nuevo
 */
function Confirmacion({ reserva, tenant, onExito, onVolver, resultado, onNuevaReserva }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  /**
   * handleConfirmar
   * Envía la reserva al backend y dispara onExito si todo va bien.
   */
  const handleConfirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await crearTurno({
        servicio_id: reserva.servicio.id,
        barbero_id: reserva.barbero.id,
        inicio: reserva.horario,
        nombre: reserva.nombre,
        telefono: reserva.telefono,
        email: reserva.email,
      });
      onExito(res);
    } catch (err) {
      console.error('[Confirmacion] Error:', err.message);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <ConfirmadoView
        reserva={reserva}
        resultado={resultado}
        onNuevaReserva={onNuevaReserva}
      />
    );
  }

  return (
    <RevisarView
      reserva={reserva}
      tenant={tenant}
      enviando={enviando}
      error={error}
      onConfirmar={handleConfirmar}
      onVolver={onVolver}
    />
  );
}

// ═════════════════════════════════════════════════════════════
//  Modo "Revisar"
// ═════════════════════════════════════════════════════════════

/**
 * RevisarView
 * Muestra el resumen completo antes de confirmar el POST.
 */
function RevisarView({ reserva, tenant, enviando, error, onConfirmar, onVolver }) {
  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow="Paso 6 de 6"
        title="Revisá tu reserva"
        subtitle="Confirmás y te llega el detalle por mail."
      />
      <Progress step={6}/>

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {error && <BannerError mensaje={error}/>}

        {/* Card principal con el turno */}
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 16,
        }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
            marginBottom: 4,
          }}>Tu turno</div>

          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}>{fmtFechaHora(reserva.horario)}</div>

          {/* Línea barbero + servicio + precio */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${theme.hairlineSoft}`,
          }}>
            <AvatarIniciales nombre={reserva.barbero.nombre} size={36}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: theme.body,
                fontWeight: theme.weightMedium,
                fontSize: theme.sizeBody,
                color: theme.ink,
              }}>{reserva.barbero.nombre}</div>
              <div style={{
                fontFamily: theme.body,
                fontSize: 13,
                color: theme.muted,
                marginTop: 1,
              }}>
                {reserva.servicio.nombre} · {reserva.servicio.duracion_minutos} min
              </div>
            </div>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeBody,
              color: theme.ink,
              whiteSpace: 'nowrap',
            }}>{fmtPesos(reserva.servicio.precio)}</div>
          </div>
        </div>

        {/* Datos del cliente */}
        <div style={{ marginTop: 16 }}>
          <SummaryRow label="A nombre de" value={reserva.nombre}/>
          <SummaryRow label="Email"        value={reserva.email}/>
          <SummaryRow label="Teléfono"     value={reserva.telefono}/>
          <SummaryRow label="Lugar"        value={tenant.direccion || tenant.nombre}/>
        </div>

        {/* Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${theme.hairline}`,
        }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
          }}>Total · se paga en el local</div>
          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}>{fmtPesos(reserva.servicio.precio)}</div>
        </div>

        {/* Nota de cancelación — comentario inline, anclado al fondo del content */}
        <div style={{
          marginTop: 'auto',
          paddingTop: 28,
          paddingLeft: 4,
          paddingRight: 4,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          fontFamily: theme.body,
          fontSize: 12,
          color: theme.mutedSoft,
          lineHeight: 1.5,
        }}>
          <IconoInfo/>
          <span>
            Podés cancelar o reprogramar tu turno desde el link que te llega por mail.
          </span>
        </div>
      </div>

      <StickyFooter>
        <Button onClick={onConfirmar} disabled={enviando}>
          {enviando ? 'Confirmando…' : 'Confirmar turno'}
        </Button>
      </StickyFooter>
    </PageContainer>
  );
}

// ═════════════════════════════════════════════════════════════
//  Modo "Confirmado"
// ═════════════════════════════════════════════════════════════

/**
 * ConfirmadoView
 * Pantalla de éxito post-POST. Permite navegar a /turnos/gestionar/:token o reservar otro.
 */
function ConfirmadoView({ reserva, resultado, onNuevaReserva }) {
  /**
   * irAGestionar
   * Navega a la URL de gestión del turno usando el token recibido del backend.
   */
  const irAGestionar = () => {
    window.location.href = `/turnos/gestionar/${resultado.token_gestion}`;
  };

  return (
    <PageContainer>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 16px 8px',
      }}>
        {/* Glyph animado de éxito */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SuccessGlyph/>
        </div>

        <div style={{
          fontFamily: theme.mono,
          fontWeight: theme.weightMedium,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.success,
          textAlign: 'center',
          marginTop: 16,
        }}>Turno confirmado</div>

        <h2 style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeTitle,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: theme.ink,
          textAlign: 'center',
          marginTop: 8,
          margin: '8px 0 0',
        }}>Nos vemos pronto</h2>

        <p style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          textAlign: 'center',
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          Te mandamos los detalles a<br/>
          <span style={{ color: theme.ink, fontWeight: theme.weightMedium }}>{reserva.email}</span>
        </p>

        {/* Card resumen del turno confirmado */}
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 16,
          marginTop: 20,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
          }}>{fmtFechaLarga(reserva.horario.slice(0, 10))}</div>

          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: 28,
            color: theme.ink,
            letterSpacing: '-0.02em',
            marginTop: 4,
          }}>
            {fmtHora(reserva.horario)}
            <span style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightRegular,
              color: theme.muted,
              marginLeft: 4,
            }}>hs</span>
          </div>

          <div style={{
            fontFamily: theme.body,
            fontSize: 13,
            color: theme.muted,
            marginTop: 4,
          }}>
            {reserva.servicio.nombre} con {reserva.barbero.nombre}
          </div>
        </div>
      </div>

      <StickyFooter>
        <Button onClick={irAGestionar}>Ver mi turno</Button>
        <div style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onNuevaReserva}>Reservar otro turno</Button>
        </div>
      </StickyFooter>
    </PageContainer>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * BannerError
 * Aviso de error en banner rojo discreto. Se usa cuando falla el POST.
 * @param {string} props.mensaje
 */
function BannerError({ mensaje }) {
  return (
    <div style={{
      background: theme.dangerSoft,
      border: `1px solid ${theme.danger}33`,
      borderRadius: theme.radius,
      padding: '10px 12px',
      marginBottom: 12,
      fontFamily: theme.body,
      fontSize: 13,
      color: theme.danger,
      lineHeight: 1.4,
    }}>{mensaje}</div>
  );
}

/**
 * IconoInfo
 * SVG chico de información, usado en la nota de cancelación.
 */
function IconoInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="8" r="0.75" fill="currentColor"/>
    </svg>
  );
}

/**
 * SuccessGlyph
 * Círculo verde con tilde animado. Se anima al montarse usando @keyframes om-pop y om-stroke.
 */
function SuccessGlyph() {
  return (
    <div style={{
      width: 64,
      height: 64,
      borderRadius: 999,
      background: theme.successSoft,
      color: theme.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'om-pop .45s cubic-bezier(.34,1.56,.64,1) both',
    }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12.5 L10 17.5 L19 7.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: 30,
            animation: 'om-stroke .5s .15s ease-out forwards',
          }}
        />
      </svg>
    </div>
  );
}

export default Confirmacion;
