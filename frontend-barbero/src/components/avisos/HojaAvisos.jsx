// /frontend-barbero/src/components/avisos/HojaAvisos.jsx
// El modal de avisos que abre la campanita de "Hoy": una hoja superpuesta que se
// cierra con la X. Junta en un solo lugar lo que el barbero tiene que ver:
//   - "Te ofrecen": los turnos que otro barbero le ofrece, con Aceptar y
//     Rechazar (el barbero que recibe, B, de los traspasos de F2);
//   - "Tus traspasos": cómo terminaron los que ofreció (aceptado, rechazado o
//     vencido), los que ya vio en gris.
// Cada grupo es un bloque aparte: un tipo de aviso nuevo se suma como otro
// bloque, con su cuenta en el número de la campanita (hooks/useTraspasos).

import { useState } from 'react';
import { BellOff, CheckCircle2, XCircle, Clock } from 'lucide-react';

import { responderTraspaso } from '../../services/api.js';
import { theme } from '../../theme/tokens.js';
import { fmtDiaRelativo, fmtHora, fechaDeISO } from '../../utils/fecha.js';
import { capitalizar } from '../../utils/formato.js';
import {
  textoResultadoParaA, textoErrorAlResponder, textoDatosTurno,
} from '../../utils/traspasos.js';
import { HojaInferior, Button, AvisoError, EmptyState } from '../ui';

// Rótulo de cada bloque (mono, en mayúsculas).
const ESTILO_ROTULO = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
  margin: '0 0 8px',
};

// Caja de cada aviso.
const ESTILO_TARJETA = {
  background: theme.surface,
  border: `1px solid ${theme.hairline}`,
  borderRadius: theme.radius,
  padding: 12,
  listStyle: 'none',
};

// Ícono y color de cada resultado de A. El texto ya dice qué pasó: el color
// no va solo.
const ICONO_RESULTADO = {
  aceptado:  { Icono: CheckCircle2, color: theme.success },
  rechazado: { Icono: XCircle,      color: theme.muted },
  vencido:   { Icono: Clock,        color: theme.warning },
};

/**
 * cuandoEsElTurno
 * Día y horario de un turno para el título de un aviso.
 * @param {{ inicio: string, fin: string }} turno
 * @returns {string} Ej: "Hoy · 10:00 – 10:50", "Jue 20/11 · 10:00 – 10:50"
 */
function cuandoEsElTurno(turno) {
  return `${capitalizar(fmtDiaRelativo(turno.inicio))} · ${fmtHora(turno.inicio)} – ${fmtHora(turno.fin)}`;
}

/**
 * TarjetaOfrecida
 * Un turno que otro barbero le ofrece al de la sesión, con Aceptar y Rechazar.
 * Después de responder, muestra cómo quedó (aceptado con "Ver en la Agenda",
 * rechazado, o por qué ya no se puede) hasta que se cierra el modal.
 * @param {Object} props.solicitud
 * @param {{ tipo: 'aceptado'|'rechazado'|'error', texto?: string, final?: boolean }|undefined} props.respuesta
 * @param {'aceptar'|'rechazar'|null} props.procesando - la acción en curso de esta tarjeta
 * @param {boolean} props.ocupado - hay una acción en curso en otra tarjeta
 * @param {(accion: 'aceptar'|'rechazar') => void} props.onResponder
 * @param {() => void} props.onVerEnAgenda
 * @returns {JSX.Element}
 */
