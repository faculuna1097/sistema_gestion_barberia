// /frontend-turnero/src/screens/TurnoConfirmado.jsx
// Éxito de la reserva: el turno ya está creado. Lo más visible es cuándo es,
// con "Agregar al calendario" al lado; después, qué y con quién, dónde y cómo
// llegar, y el aviso del mail (que trae el link para cambiar o cancelar).

import { theme } from '../theme/tokens.js';
import { fechaDeISO, fmtDiaEnOracion, fmtHora, sumarMinutos } from '../utils/fecha.js';
import { capitalizar, textoBarbero } from '../utils/formato.js';
import { eventoDeTurno } from '../utils/calendario.js';
import { urlGestion } from '../utils/rutas.js';
import { linkMapa } from '../utils/mapa.js';
import {
  PageContainer, AgregarAlCalendario, AvatarIniciales, IconoPin, IconoPersona,
} from '../components/ui';

/**
 * ALTO_CIRCULO
 * Diámetro del avatar del barbero y del círculo del pin en el detalle.
 */
const ALTO_CIRCULO = 36;

/**
 * primerNombre
 * Primera palabra del nombre que escribió el cliente, para saludarlo.
 * @param {string} nombre - Ej: "Diego Pereyra"
 * @returns {string} Ej: "Diego" ('' si no hay nombre)
 */
