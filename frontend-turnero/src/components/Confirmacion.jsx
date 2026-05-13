// /frontend-turnero/src/components/Confirmacion.jsx
// Pantalla 7: resumen de la reserva + botón confirmar.
// Post-confirmación muestra el resultado (turno_id, token).

import { useState } from 'react';
import { crearTurno } from '../services/api.js';

/**
 * formatearFechaHora
 * Convierte ISO a fecha y hora legible.
 * @param {string} iso
 * @returns {string}
 */
function formatearFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * Confirmacion
 * Muestra resumen de la reserva y permite confirmar.
 * @param {Object} props.reserva - Estado completo del wizard
 * @param {Object} props.tenant - Datos del tenant
 * @param {Function} props.onExito - Callback con { turno_id, token_gestion }
 * @param {Function} props.onVolver - Callback para retroceder
 * @param {Object|null} props.resultado - Resultado si ya se confirmó
 * @param {Function} props.onNuevaReserva - Callback para resetear el wizard
 */
function Confirmacion({ reserva, tenant, onExito, onVolver, resultado, onNuevaReserva }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  /**
   * handleConfirmar
   * Envía la reserva al backend.
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
      console.log('[Confirmacion] turno creado | turno_id:', res.turno_id);
      onExito(res);
    } catch (err) {
      console.error('[Confirmacion] Error:', err.message);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Post-confirmación: mostrar resultado
  if (resultado) {
    return (
      <div>
        <h2>Turno confirmado</h2>
        <p>Tu turno fue reservado exitosamente.</p>
        <p>Revisá tu email ({reserva.email}) para los detalles y el link de gestión.</p>
        <p><small>Token de gestión: {resultado.token_gestion}</small></p>
        <button onPointerDown={onNuevaReserva}>Reservar otro turno</button>
      </div>
    );
  }

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Confirmar reserva</h2>

      <table style={{ textAlign: 'left' }}>
        <tbody>
          <tr><td><strong>Servicio</strong></td><td>{reserva.servicio.nombre} — ${reserva.servicio.precio}</td></tr>
          <tr><td><strong>Barbero</strong></td><td>{reserva.barbero.nombre}</td></tr>
          <tr><td><strong>Fecha/hora</strong></td><td>{formatearFechaHora(reserva.horario)}</td></tr>
          <tr><td><strong>Duración</strong></td><td>{reserva.servicio.duracion_minutos} min</td></tr>
          <tr><td><strong>Nombre</strong></td><td>{reserva.nombre}</td></tr>
          <tr><td><strong>Teléfono</strong></td><td>{reserva.telefono}</td></tr>
          <tr><td><strong>Email</strong></td><td>{reserva.email}</td></tr>
        </tbody>
      </table>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onPointerDown={handleConfirmar} disabled={enviando}>
        {enviando ? 'Enviando...' : 'Confirmar turno'}
      </button>
    </div>
  );
}

export default Confirmacion;
