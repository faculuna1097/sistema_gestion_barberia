// /frontend/src/screens/admin/sections/gestion/BloqueHorarioAtencion.jsx
// Bloque de gestión del horario semanal de atención del negocio.
// Se renderiza dentro de TabNegocio. Cobertura: plan_horario_atencion.md §3.8.
//
// Sistema de diseño: tokens + Geist + primitivos + onClick. El modal de
// confirmación de la cascada 409 usa ConfirmDialog + DetalleRecurso (mismo
// patrón que Caja/Ventas/Gastos). El shape de la respuesta del endpoint NO
// cambia: lo consume también TabBarberos (defaults de bloque + días cerrados).

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../../services/api';
import {
  Button,
  ConfirmDialog,
  DetalleRecurso,
  InputTiempo,
  Toast,
  LoadingState,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// Nombres de día indexados por dia_semana (0=domingo .. 6=sábado),
// misma convención que usa el backend.
const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Orden de presentación: Lun→Sáb, Dom al final.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

// Horario por defecto al abrir un día que estaba cerrado.
const DEFAULT_INICIO = '10:00';
const DEFAULT_FIN    = '19:00';

/**
 * normalizarSemana
 * Normaliza la respuesta del GET (array de 7 días, los cerrados sin horas) a un
 * estado de UI donde todos los días tienen hora_inicio/hora_fin (los cerrados
 * con el default, para que al abrirlos tengan valores). Recorta segundos
 * (HH:MM:SS → HH:MM) porque el input type="time" trabaja en HH:MM.
 * @param {Array} semana - respuesta de GET /admin/horario-atencion
 * @returns {Array} 7 objetos { dia_semana, abierto, hora_inicio, hora_fin }
 */
function normalizarSemana(semana) {
  return semana.map((d) => ({
    dia_semana: d.dia_semana,
    abierto: d.abierto,
    hora_inicio: (d.hora_inicio || DEFAULT_INICIO).slice(0, 5),
    hora_fin: (d.hora_fin || DEFAULT_FIN).slice(0, 5),
  }));
}

/**
 * claveHorario
 * Genera una clave string que representa el horario relevante (solo días
 * abiertos con sus horas). Sirve para detectar si hubo cambios sin que las
 * horas "fantasma" de los días cerrados cuenten como diferencia.
 * @param {Array} dias - estado de UI de los 7 días
 * @returns {string}
 */
function claveHorario(dias) {
  return dias
    .filter((d) => d.abierto)
    .map((d) => `${d.dia_semana}:${d.hora_inicio}-${d.hora_fin}`)
    .join('|');
}

/**
 * ToggleAbierto
 * Pill de dos estados (Abierto / Cerrado) que alterna al hacer click.
 * Abierto = accent (tinted), Cerrado = neutro. Comparte el lenguaje visual de
 * ToggleEstado/ChipFiltro pero con semántica y labels propios del bloque.
 *
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.onToggle
 * @param {boolean} [props.disabled=false]
 * @returns {JSX.Element}
 */
function ToggleAbierto({ abierto, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={abierto}
      style={{
        width: '100%',
        padding: '7px 14px',
        borderRadius: 999,
        border: `1px solid ${abierto ? theme.accent : theme.hairline}`,
        background: abierto ? theme.accentSoft : 'transparent',
        color: abierto ? theme.accent : theme.muted,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: abierto ? theme.weightHeading : theme.weightMedium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}`,
      }}
    >
      {abierto ? 'Abierto' : 'Cerrado'}
    </button>
  );
}

// Wrapper de contenido (sin chrome de card: el panel lo aporta TabNegocio).
// Compartido entre los estados carga/error/contenido.
const CONTENT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

/**
 * EncabezadoHorario
 * Título + hint de la card. Compartido entre los estados de carga / error /
 * contenido para no duplicar la tipografía.
 * @returns {JSX.Element}
 */
function EncabezadoHorario() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>
        Horario de atención
      </span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        lineHeight: 1.5,
      }}>
        Días y horas en que el negocio abre. Define la disponibilidad de turnos
        y el rango válido para los horarios de los barberos.
      </span>
    </div>
  );
}

/**
 * BloqueHorarioAtencion
 * Carga el horario semanal, permite editarlo (toggle por día + InputTiempo) y
 * guardarlo con el flujo de confirmación de cascada del backend (409 → modal).
 * @returns {JSX.Element}
 */
export default function BloqueHorarioAtencion() {
  const [dias, setDias]               = useState([]);
  const [claveOriginal, setClaveOrig] = useState('');
  const [cargando, setCargando]       = useState(true);
  const [guardando, setGuardando]     = useState(false);
  const [errorCarga, setErrorCarga]   = useState(null);     // fallo de carga → bloque de error + retry
  const [feedback, setFeedback]       = useState(null);     // { tone, texto } | null
  const [deltaConfirmar, setDeltaConf] = useState(null);    // delta del 409 → ConfirmDialog
  const [intento, setIntento]         = useState(0);

  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const cargarHorario = async () => {
      setCargando(true);
      setErrorCarga(null);
      try {
        const res  = await apiFetch('/admin/horario-atencion');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelado) return;
        const norm = normalizarSemana(data);
        setDias(norm);
        setClaveOrig(claveHorario(norm));
      } catch (err) {
        console.error('[bloqueHorarioAtencion] Error en cargarHorario:', err.message);
        if (!cancelado) setErrorCarga('No se pudo cargar el horario de atención.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarHorario();
    return () => { cancelado = true; };
  }, [intento]);

  /**
   * toggleDia — alterna abierto/cerrado de un día. Al abrir conserva las horas
   * que ya tuviera (default si nunca tuvo).
   * @param {number} diaSemana
   */
  const toggleDia = (diaSemana) => {
    setFeedback(null);
    setDias((prev) => prev.map((d) =>
      d.dia_semana === diaSemana ? { ...d, abierto: !d.abierto } : d
    ));
  };

  /**
   * cambiarHora — cambia una hora (inicio o fin) de un día abierto.
   * @param {number} diaSemana
   * @param {string} campo - 'hora_inicio' | 'hora_fin'
   * @param {string} valor
   */
  const cambiarHora = (diaSemana, campo, valor) => {
    setFeedback(null);
    setDias((prev) => prev.map((d) =>
      d.dia_semana === diaSemana ? { ...d, [campo]: valor } : d
    ));
  };

  // Días abiertos con rango inválido (fin <= inicio). Bloquean el guardado.
  const diasInvalidos = dias.filter((d) => d.abierto && d.hora_fin <= d.hora_inicio);
  const huboCambios   = claveHorario(dias) !== claveOriginal;
  const puedeGuardar  = huboCambios && diasInvalidos.length === 0;

  /**
   * ejecutarGuardado — ejecuta el PUT del horario. Si confirmarCascada es false
   * y el backend responde 409, abre el modal de confirmación. Si es true (o no
   * había impacto), aplica el cambio y muestra el resumen.
   * @param {boolean} confirmarCascada
   */
  const ejecutarGuardado = async (confirmarCascada) => {
    setGuardando(true);
    setFeedback(null);

    const horarios = dias
      .filter((d) => d.abierto)
      .map((d) => ({ dia_semana: d.dia_semana, hora_inicio: d.hora_inicio, hora_fin: d.hora_fin }));

    try {
      const res = await apiFetch('/admin/horario-atencion', {
        method: 'PUT',
        body: JSON.stringify({ horarios, confirmar_cascada: confirmarCascada }),
      });

      // 409 → el cambio achica el horario; pedir confirmación al usuario.
      if (res.status === 409) {
        const data = await res.json();
        if (vivoRef.current) setDeltaConf(data.delta);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      if (!vivoRef.current) return;
      const norm = normalizarSemana(data.horarios);
      setDias(norm);
      setClaveOrig(claveHorario(norm));
      setDeltaConf(null);

      const c = data.cascada;
      const huboCascada = c.turnos_cancelados > 0 || c.bloques_eliminados > 0 || c.bloques_truncados > 0;
      if (huboCascada) {
        const bloques = c.bloques_eliminados + c.bloques_truncados;
        setFeedback({
          tone: 'success',
          texto: `Horario actualizado · ${c.turnos_cancelados} turno(s) cancelado(s) · ${bloques} bloque(s) de barbero actualizado(s).`,
        });
      } else {
        setFeedback({ tone: 'success', texto: 'Horario actualizado correctamente.' });
      }
    } catch (err) {
      console.error('[bloqueHorarioAtencion] Error en ejecutarGuardado:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: err.message || 'No se pudo guardar el horario. Intentá de nuevo.' });
    } finally {
      if (vivoRef.current) setGuardando(false);
    }
  };

  const handleGuardar = () => {
    if (!puedeGuardar) return;
    ejecutarGuardado(false);
  };

  if (cargando) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoHorario />
        <LoadingState />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoHorario />
        <Toast tone="danger">{errorCarga}</Toast>
        <div>
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const diasOrdenados = ORDEN_DIAS.map((i) => dias.find((d) => d.dia_semana === i)).filter(Boolean);

  return (
    <div style={CONTENT_STYLE}>
      {/* Modal de confirmación de cascada (PUT respondió 409) */}
      <ConfirmDialog
        open={deltaConfirmar !== null}
        title="¿Confirmás el cambio de horario?"
        message="Este cambio cancelará turnos ya reservados y modificará horarios de barberos. No se puede deshacer."
        confirmLabel="Sí, confirmar"
        confirmVariant="danger"
        loading={guardando}
        onConfirm={() => ejecutarGuardado(true)}
        onCancel={() => { if (!guardando) setDeltaConf(null); }}
      >
        {deltaConfirmar && (
          <DetalleRecurso
            filas={[
              {
                label: 'Turnos a cancelar',
                valor: deltaConfirmar.turnos_cancelados,
                numeric: true,
                valorColor: theme.danger,
                valorWeight: theme.weightHeading,
              },
              {
                label: 'Bloques de barbero afectados',
                valor: deltaConfirmar.bloques_truncados + deltaConfirmar.bloques_eliminados,
                numeric: true,
              },
            ]}
          />
        )}
      </ConfirmDialog>

      <EncabezadoHorario />

      {/* Grilla horizontal: auto-fill reparte los 7 días en varias columnas y
          se contraen a menos columnas en pantallas angostas. alignItems:start
          evita que un día abierto estire en alto a sus vecinos cerrados. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 10,
        alignItems: 'start',
      }}>
        {diasOrdenados.map((d) => {
          const invalido = d.abierto && d.hora_fin <= d.hora_inicio;
          return (
            <div
              key={d.dia_semana}
              style={{
                border: `1px solid ${theme.hairline}`,
                borderRadius: theme.radius,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: d.abierto ? 'transparent' : theme.surfaceAlt,
              }}
            >
              <span style={{
                fontFamily: theme.body,
                fontWeight: theme.weightHeading,
                fontSize: theme.sizeBody,
                color: d.abierto ? theme.ink : theme.muted,
              }}>
                {NOMBRE_DIA[d.dia_semana]}
              </span>

              <ToggleAbierto
                abierto={d.abierto}
                onToggle={() => toggleDia(d.dia_semana)}
                disabled={guardando}
              />

              {d.abierto && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <InputTiempo
                    type="time"
                    step="1800"
                    value={d.hora_inicio}
                    onChange={(v) => cambiarHora(d.dia_semana, 'hora_inicio', v)}
                    ariaLabel={`Hora de apertura (${NOMBRE_DIA[d.dia_semana]})`}
                    invalid={invalido}
                    disabled={guardando}
                    full
                  />
                  <InputTiempo
                    type="time"
                    step="1800"
                    value={d.hora_fin}
                    onChange={(v) => cambiarHora(d.dia_semana, 'hora_fin', v)}
                    ariaLabel={`Hora de cierre (${NOMBRE_DIA[d.dia_semana]})`}
                    invalid={invalido}
                    disabled={guardando}
                    full
                  />
                  {invalido && (
                    <span style={{ fontFamily: theme.body, fontSize: 12, color: theme.danger }}>
                      El cierre debe ser mayor a la apertura.
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feedback && (
        <Toast
          tone={feedback.tone}
          autoDismissMs={feedback.tone === 'success' ? 4000 : undefined}
          dismissible={feedback.tone === 'danger'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.texto}
        </Toast>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          onClick={handleGuardar}
          disabled={!puedeGuardar || guardando}
          full={false}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
