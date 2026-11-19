// /frontend-barbero/src/components/agenda/HojaAsignarCliente.jsx
// "Asignar cliente" a un turno "Sin datos" desde su detalle en la Agenda: buscar
// uno de los clientes del barbero o cargar uno nuevo
// (PATCH /admin/turnos/:id/cliente).

import { useState } from 'react';

import { asignarClienteTurno } from '../../services/api.js';
import { fmtHora } from '../../utils/fecha.js';
import { CLIENTE_VACIO, datosClienteParaApi } from '../../utils/clienteTurno.js';
import { HojaInferior, Button, AvisoError } from '../ui';
import SelectorCliente from '../cliente/SelectorCliente.jsx';

/**
 * HojaAsignarCliente
 * Hoja con el SelectorCliente y "Asignar cliente". Con la respuesta del servidor
 * avisa a quien la abrió, que dibuja el nombre y la cierra (convenciones §8). Un
 * 409 (otro ya le asignó un cliente, o el turno cambió de estado) también lo
 * resuelve quien la abrió: cierra, avisa y recarga. El resto de los errores
 * quedan en la hoja, sin perder lo cargado.
 * @param {Object} props.turno - el turno de la Agenda ({ id, inicio, servicio_nombre })
 * @param {() => void} props.onCerrar
 * @param {(respuesta: Object) => void} props.onAsignado - recibe { id, cliente_id, cliente_nombre, ... }
 * @param {(err: Error & { codigo?: string }) => void} props.onConflicto - el 409
 * @returns {JSX.Element}
 */
export default function HojaAsignarCliente({ turno, onCerrar, onAsignado, onConflicto }) {
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const datos = datosClienteParaApi(cliente);

  /**
   * asignar
   * Manda el cliente elegido o el nuevo al servidor.
   */
  const asignar = async () => {
    if (!datos) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await asignarClienteTurno(turno.id, datos);
      onAsignado(respuesta);
    } catch (err) {
      console.error('[HojaAsignarCliente] Error al asignar el cliente:', err.message);
      setEnviando(false);
      if (err.status === 409) {
        onConflicto(err);
        return;
      }
      setError(err.status && err.status < 500
        ? err.message
        : 'No se pudo asignar el cliente. Probá de nuevo.');
    }
  };

  const subtitulo = [fmtHora(turno.inicio), turno.servicio_nombre].filter(Boolean).join(' · ');

  return (
    <HojaInferior
      titulo="Asignar cliente"
      subtitulo={subtitulo}
      bloqueada={enviando}
      onCerrar={onCerrar}
      pie={
        <>
          {error && <AvisoError>{error}</AvisoError>}
          <Button variant="primary" onClick={asignar} disabled={enviando || !datos}>
            {enviando ? 'Asignando…' : 'Asignar cliente'}
          </Button>
        </>
      }
    >
      <SelectorCliente valor={cliente} onCambiar={setCliente} deshabilitado={enviando} />
    </HojaInferior>
  );
}
