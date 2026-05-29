// /frontend/src/screens/admin/sections/gestion/TabBarberos.jsx
// ABM de barberos. Lista en DataTable (sin eliminación física: se usa activo).
// Comisión siempre en porcentaje entero (0-100). PIN requerido al crear,
// opcional al editar (vacío = no cambia).
//
// Arquitectura (Opción C del plan):
//   - Lista: DataTable. Click en fila → modal chico de datos básicos.
//   - Columna "Horarios": check si el barbero tiene horarios cargados.
//   - Acción de fila (BotonIconoFila): abre un modal ancho de "agenda" con
//     tabs internos Horario / Ausencias (los dos editores pesados).
//
// Los horarios de todos los barberos se precargan en el mount (Promise.allSettled,
// N chico) por dos motivos: (a) alimentar el check de la columna, (b) servir de
// cache para abrir el modal de Horario sin refetch.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Users, Check, Clock, CalendarOff, CalendarClock,
  Trash2, AlertTriangle, RefreshCw,
} from 'lucide-react';

import {
  apiFetch,
  getAdminHorarios,
  putAdminHorarios,
  getAdminSuspensiones,
  crearAdminSuspension,
  eliminarAdminSuspension,
} from '../../../../services/api';
import { TZ, DIAS } from '../../../../utils/fecha';
import {
  Button,
  Field,
  Modal,
  Tabs,
  DataTable,
  EmptyState,
  LoadingState,
  IconoAlerta,
  BadgeEstado,
  ToggleEstado,
  BotonIconoFila,
  AvatarIniciales,
  Toast,
  InputTiempo,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// Orden de presentación de los días: Lun→Sáb, Dom al final (índices de DIAS).
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

/**
 * fmtFechaHora
 * Formatea un timestamp ISO a 'DD/MM/YYYY HH:MM' en timezone Argentina.
 * @param {string} iso
 * @returns {string}
 */
function fmtFechaHora(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * humanizarDiasEnMensaje
 * Reemplaza las referencias "día N" (0-6) en un mensaje de error del backend
 * por el nombre del día (DIAS[N]). El backend reporta el solapamiento de
 * horarios como "Solapamiento en día 5: ..."; esto lo vuelve "...en Viernes:".
 * @param {string} mensaje
 * @returns {string}
 */
function humanizarDiasEnMensaje(mensaje) {
  return String(mensaje).replace(/d[ií]a\s+(\d)/gi, (coincidencia, n) => {
    const nombre = DIAS[Number(n)];
    return nombre ?? coincidencia;
  });
}

/**
 * construirHorarioLocal
 * Reduce la respuesta de GET /admin/horario-atencion (array de 7 días) a un
 * mapa { [dia_semana]: { inicio: 'HH:MM', fin: 'HH:MM' } } con solo los días
 * abiertos. Lo usa "Agregar bloque" para arrancar con el horario del local en
 * vez de un default fijo. Recorta los segundos (HH:MM:SS → HH:MM) de la DB,
 * porque el input type="time" trabaja en HH:MM.
 * @param {Array|null} semana
 * @returns {Object}
 */
function construirHorarioLocal(semana) {
  const mapa = {};
  if (!Array.isArray(semana)) return mapa;
  semana.forEach((d) => {
    if (d.abierto && d.hora_inicio && d.hora_fin) {
      mapa[d.dia_semana] = { inicio: d.hora_inicio.slice(0, 5), fin: d.hora_fin.slice(0, 5) };
    }
  });
  return mapa;
}

// ─── Tab Horario (dentro del modal de agenda) ─────────────────────────────────
/**
 * SubPanelHorario
 * Editor del horario semanal de un barbero. Arranca de la cache (bloquesIniciales)
 * si está disponible; si no (cache falló en el mount), hace su propio fetch.
 * El PUT reemplaza el horario completo. Al guardar, propaga al padre vía onGuardado
 * para refrescar el check de la columna y la cache.
 *
 * @param {object} props
 * @param {object} props.barbero - { id, nombre }
 * @param {Array|null} props.bloquesIniciales - bloques cacheados, o null si falló la carga
 * @param {Object|null} props.horarioLocal - { [dia]: { inicio, fin } } días abiertos del local; null si no se pudo leer (no se bloquea ningún día)
 * @param {(bloques: Array) => void} props.onGuardado
 */
function SubPanelHorario({ barbero, bloquesIniciales, horarioLocal, onGuardado }) {
  const tieneCache = Array.isArray(bloquesIniciales);

  const [bloques, setBloques]     = useState(tieneCache ? bloquesIniciales : []);
  const [cargando, setCargando]   = useState(!tieneCache);
  const [guardando, setGuardando] = useState(false);
  const [feedback, setFeedback]   = useState(null); // { tone, texto } | null

  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  // Fetch solo si no había cache (fallback ante fallo de precarga).
  useEffect(() => {
    if (tieneCache) return;
    (async () => {
      try {
        const data = await getAdminHorarios(barbero.id);
        if (vivoRef.current) setBloques(data);
      } catch (err) {
        console.error('[tabBarberos/Horario] Error cargando:', err.message);
        if (vivoRef.current) setFeedback({ tone: 'danger', texto: 'No se pudieron cargar los horarios.' });
      } finally {
        if (vivoRef.current) setCargando(false);
      }
    })();
  }, [barbero.id, tieneCache]);

  /**
   * agregarBloque — suma un bloque para un día, arrancando con el horario del
   * local para ese día (si el local abre); si no, cae al default 09:00–18:00.
   * @param {number} dia - 0-6
   */
  const agregarBloque = (dia) => {
    const local = horarioLocal?.[dia];
    setBloques((prev) => [...prev, {
      dia_semana: dia,
      hora_inicio: local?.inicio ?? '09:00',
      hora_fin: local?.fin ?? '18:00',
    }]);
    setFeedback(null);
  };

  /**
   * actualizarBloque — actualiza un campo de un bloque por índice.
   * @param {number} index
   * @param {string} campo - 'hora_inicio' | 'hora_fin'
   * @param {string} valor
   */
  const actualizarBloque = (index, campo, valor) => {
    setBloques((prev) => prev.map((b, i) => (i === index ? { ...b, [campo]: valor } : b)));
    setFeedback(null);
  };

  /**
   * eliminarBloque — quita un bloque del array local por índice.
   * @param {number} index
   */
  const eliminarBloque = (index) => {
    setBloques((prev) => prev.filter((_, i) => i !== index));
    setFeedback(null);
  };

  /**
   * guardar — envía el horario completo (PUT reemplaza todo) y propaga al padre.
   */
  const guardar = async () => {
    setGuardando(true);
    setFeedback(null);
    try {
      const payload = bloques.map(({ dia_semana, hora_inicio, hora_fin }) => ({
        dia_semana, hora_inicio, hora_fin,
      }));
      const resultado = await putAdminHorarios(barbero.id, payload);
      if (!vivoRef.current) return;
      setBloques(resultado);
      onGuardado(resultado);
      setFeedback({ tone: 'success', texto: 'Horarios guardados correctamente.' });
    } catch (err) {
      console.error('[tabBarberos/Horario] Error guardando:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: `Error: ${humanizarDiasEnMensaje(err.message)}` });
    } finally {
      if (vivoRef.current) setGuardando(false);
    }
  };

  if (cargando) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {feedback && (
        <Toast
          tone={feedback.tone}
          autoDismissMs={feedback.tone === 'success' ? 3000 : undefined}
          dismissible={feedback.tone === 'danger'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.texto}
        </Toast>
      )}

      {/* Grilla horizontal de días: auto-fill reparte los 7 días en varias
          columnas (3 en desktop, 2 en iPad) para que el modal no crezca a lo
          alto y se salga de la pantalla. alignItems:start evita que una card
          con muchos bloques estire en altura a sus vecinas de fila. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 10,
        alignItems: 'start',
      }}>
      {ORDEN_DIAS.map((dia) => {
        const bloquesDelDia = bloques
          .map((b, i) => ({ ...b, _index: i }))
          .filter((b) => b.dia_semana === dia);
        // Día cerrado en el local: solo si conocemos la atención (≠ null) y el
        // día no figura entre los abiertos. Si es null (no se pudo leer), no
        // bloqueamos nada.
        const cerrado = horarioLocal != null && !horarioLocal[dia];

        return (
          <div
            key={dia}
            style={{
              border: `1px solid ${theme.hairline}`,
              borderRadius: theme.radius,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: cerrado ? theme.surfaceAlt : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: theme.body,
                fontWeight: theme.weightHeading,
                fontSize: theme.sizeBody,
                color: cerrado ? theme.muted : theme.ink,
                minWidth: 88,
              }}>
                {DIAS[dia]}
              </span>
              {cerrado ? (
                <span style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                  color: theme.mutedSoft,
                }}>
                  Local cerrado
                </span>
              ) : bloquesDelDia.length === 0 ? (
                <span style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeBody,
                  color: theme.mutedSoft,
                }}>
                  Sin horario
                </span>
              ) : null}
            </div>

            {bloquesDelDia.map((bloque) => (
              <div key={bloque._index} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <InputTiempo
                    type="time"
                    value={bloque.hora_inicio}
                    onChange={(v) => actualizarBloque(bloque._index, 'hora_inicio', v)}
                    ariaLabel={`Hora de inicio (${DIAS[dia]})`}
                    full
                  />
                </div>
                <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>a</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <InputTiempo
                    type="time"
                    value={bloque.hora_fin}
                    onChange={(v) => actualizarBloque(bloque._index, 'hora_fin', v)}
                    ariaLabel={`Hora de fin (${DIAS[dia]})`}
                    full
                  />
                </div>
                <BotonIconoFila
                  tono="danger"
                  ariaLabel="Eliminar bloque"
                  icono={<Trash2 size={14} strokeWidth={1.75} />}
                  onClick={() => eliminarBloque(bloque._index)}
                />
              </div>
            ))}

            {!cerrado && (
            <button
              type="button"
              onClick={() => agregarBloque(dia)}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.accentSoft; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                border: `1px dashed ${theme.hairline}`,
                borderRadius: theme.radiusSm,
                background: 'transparent',
                color: theme.accent,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: theme.weightMedium,
                cursor: 'pointer',
                transition: `background ${theme.transitionFast}`,
              }}
            >
              <Plus size={14} strokeWidth={2} /> Agregar bloque
            </button>
            )}
          </div>
        );
      })}
      </div>

      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={guardar} disabled={guardando} full={false}>
          {guardando ? 'Guardando…' : 'Guardar horarios'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab Ausencias (dentro del modal de agenda) ───────────────────────────────
/**
 * SubPanelAusencias
 * Lista, crea y elimina ausencias (suspensiones) de un barbero. La creación
 * maneja el flujo de conflicto 409 (turnos que se cancelarían). El borrado usa
 * confirmación inline de 2 pasos (sin ConfirmDialog anidado dentro del modal).
 *
 * @param {object} props
 * @param {object} props.barbero - { id, nombre }
 */
function SubPanelAusencias({ barbero }) {
  const [suspensiones, setSuspensiones] = useState([]);
  const [cargando, setCargando]         = useState(true);

  const [formDesde, setFormDesde]   = useState('');
  const [formHasta, setFormHasta]   = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [creando, setCreando]       = useState(false);
  const [conflicto, setConflicto]   = useState(null);
  const [feedback, setFeedback]     = useState(null); // { tone, texto } | null

  const [eliminando, setEliminando]       = useState(null); // id en proceso de borrado
  const [confirmandoId, setConfirmandoId] = useState(null); // id en confirmación inline

  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  // Validación de rango: desde debe ser estrictamente anterior a hasta.
  // Los valores datetime-local ('YYYY-MM-DDTHH:MM') comparan lexicográficamente bien.
  const rangoInvalido = formDesde !== '' && formHasta !== '' && formDesde >= formHasta;
  const puedeCrear = formDesde !== '' && formHasta !== '' && !rangoInvalido;

  /**
   * cargarSuspensiones — fetch de ausencias futuras del barbero.
   */
  const cargarSuspensiones = async () => {
    try {
      const data = await getAdminSuspensiones(barbero.id);
      if (vivoRef.current) setSuspensiones(data);
    } catch (err) {
      console.error('[tabBarberos/Ausencias] Error cargando:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: 'No se pudieron cargar las ausencias.' });
    } finally {
      if (vivoRef.current) setCargando(false);
    }
  };

  useEffect(() => {
    cargarSuspensiones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbero.id]);

  /**
   * crear — crea una ausencia. Maneja el conflicto 409 (turnos afectados).
   * @param {boolean} confirmarCancelacion - true para forzar tras conflicto
   */
  const crear = async (confirmarCancelacion = false) => {
    if (!puedeCrear) return;
    setCreando(true);
    setFeedback(null);
    try {
      const datos = {
        barbero_id: barbero.id,
        desde: formDesde,
        hasta: formHasta,
        ...(formMotivo.trim() ? { motivo: formMotivo.trim() } : {}),
        ...(confirmarCancelacion ? { confirmar_cancelacion: true } : {}),
      };
      const res = await crearAdminSuspension(datos);
      if (!vivoRef.current) return;

      if (res.conflicto) {
        setConflicto(res);
        setCreando(false);
        return;
      }

      setConflicto(null);
      setFormDesde('');
      setFormHasta('');
      setFormMotivo('');
      setFeedback({ tone: 'success', texto: `Ausencia creada. ${res.turnos_cancelados || 0} turno(s) cancelado(s).` });
      await cargarSuspensiones();
    } catch (err) {
      console.error('[tabBarberos/Ausencias] Error creando:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: `Error: ${err.message}` });
    } finally {
      if (vivoRef.current) setCreando(false);
    }
  };

  /**
   * eliminar — borra una ausencia por id (tras confirmación inline).
   * @param {string} id
   */
  const eliminar = async (id) => {
    setEliminando(id);
    try {
      await eliminarAdminSuspension(id);
      if (!vivoRef.current) return;
      setConfirmandoId(null);
      await cargarSuspensiones();
    } catch (err) {
      console.error('[tabBarberos/Ausencias] Error eliminando:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: `Error: ${err.message}` });
    } finally {
      if (vivoRef.current) setEliminando(null);
    }
  };

  if (cargando) return <LoadingState />;

  const cantConflicto = conflicto?.turnos_afectados?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      {/* Formulario de nueva ausencia */}
      <div style={{
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <span style={{
          fontFamily: theme.mono,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.inkSoft,
        }}>
          Nueva ausencia
        </span>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <CampoTiempo
            label="Desde"
            type="datetime-local"
            value={formDesde}
            onChange={setFormDesde}
            invalid={rangoInvalido}
          />
          <CampoTiempo
            label="Hasta"
            type="datetime-local"
            value={formHasta}
            onChange={setFormHasta}
            invalid={rangoInvalido}
          />
        </div>

        {rangoInvalido && (
          <span style={{ fontFamily: theme.body, fontSize: 12, color: theme.danger }}>
            La fecha "Desde" debe ser anterior a "Hasta".
          </span>
        )}

        <Field
          label="Motivo (opcional)"
          value={formMotivo}
          onChange={setFormMotivo}
          placeholder="Ej: Vacaciones, turno médico…"
        />

        {/* Conflicto: turnos que se cancelarían */}
        {conflicto && (
          <div style={{
            background: theme.warningSoft,
            border: `1px solid ${theme.warning}33`,
            borderRadius: theme.radius,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.warning }}>
              <AlertTriangle size={16} strokeWidth={1.75} />
              <span style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: theme.sizeBody }}>
                {cantConflicto} turno{cantConflicto !== 1 ? 's' : ''} se cancelará{cantConflicto !== 1 ? 'n' : ''}:
              </span>
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: 20,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.inkSoft,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {conflicto.turnos_afectados?.map((t, i) => (
                <li key={i}>{fmtFechaHora(t.inicio)} — {t.cliente_nombre || 'Sin nombre'}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" onClick={() => crear(true)} disabled={creando} full={false}>
                {creando ? 'Creando…' : 'Confirmar y crear'}
              </Button>
              <Button variant="ghost" onClick={() => setConflicto(null)} disabled={creando} full={false}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!conflicto && (
          <div>
            <Button variant="primary" onClick={() => crear(false)} disabled={creando || !puedeCrear} full={false}>
              {creando ? 'Creando…' : 'Crear ausencia'}
            </Button>
          </div>
        )}
      </div>

      {/* Lista de ausencias */}
      {suspensiones.length === 0 ? (
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          No hay ausencias programadas.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suspensiones.map((s) => {
            const confirmando = confirmandoId === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  border: `1px solid ${theme.hairline}`,
                  borderRadius: theme.radius,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{
                    fontFamily: theme.body,
                    fontWeight: theme.weightMedium,
                    fontSize: theme.sizeBody,
                    color: theme.ink,
                  }}>
                    {fmtFechaHora(s.desde)} → {fmtFechaHora(s.hasta)}
                  </span>
                  {s.motivo && (
                    <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
                      {s.motivo}
                    </span>
                  )}
                  <span style={{
                    fontFamily: theme.mono,
                    fontSize: theme.sizeMicro,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: theme.mutedSoft,
                  }}>
                    Origen: {s.origen}
                  </span>
                </div>

                {confirmando ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button variant="danger" onClick={() => eliminar(s.id)} disabled={eliminando === s.id} full={false}>
                      {eliminando === s.id ? 'Eliminando…' : 'Sí, eliminar'}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmandoId(null)} disabled={eliminando === s.id} full={false}>
                      No
                    </Button>
                  </div>
                ) : (
                  <BotonIconoFila
                    tono="danger"
                    ariaLabel="Eliminar ausencia"
                    icono={<Trash2 size={14} strokeWidth={1.75} />}
                    onClick={() => setConfirmandoId(s.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * CampoTiempo
 * Wrapper label (eyebrow) + InputTiempo full-width, para el form de ausencias.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.type - 'datetime-local' | 'time'
 * @param {string} props.value
 * @param {(v: string) => void} props.onChange
 * @param {boolean} [props.invalid=false]
 */
function CampoTiempo({ label, type, value, onChange, invalid = false }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</span>
      <InputTiempo type={type} value={value} onChange={onChange} ariaLabel={label} invalid={invalid} full />
    </label>
  );
}

// ─── Modal de agenda (Horario + Ausencias) ────────────────────────────────────
/**
 * ModalAgenda
 * Modal ancho con tabs internos Horario / Ausencias para un barbero existente.
 * Ambos paneles se montan a la vez (toggle por display) para no refetchear al
 * cambiar de tab. Solo accesible para barberos ya creados.
 *
 * @param {object} props
 * @param {object} props.barbero - { id, nombre }
 * @param {Array|null} props.bloquesIniciales - horarios cacheados del barbero
 * @param {Object|null} props.horarioLocal - { [dia]: { inicio, fin } } días abiertos del local; null si no se pudo leer
 * @param {() => void} props.onClose
 * @param {(barberoId: string, bloques: Array) => void} props.onHorarioGuardado
 */
function ModalAgenda({ barbero, bloquesIniciales, horarioLocal, onClose, onHorarioGuardado }) {
  const [tab, setTab] = useState('horario');

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={900}
      title="Horario y ausencias"
      subtitle={barbero.nombre}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} full={false}>Cerrar</Button>
        </div>
      }
    >
      <Tabs
        items={[
          { key: 'horario',   label: 'Horario',   icon: Clock },
          { key: 'ausencias', label: 'Ausencias', icon: CalendarOff },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: 16 }}>
        <div style={{ display: tab === 'horario' ? 'block' : 'none' }}>
          <SubPanelHorario
            barbero={barbero}
            bloquesIniciales={bloquesIniciales}
            horarioLocal={horarioLocal}
            onGuardado={(bloques) => onHorarioGuardado(barbero.id, bloques)}
          />
        </div>
        <div style={{ display: tab === 'ausencias' ? 'block' : 'none' }}>
          <SubPanelAusencias barbero={barbero} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal de datos básicos (crear / editar) ──────────────────────────────────
/**
 * ModalDatosBarbero
 * Formulario chico para crear o editar los datos básicos de un barbero
 * (nombre, PIN, comisión, estado). El horario y las ausencias se gestionan
 * aparte, desde el modal de agenda.
 *
 * @param {object} props
 * @param {object|null} props.barbero - null = modo crear; objeto = modo editar
 * @param {(barbero: object, esEdicion: boolean) => void} props.onGuardar
 * @param {() => void} props.onCerrar
 */
function ModalDatosBarbero({ barbero, onGuardar, onCerrar }) {
  const esEdicion = barbero !== null;

  const [nombre, setNombre]       = useState(barbero?.nombre ?? '');
  const [pin, setPin]             = useState('');
  const [comision, setComision]   = useState(barbero?.comision_valor != null ? String(barbero.comision_valor) : '');
  const [activo, setActivo]       = useState(barbero?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  const pinValido    = pin === '' || /^\d{4}$/.test(pin);
  const pinRequerido = !esEdicion && pin.length !== 4;

  const comisionNum    = comision === '' ? null : Number(comision);
  const comisionValida = comisionNum !== null && comisionNum >= 0 && comisionNum <= 100;

  const puedeGuardar =
    nombre.trim() !== '' &&
    comisionValida &&
    pinValido &&
    !pinRequerido;

  /**
   * handleGuardar — POST (crear) o PUT (editar). Incluye pin solo si se ingresó.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);

    const body = {
      nombre: nombre.trim(),
      comision_valor: Number(comision),
      activo,
    };
    if (pin !== '') body.pin = pin;

    const method = esEdicion ? 'PUT' : 'POST';
    const path   = esEdicion ? `/admin/barberos/${barbero.id}` : '/admin/barberos';

    try {
      const res = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }
      const barberoGuardado = await res.json();
      onGuardar(barberoGuardado, esEdicion);
    } catch (err) {
      console.error('[tabBarberos] Error en handleGuardar:', err.message);
      setError(err.message || 'No se pudo guardar el barbero. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      loading={guardando}
      title={esEdicion ? 'Editar barbero' : 'Nuevo barbero'}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleGuardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Nombre"
          value={nombre}
          onChange={setNombre}
          placeholder="Ej: Martín"
        />
        <Field
          label={esEdicion ? 'PIN (dejá vacío para no cambiar)' : 'PIN'}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 dígitos"
          error={pin !== '' && !pinValido ? 'El PIN debe tener exactamente 4 dígitos.' : undefined}
          helper={!esEdicion && pin === '' ? 'Requerido para crear un barbero.' : undefined}
        />
        <Field
          label="Comisión (%)"
          type="text"
          inputMode="numeric"
          value={comision}
          onChange={(v) => setComision(v.replace(/\D/g, ''))}
          placeholder="Ej: 40"
          error={comision !== '' && !comisionValida ? 'La comisión debe estar entre 0 y 100.' : undefined}
        />
        {esEdicion && <ToggleEstado value={activo} onChange={setActivo} />}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}33`,
            borderRadius: theme.radius,
            color: theme.danger,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
          }}>
            <AlertTriangle size={16} strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
/**
 * TabBarberos
 * Tab de gestión de barberos. Lista + crear/editar datos + gestión de agenda.
 *
 * @returns {JSX.Element}
 */
export default function TabBarberos() {
  const [barberos, setBarberos]                 = useState([]);
  const [horariosPorBarbero, setHorarios]       = useState({}); // { [id]: bloques[] | null }
  const [horarioLocal, setHorarioLocal]         = useState(null); // { [dia]: { inicio, fin } } | null = desconocido
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [intento, setIntento]                   = useState(0);

  const [modalDatos, setModalDatos]             = useState(false);
  const [barberoEditando, setBarberoEditando]   = useState(null);

  const [agendaBarbero, setAgendaBarbero]       = useState(null); // barbero | null

  // ── Carga inicial / reintentos ────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await apiFetch('/admin/barberos');
        if (!res.ok) throw new Error('Error del servidor');
        const data = await res.json();
        // Precarga en paralelo de: (a) horarios por barbero — alimenta el check
        // de la columna y sirve de cache para el modal; (b) horario de atención
        // del local — default de "Agregar bloque". allSettled en (a) → un fallo
        // puntual no rompe la tabla; la atención cae a {} si falla (default fijo).
        const [resultados, atencion] = await Promise.all([
          Promise.allSettled(data.map((b) => getAdminHorarios(b.id))),
          apiFetch('/admin/horario-atencion')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        if (cancelado) return;
        const mapa = {};
        data.forEach((b, i) => {
          mapa[b.id] = resultados[i].status === 'fulfilled' ? resultados[i].value : null;
        });
        setBarberos(data);
        setHorarios(mapa);
        // null = no pudimos leer la atención (no bloqueamos días); objeto = sí.
        setHorarioLocal(atencion ? construirHorarioLocal(atencion) : null);
      } catch (err) {
        console.error('[tabBarberos] Error en carga:', err.message);
        if (!cancelado) setError('No se pudieron cargar los barberos.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Modal de datos ────────────────────────────────────────────────────────
  const abrirCrear  = ()        => { setBarberoEditando(null);    setModalDatos(true); };
  const abrirEditar = (barbero) => { setBarberoEditando(barbero); setModalDatos(true); };
  const cerrarDatos = ()        => { setModalDatos(false); setBarberoEditando(null); };

  /**
   * handleGuardado — actualiza la lista local sin refetch tras crear/editar.
   * @param {object}  barberoGuardado
   * @param {boolean} esEdicion
   */
  const handleGuardado = (barberoGuardado, esEdicion) => {
    if (esEdicion) {
      setBarberos((prev) => prev.map((b) => (b.id === barberoGuardado.id ? barberoGuardado : b)));
    } else {
      setBarberos((prev) => [...prev, barberoGuardado]);
      // Un barbero nuevo arranca sin horarios cargados.
      setHorarios((prev) => ({ ...prev, [barberoGuardado.id]: [] }));
    }
    cerrarDatos();
  };

  // ── Modal de agenda ───────────────────────────────────────────────────────
  const abrirAgenda  = (barbero) => setAgendaBarbero(barbero);
  const cerrarAgenda = ()        => setAgendaBarbero(null);

  /**
   * handleHorarioGuardado — refresca la cache de horarios (y el check de la
   * columna) tras guardar el horario de un barbero desde el modal de agenda.
   * @param {string} barberoId
   * @param {Array}  bloques
   */
  const handleHorarioGuardado = (barberoId, bloques) => {
    setHorarios((prev) => ({ ...prev, [barberoId]: bloques }));
  };

  // ── Estados de carga / error ──────────────────────────────────────────────
  if (cargando) return <LoadingState />;
  if (error) {
    return (
      <EmptyState
        glyph={<IconoAlerta />}
        title="No se pudieron cargar los barberos"
        body={error}
        action={
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        }
      />
    );
  }

  /**
   * tieneHorarios — true si el barbero tiene al menos un bloque cargado.
   * @param {object} b
   * @returns {boolean}
   */
  const tieneHorarios = (b) => {
    const h = horariosPorBarbero[b.id];
    return Array.isArray(h) && h.length > 0;
  };

  // ── Columnas del DataTable ────────────────────────────────────────────────
  const columnas = [
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      grow: true,
      sortAccessor: (row) => String(row.nombre ?? '').toLowerCase(),
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AvatarIniciales nombre={row.nombre} size={30} />
          <span>{row.nombre}</span>
        </div>
      ),
    },
    {
      key: 'comision',
      label: 'Comisión',
      sortable: true,
      align: 'right',
      sortAccessor: (row) => Number(row.comision_valor),
      render: (row) => `${Number(row.comision_valor)}%`,
    },
    {
      key: 'horarios',
      label: 'Horarios',
      sortable: true,
      align: 'center',
      // "Con horario" primero al ordenar asc.
      sortAccessor: (row) => (tieneHorarios(row) ? 0 : 1),
      // Centrado vía flex (no text-align): un svg no se centra de forma
      // confiable con textAlign en la celda.
      render: (row) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {tieneHorarios(row)
            ? <Check size={18} strokeWidth={2.25} color={theme.success} />
            : <span style={{ color: theme.mutedSoft }}>—</span>}
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      align: 'right',
      sortAccessor: (row) => (row.activo ? 0 : 1),
      render: (row) => <BadgeEstado activo={row.activo} />,
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      width: 56,
      render: (row) => (
        <BotonIconoFila
          tono="accent"
          ariaLabel={`Gestionar horario y ausencias de ${row.nombre}`}
          icono={<CalendarClock size={14} strokeWidth={1.75} />}
          onClick={(e) => { e.stopPropagation(); abrirAgenda(row); }}
        />
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Fila de acción superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          {barberos.length} barbero{barberos.length !== 1 ? 's' : ''} registrado{barberos.length !== 1 ? 's' : ''}
        </span>
        <Button variant="primary" onClick={abrirCrear} full={false}>
          <Plus size={16} strokeWidth={2} /> Nuevo barbero
        </Button>
      </div>

      {/* Tabla o empty */}
      {barberos.length === 0 ? (
        <EmptyState
          glyph={<Users size={28} strokeWidth={1.5} />}
          title="Sin barberos registrados"
          body="Creá tu primer barbero desde el botón de arriba."
        />
      ) : (
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          overflow: 'hidden',
        }}>
          <DataTable
            columns={columnas}
            rows={barberos}
            rowKey={(row) => row.id}
            onRowClick={abrirEditar}
            pageSize={6}
          />
        </div>
      )}

      {/* Modal de datos básicos */}
      {modalDatos && (
        <ModalDatosBarbero
          barbero={barberoEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarDatos}
        />
      )}

      {/* Modal de agenda (horario + ausencias) */}
      {agendaBarbero && (
        <ModalAgenda
          barbero={agendaBarbero}
          bloquesIniciales={horariosPorBarbero[agendaBarbero.id]}
          horarioLocal={horarioLocal}
          onClose={cerrarAgenda}
          onHorarioGuardado={handleHorarioGuardado}
        />
      )}
    </div>
  );
}
