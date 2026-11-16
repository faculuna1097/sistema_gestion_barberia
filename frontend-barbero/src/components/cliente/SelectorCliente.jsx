// /frontend-barbero/src/components/cliente/SelectorCliente.jsx
// Elegir el cliente de un turno: buscar uno existente o cargar uno nuevo. Lo
// comparten el alta de turno (wizard y atajo de la Agenda) y "Asignar cliente"
// del detalle. El "Sin datos" no está acá: cada pantalla lo pone donde le sirve
// (BotonSinDatos).
//
// Es controlado: el valor vive en quien lo usa, que lo arma con CLIENTE_VACIO y
// lo convierte para la API con datosClienteParaApi (utils/clienteTurno.js).

import { useState } from 'react';

import { theme } from '../../theme/tokens.js';
import { useBusquedaClientes } from '../../hooks/useBusquedaClientes.js';
import { CLIENTE_VACIO } from '../../utils/clienteTurno.js';
import { Card, Field, SearchInput, Button } from '../ui';

// Cuántos resultados de la búsqueda se muestran (el resto, refinando el texto).
const MAXIMO_RESULTADOS = 5;

// Rótulo mono en mayúsculas, el mismo de Field.
const ESTILO_ROTULO = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};

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
 * SelectorCliente
 * Buscador de clientes existentes y, debajo, el formulario de uno nuevo. Al
 * elegir uno de la búsqueda, el formulario se reemplaza por la card del elegido,
 * con "Cambiar" para volver atrás.
 * @param {{ cliente: Object|null, nombre: string, telefono: string, email: string }} props.valor
 * @param {(nuevo: Object) => void} props.onCambiar - recibe el valor nuevo, con la misma forma
 * @param {boolean} [props.deshabilitado=false] - mientras se envía
 * @returns {JSX.Element}
 */
export default function SelectorCliente({ valor, onCambiar, deshabilitado = false }) {
  const [busqueda, setBusqueda] = useState('');
  const { resultados, buscando, error, buscado } = useBusquedaClientes(busqueda);

  /**
   * elegir
   * Toma un cliente de la búsqueda y limpia el buscador.
   * @param {Object} cliente - { id, nombre, telefono, email }
   */
  const elegir = (cliente) => {
    onCambiar({ ...CLIENTE_VACIO, cliente });
    setBusqueda('');
  };

  // ─── Cliente existente elegido ──────────────────────────────────────────
  if (valor.cliente) {
    const contacto = contactoDe(valor.cliente);
    return (
      <Card padding={12} selected>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightMedium,
              color: theme.ink,
            }}>
              {valor.cliente.nombre}
            </div>
            {contacto && (
              <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, marginTop: 2 }}>
                {contacto}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            full={false}
            disabled={deshabilitado}
            onClick={() => onCambiar(CLIENTE_VACIO)}
            ariaLabel="Cambiar el cliente elegido"
          >
            Cambiar
          </Button>
        </div>
      </Card>
    );
  }

  const textoLimpio = busqueda.trim();
  const sinResultados = buscado && !error && resultados.length === 0 && textoLimpio.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Buscar uno existente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={ESTILO_ROTULO}>Buscar cliente</span>
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Nombre, teléfono o email"
          ariaLabel="Buscar cliente"
        />
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {buscando && (
            <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>Buscando…</span>
          )}
          {!buscando && error && (
            <span style={{ fontSize: theme.sizeBody, color: theme.danger }}>
              No se pudo buscar. Probá de nuevo.
            </span>
          )}
          {!buscando && sinResultados && (
            <span style={{ fontSize: theme.sizeBody, color: theme.muted }}>
              Sin resultados. Cargalo como cliente nuevo.
            </span>
          )}
          {!buscando && resultados.slice(0, MAXIMO_RESULTADOS).map((c) => {
            const contacto = contactoDe(c);
            return (
              <Card key={c.id} onClick={deshabilitado ? undefined : () => elegir(c)} padding={12}>
                <div style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                  fontWeight: theme.weightMedium,
                  color: theme.ink,
                }}>
                  {c.nombre}
                </div>
                {contacto && (
                  <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, marginTop: 2 }}>
                    {contacto}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* O cargar uno nuevo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={ESTILO_ROTULO}>O un cliente nuevo</span>
        <Field
          label="Nombre"
          value={valor.nombre}
          onChange={(v) => onCambiar({ ...valor, nombre: v })}
          placeholder="Nombre y apellido"
        />
        <Field
          label="Teléfono (opcional)"
          type="tel"
          value={valor.telefono}
          onChange={(v) => onCambiar({ ...valor, telefono: v })}
        />
        <Field
          label="Email (opcional)"
          type="email"
          value={valor.email}
          onChange={(v) => onCambiar({ ...valor, email: v })}
        />
      </div>
    </div>
  );
}
