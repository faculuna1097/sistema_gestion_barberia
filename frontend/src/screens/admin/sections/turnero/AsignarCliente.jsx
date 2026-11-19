// /frontend/src/screens/admin/sections/turnero/AsignarCliente.jsx
// "Asignar cliente" a un turno "Sin datos" desde su detalle en el Turnero: buscar
// un cliente del local (también en modo barbero) o cargar uno nuevo
// (PATCH /admin/turnos/:id/cliente). Con `reemplazando`, el mismo formulario
// cambia el cliente que ya tiene el turno (solo el admin; auditoría 2026-11,
// Z5-09). Son los modos 'asignando' y 'cambiando' de ModalDetalleTurno: se dibuja
// adentro del mismo Modal, sin anidar otro.

import { useState } from 'react';

import { theme } from '../../../../theme/tokens.js';
import { asignarClienteAdminTurno } from '../../../../services/api';
import { mensajeDeError } from '../../../../utils/errores';
import { useBusquedaClientes } from '../../../../hooks/useBusquedaClientes';
import { Button, Field, Toast } from '../../../../components/ui';
import { estiloEtiquetaCampo } from '../../../../components/ui/estilos';

// Cuántos resultados de la búsqueda se muestran (el resto, refinando el texto).
const MAXIMO_RESULTADOS = 6;

/**
 * contactoDe
 * Teléfono y email de un cliente en una línea.
 * @param {{ telefono?: string, email?: string }} cliente
 * @returns {string} Ej: "1155556666 · ana@mail.com"; '' si no tiene ninguno
 */
function contactoDe(cliente) {
  return [cliente.telefono, cliente.email].filter(Boolean).join(' · ');
}

/**
 * OpcionCliente
 * Un cliente de la búsqueda (o el elegido): nombre y contacto. Elegido, con
 * borde de acento (aria-pressed).
 * @param {{ nombre: string, telefono?: string, email?: string }} props.cliente
 * @param {boolean} props.elegido
 * @param {boolean} props.deshabilitado
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function OpcionCliente({ cliente, elegido, deshabilitado, onClick }) {
  const [hover, setHover] = useState(false);
  const contacto = contactoDe(cliente);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={elegido}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        minHeight: 44,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        background: elegido ? theme.accentSoft : (hover ? theme.surfaceAlt : theme.surface),
        border: `1px solid ${elegido ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        cursor: deshabilitado ? 'default' : 'pointer',
        textAlign: 'left',
        fontFamily: theme.body,
      }}
    >
      <span style={{ fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
        {cliente.nombre}
      </span>
      {contacto && <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>{contacto}</span>}
    </button>
  );
}

/**
 * AsignarCliente
 * Buscador de clientes y, debajo, el formulario de uno nuevo. Elegir uno de la
 * búsqueda lo deja marcado (tocarlo de nuevo lo suelta). Con la respuesta del
 * servidor avisa a quien lo abrió, que dibuja el cliente (convenciones §8). Un
 * 409 también lo resuelve quien lo abrió (cierra, avisa y recarga); el resto de
 * los errores quedan acá, sin perder lo cargado.
 * @param {Object} props.turno - el turno ({ id, cliente_id })
 * @param {boolean} [props.reemplazando=false] - true para cambiar el cliente que
 *   ya tiene: manda `reemplazar` con el cliente que se ve (turno.cliente_id), y
 *   el actual no se ofrece en la búsqueda
 * @param {() => void} props.onVolver - vuelve al detalle
 * @param {(enviando: boolean) => void} props.onEnviando - para bloquear el cierre del Modal
 * @param {(respuesta: Object) => void} props.onAsignado - { id, cliente_id, cliente_nombre, ... }
 * @param {(err: Error) => void} props.onConflicto - el 409
 * @returns {JSX.Element}
 */
