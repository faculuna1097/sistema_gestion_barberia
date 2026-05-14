// /frontend/src/screens/admin/sections/SeccionTurnero.jsx
// Vista global de turnos del día para el admin.
//
// Layout:
//   Fila 1 — título + subtítulo
//   Fila 2 — selector de fecha (← hoy →)
//   Fila 3 — pills de barberos (estilo SeccionPlanillas) con opción "Todos"
//   Contenido — tabla de turnos, agrupada por barbero cuando se ve "Todos"
//
// Acciones por turno: cambiar estado (completado / no_asistio), cancelar.
// No recibe props — carga sus datos con useEffect.

import { useState, useEffect } from 'react';
import { getBarberos, getAdminTurnos, patchAdminTurnoEstado, cancelarAdminTurno } from '../../../services/api';
import { getFechaHoy, formatHora } from '../../../utils/fechas';
import SelectorDia from '../../../components/SelectorDia';

// Colores por estado de turno
const COLORES_ESTADO = {
  reservado:  { bg: '#e3f2fd', color: '#1565c0' },
  completado: { bg: '#e8f5e9', color: '#2e7d32' },
  no_asistio: { bg: '#fff8e1', color: '#f57f17' },
  cancelado:  { bg: '#fce4ec', color: '#c62828' },
};

// Labels legibles para el estado
const LABEL_ESTADO = {
  reservado:  'Reservado',
  completado: 'Completado',
  no_asistio: 'No asistió',
  cancelado:  'Cancelado',
};

// ─── Modal de confirmación de cancelación ────────────────────────────────────
/**
 * ModalCancelarTurno
 * Muestra los datos del turno y pide confirmación antes de cancelar.
 * @param {Object}   turno       - turno a cancelar
 * @param {function} onConfirmar - callback al confirmar
 * @param {function} onCerrar    - callback al cancelar/cerrar
 * @param {boolean}  cancelando  - true mientras se procesa la cancelación
 */
