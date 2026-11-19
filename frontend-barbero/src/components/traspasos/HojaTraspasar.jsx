// /frontend-barbero/src/components/traspasos/HojaTraspasar.jsx
// "Traspasar" un turno desde su detalle en la Agenda (F2 de
// plan_mejoras_operativas.md): la lista de barberos que tienen libre ese
// horario (GET /admin/traspasos/candidatos), elegir uno y "Ofrecer a {B}"
// (POST /admin/traspasos). El turno sigue siendo del barbero hasta que el otro
// acepta.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, UserX } from 'lucide-react';

import { getCandidatosTraspaso, crearTraspaso } from '../../services/api.js';
import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { textoDatosTurno } from '../../utils/traspasos.js';
import { useHover } from '../../hooks/useHover.js';
import {
  HojaInferior, Button, AvisoError, EmptyState, Skeleton, AvatarIniciales,
} from '../ui';

// Errores que no se arreglan eligiendo otro barbero: el turno cambió o ya tiene
// una oferta. Los resuelve quien abrió la hoja (cierra, avisa y recarga).
const CODIGOS_DEL_TURNO = new Set(['turno_no_encontrado', 'turno_no_traspasable', 'traspaso_pendiente']);

// Errores de un barbero que dejó de servir entre la lista y el envío.
const CODIGOS_DEL_CANDIDATO = new Set(['no_es_candidato', 'barbero_no_encontrado']);

/**
 * FilaCandidato
 * Un barbero de la lista: avatar y nombre, con una tilde si está elegido.
 * Botón con aria-pressed, de 56 de alto.
 * @param {{ barbero_id: string, nombre: string }} props.candidato
 * @param {boolean} props.elegido
 * @param {boolean} props.deshabilitado
 * @param {() => void} props.onElegir
 * @returns {JSX.Element}
 */
function FilaCandidato({ candidato, elegido, deshabilitado, onElegir }) {
  const [hover, eventosHover] = useHover();
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        onClick={onElegir}
        disabled={deshabilitado}
        aria-pressed={elegido}
        {...eventosHover}
        style={{
          width: '100%',
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          background: elegido ? theme.accentSoft : (hover ? theme.surfaceAlt : theme.surface),
          border: `1px solid ${elegido ? theme.accent : theme.hairline}`,
          borderRadius: theme.radius,
          cursor: deshabilitado ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          transition: `background ${theme.transitionFast}`,
        }}
      >
        <AvatarIniciales nombre={candidato.nombre} size={36} />
        <span style={{ flex: 1, minWidth: 0 }}>{candidato.nombre}</span>
        {elegido && <Check size={20} strokeWidth={2} aria-hidden="true" style={{ color: theme.accent }} />}
      </button>
    </li>
  );
}

/**
 * HojaTraspasar
 * Hoja con los candidatos y "Ofrecer a {B}". Con la respuesta del servidor avisa
 * a quien la abrió, que dibuja la solicitud y la cierra (convenciones §8).
 * @param {Object} props.turno - el turno de la Agenda ({ id, inicio, fin, servicio_nombre, cliente_nombre })
 * @param {() => void} props.onCerrar
 * @param {(solicitud: Object) => void} props.onEnviado - la solicitud creada
 * @param {(err: Error & { codigo?: string }) => void} props.onConflicto - el turno
 *   ya no se puede ofrecer (cambió, o ya tiene una oferta pendiente)
 * @returns {JSX.Element}
 */
