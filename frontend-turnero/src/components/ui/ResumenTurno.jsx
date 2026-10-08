// /frontend-turnero/src/components/ui/ResumenTurno.jsx
// Resumen del turno del flujo de reserva: cuándo, servicio, barbero y dirección.
// Lo comparten la pantalla de confirmación (antes de reservar) y la de éxito.
// Exclusivo del flujo de reserva (como Progress y SelectorDiaHorario).

import { theme } from '../../theme/tokens.js';
import { fmtPesos, capitalizar } from '../../utils/formato.js';
import { fmtFechaLarga, fmtHora, fechaDeISO } from '../../utils/fecha.js';
import AvatarIniciales from './AvatarIniciales.jsx';
import IconoPin from './IconoPin.jsx';

/**
 * textoBarbero
 * Quién atiende, dicho para el cliente.
 * @param {Object} barbero - { id, nombre }; `nombre` es null si "Cualquiera"
 *   asignó un barbero que no está en la lista de App
 * @param {boolean} asignado - true si lo asignó "Cualquiera"
 * @returns {string} "Te atiende Juan" (asignado), "Con Juan" (elegido a mano)
 *   o "Te asignamos un barbero" (sin nombre)
 */
function textoBarbero(barbero, asignado) {
  if (!barbero.nombre) return 'Te asignamos un barbero';
  return asignado ? `Te atiende ${barbero.nombre}` : `Con ${barbero.nombre}`;
}

/**
 * ResumenTurno
 * Tarjeta con el detalle del turno. Arriba, el día y la hora (si se pasa
 * `horario`); después el servicio con su duración (y el precio, con
 * `conPrecio`); abajo, quién atiende y la dirección del local (si hay).
 * @param {Object} props.servicio - { nombre, duracion_minutos, precio }
 * @param {Object} props.barbero - { id, nombre } (nombre puede ser null)
 * @param {boolean} props.barberoAsignado - true si lo asignó "Cualquiera"
 * @param {string|null} [props.direccion] - Dirección del local
 * @param {string} [props.horario] - ISO del turno; sin él no se muestra el día y la hora
 * @param {boolean} [props.conPrecio=false] - Muestra el precio y "se paga en el local"
 */
function ResumenTurno({
  servicio, barbero, barberoAsignado, direccion, horario, conPrecio = false,
}) {
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      padding: 16,
    }}>
      {/* Día y hora: lo primero que el cliente tiene que verificar */}
      {horario && (
        <div style={{
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: `1px solid ${theme.hairlineSoft}`,
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          lineHeight: 1.35,
          letterSpacing: '-0.01em',
          color: theme.ink,
        }}>
          <div>{capitalizar(fmtFechaLarga(fechaDeISO(horario)))}</div>
          <div>{fmtHora(horario)} hs</div>
        </div>
      )}

      {/* Servicio (+ precio) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>
        <span style={{ minWidth: 0 }}>{servicio.nombre}</span>
        {conPrecio && <span style={{ whiteSpace: 'nowrap' }}>{fmtPesos(servicio.precio)}</span>}
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        marginTop: 2,
      }}>
        {servicio.duracion_minutos} min{conPrecio && ' · se paga en el local'}
      </div>

      {/* Quién atiende y dónde */}
      <ul style={{
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${theme.hairlineSoft}`,
      }}>
        <Renglon
          icono={barbero.nombre
            ? <AvatarIniciales nombre={barbero.nombre} size={28}/>
            : <CirculoIcono><IconoPersona/></CirculoIcono>}
          texto={textoBarbero(barbero, barberoAsignado)}
        />
        {direccion && (
          <Renglon
            icono={<CirculoIcono><IconoPin/></CirculoIcono>}
            texto={direccion}
          />
        )}
      </ul>
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * Renglon
 * Renglón del resumen: un círculo de 28 px (avatar o ícono) y el texto.
 * @param {ReactNode} props.icono - Decorativo
 * @param {string} props.texto
 */
function Renglon({ icono, texto }) {
  return (
    <li style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      color: theme.ink,
    }}>
      <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>{icono}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{texto}</span>
    </li>
  );
}

/**
 * CirculoIcono
 * Círculo de 28 px con el mismo fondo que las iniciales de un barbero, para
 * que los íconos del resumen queden alineados con el avatar.
 * @param {ReactNode} props.children - Ícono de 16 px
 */
function CirculoIcono({ children }) {
  return (
    <span style={{
      width: 28,
      height: 28,
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
 * IconoPersona
 * SVG inline de una silueta, en lugar del avatar cuando no se sabe el nombre
 * del barbero.
 */
function IconoPersona() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default ResumenTurno;
