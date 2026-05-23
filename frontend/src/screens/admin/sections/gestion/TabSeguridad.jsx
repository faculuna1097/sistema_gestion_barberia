// /frontend/src/screens/admin/sections/gestion/TabSeguridad.jsx
// Tab "Seguridad" del panel admin. Agrupa todas las credenciales de acceso
// del sistema en una sola pantalla:
//   - PIN del administrador (acceso al panel desde tablets / desktop).
//   - Usuario y contraseña del modo operativo (login del iPad del local).
//
// Layout: cards con filas tipo "campo · valor · botón editar".
// Cada botón de editar abre un modal con su formulario propio.
//
// Por qué cada campo abre un modal en vez de un formulario inline:
//   - Mantiene la vista principal limpia y declarativa.
//   - Permite distintos campos / validaciones por modal sin acumular estado
//     en el componente padre.
//   - Cierra cleanly tras éxito y resetea el form sin guardar borrador.

import { useState, useEffect } from 'react';
import {
  apiFetch,
  getCredencialesOperativas,
  actualizarCredencialesOperativas,
} from '../../../../services/api';

// ─── Ícono de editar (lápiz) ──────────────────────────────────────────────────
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabSeguridad() {
  // Usuario operativo actual — precargado para el modal de cambio de usuario.
  const [usuarioOperativo, setUsuarioOperativo] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);

  // Modal activo: 'pin' | 'usuario' | 'password' | null
  const [modalAbierto, setModalAbierto] = useState(null);

  // Mensaje de éxito tras un cambio (toast simple). Se autoborra a los 4s.
  const [mensajeExito, setMensajeExito] = useState(null);

  // Cargar usuario operativo al montar para poder precargarlo en el modal.
  useEffect(() => {
    (async () => {
      try {
        const data = await getCredencialesOperativas();
        setUsuarioOperativo(data.usuario);
      } catch (err) {
        console.error('[tabSeguridad] Error cargando usuario operativo:', err.message);
        setUsuarioOperativo(null);
      } finally {
        setCargandoUsuario(false);
      }
    })();
  }, []);

  const cerrarModal = () => setModalAbierto(null);

  const mostrarExito = (texto) => {
    setMensajeExito(texto);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  /** Callback al cerrar el modal de cambio de usuario con éxito. */
  const trasCambioUsuario = (nuevoUsuario) => {
    setUsuarioOperativo(nuevoUsuario);
    mostrarExito('✓ Usuario actualizado correctamente.');
    cerrarModal();
  };

  /** Callback al cerrar el modal de cambio de contraseña operativo con éxito. */
  const trasCambioPassword = () => {
    mostrarExito('✓ Contraseña actualizada correctamente.');
    cerrarModal();
  };

  /** Callback al cerrar el modal de cambio de PIN admin con éxito. */
  const trasCambioPin = () => {
    mostrarExito('✓ PIN actualizado correctamente.');
    cerrarModal();
  };

  return (
    <div style={styles.contenedor}>

      {/* Toast global de éxito */}
      {mensajeExito && <p style={styles.toastExito}>{mensajeExito}</p>}

      {/* ── Card única con ambas secciones ─────────────────────────────────── */}
      <div style={styles.card}>

        {/* Sub-sección: PIN admin */}
        <p style={styles.cardTitulo}>PIN de administrador</p>
        <p style={styles.cardHint}>
          Se usa para acceder al panel desde cualquier dispositivo. 4 dígitos numéricos.
        </p>

        <div style={styles.fila}>
          <span style={styles.filaLabel}>PIN</span>
          <span style={styles.filaValor}>••••</span>
          <button
            style={styles.btnEditar}
            onClick={() => setModalAbierto('pin')}
            aria-label="Cambiar PIN"
            title="Cambiar PIN"
          >
            <EditIcon />
          </button>
        </div>

        <div style={styles.separadorSeccion} />

        {/* Sub-sección: Modo operativo */}
        <p style={styles.cardTitulo}>Modo operativo</p>
        <p style={styles.cardHint}>
          Credenciales que usa el iPad del local para acceder a los flujos
          operativos (corte, venta, gasto).
        </p>

        <div style={styles.fila}>
          <span style={styles.filaLabel}>Usuario</span>
          <span style={styles.filaValor}>
            {cargandoUsuario
              ? <span style={styles.cargando}>cargando…</span>
              : (usuarioOperativo || <span style={styles.sinValor}>sin configurar</span>)}
          </span>
          <button
            style={styles.btnEditar}
            onClick={() => setModalAbierto('usuario')}
            aria-label="Cambiar usuario"
            title="Cambiar usuario"
            disabled={cargandoUsuario}
          >
            <EditIcon />
          </button>
        </div>

        <div style={styles.filaDivisor} />

        <div style={styles.fila}>
          <span style={styles.filaLabel}>Contraseña</span>
          <span style={styles.filaValor}>••••••••</span>
          <button
            style={styles.btnEditar}
            onClick={() => setModalAbierto('password')}
            aria-label="Cambiar contraseña"
            title="Cambiar contraseña"
          >
            <EditIcon />
          </button>
        </div>
      </div>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      <ModalCambiarPin
        open={modalAbierto === 'pin'}
        onClose={cerrarModal}
        onSuccess={trasCambioPin}
      />
      <ModalCambiarUsuario
        open={modalAbierto === 'usuario'}
        onClose={cerrarModal}
        usuarioActual={usuarioOperativo || ''}
        onSuccess={trasCambioUsuario}
      />
      <ModalCambiarPassword
        open={modalAbierto === 'password'}
        onClose={cerrarModal}
        onSuccess={trasCambioPassword}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL — wrapper genérico
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Modal — overlay con backdrop semitransparente y card centrada.
 * Click en backdrop o ESC cierran. Click dentro de la card no cierra.
 */
function Modal({ open, onClose, title, children }) {
  // Cerrar con ESC (mejora la UX de teclado en desktop).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <div style={modalStyles.card} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.titulo}>{title}</h3>
          <button style={modalStyles.btnCerrar} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={modalStyles.body}>{children}</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar PIN admin
// ═════════════════════════════════════════════════════════════════════════════

function ModalCambiarPin({ open, onClose, onSuccess }) {
  const [pinActual,    setPinActual]    = useState('');
  const [pinNuevo,     setPinNuevo]     = useState('');
  const [pinConfirmar, setPinConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Reset al abrir el modal — evita conservar borradores entre aperturas.
  useEffect(() => {
    if (open) {
      setPinActual(''); setPinNuevo(''); setPinConfirmar('');
      setError(null); setGuardando(false);
    }
  }, [open]);

  const pinsCoinciden = pinNuevo === pinConfirmar;
  const puedeGuardar  =
    pinActual.length === 4 &&
    pinNuevo.length === 4 &&
    pinConfirmar.length === 4 &&
    pinsCoinciden;

  const handlePinInput = (setter, valor) => {
    setter(valor.replace(/\D/g, '').slice(0, 4));
    setError(null);
  };

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await apiFetch('/admin/negocio/pin-admin', {
        method: 'PUT',
        body: JSON.stringify({ pin_actual: pinActual, pin_nuevo: pinNuevo }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }
      onSuccess();
    } catch (err) {
      console.error('[modalCambiarPin] Error:', err.message);
      setError(err.message || 'No se pudo cambiar el PIN.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cambiar PIN de administrador">
      <div style={modalStyles.camposCol}>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>PIN actual</label>
          <input
            type="password" inputMode="numeric" maxLength={4}
            value={pinActual}
            onChange={(e) => handlePinInput(setPinActual, e.target.value)}
            placeholder="• • • •"
            style={{ ...modalStyles.campoInput, letterSpacing: pinActual.length > 0 ? '0.5em' : '0' }}
          />
        </div>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>Nuevo PIN</label>
          <input
            type="password" inputMode="numeric" maxLength={4}
            value={pinNuevo}
            onChange={(e) => handlePinInput(setPinNuevo, e.target.value)}
            placeholder="• • • •"
            style={{ ...modalStyles.campoInput, letterSpacing: pinNuevo.length > 0 ? '0.5em' : '0' }}
          />
        </div>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>Confirmar nuevo PIN</label>
          <input
            type="password" inputMode="numeric" maxLength={4}
            value={pinConfirmar}
            onChange={(e) => handlePinInput(setPinConfirmar, e.target.value)}
            placeholder="• • • •"
            style={{
              ...modalStyles.campoInput,
              letterSpacing: pinConfirmar.length > 0 ? '0.5em' : '0',
              borderColor: pinConfirmar.length === 4 && !pinsCoinciden ? '#c0392b' : '#e0e0e0',
            }}
          />
          {pinConfirmar.length === 4 && !pinsCoinciden && (
            <p style={modalStyles.campoError}>Los PINs no coinciden.</p>
          )}
        </div>
      </div>

      {error && <p style={modalStyles.errorTexto}>{error}</p>}

      <div style={modalStyles.acciones}>
        <button style={modalStyles.btnCancelar} onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button
          style={{ ...modalStyles.btnGuardar, ...(!puedeGuardar || guardando ? modalStyles.btnDeshabilitado : {}) }}
          onClick={handleGuardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar usuario operativo
// ═════════════════════════════════════════════════════════════════════════════

function ModalCambiarUsuario({ open, onClose, usuarioActual, onSuccess }) {
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Precargar con el usuario actual cada vez que se abre el modal.
  useEffect(() => {
    if (open) {
      setNuevoUsuario(usuarioActual);
      setError(null);
      setGuardando(false);
    }
  }, [open, usuarioActual]);

  const usuarioLimpio = nuevoUsuario.trim();
  const hayCambio = usuarioLimpio !== usuarioActual;
  const esValido  = usuarioLimpio.length >= 3;
  const puedeGuardar = hayCambio && esValido;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarCredencialesOperativas({ usuario: usuarioLimpio });
      onSuccess(usuarioLimpio);
    } catch (err) {
      console.error('[modalCambiarUsuario] Error:', err.message);
      setError(err.message || 'No se pudo cambiar el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cambiar usuario del modo operativo">
      <div style={modalStyles.camposCol}>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>Nuevo usuario</label>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={nuevoUsuario}
            onChange={(e) => { setNuevoUsuario(e.target.value); setError(null); }}
            placeholder="Mínimo 3 caracteres"
            style={modalStyles.campoInput}
          />
        </div>
      </div>

      {error && <p style={modalStyles.errorTexto}>{error}</p>}

      <div style={modalStyles.acciones}>
        <button style={modalStyles.btnCancelar} onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button
          style={{ ...modalStyles.btnGuardar, ...(!puedeGuardar || guardando ? modalStyles.btnDeshabilitado : {}) }}
          onClick={handleGuardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar contraseña operativa
// ═════════════════════════════════════════════════════════════════════════════

function ModalCambiarPassword({ open, onClose, onSuccess }) {
  const [password,  setPassword]  = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setPassword(''); setConfirmar('');
      setError(null); setGuardando(false);
    }
  }, [open]);

  const esValida    = password.length >= 8;
  const coincide    = password === confirmar;
  const puedeGuardar = esValida && coincide && confirmar.length > 0;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarCredencialesOperativas({ password });
      onSuccess();
    } catch (err) {
      console.error('[modalCambiarPassword] Error:', err.message);
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña del modo operativo">
      <div style={modalStyles.camposCol}>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>Nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Mínimo 8 caracteres"
            style={modalStyles.campoInput}
          />
          {password.length > 0 && !esValida && (
            <p style={modalStyles.campoError}>Mínimo 8 caracteres.</p>
          )}
        </div>
        <div style={modalStyles.campoGrupo}>
          <label style={modalStyles.campoLabel}>Confirmar nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => { setConfirmar(e.target.value); setError(null); }}
            placeholder="Reescribila"
            style={{
              ...modalStyles.campoInput,
              borderColor: confirmar.length > 0 && !coincide ? '#c0392b' : '#e0e0e0',
            }}
          />
          {confirmar.length > 0 && !coincide && (
            <p style={modalStyles.campoError}>Las contraseñas no coinciden.</p>
          )}
        </div>
      </div>

      {error && <p style={modalStyles.errorTexto}>{error}</p>}

      <div style={modalStyles.acciones}>
        <button style={modalStyles.btnCancelar} onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button
          style={{ ...modalStyles.btnGuardar, ...(!puedeGuardar || guardando ? modalStyles.btnDeshabilitado : {}) }}
          onClick={handleGuardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Estilos del tab ──────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    maxWidth: '580px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  toastExito: {
    backgroundColor: '#e8f5ee',
    border: '1.5px solid #b6e0c8',
    color: '#1a7a4a',
    fontSize: '14px',
    fontWeight: '600',
    padding: '12px 16px',
    borderRadius: '12px',
    margin: 0,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  // Separador entre las dos sub-secciones (PIN admin / Modo operativo)
  // dentro de la misma card. Más visible que el divisor entre filas porque
  // separa secciones conceptualmente distintas.
  separadorSeccion: {
    height: '1px',
    backgroundColor: '#e8e8e8',
    margin: '16px 0 8px',
  },
  cardTitulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  cardHint: {
    fontSize: '13px',
    color: '#888888',
    margin: '0 0 12px',
    lineHeight: 1.5,
  },
  fila: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 0',
    gap: '16px',
  },
  filaDivisor: {
    height: '1px',
    backgroundColor: '#eeeeee',
  },
  filaLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#555555',
    minWidth: '120px',
  },
  filaValor: {
    flex: 1,
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  cargando: {
    color: '#aaaaaa',
    fontStyle: 'italic',
  },
  sinValor: {
    color: '#c0392b',
    fontStyle: 'italic',
  },
  btnEditar: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
  },
};

// ─── Estilos de los modales ───────────────────────────────────────────────────
const modalStyles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(17, 17, 17, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '18px',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.25)',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 0',
  },
  titulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  btnCerrar: {
    border: 'none',
    background: 'none',
    fontSize: '26px',
    lineHeight: 1,
    color: '#888888',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
  },
  body: {
    padding: '20px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  camposCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
    fontSize: '16px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    backgroundColor: '#ffffff',
    width: '100%',
    boxSizing: 'border-box',
  },
  campoError: {
    fontSize: '12px',
    color: '#c0392b',
    margin: 0,
  },
  errorTexto: {
    color: '#c0392b',
    fontSize: '13px',
    margin: 0,
    textAlign: 'center',
  },
  acciones: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '4px',
  },
  btnCancelar: {
    padding: '11px 22px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnGuardar: {
    padding: '11px 22px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