export default function HojaTraspasar({ turno, onCerrar, onEnviado, onConflicto }) {
  // null mientras carga; después, la lista (puede venir vacía).
  const [candidatos, setCandidatos] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [elegido, setElegido] = useState(null); // barbero_id
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // Última versión de onConflicto: la carga no depende de que quien abrió la
  // hoja pase siempre la misma función (si no, se volvería a pedir la lista en
  // cada render de la Agenda).
  const refOnConflicto = useRef(onConflicto);
  useEffect(() => { refOnConflicto.current = onConflicto; }, [onConflicto]);

  /**
   * cargarCandidatos
   * Pide los barberos con el horario libre. Si el turno ya no se puede ofrecer,
   * lo resuelve quien abrió la hoja.
   */
  const cargarCandidatos = useCallback(async () => {
    setCandidatos(null);
    setErrorCarga(null);
    try {
      setCandidatos(await getCandidatosTraspaso(turno.id));
    } catch (err) {
      console.error('[HojaTraspasar] Error cargando los candidatos:', err.message);
      if (CODIGOS_DEL_TURNO.has(err.codigo)) {
        refOnConflicto.current(err);
        return;
      }
      setErrorCarga('No se pudo cargar quién tiene ese horario libre.');
      setCandidatos([]);
    }
  }, [turno.id]);

  useEffect(() => { cargarCandidatos(); }, [cargarCandidatos]);

  const candidatoElegido = candidatos?.find((c) => c.barbero_id === elegido) ?? null;

  /**
   * ofrecer
   * Manda la solicitud al barbero elegido. Si ese barbero ya no tiene el horario
   * libre, avisa en la hoja y recarga la lista.
   */
  const ofrecer = async () => {
    if (!candidatoElegido) return;
    setEnviando(true);
    setError(null);
    try {
      const solicitud = await crearTraspaso(turno.id, candidatoElegido.barbero_id);
      onEnviado(solicitud);
    } catch (err) {
      console.error('[HojaTraspasar] Error al ofrecer el turno:', err.message);
      setEnviando(false);
      if (CODIGOS_DEL_TURNO.has(err.codigo)) {
        onConflicto(err);
        return;
      }
      if (CODIGOS_DEL_CANDIDATO.has(err.codigo)) {
        setError(`${candidatoElegido.nombre} ya no tiene ese horario libre. Elegí otro.`);
        setElegido(null);
        cargarCandidatos();
        return;
      }
      setError(err.status && err.status < 500 && err.message
        ? err.message
        : 'No se pudo ofrecer el turno. Probá de nuevo.');
    }
  };

  const horario = `${fmtHora(turno.inicio)} a ${fmtHora(turno.fin)}`;
  const subtitulo = [`${fmtHora(turno.inicio)} – ${fmtHora(turno.fin)}`, textoDatosTurno(turno)].join(' · ');

  return (
    <HojaInferior
      titulo="Traspasar turno"
      subtitulo={subtitulo}
      bloqueada={enviando}
      onCerrar={onCerrar}
      pie={candidatos && candidatos.length > 0 ? (
        <>
          {error && <AvisoError>{error}</AvisoError>}
          <Button variant="primary" onClick={ofrecer} disabled={enviando || !candidatoElegido}>
            {enviando
              ? 'Ofreciendo…'
              : (candidatoElegido ? `Ofrecer a ${candidatoElegido.nombre}` : 'Elegí a quién ofrecérselo')}
          </Button>
        </>
      ) : null}
    >
      {candidatos === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={56} radius={theme.radius} />)}
        </div>
      )}

      {errorCarga && (
        <AvisoError>
          {errorCarga}
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" full={false} onClick={cargarCandidatos}>Reintentar</Button>
          </div>
        </AvisoError>
      )}

      {!errorCarga && candidatos && candidatos.length === 0 && (
        <>
          {error && <AvisoError>{error}</AvisoError>}
          <EmptyState
            glyph={<UserX size={28} strokeWidth={1.5} aria-hidden="true" />}
            title="Nadie tiene ese horario libre"
            body={`Para ofrecérselo, otro barbero tiene que estar libre de ${horario}, sin turnos ni descansos.`}
          />
        </>
      )}

      {!errorCarga && candidatos && candidatos.length > 0 && (
        <>
          <p style={{ margin: '0 0 12px', fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
            Tienen libre ese horario. El turno sigue siendo tuyo hasta que acepte.
          </p>
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidatos.map((c) => (
              <FilaCandidato
                key={c.barbero_id}
                candidato={c}
                elegido={c.barbero_id === elegido}
                deshabilitado={enviando}
                onElegir={() => setElegido(c.barbero_id)}
              />
            ))}
          </ul>
        </>
      )}
    </HojaInferior>
  );
}