function primerNombre(nombre) {
  return (nombre || '').trim().split(/\s+/)[0];
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * SuccessGlyph
 * Círculo verde con una tilde que se dibuja. Entra con `om-pop` (fundido y
 * escala, sin rebote, ease-out) y la tilde con `om-stroke`. Con "reducir
 * movimiento", `om-pop` queda en un fundido (index.css). Decorativo.
 */
function SuccessGlyph() {
  return (
    <div aria-hidden="true" style={{
      width: 56,
      height: 56,
      borderRadius: 999,
      background: theme.successSoft,
      color: theme.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'om-pop .3s cubic-bezier(0.25, 1, 0.5, 1) both',
    }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
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

/**
 * Circulo
 * Círculo gris del detalle con un ícono adentro, del mismo tamaño que el
 * avatar del barbero para que los dos renglones queden alineados. Decorativo.
 * @param {ReactNode} props.children - Ícono de 18 px
 */
function Circulo({ children }) {
  return (
    <span aria-hidden="true" style={{
      width: ALTO_CIRCULO,
      height: ALTO_CIRCULO,
      flexShrink: 0,
      borderRadius: 999,
      background: theme.surfaceAlt,
      color: theme.inkSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {children}
    </span>
  );
}

/**
 * IconoAfuera
 * Flecha en diagonal hacia arriba a la derecha: el link abre otra app o
 * pestaña (el mapa). Decorativo, toma el color del texto.
 */
function IconoAfuera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * RenglonDetalle
 * Renglón del detalle: el círculo a la izquierda, centrado con el texto de
 * al lado (un texto principal y otro secundario, opcional). Con `href`, la fila entera es un
 * link al mapa (más fácil de tocar que un botón chico): el texto va subrayado
 * con una flecha ↗ al final, que dice que abre afuera. La fila llega hasta los
 * bordes de la tarjeta y el anillo de foco va hacia adentro, para no pisar el
 * borde. Solo el último renglón puede tener `href`: toma las esquinas de abajo
 * de la tarjeta.
 * @param {ReactNode} props.icono - Avatar o `Circulo`
 * @param {string} props.texto - Texto principal (en `ink`)
 * @param {string} [props.secundario] - Debajo, en `muted`
 * @param {string} [props.href] - Si se pasa, la fila abre esta dirección en otra pestaña
 * @param {string} [props.etiqueta] - Con `href`: nombre del link para lectores
 *   de pantalla (ej. "Cómo llegar a …")
 * @param {boolean} [props.separado=false] - Línea arriba (no es el primero)
 */
function RenglonDetalle({ icono, texto, secundario, href, etiqueta, separado = false }) {
  const contenido = (
    <>
      {icono}
      <div style={{
        flex: 1,
        minWidth: 0,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: '21px',
      }}>
        <div style={{ color: theme.ink, fontWeight: theme.weightMedium, overflowWrap: 'anywhere' }}>
          {href ? (
            <>
              <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{texto}</span>
              <span style={{ display: 'inline-block', marginLeft: 4, verticalAlign: -1 }}>
                <IconoAfuera/>
              </span>
            </>
          ) : texto}
        </div>
        {secundario && (
          <div style={{ color: theme.muted, marginTop: 2 }}>{secundario}</div>
        )}
      </div>
    </>
  );

  // El círculo queda centrado con todo el bloque de texto (uno o más renglones).
  const fila = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
  };

  return (
    <li style={{ borderTop: separado ? `1px solid ${theme.hairlineSoft}` : 'none' }}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={etiqueta}
          style={{
            ...fila,
            // Hasta los bordes de la tarjeta (que tiene 16 px a los costados).
            margin: '0 -16px',
            padding: 16,
            borderRadius: `0 0 ${theme.radiusLg}px ${theme.radiusLg}px`,
            outlineOffset: -2,
          }}
        >
          {contenido}
        </a>
      ) : (
        <div style={fila}>{contenido}</div>
      )}
    </li>
  );
}

/**
 * TurnoConfirmado
 * Pantalla de éxito. Sin "Volver" ni más acciones que las del turno: el flujo
 * ya se cerró (el "atrás" del celular lleva a la landing, ver
 * useNavegacion#cerrarFlujo) y cambiar o cancelar el turno se hace desde el
 * link del mail.
 * @param {Object} props.reserva - Reserva confirmada: servicio, barbero,
 *   barberoAsignado, horario
 * @param {Object} props.cliente - Datos con los que se confirmó: { nombre, email, ... }
 * @param {Object} props.tenant - { nombre, direccion }
 * @param {Object} props.resultado - Respuesta del POST: { turno_id, token_gestion }
 */
function TurnoConfirmado({ reserva, cliente, tenant, resultado }) {
  const { servicio, barbero, horario } = reserva;
  const nombre = primerNombre(cliente.nombre);

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
        padding: '40px 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* ── Cuándo: lo principal, con el calendario al lado ───── */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          fontFamily: theme.body,
          color: theme.ink,
        }}>
          <SuccessGlyph/>

          <h2 style={{
            marginTop: 16,
            fontSize: theme.sizeHeading,
            fontWeight: theme.weightMedium,
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            color: theme.inkSoft,
          }}>
            {nombre ? `Listo, ${nombre}. Te esperamos:` : 'Listo. Te esperamos:'}
          </h2>

          <p style={{ marginTop: 16 }}>
            <span style={{
              display: 'block',
              fontSize: theme.sizeTitle,
              fontWeight: theme.weightHeading,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              {capitalizar(fmtDiaEnOracion(fechaDeISO(horario)))}
            </span>
            <span style={{
              display: 'block',
              marginTop: 4,
              fontSize: theme.sizeDisplay,
              fontWeight: theme.weightHeading,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtHora(horario)}
              <span style={{
                marginLeft: 6,
                fontSize: theme.sizeHeading,
                fontWeight: theme.weightMedium,
                letterSpacing: 0,
                color: theme.muted,
              }}>hs</span>
            </span>
          </p>

          <div style={{ width: '100%', marginTop: 24 }}>
            <AgregarAlCalendario evento={evento} conOtraOpcion={false}/>
          </div>
        </section>

        {/* ── Qué, con quién y dónde ───────────────────────────── */}
        <ul style={{
          listStyle: 'none',
          padding: '0 16px',
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
        }}>
          <RenglonDetalle
            icono={barbero.nombre
              ? <span aria-hidden="true" style={{ display: 'flex' }}>
                  <AvatarIniciales nombre={barbero.nombre} size={ALTO_CIRCULO}/>
                </span>
              : <Circulo><IconoPersona size={18}/></Circulo>}
            texto={textoBarbero(barbero, reserva.barberoAsignado)}
            secundario={`${servicio.nombre} · ${servicio.duracion_minutos} min`}
          />
          {tenant.direccion && (
            <RenglonDetalle
              icono={<Circulo><IconoPin size={18}/></Circulo>}
              texto={tenant.direccion}
              href={linkMapa(tenant.direccion)}
              etiqueta={`Cómo llegar a ${tenant.direccion}`}
              separado
            />
          )}
        </ul>

        {/* ── Aviso del mail ───────────────────────────────────── */}
        <p style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          lineHeight: 1.5,
          textAlign: 'center',
        }}>
          Te mandamos el detalle a{' '}
          <span style={{ color: theme.ink, fontWeight: theme.weightMedium, overflowWrap: 'anywhere' }}>
            {cliente.email.trim()}
          </span>
          , con el link para cambiar o cancelar el turno. Si no lo ves, revisá
          spam o correo no deseado.
        </p>
      </div>
    </PageContainer>
  );
}

export default TurnoConfirmado;
