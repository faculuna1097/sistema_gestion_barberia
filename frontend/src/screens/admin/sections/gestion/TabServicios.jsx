// frontend/src/screens/admin/sections/gestion/TabServicios.jsx
// ABM de servicios. Permite listar, crear y editar servicios.
// No hay eliminación — se usa el campo activo (true/false) para desactivar.
// Los datos se cargan al montar el componente.

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Modal crear / editar servicio ───────────────────────────────────────────
/**
 * ModalServicio — formulario para crear o editar un servicio.
 * @param {object|null} servicio - null = modo crear, objeto = modo editar
 * @param {function} onGuardar   - callback al guardar exitosamente
 * @param {function} onCerrar    - callback al cancelar o cerrar
 */
function ModalServicio({ servicio, onGuardar, onCerrar }) {
  const esEdicion = servicio !== null;

  const [nombre, setNombre]   = useState(servicio?.nombre  ?? '');
  const [precio, setPrecio]   = useState(servicio?.precio  ?? '');
  const [activo, setActivo]   = useState(servicio?.activo  ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]     = useState(null);

  const puedeGuardar = nombre.trim() !== '' && precio !== '' && Number(precio) >= 0;

  /**
   * handleGuardar — envía POST (crear) o PUT (editar) al backend.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);

    const body = {
      nombre: nombre.trim(),
      precio: Number(precio),
      activo,
    };

    try {
      const url = esEdicion
        ? `${API_URL}/api/gestion/servicios/${servicio.id}`
        : `${API_URL}/api/gestion/servicios`;
      const method = esEdicion ? 'PUT' : 'POST';

      console.log(`[TabServicios] ${method} servicio —`, body);

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const servicioGuardado = await res.json();
      console.log('[TabServicios] Servicio guardado:', servicioGuardado);
      onGuardar(servicioGuardado, esEdicion);
    } catch (err) {
      console.error('[TabServicios] Error al guardar servicio:', err);
      setError(err.message || 'No se pudo guardar el servicio. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>

        {/* Título */}
        <p style={styles.modalTitulo}>
          {esEdicion ? 'Editar servicio' : 'Nuevo servicio'}
        </p>

        {/* Campos */}
        <div style={styles.camposCol}>

          {/* Nombre */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Corte clásico"
              style={styles.campoInput}
              autoFocus
            />
          </div>

          {/* Precio */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Precio</label>
            <div style={styles.precioRow}>
              <span style={styles.precioSigno}>$</span>
              <input
                type="number"
                min="0"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="0"
                style={{ ...styles.campoInput, flex: 1 }}
              />
            </div>
          </div>

          {/* Activo — solo visible en modo edición */}
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

        {/* Error */}
        {error && <p style={styles.errorTexto}>{error}</p>}

        {/* Botones */}
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabServicios() {
  const [servicios, setServicios]         = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [servicioEditando, setServicioEditando] = useState(null); // null = crear

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[TabServicios] Cargando servicios...');
    fetch(`${API_URL}/api/gestion/servicios`)
      .then(r => r.json())
      .then(data => {
        console.log('[TabServicios] Servicios cargados:', data.length);
        setServicios(data);
        setCargando(false);
      })
      .catch(err => {
        console.error('[TabServicios] Error al cargar servicios:', err);
        setError('No se pudieron cargar los servicios.');
        setCargando(false);
      });
  }, []);

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    console.log('[TabServicios] Abriendo modal — modo crear');
    setServicioEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (servicio) => {
    console.log('[TabServicios] Abriendo modal — modo editar:', servicio.id);
    setServicioEditando(servicio);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setServicioEditando(null);
  };

  // ── Callback al guardar ────────────────────────────────────────────────────
  /**
   * handleGuardado — actualiza la lista local sin refetch al backend.
   * @param {object}  servicioGuardado - objeto devuelto por el backend
   * @param {boolean} esEdicion        - true = edición, false = creación
   */
  const handleGuardado = (servicioGuardado, esEdicion) => {
    if (esEdicion) {
      setServicios(prev =>
        prev.map(s => s.id === servicioGuardado.id ? servicioGuardado : s)
      );
    } else {
      setServicios(prev => [...prev, servicioGuardado]);
    }
    cerrarModal();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (cargando) return <p style={styles.estadoTexto}>Cargando servicios...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      {/* Modal */}
      {modalAbierto && (
        <ModalServicio
          servicio={servicioEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}

      {/* ── Fila superior: título + botón nuevo ── */}
      <div style={styles.filaAcciones}>
        <p style={styles.subtitulo}>
          {servicios.length} servicio{servicios.length !== 1 ? 's' : ''} registrado{servicios.length !== 1 ? 's' : ''}
        </p>
        <button style={styles.btnNuevo} onPointerDown={abrirCrear}>
          + Nuevo servicio
        </button>
      </div>

      {/* ── Tabla ── */}
      {servicios.length === 0 ? (
        <p style={styles.estadoTexto}>No hay servicios registrados todavía.</p>
      ) : (
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Precio</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.thAccion}></th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
                >
                  <td style={styles.td}>{s.nombre}</td>
                  <td style={styles.td}>
                    $ {Number(s.precio).toLocaleString('es-AR')}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      ...(s.activo ? styles.badgeActivo : styles.badgeInactivo),
                    }}>
                      {s.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={styles.tdAccion}>
                    <button
                      style={styles.btnEditar}
                      onPointerDown={() => abrirEditar(s)}
                    >
                      ✎
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  // Layout
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

  // Campos del formulario
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
  precioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  precioSigno: {
    fontSize: '18px',
    fontWeight: '300',
    color: '#555555',
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

  // Botones del modal
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