function TarjetaOfrecida({ solicitud, respuesta, procesando, ocupado, onResponder, onVerEnAgenda }) {
  const { turno } = solicitud;
  // Con una respuesta final (aceptada, rechazada o un 409) ya no hay botones.
  const respondida = respuesta && (respuesta.tipo !== 'error' || respuesta.final);

  return (
    <li style={ESTILO_TARJETA}>
      <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
        {solicitud.de_barbero.nombre} te ofrece
      </div>
      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeHeading,
        fontWeight: theme.weightHeading,
        color: theme.ink,
        marginTop: 2,
      }}>
        {cuandoEsElTurno(turno)}
      </div>
      <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft, marginTop: 2 }}>
        {textoDatosTurno(turno)}
      </div>

      {respuesta?.tipo === 'error' && (
        <div style={{ marginTop: 12 }}>
          <AvisoError>{respuesta.texto}</AvisoError>
        </div>
      )}

      {respuesta?.tipo === 'aceptado' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span role="status" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.success,
          }}>
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Aceptado
          </span>
          <Button variant="secondary" full={false} onClick={onVerEnAgenda}>Ver en la Agenda</Button>
        </div>
      )}

      {respuesta?.tipo === 'rechazado' && (
        <div role="status" style={{ marginTop: 12, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          Rechazaste este turno
        </div>
      )}

      {!respondida && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Button variant="secondary" disabled={ocupado} onClick={() => onResponder('rechazar')}>
              {procesando === 'rechazar' ? 'Rechazando…' : 'Rechazar'}
            </Button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Button variant="primary" disabled={ocupado} onClick={() => onResponder('aceptar')}>
              {procesando === 'aceptar' ? 'Aceptando…' : 'Aceptar'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * TarjetaResultado
 * Cómo terminó un turno que el barbero ofreció. Los que ya vio van en gris.
 * @param {Object} props.solicitud - con estado aceptado, rechazado o vencido
 * @param {boolean} props.visto
 * @returns {JSX.Element}
 */
function TarjetaResultado({ solicitud, visto }) {
  const { Icono, color } = ICONO_RESULTADO[solicitud.estado] ?? ICONO_RESULTADO.vencido;
  const { turno } = solicitud;
  // Un vencido no dice de qué turno se trata en su texto: va en la segunda línea.
  const detalle = solicitud.estado === 'vencido'
    ? `${cuandoEsElTurno(turno)} · ${textoDatosTurno(turno)}`
    : textoDatosTurno(turno);

  return (
    <li style={{ ...ESTILO_TARJETA, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Icono
        size={20}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{ color: visto ? theme.muted : color, flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: visto ? theme.weightRegular : theme.weightMedium,
          color: visto ? theme.muted : theme.ink,
        }}>
          {textoResultadoParaA(solicitud)}
        </div>
        <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, marginTop: 2 }}>
          {detalle}
        </div>
      </div>
    </li>
  );
}

/**
 * HojaAvisos
 * Modal de avisos. Lo que ya respondió el barbero queda a la vista, con cómo
 * quedó, hasta que lo cierra: aunque la lista recargada ya no lo traiga.
 * @param {Array} props.pendientes - solicitudes que tiene que responder (useTraspasos)
 * @param {Array} props.resultados - cómo terminaron las que ofreció (useTraspasos)
 * @param {Set<string>} props.vistos - ids de resultados ya vistos
 * @param {(ids: string[]) => void} props.onCerrar - recibe los resultados que se
 *   vieron, para dejar de contarlos
 * @param {(solicitud: Object|null) => void} props.onRespondida - después de
 *   Aceptar o Rechazar: la solicitud que devolvió el servidor (null si falló), así
 *   quien la abrió actualiza la lista y recarga
 * @param {(fecha: string) => void} props.onVerEnAgenda - 'YYYY-MM-DD' del turno;
 *   antes se llama a onCerrar, así el modal se cierra igual que con la X
 * @returns {JSX.Element}
 */
export default function HojaAvisos({ pendientes, resultados, vistos, onCerrar, onRespondida, onVerEnAgenda }) {
  // Lo respondido mientras el modal está abierto: id → { solicitud, tipo, texto, final }.
  const [respuestas, setRespuestas] = useState({});
  // La acción en curso: { id, accion } o null.
  const [enCurso, setEnCurso] = useState(null);

  // Las ofrecidas: las pendientes de ahora más las que se respondieron con el
  // modal abierto (con los datos del momento en que se respondieron).
  const idsPendientes = new Set(pendientes.map((s) => s.id));
  const ofrecidas = [
    ...pendientes,
    ...Object.values(respuestas).filter((r) => !idsPendientes.has(r.solicitud.id)).map((r) => r.solicitud),
  ].sort((x, y) => new Date(x.turno.inicio) - new Date(y.turno.inicio));

  /**
   * responder
   * Acepta o rechaza una solicitud. Con la respuesta del servidor, la tarjeta
   * muestra cómo quedó y la lista de la app se actualiza. Un 409 o 404 (venció,
   * otro ya respondió, A la retiró) se muestra en la tarjeta como final; otro
   * error deja los botones para probar de nuevo.
   * @param {Object} solicitud
   * @param {'aceptar'|'rechazar'} accion
   */
  const responder = async (solicitud, accion) => {
    setEnCurso({ id: solicitud.id, accion });
    try {
      const actualizada = await responderTraspaso(solicitud.id, accion);
      setRespuestas((actual) => ({
        ...actual,
        [solicitud.id]: { solicitud, tipo: accion === 'aceptar' ? 'aceptado' : 'rechazado' },
      }));
      onRespondida(actualizada);
    } catch (err) {
      console.error('[HojaAvisos] Error al responder el traspaso:', err.message);
      const final = err.status === 404 || err.status === 409;
      setRespuestas((actual) => ({
        ...actual,
        [solicitud.id]: { solicitud, tipo: 'error', texto: textoErrorAlResponder(err, solicitud), final },
      }));
      if (final) onRespondida(null);
    } finally {
      setEnCurso(null);
    }
  };

  /**
   * cerrar
   * Cierra el modal y da por vistos los resultados que mostraba.
   */
  const cerrar = () => onCerrar(resultados.map((s) => s.id));

  const sinAvisos = ofrecidas.length === 0 && resultados.length === 0;

  return (
    <HojaInferior titulo="Avisos" bloqueada={Boolean(enCurso)} onCerrar={cerrar}>
      {sinAvisos && (
        <EmptyState
          glyph={<BellOff size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No tenés avisos"
          body="Acá te llegan los turnos que te ofrecen otros barberos y las respuestas a los que ofreciste."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {ofrecidas.length > 0 && (
          <section aria-labelledby="avisos-ofrecen">
            <h3 id="avisos-ofrecen" style={ESTILO_ROTULO}>Te ofrecen</h3>
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ofrecidas.map((s) => (
                <TarjetaOfrecida
                  key={s.id}
                  solicitud={s}
                  respuesta={respuestas[s.id]}
                  procesando={enCurso?.id === s.id ? enCurso.accion : null}
                  ocupado={Boolean(enCurso)}
                  onResponder={(accion) => responder(s, accion)}
                  onVerEnAgenda={() => {
                    cerrar();
                    onVerEnAgenda(fechaDeISO(s.turno.inicio));
                  }}
                />
              ))}
            </ul>
          </section>
        )}

        {resultados.length > 0 && (
          <section aria-labelledby="avisos-traspasos">
            <h3 id="avisos-traspasos" style={ESTILO_ROTULO}>Tus traspasos</h3>
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultados.map((s) => (
                <TarjetaResultado key={s.id} solicitud={s} visto={vistos.has(s.id)} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </HojaInferior>
  );
}