export default function AsignarCliente({
  turno, reemplazando = false, onVolver, onEnviando, onAsignado, onConflicto,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState(null);
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '', email: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const { resultados, buscando, error: errorBusqueda, buscado } = useBusquedaClientes(busqueda);

  // Lo que va a la API: el elegido, o el nuevo si tiene nombre. Al cambiar el
  // cliente, además el que se ve ahora (el servidor no pisa si otro lo cambió).
  const nombreNuevo = nuevo.nombre.trim();
  const cliente = elegido
    ? { cliente_id: elegido.id }
    : nombreNuevo
      ? {
        nombre: nombreNuevo,
        ...(nuevo.telefono.trim() ? { telefono: nuevo.telefono.trim() } : {}),
        ...(nuevo.email.trim() ? { email: nuevo.email.trim() } : {}),
      }
      : null;
  const datos = cliente && reemplazando
    ? { ...cliente, reemplazar: true, cliente_actual_id: turno.cliente_id }
    : cliente;

  /**
   * asignar
   * Manda el cliente elegido o el nuevo al servidor.
   */
  const asignar = async () => {
    if (!datos) return;
    setEnviando(true);
    onEnviando(true);
    setError(null);
    try {
      const respuesta = await asignarClienteAdminTurno(turno.id, datos);
      onAsignado(respuesta);
    } catch (err) {
      console.error('[AsignarCliente] Error al asignar el cliente:', err.message);
      if (err.status === 409) {
        onConflicto(err);
        return;
      }
      setError(mensajeDeError(err, reemplazando
        ? 'No se pudo cambiar el cliente. Intentá de nuevo.'
        : 'No se pudo asignar el cliente. Intentá de nuevo.'));
    } finally {
      setEnviando(false);
      onEnviando(false);
    }
  };

  // Al cambiar el cliente, el que ya tiene el turno no se ofrece.
  const encontrados = reemplazando ? resultados.filter((c) => c.id !== turno.cliente_id) : resultados;
  const sinResultados = buscado && !errorBusqueda && encontrados.length === 0 && busqueda.trim().length >= 2;
  // El elegido queda a la vista aunque el texto de búsqueda cambie.
  const lista = elegido && !encontrados.some((c) => c.id === elegido.id)
    ? [elegido, ...encontrados]
    : encontrados;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Buscar uno existente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Field
          label="Buscar cliente"
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Nombre, teléfono o email"
          disabled={enviando}
          autoFocus
        />
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {buscando && <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>Buscando…</span>}
          {!buscando && errorBusqueda && (
            <span style={{ fontSize: theme.sizeBody, color: theme.danger }}>No se pudo buscar. Intentá de nuevo.</span>
          )}
          {!buscando && sinResultados && !elegido && (
            <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>Sin resultados. Cargalo como cliente nuevo.</span>
          )}
          {lista.slice(0, MAXIMO_RESULTADOS).map((c) => (
            <OpcionCliente
              key={c.id}
              cliente={c}
              elegido={elegido?.id === c.id}
              deshabilitado={enviando}
              onClick={() => setElegido((actual) => (actual?.id === c.id ? null : c))}
            />
          ))}
        </div>
      </div>

      {/* O cargar uno nuevo (si eligió uno de la búsqueda, no hace falta) */}
      {!elegido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={estiloEtiquetaCampo}>O un cliente nuevo</span>
          <Field
            label="Nombre"
            value={nuevo.nombre}
            onChange={(v) => setNuevo((n) => ({ ...n, nombre: v }))}
            placeholder="Nombre y apellido"
            disabled={enviando}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <Field
                label="Teléfono (opcional)"
                type="tel"
                value={nuevo.telefono}
                onChange={(v) => setNuevo((n) => ({ ...n, telefono: v }))}
                disabled={enviando}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <Field
                label="Email (opcional)"
                type="email"
                value={nuevo.email}
                onChange={(v) => setNuevo((n) => ({ ...n, email: v }))}
                disabled={enviando}
              />
            </div>
          </div>
        </div>
      )}

      {error && <Toast tone="danger">{error}</Toast>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" full={false} onClick={onVolver} disabled={enviando}>
          Volver
        </Button>
        <Button variant="primary" full={false} onClick={asignar} disabled={enviando || !datos}>
          {reemplazando
            ? (enviando ? 'Cambiando…' : 'Cambiar cliente')
            : (enviando ? 'Asignando…' : 'Asignar cliente')}
        </Button>
      </div>
    </div>
  );
}
