// frontend/src/screens/admin/sections/gestion/TabBarberos.jsx
// ABM de barberos. Permite listar, crear y editar barberos.
// Comisión siempre en porcentaje (0-100).
// PIN: requerido al crear, opcional al editar (vacío = no cambia).
// No hay eliminación — se usa activo (true/false) para desactivar.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../../services/api';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Modal crear / editar barbero ─────────────────────────────────────────────
/**
 * ModalBarbero — formulario para crear o editar un barbero.
 * @param {object|null} barbero  - null = modo crear, objeto = modo editar
 * @param {function}    onGuardar - callback al guardar exitosamente
 * @param {function}    onCerrar  - callback al cancelar o cerrar
 */
function ModalBarbero({ barbero, onGuardar, onCerrar }) {
  const esEdicion = barbero !== null;

  const [nombre, setNombre]       = useState(barbero?.nombre          ?? '');
  const [pin, setPin]             = useState('');
  const [comision, setComision]   = useState(barbero?.comision_valor  ?? '');
  const [activo, setActivo]       = useState(barbero?.activo          ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  // ── Validaciones ────────────────────────────────────────────────────────
  const pinValido = pin === '' || (pin.length === 4 && /^\d{4}$/.test(pin));
  const pinRequerido = !esEdicion && pin.length !== 4;

  const puedeGuardar =
    nombre.trim() !== ''        &&
    comision !== ''             &&
    Number(comision) >= 0       &&
    Number(comision) <= 100     &&
    pinValido                   &&
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

    // PIN: siempre requerido al crear; en edición solo si se completó
    if (pin !== '') body.pin = pin;

    try {
      const url    = esEdicion
        ? `${API_URL}/api/gestion/barberos/${barbero.id}`
        : `${API_URL}/api/gestion/barberos`;
      const method = esEdicion ? 'PUT' : 'POST';

      // NUNCA loguear el PIN
      console.log(`[TabBarberos] ${method} barbero —`, { ...body, pin: body.pin ? '***' : undefined });

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const barberoGuardado = await res.json();
      console.log('[TabBarberos] Barbero guardado:', barberoGuardado.id, barberoGuardado.nombre);
      onGuardar(barberoGuardado, esEdicion);
    } catch (err) {
      console.error('[TabBarberos] Error al guardar barbero:', err);
      setError(err.message || 'No se pudo guardar el barbero. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>

        {/* Título */}
        <p style={styles.modalTitulo}>
          {esEdicion ? 'Editar barbero' : 'Nuevo barbero'}
        </p>

        <div style={styles.camposCol}>

          {/* Nombre */}
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

          {/* PIN */}
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
                // Solo permite dígitos
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

          {/* Comisión */}
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

          {/* Activo — solo en edición */}
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

        {/* Error general */}
        {error && <p style={styles.errorTextoModal}>{error}</p>}

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
export default function TabBarberos() {
  const [barberos, setBarberos]             = useState([]);
  const [cargando, setCargando]             = useState(true);
  const [error, setError]                   = useState(null);
  const [modalAbierto, setModalAbierto]     = useState(false);
  const [barberoEditando, setBarberoEditando] = useState(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[TabBarberos] Cargando barberos...');
    apiFetch(`${API_URL}/api/gestion/barberos`)
      .then(r => r.json())
      .then(data => {
        console.log('[TabBarberos] Barberos cargados:', data.length);
        setBarberos(data);
        setCargando(false);
      })
      .catch(err => {
        console.error('[TabBarberos] Error al cargar barberos:', err);
        setError('No se pudieron cargar los barberos.');
        setCargando(false);
      });
  }, []);

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    console.log('[TabBarberos] Abriendo modal — modo crear');
    setBarberoEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (barbero) => {
    console.log('[TabBarberos] Abriendo modal — modo editar:', barbero.id, barbero.nombre);
    setBarberoEditando(barbero);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setBarberoEditando(null);
  };

  // ── Callback al guardar ────────────────────────────────────────────────────
  /**
   * handleGuardado — actualiza la lista local sin refetch.
   * @param {object}  barberoGuardado - objeto devuelto por el backend
   * @param {boolean} esEdicion       - true = edición, false = creación
   */
  const handleGuardado = (barberoGuardado, esEdicion) => {
    if (esEdicion) {
      setBarberos(prev =>
        prev.map(b => b.id === barberoGuardado.id ? barberoGuardado : b)
      );
    } else {
      setBarberos(prev => [...prev, barberoGuardado]);
    }
    cerrarModal();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (cargando) return <p style={styles.estadoTexto}>Cargando barberos...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      {/* Modal */}
      {modalAbierto && (
        <ModalBarbero
          barbero={barberoEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}

      {/* ── Fila superior ── */}
      <div style={styles.filaAcciones}>
        <p style={styles.subtitulo}>
          {barberos.length} barbero{barberos.length !== 1 ? 's' : ''} registrado{barberos.length !== 1 ? 's' : ''}
        </p>
        <button style={styles.btnNuevo} onPointerDown={abrirCrear}>
          + Nuevo barbero
        </button>
      </div>

      {/* ── Tabla ── */}
      {barberos.length === 0 ? (
        <p style={styles.estadoTexto}>No hay barberos registrados todavía.</p>
      ) : (
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Comisión</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.thAccion}></th>
              </tr>
            </thead>
            <tbody>
              {barberos.map((b, i) => (
                <tr
                  key={b.id}
                  style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
                >
                  <td style={styles.td}>{b.nombre}</td>
                  <td style={styles.td}>
                    {Number(b.comision_valor)}%
                  </td>
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