function ModalCancelarTurno({ turno, onConfirmar, onCerrar, cancelando }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Cancelar este turno?</p>
        <p style={styles.modalAdvertencia}>Se notificará al cliente por email si tiene uno registrado.</p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Hora</span>
            <span style={styles.modalValor}>{formatHora(turno.inicio)}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Cliente</span>
            <span style={styles.modalValor}>{turno.cliente_nombre}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Servicio</span>
            <span style={styles.modalValor}>{turno.servicio_nombre}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Barbero</span>
            <span style={styles.modalValor}>{turno.barbero_nombre}</span>
          </div>
        </div>

        <div style={styles.modalBotones}>
          <button style={styles.btnModalCancelar} onPointerDown={onCerrar} disabled={cancelando}>
            Volver
          </button>
          <button style={styles.btnModalConfirmar} onPointerDown={onConfirmar} disabled={cancelando}>
            {cancelando ? 'Cancelando...' : 'Sí, cancelar turno'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function SeccionTurnero() {
  const [fecha, setFecha]               = useState(getFechaHoy);
  const [barberos, setBarberos]         = useState([]);
  const [barberoActivo, setBarberoActivo] = useState(null); // null = "Todos"
  const [turnos, setTurnos]             = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [accionando, setAccionando]     = useState(null);
  const [turnoACancelar, setTurnoACancelar] = useState(null);

  // ── Carga de barberos (una sola vez) ──────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      console.log('[seccionTurnero] cargarBarberos — request recibido');
      try {
        const data = await getBarberos();
        console.log('[seccionTurnero] cargarBarberos — completado |', data.length, 'barberos');
        setBarberos(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarBarberos:', err.message);
      }
    };
    cargar();
  }, []);

  // ── Carga de turnos (cada vez que cambia fecha o barbero) ─────────────────
  useEffect(() => {
    const cargar = async () => {
      console.log('[seccionTurnero] cargarTurnos — request recibido | fecha:', fecha, '| barbero:', barberoActivo ?? 'todos');
      setCargando(true);
      setError(null);
      try {
        const data = await getAdminTurnos(fecha, barberoActivo);
        console.log('[seccionTurnero] cargarTurnos — completado |', data.length, 'turnos');
        setTurnos(data);
      } catch (err) {
        console.error('[seccionTurnero] Error en cargarTurnos:', err.message);
        setError('No se pudieron cargar los turnos.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [fecha, barberoActivo]);

  // ── Acciones sobre turnos ─────────────────────────────────────────────────

  /**
   * cambiarEstado
   * Cambia el estado de un turno y actualiza la lista local.
   * @param {string} turnoId
   * @param {string} nuevoEstado - 'completado' | 'no_asistio'
   */
  const cambiarEstado = async (turnoId, nuevoEstado) => {
    setAccionando(turnoId);
    try {
      const actualizado = await patchAdminTurnoEstado(turnoId, nuevoEstado);
      setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, estado: actualizado.estado } : t));
      console.log('[seccionTurnero] cambiarEstado — completado | turno:', turnoId, '→', nuevoEstado);
    } catch (err) {
      console.error('[seccionTurnero] Error en cambiarEstado:', err.message);
      alert('Error al cambiar estado: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  /**
   * confirmarCancelacion
   * Ejecuta la cancelación del turno seleccionado en el modal.
   */
  const confirmarCancelacion = async () => {
    const turnoId = turnoACancelar.id;
    setAccionando(turnoId);
    try {
      await cancelarAdminTurno(turnoId);
      setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, estado: 'cancelado' } : t));
      console.log('[seccionTurnero] confirmarCancelacion — completado | turno:', turnoId);
      setTurnoACancelar(null);
    } catch (err) {
      console.error('[seccionTurnero] Error en confirmarCancelacion:', err.message);
      alert('Error al cancelar turno: ' + err.message);
    } finally {
      setAccionando(null);
    }
  };

  // ── Agrupar turnos por barbero (para vista "Todos") ───────────────────────
  /**
   * agruparPorBarbero
   * Agrupa un array de turnos por barbero_id.
   * @param {Array} lista
   * @returns {Array<{ barbero_id, barbero_nombre, turnos[] }>}
   */
  const agruparPorBarbero = (lista) => {
    const mapa = new Map();
    for (const t of lista) {
      if (!mapa.has(t.barbero_id)) {
        mapa.set(t.barbero_id, { barbero_id: t.barbero_id, barbero_nombre: t.barbero_nombre, turnos: [] });
      }
      mapa.get(t.barbero_id).turnos.push(t);
    }
    return Array.from(mapa.values());
  };

  // Turnos filtrados que no estén cancelados en la vista activa
  const turnosVisibles = turnos;
  const grupos = barberoActivo === null ? agruparPorBarbero(turnosVisibles) : null;

  // ── Render de una fila de turno ───────────────────────────────────────────
  /**
   * renderFilaTurno
   * Renderiza una fila <tr> para un turno individual.
   * @param {Object} turno
   * @param {boolean} mostrarBarbero - true cuando se ve un barbero individual
   *                                   (no se muestra columna barbero en agrupado)
   */
  const renderFilaTurno = (turno, mostrarBarbero = false) => {
    const estadoInfo = COLORES_ESTADO[turno.estado] || COLORES_ESTADO.reservado;
    const deshabilitado = accionando === turno.id;
    const esActivo = turno.estado === 'reservado';

    return (
      <tr key={turno.id}>
        <td style={styles.td}>{formatHora(turno.inicio)}</td>
        {mostrarBarbero && <td style={styles.td}>{turno.barbero_nombre}</td>}
        <td style={styles.td}>{turno.cliente_nombre}</td>
        <td style={styles.td}>{turno.servicio_nombre}</td>
        <td style={styles.td}>
          <span style={{ ...styles.badge, backgroundColor: estadoInfo.bg, color: estadoInfo.color }}>
            {LABEL_ESTADO[turno.estado] || turno.estado}
          </span>
        </td>
        <td style={styles.tdAcciones}>
          {esActivo && (
            <div style={styles.accionesRow}>
              <button
                style={styles.btnCompletado}
                onPointerDown={() => cambiarEstado(turno.id, 'completado')}
                disabled={deshabilitado}
                title="Marcar como completado"
              >
                ✓
              </button>
              <button
                style={styles.btnNoAsistio}
                onPointerDown={() => cambiarEstado(turno.id, 'no_asistio')}
                disabled={deshabilitado}
                title="Marcar como no asistió"
              >
                ✗
              </button>
              <button
                style={styles.btnCancelarTurno}
                onPointerDown={() => setTurnoACancelar(turno)}
                disabled={deshabilitado}
                title="Cancelar turno"
              >
                🗑
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <div style={styles.contenedor}>

      {/* ── Modal de cancelación ── */}
      {turnoACancelar && (
        <ModalCancelarTurno
          turno={turnoACancelar}
          onConfirmar={confirmarCancelacion}
          onCerrar={() => setTurnoACancelar(null)}
          cancelando={accionando === turnoACancelar.id}
        />
      )}

      {/* ── FILA 1: título ──────────────────────────────────────────────── */}
      <div style={styles.fila1}>
        <div>
          <h2 style={styles.titulo}>Turnero</h2>
          <p style={styles.subtitulo}>Vista global de turnos del día</p>
        </div>
      </div>

      {/* ── FILA 2: selector de fecha ───────────────────────────────────── */}
      <div style={styles.filaFecha}>
        <SelectorDia value={fecha} onChange={setFecha} permitirFuturo />
      </div>

      {/* ── FILA 3: pills de barberos ───────────────────────────────────── */}
      {barberos.length > 0 && (
        <div style={styles.filaBarberos}>
          <div style={styles.tabsContainer}>
            <button
              style={{ ...styles.tabBtn, ...(barberoActivo === null ? styles.tabBtnActivo : {}) }}
              onPointerDown={() => setBarberoActivo(null)}
            >
              Todos
            </button>
            {barberos.map((b) => (
              <button
                key={b.id}
                style={{ ...styles.tabBtn, ...(barberoActivo === b.id ? styles.tabBtnActivo : {}) }}
                onPointerDown={() => setBarberoActivo(b.id)}
              >
                {b.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTENIDO ───────────────────────────────────────────────────── */}
      <div style={styles.contenido}>
        {cargando && <p style={styles.estadoTexto}>Cargando turnos...</p>}
        {!cargando && error && <p style={styles.errorTexto}>{error}</p>}

        {!cargando && !error && turnosVisibles.length === 0 && (
          <p style={styles.estadoTexto}>No hay turnos para este día.</p>
        )}

        {/* ── Vista con barbero seleccionado (tabla plana) ── */}
        {!cargando && !error && turnosVisibles.length > 0 && barberoActivo !== null && (
          <div style={styles.bloque}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Hora</th>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Servicio</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.thAcciones}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {turnosVisibles.map(t => renderFilaTurno(t, false))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Vista "Todos" (agrupado por barbero) ── */}
        {!cargando && !error && turnosVisibles.length > 0 && barberoActivo === null && (
          grupos.map(grupo => (
            <div key={grupo.barbero_id} style={styles.bloque}>
              <div style={styles.grupoHeader}>
                <span style={styles.grupoNombre}>{grupo.barbero_nombre}</span>
                <span style={styles.grupoCantidad}>
                  {grupo.turnos.length} turno{grupo.turnos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <table style={styles.tabla}>
                <thead>
                  <tr>
                    <th style={styles.th}>Hora</th>
                    <th style={styles.th}>Cliente</th>
                    <th style={styles.th}>Servicio</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.thAcciones}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.turnos.map(t => renderFilaTurno(t, false))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    padding: '36px 40px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    color: '#111111',
  },

  // ── Fila 1: título ──────────────────────────────────────────────────────
  fila1: {
    marginBottom: '20px',
  },
  titulo: {
    fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px', color: '#888', margin: 0,
  },

  // ── Fila 2: selector de fecha ───────────────────────────────────────────
  filaFecha: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },

  // ── Fila 3: pills de barberos ───────────────────────────────────────────
  filaBarberos: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  },
  tabsContainer: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    padding: '4px',
  },
  tabBtn: {
    padding: '8px 20px',
    borderRadius: '9px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  tabBtnActivo: {
    backgroundColor: '#ffffff',
    color: '#111111',
    fontWeight: '600',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  },

  // ── Contenido ───────────────────────────────────────────────────────────
  contenido: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  // ── Bloque (tabla envuelta en card) ─────────────────────────────────────
  bloque: {
    backgroundColor: '#ffffff',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    overflow: 'hidden',
  },

  // ── Header de grupo (vista "Todos") ─────────────────────────────────────
  grupoHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
  },
  grupoNombre: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#333',
  },
  grupoCantidad: {
    fontSize: '13px',
    color: '#888',
    fontWeight: '500',
  },

  // ── Tabla ───────────────────────────────────────────────────────────────
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'left',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
  },
  thAcciones: {
    padding: '12px 20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'center',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '14px 20px',
    fontSize: '14px',
    color: '#333333',
    borderBottom: '1px solid #f7f7f7',
  },
  tdAcciones: {
    padding: '10px 20px',
    textAlign: 'center',
    borderBottom: '1px solid #f7f7f7',
  },

  // ── Badge de estado ─────────────────────────────────────────────────────
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },

  // ── Botones de acción ───────────────────────────────────────────────────
  accionesRow: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
  },
  btnCompletado: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: '1.5px solid #c8e6c9',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnNoAsistio: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: '1.5px solid #ffe0b2',
    backgroundColor: '#fff8e1',
    color: '#f57f17',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnCancelarTurno: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: '1.5px solid #f0f0f0',
    backgroundColor: '#ffffff',
    color: '#999',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // ── Modal de cancelación ─────────────────────────────────────────────────
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: '0 0 6px', textAlign: 'center',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: '0 0 24px',
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel:   { fontSize: '13px', color: '#888888' },
  modalValor:   { fontSize: '14px', color: '#111111', fontWeight: '600' },
  modalDivider: { height: '1px', backgroundColor: '#eeeeee' },
  modalBotones: { display: 'flex', gap: '12px' },
  btnModalCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnModalConfirmar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── Estados ─────────────────────────────────────────────────────────────
  estadoTexto: {
    textAlign: 'center',
    color: '#999999',
    fontSize: '15px',
    padding: '40px 0',
    margin: 0,
  },
  errorTexto: {
    textAlign: 'center',
    color: '#c0392b',
    fontSize: '14px',
    padding: '20px 0',
    margin: 0,
  },
};
