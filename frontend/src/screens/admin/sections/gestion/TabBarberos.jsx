// /frontend/src/screens/admin/sections/gestion/TabBarberos.jsx
// ABM de barberos con filas expandibles para horarios y suspensiones.
// Comisión siempre en porcentaje (0-100).
// PIN: requerido al crear, opcional al editar (vacío = no cambia).
// No hay eliminación — se usa activo (true/false) para desactivar.

import { useState, useEffect } from 'react';
import {
  apiFetch,
  getAdminHorarios,
  putAdminHorarios,
  getAdminSuspensiones,
  crearAdminSuspension,
  eliminarAdminSuspension,
} from '../../../../services/api';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ─── Modal crear / editar barbero ─────────────────────────────────────────────
/**
 * ModalBarbero — formulario para crear o editar un barbero.
 * @param {object|null} barbero   - null = modo crear, objeto = modo editar
 * @param {function}    onGuardar - callback al guardar exitosamente
 * @param {function}    onCerrar  - callback al cancelar o cerrar
 */
function ModalBarbero({ barbero, onGuardar, onCerrar }) {
  const esEdicion = barbero !== null;

  const [nombre, setNombre]       = useState(barbero?.nombre         ?? '');
  const [pin, setPin]             = useState('');
  const [comision, setComision]   = useState(barbero?.comision_valor ?? '');
  const [activo, setActivo]       = useState(barbero?.activo         ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  const pinValido    = pin === '' || (pin.length === 4 && /^\d{4}$/.test(pin));
  const pinRequerido = !esEdicion && pin.length !== 4;

  const puedeGuardar =
    nombre.trim() !== ''    &&
    comision !== ''         &&
    Number(comision) >= 0   &&
    Number(comision) <= 100 &&
    pinValido               &&
    !pinRequerido;

  /**
   * handleGuardar — envía POST (crear) o PUT (editar) al backend.
   * En edición, solo incluye pin en el body si el campo no está vacío.
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
      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
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
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>

        <p style={styles.modalTitulo}>
          {esEdicion ? 'Editar barbero' : 'Nuevo barbero'}
        </p>

        <div style={styles.camposCol}>

          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Martín"
              style={styles.campoInput}
              autoFocus
            />
          </div>

          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>
              PIN {esEdicion ? '(dejá vacío para no cambiar)' : ''}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
              }}
              placeholder="4 dígitos"
              style={{
                ...styles.campoInput,
                letterSpacing: pin.length > 0 ? '0.4em' : '0',
                borderColor: pin !== '' && !pinValido ? '#c0392b' : '#e0e0e0',
              }}
            />
            {pin !== '' && !pinValido && (
              <p style={styles.campoError}>El PIN debe tener exactamente 4 dígitos.</p>
            )}
            {!esEdicion && pin === '' && (
              <p style={styles.campoHint}>Requerido para crear un barbero.</p>
            )}
          </div>

          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Comisión</label>
            <div style={styles.comisionRow}>
              <input
                type="number"
                min="0"
                max="100"
                value={comision}
                onChange={e => setComision(e.target.value)}
                placeholder="0"
                style={{ ...styles.campoInput, flex: 1 }}
              />
              <span style={styles.comisionSufijo}>%</span>
            </div>
            {comision !== '' && (Number(comision) < 0 || Number(comision) > 100) && (
              <p style={styles.campoError}>La comisión debe estar entre 0 y 100.</p>
            )}
          </div>

          {esEdicion && (
            <div style={styles.activoRow}>
              <span style={styles.campoLabel}>Estado</span>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(activo ? styles.toggleActivo : styles.toggleInactivo),
                }}
                onPointerDown={() => setActivo(prev => !prev)}
              >
                {activo ? '✓  Activo' : '✕  Inactivo'}
              </button>
            </div>
          )}

        </div>

        {error && <p style={styles.errorTextoModal}>{error}</p>}

        <div style={styles.modalBotones}>
          <button
            style={styles.btnCancelar}
            onPointerDown={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            style={{
              ...styles.btnGuardar,
              ...(!puedeGuardar || guardando ? styles.btnDeshabilitado : {}),
            }}
            onPointerDown={handleGuardar}
            disabled={!puedeGuardar || guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Panel expandido: Horarios ───────────────────────────────────────────────
/**
 * PanelHorarios — editor del horario semanal de un barbero.
 * @param {object} barbero - { id, nombre }
 */
function PanelHorarios({ barbero }) {
  const [bloques, setBloques]     = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje]     = useState(null);

  useEffect(() => {
    setCargando(true);
    async function cargar() {
      try {
        const data = await getAdminHorarios(barbero.id);
        setBloques(data);
      } catch (err) {
        console.error('[tabBarberos/Horarios] Error cargando:', err.message);
        setMensaje('Error al cargar horarios');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [barbero.id]);

  /**
   * agregarBloque — agrega un bloque vacío para un día.
   * @param {number} dia - 0-6
   */
  const agregarBloque = (dia) => {
    setBloques(prev => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '18:00' }]);
    setMensaje(null);
  };

  /**
   * actualizarBloque — actualiza un campo de un bloque existente.
   * @param {number} index
   * @param {string} campo
   * @param {string} valor
   */
  const actualizarBloque = (index, campo, valor) => {
    setBloques(prev => prev.map((b, i) => i === index ? { ...b, [campo]: valor } : b));
    setMensaje(null);
  };

  /**
   * eliminarBloque — elimina un bloque del array local.
   * @param {number} index
   */
  const eliminarBloque = (index) => {
    setBloques(prev => prev.filter((_, i) => i !== index));
    setMensaje(null);
  };

  /**
   * guardar — envía el horario completo al backend (PUT reemplaza todo).
   */
  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const payload = bloques.map(({ dia_semana, hora_inicio, hora_fin }) => ({
        dia_semana,
        hora_inicio,
        hora_fin,
      }));
      const resultado = await putAdminHorarios(barbero.id, payload);
      setBloques(resultado);
      setMensaje('Horarios guardados correctamente');
    } catch (err) {
      console.error('[tabBarberos/Horarios] Error guardando:', err.message);
      setMensaje('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p style={styles.panelCargando}>Cargando horarios...</p>;

  return (
    <div>
      {mensaje && (
        <p style={{
          ...styles.panelMensaje,
          color: mensaje.startsWith('Error') ? '#c0392b' : '#2e7d32',
        }}>
          {mensaje}
        </p>
      )}

      {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
        const bloquesDelDia = bloques
          .map((b, i) => ({ ...b, _index: i }))
          .filter(b => b.dia_semana === dia);

        return (
          <div key={dia} style={styles.diaRow}>
            <div style={styles.diaHeader}>
              <span style={styles.diaNombre}>{DIAS_SEMANA[dia]}</span>
              {bloquesDelDia.length === 0 && (
                <span style={styles.sinHorario}>Sin horario</span>
              )}
            </div>
            {bloquesDelDia.map((bloque) => (
              <div key={bloque._index} style={styles.bloqueRow}>
                <input
                  type="time"
                  value={bloque.hora_inicio}
                  onChange={(e) => actualizarBloque(bloque._index, 'hora_inicio', e.target.value)}
                  style={styles.inputTime}
                />
                <span style={styles.bloqueA}>a</span>
                <input
                  type="time"
                  value={bloque.hora_fin}
                  onChange={(e) => actualizarBloque(bloque._index, 'hora_fin', e.target.value)}
                  style={styles.inputTime}
                />
                <button
                  onPointerDown={() => eliminarBloque(bloque._index)}
                  style={styles.btnEliminarBloque}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onPointerDown={() => agregarBloque(dia)}
              style={styles.btnAgregarBloque}
            >
              + Agregar bloque
            </button>
          </div>
        );
      })}

      <button
        onPointerDown={guardar}
        disabled={guardando}
        style={{
          ...styles.btnGuardarHorarios,
          ...(guardando ? styles.btnDeshabilitado : {}),
        }}
      >
        {guardando ? 'Guardando...' : 'Guardar horarios'}
      </button>
    </div>
  );
}

// ─── Panel expandido: Suspensiones ───────────────────────────────────────────
/**
 * PanelSuspensiones — lista, crea y elimina suspensiones de un barbero.
 * @param {object} barbero - { id, nombre }
 */
function PanelSuspensiones({ barbero }) {
  const [suspensiones, setSuspensiones] = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [eliminando, setEliminando]     = useState(null);

  const [formDesde, setFormDesde]   = useState('');
  const [formHasta, setFormHasta]   = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [creando, setCreando]       = useState(false);
  const [conflicto, setConflicto]   = useState(null);
  const [mensaje, setMensaje]       = useState(null);

  /**
   * cargarSuspensiones — fetch de suspensiones futuras del barbero.
   */
  const cargarSuspensiones = async () => {
    try {
      const data = await getAdminSuspensiones(barbero.id);
      setSuspensiones(data);
    } catch (err) {
      console.error('[tabBarberos/Suspensiones] Error cargando:', err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSuspensiones();
  }, [barbero.id]);

  /**
   * crear — crea una nueva suspensión. Maneja el flujo de conflicto 409.
   * @param {boolean} confirmarCancelacion - true para forzar tras conflicto
   */
  const crear = async (confirmarCancelacion = false) => {
    if (!formDesde || !formHasta) return;
    setCreando(true);
    setMensaje(null);
    try {
      const datos = {
        barbero_id: barbero.id,
        desde: formDesde,
        hasta: formHasta,
        ...(formMotivo.trim() ? { motivo: formMotivo.trim() } : {}),
        ...(confirmarCancelacion ? { confirmar_cancelacion: true } : {}),
      };
      const res = await crearAdminSuspension(datos);

      if (res.conflicto) {
        setConflicto(res);
        setCreando(false);
        return;
      }

      setMensaje(`Suspensión creada. ${res.turnos_cancelados || 0} turnos cancelados.`);
      setConflicto(null);
      setFormDesde('');
      setFormHasta('');
      setFormMotivo('');
      await cargarSuspensiones();
    } catch (err) {
      console.error('[tabBarberos/Suspensiones] Error creando:', err.message);
      setMensaje('Error: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  /**
   * eliminar — elimina una suspensión por su id.
   * @param {string} id
   */
  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta suspensión?')) return;
    setEliminando(id);
    try {
      await eliminarAdminSuspension(id);
      await cargarSuspensiones();
    } catch (err) {
      console.error('[tabBarberos/Suspensiones] Error eliminando:', err.message);
      setMensaje('Error: ' + err.message);
    } finally {
      setEliminando(null);
    }
  };

  /**
   * formatearFechaHora — formatea un ISO a formato legible argentino.
   * @param {string} iso
   * @returns {string}
   */
  const formatearFechaHora = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (cargando) return <p style={styles.panelCargando}>Cargando suspensiones...</p>;

  return (
    <div>
      {/* Formulario de nueva suspensión */}
      <div style={styles.formSuspension}>
        <p style={styles.formTitulo}>Nueva suspensión</p>

        <div style={styles.formRow}>
          <div style={styles.formCampo}>
            <label style={styles.campoLabel}>Desde</label>
            <input
              type="datetime-local"
              value={formDesde}
              onChange={(e) => setFormDesde(e.target.value)}
              style={styles.campoInput}
            />
          </div>
          <div style={styles.formCampo}>
            <label style={styles.campoLabel}>Hasta</label>
            <input
              type="datetime-local"
              value={formHasta}
              onChange={(e) => setFormHasta(e.target.value)}
              style={styles.campoInput}
            />
          </div>
        </div>

        <div style={styles.formCampo}>
          <label style={styles.campoLabel}>Motivo (opcional)</label>
          <input
            type="text"
            value={formMotivo}
            onChange={(e) => setFormMotivo(e.target.value)}
            placeholder="Ej: Vacaciones, turno médico..."
            style={styles.campoInput}
          />
        </div>

        {/* Conflicto: turnos afectados */}
        {conflicto && (
          <div style={styles.conflictoBox}>
            <p style={styles.conflictoTitulo}>
              Hay {conflicto.turnos_afectados?.length || 0} turno{(conflicto.turnos_afectados?.length || 0) !== 1 ? 's' : ''} que será{(conflicto.turnos_afectados?.length || 0) !== 1 ? 'n' : ''} cancelado{(conflicto.turnos_afectados?.length || 0) !== 1 ? 's' : ''}:
            </p>
            <ul style={styles.conflictoLista}>
              {conflicto.turnos_afectados?.map((t, i) => (
                <li key={i}>{formatearFechaHora(t.inicio)} — {t.cliente_nombre || 'Sin nombre'}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onPointerDown={() => crear(true)}
                disabled={creando}
                style={styles.btnConfirmarConflicto}
              >
                {creando ? 'Creando...' : 'Confirmar y crear'}
              </button>
              <button
                onPointerDown={() => setConflicto(null)}
                style={styles.btnCancelarConflicto}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!conflicto && (
          <button
            onPointerDown={() => crear(false)}
            disabled={creando || !formDesde || !formHasta}
            style={{
              ...styles.btnCrearSuspension,
              ...(creando || !formDesde || !formHasta ? styles.btnDeshabilitado : {}),
            }}
          >
            {creando ? 'Creando...' : 'Crear suspensión'}
          </button>
        )}

        {mensaje && (
          <p style={{
            ...styles.panelMensaje,
            color: mensaje.startsWith('Error') ? '#c0392b' : '#2e7d32',
          }}>
            {mensaje}
          </p>
        )}
      </div>

      {/* Lista de suspensiones */}
      {suspensiones.length === 0 ? (
        <p style={styles.sinSuspensiones}>No hay suspensiones programadas.</p>
      ) : (
        <div style={styles.suspensionesLista}>
          {suspensiones.map((s) => (
            <div key={s.id} style={styles.suspensionItem}>
              <div style={styles.suspensionInfo}>
                <span style={styles.suspensionFechas}>
                  {formatearFechaHora(s.desde)} — {formatearFechaHora(s.hasta)}
                </span>
                {s.motivo && <span style={styles.suspensionMotivo}>{s.motivo}</span>}
                <span style={styles.suspensionOrigen}>Origen: {s.origen}</span>
              </div>
              <button
                onPointerDown={() => eliminar(s.id)}
                disabled={eliminando === s.id}
                style={styles.btnEliminarSuspension}
              >
                {eliminando === s.id ? '...' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabBarberos() {
  const [barberos, setBarberos]               = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [error, setError]                     = useState(null);
  const [modalAbierto, setModalAbierto]       = useState(false);
  const [barberoEditando, setBarberoEditando] = useState(null);
  const [expandido, setExpandido]             = useState(null);
  const [subTab, setSubTab]                   = useState('horarios');

  useEffect(() => {
    const cargarBarberos = async () => {
      try {
        const res  = await apiFetch('/admin/barberos');
        const data = await res.json();
        setBarberos(data);
      } catch (err) {
        console.error('[tabBarberos] Error en cargarBarberos:', err.message);
        setError('No se pudieron cargar los barberos.');
      } finally {
        setCargando(false);
      }
    };
    cargarBarberos();
  }, []);

  const abrirCrear  = ()        => { setBarberoEditando(null);    setModalAbierto(true); };
  const abrirEditar = (barbero) => { setBarberoEditando(barbero); setModalAbierto(true); };
  const cerrarModal = ()        => { setModalAbierto(false); setBarberoEditando(null); };

  /**
   * handleGuardado — actualiza la lista local sin refetch.
   * @param {object}  barberoGuardado - objeto devuelto por el backend
   * @param {boolean} esEdicion       - true = edición, false = creación
   */
  const handleGuardado = (barberoGuardado, esEdicion) => {
    if (esEdicion) {
      setBarberos(prev => prev.map(b => b.id === barberoGuardado.id ? barberoGuardado : b));
    } else {
      setBarberos(prev => [...prev, barberoGuardado]);
    }
    cerrarModal();
  };

  /**
   * toggleExpandir — expande o colapsa la fila de un barbero.
   * @param {string} barberoId
   */
  const toggleExpandir = (barberoId) => {
    if (expandido === barberoId) {
      setExpandido(null);
    } else {
      setExpandido(barberoId);
      setSubTab('horarios');
    }
  };

  if (cargando) return <p style={styles.estadoTexto}>Cargando barberos...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      {modalAbierto && (
        <ModalBarbero
          barbero={barberoEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}

      {/* Fila superior */}
      <div style={styles.filaAcciones}>
        <p style={styles.subtitulo}>
          {barberos.length} barbero{barberos.length !== 1 ? 's' : ''} registrado{barberos.length !== 1 ? 's' : ''}
        </p>
        <button style={styles.btnNuevo} onPointerDown={abrirCrear}>
          + Nuevo barbero
        </button>
      </div>

      {/* Tabla */}
      {barberos.length === 0 ? (
        <p style={styles.estadoTexto}>No hay barberos registrados todavía.</p>
      ) : (
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '48px' }}></th>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Comisión</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.thAccion}></th>
              </tr>
            </thead>
            <tbody>
              {barberos.map((b, i) => {
                const estaExpandido = expandido === b.id;
                return [
                  /* Fila normal */
                  <tr
                    key={b.id}
                    style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
                  >
                    <td style={styles.td}>
                      <button
                        style={styles.btnExpandir}
                        onPointerDown={() => toggleExpandir(b.id)}
                      >
                        {estaExpandido ? '▾' : '▸'}
                      </button>
                    </td>
                    <td style={styles.td}>{b.nombre}</td>
                    <td style={styles.td}>{Number(b.comision_valor)}%</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        ...(b.activo ? styles.badgeActivo : styles.badgeInactivo),
                      }}>
                        {b.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={styles.tdAccion}>
                      <button
                        style={styles.btnEditar}
                        onPointerDown={() => abrirEditar(b)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>,

                  /* Fila expandida (panel de horarios/suspensiones) */
                  estaExpandido && (
                    <tr key={`${b.id}-panel`}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div style={styles.panelExpandido}>
                          <div style={styles.subTabsContainer}>
                            <button
                              style={{
                                ...styles.subTabBtn,
                                ...(subTab === 'horarios' ? styles.subTabBtnActivo : {}),
                              }}
                              onPointerDown={() => setSubTab('horarios')}
                            >
                              Horarios
                            </button>
                            <button
                              style={{
                                ...styles.subTabBtn,
                                ...(subTab === 'suspensiones' ? styles.subTabBtnActivo : {}),
                              }}
                              onPointerDown={() => setSubTab('suspensiones')}
                            >
                              Suspensiones
                            </button>
                          </div>

                          {subTab === 'horarios' && <PanelHorarios barbero={b} />}
                          {subTab === 'suspensiones' && <PanelSuspensiones barbero={b} />}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  filaAcciones: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  subtitulo: {
    margin: 0,
    fontSize: '14px',
    color: '#888888',
  },
  btnNuevo: {
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Tabla
  tablaWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1.5px solid #eeeeee',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '13px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    borderBottom: '1.5px solid #eeeeee',
    backgroundColor: '#fafafa',
  },
  thAccion: {
    padding: '13px 16px',
    width: '48px',
    borderBottom: '1.5px solid #eeeeee',
    backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px',
    color: '#333333',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '14px',
  },
  tdAccion: {
    padding: '8px 12px',
    textAlign: 'center',
    borderBottom: '1px solid #f0f0f0',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  badgeActivo: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  badgeInactivo: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },
  btnEditar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Botón expandir
  btnExpandir: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Panel expandido
  panelExpandido: {
    padding: '16px 24px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e0e0e0',
  },
  subTabsContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    backgroundColor: '#eeeeee',
    borderRadius: '8px',
    padding: '3px',
    width: 'fit-content',
  },
  subTabBtn: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  subTabBtnActivo: {
    backgroundColor: '#ffffff',
    color: '#111111',
    fontWeight: '600',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },

  // Panel: estados
  panelCargando: {
    color: '#888888',
    fontSize: '14px',
    padding: '16px 0',
    margin: 0,
  },
  panelMensaje: {
    fontSize: '13px',
    margin: '8px 0 0',
  },

  // Horarios: días
  diaRow: {
    marginBottom: '8px',
    padding: '10px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #eeeeee',
  },
  diaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  diaNombre: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333333',
    minWidth: '80px',
  },
  sinHorario: {
    fontSize: '13px',
    color: '#aaaaaa',
  },
  bloqueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
    marginLeft: '88px',
  },
  bloqueA: {
    fontSize: '13px',
    color: '#888888',
  },
  inputTime: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1.5px solid #e0e0e0',
    fontSize: '14px',
    fontFamily: "'DM Sans', Arial, sans-serif",
    color: '#333333',
  },
  btnEliminarBloque: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#c0392b',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAgregarBloque: {
    marginTop: '6px',
    marginLeft: '88px',
    padding: '4px 12px',
    borderRadius: '6px',
    border: '1px dashed #cccccc',
    backgroundColor: 'transparent',
    color: '#1a7a4a',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnGuardarHorarios: {
    marginTop: '12px',
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Suspensiones: formulario
  formSuspension: {
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #eeeeee',
    marginBottom: '16px',
  },
  formTitulo: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#333333',
    margin: '0 0 12px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  formCampo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: '200px',
    marginBottom: '8px',
  },
  btnCrearSuspension: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Suspensiones: conflicto
  conflictoBox: {
    padding: '12px',
    backgroundColor: '#fff9e6',
    border: '1px solid #f4b400',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  conflictoTitulo: {
    margin: '0 0 8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#8a6d00',
  },
  conflictoLista: {
    margin: '0 0 8px',
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#555555',
  },
  btnConfirmarConflicto: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#c0392b',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnCancelarConflicto: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Suspensiones: lista
  sinSuspensiones: {
    color: '#888888',
    fontSize: '14px',
    margin: 0,
  },
  suspensionesLista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  suspensionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #eeeeee',
  },
  suspensionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  suspensionFechas: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333333',
  },
  suspensionMotivo: {
    fontSize: '13px',
    color: '#666666',
  },
  suspensionOrigen: {
    fontSize: '12px',
    color: '#aaaaaa',
  },
  btnEliminarSuspension: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#c0392b',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Estados
  estadoTexto: {
    textAlign: 'center',
    color: '#888888',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },
  errorTexto: {
    textAlign: 'center',
    color: '#c0392b',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '32px',
    width: '420px',
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111111',
    margin: '0 0 24px',
    textAlign: 'center',
  },

  // Campos
  camposCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  campoGrupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  campoLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  campoInput: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
  },
  campoHint: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: 0,
  },
  campoError: {
    fontSize: '12px',
    color: '#c0392b',
    margin: 0,
  },

  // Comisión
  comisionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  comisionSufijo: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#555555',
    minWidth: '20px',
  },

  // Toggle activo/inactivo
  activoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    padding: '8px 20px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  toggleActivo: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  toggleInactivo: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },

  // Error en modal
  errorTextoModal: {
    color: '#c0392b',
    fontSize: '13px',
    textAlign: 'center',
    margin: '-8px 0 8px',
  },

  // Botones modal
  modalBotones: {
    display: 'flex',
    gap: '12px',
  },
  btnCancelar: {
    flex: 1,
    padding: '13px 0',
    borderRadius: '12px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#444444',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGuardar: {
    flex: 1,
    padding: '13px 0',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
