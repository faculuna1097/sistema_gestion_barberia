// /frontend/src/screens/admin/sections/gestion/TabSeguridad.jsx
// Tab "Seguridad" del panel admin. Agrupa credenciales de acceso del sistema:
//   - PIN del administrador (acceso al panel desde tablets / desktop).
//   - Usuario y contraseña del modo operativo (login del iPad del local).
//
// Layout: dos cards stackeadas, una por concepto. Cada credencial es una
// fila label · valor enmascarado · botón editar — el click en el botón abre
// un modal específico con el form propio del cambio.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Loading inline para
// el usuario operativo. Feedback de éxito vía primitivo Toast (auto-dismiss).
//
// Deudas detectadas y anotadas en el plan:
// - Cambiar contraseña / usuario operativo no pide la contraseña actual.
// - El reintento de la carga del usuario operativo no está expuesto (si falla
//   queda "Sin configurar" — semánticamente erróneo).

import { useState, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';

import {
  apiFetch,
  getCredencialesOperativas,
  actualizarCredencialesOperativas,
} from '../../../../services/api';
import {
  Button,
  Field,
  Modal,
  Toast,
  BotonIconoFila,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * CardConfig
 * Card de bloque de configuración con título heading + descripción muted +
 * children (filas de credenciales).
 * Local — específica del layout de esta tab. Promover si aparece un patrón
 * idéntico en otra tab (probable en TabNegocio en el chat B).
 *
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} props.descripcion
 * @param {React.ReactNode} props.children
 */
function CardConfig({ titulo, descripcion, children }) {
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          color: theme.ink,
          letterSpacing: '-0.01em',
        }}>{titulo}</div>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          lineHeight: 1.5,
          marginTop: 6,
        }}>{descripcion}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

/**
 * FilaCredencial
 * Fila label · valor · botón editar. Separador inferior hairlineSoft excepto
 * en la última (controlado por prop `last`).
 *
 * @param {object} props
 * @param {string} props.label - Texto en eyebrow mono uppercase.
 * @param {React.ReactNode} props.valor - Valor enmascarado / texto.
 * @param {() => void} props.onEditar - Click del botón lápiz.
 * @param {boolean} [props.disabled=false] - Deshabilita el botón.
 * @param {boolean} [props.last=false] - Si true, no renderiza border-bottom.
 */
function FilaCredencial({ label, valor, onEditar, disabled = false, last = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 0',
      borderBottom: last ? 'none' : `1px solid ${theme.hairlineSoft}`,
    }}>
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        minWidth: 110,
      }}>{label}</span>
      <span style={{
        flex: 1,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>{valor}</span>
      <BotonIconoFila
        icono={<Pencil size={14} strokeWidth={1.75} />}
        tono="accent"
        onClick={onEditar}
        disabled={disabled}
        ariaLabel={`Cambiar ${label.toLowerCase()}`}
      />
    </div>
  );
}

/**
 * PillSinConfigurar
 * Pill warning para indicar que un campo de credencial está vacío. Más
 * declarativo que un texto rojo italic.
 */
function PillSinConfigurar() {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      background: theme.warningSoft,
      color: theme.warning,
    }}>
      Sin configurar
    </span>
  );
}

/**
 * BotonReintentar
 * Botón de texto inline (estilo link de acento) para reintentar una carga que
 * falló. Sin padding ni borde — se renderiza junto al mensaje de error dentro
 * del slot de valor de la fila.
 *
 * @param {object} props
 * @param {() => void} props.onClick
 * @param {boolean} [props.disabled=false]
 */
function BotonReintentar({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: theme.accent,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      Reintentar
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * TabSeguridad
 * Tab de gestión de credenciales: PIN admin + usuario/contraseña operativos.
 *
 * @returns {JSX.Element}
 */
export default function TabSeguridad() {
  const [usuarioOperativo, setUsuarioOperativo] = useState(null);
  const [cargandoUsuario, setCargandoUsuario]   = useState(true);
  const [errorCarga, setErrorCarga]             = useState(false); // true si el fetch falló (distinto de "sin configurar")
  const [modalAbierto, setModalAbierto]         = useState(null); // 'pin'|'usuario'|'password'|null
  const [toast, setToast]                       = useState(null); // { tone, texto }

  // ── Carga del usuario operativo (reutilizable: pre-carga + reintento) ──────
  // Distingue "no se pudo cargar" (errorCarga) de "no hay usuario configurado"
  // (usuarioOperativo === null sin error): semánticas distintas en la fila.
  const cargarUsuario = useCallback(async () => {
    setCargandoUsuario(true);
    setErrorCarga(false);
    try {
      const data = await getCredencialesOperativas();
      setUsuarioOperativo(data.usuario);
    } catch (err) {
      console.error('[tabSeguridad] Error cargando usuario operativo:', err.message);
      setErrorCarga(true);
    } finally {
      setCargandoUsuario(false);
    }
  }, []);

  useEffect(() => { cargarUsuario(); }, [cargarUsuario]);

  const cerrarModal = () => setModalAbierto(null);

  const mostrarExito = (texto) => setToast({ tone: 'success', texto });

  const trasCambioUsuario = (nuevoUsuario) => {
    setUsuarioOperativo(nuevoUsuario);
    mostrarExito('Usuario actualizado correctamente.');
    cerrarModal();
  };
  const trasCambioPassword = () => {
    mostrarExito('Contraseña actualizada correctamente.');
    cerrarModal();
  };
  const trasCambioPin = () => {
    mostrarExito('PIN actualizado correctamente.');
    cerrarModal();
  };

  // ── Render del valor de "Usuario" según estado ────────────────────────────
  // 4 estados: cargando · error de carga · usuario · sin configurar (vacío real).
  let valorUsuario;
  if (cargandoUsuario) {
    valorUsuario = <span style={{ color: theme.muted }}>—</span>;
  } else if (errorCarga) {
    valorUsuario = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: theme.danger }}>No se pudo cargar.</span>
        <BotonReintentar onClick={cargarUsuario} />
      </span>
    );
  } else {
    valorUsuario = usuarioOperativo || <PillSinConfigurar />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 600,
    }}>
      {toast && (
        <Toast
          key={toast.texto}
          tone={toast.tone}
          autoDismissMs={4000}
          onDismiss={() => setToast(null)}
        >{toast.texto}</Toast>
      )}

      <CardConfig
        titulo="PIN de administrador"
        descripcion="Se usa para acceder al panel desde cualquier dispositivo. 4 dígitos numéricos."
      >
        <FilaCredencial
          label="PIN"
          valor="••••"
          onEditar={() => setModalAbierto('pin')}
          last
        />
      </CardConfig>

      <CardConfig
        titulo="Modo operativo"
        descripcion="Credenciales que usa el iPad del local para acceder a los flujos operativos (corte, venta, gasto)."
      >
        <FilaCredencial
          label="Usuario"
          valor={valorUsuario}
          onEditar={() => setModalAbierto('usuario')}
          disabled={cargandoUsuario || errorCarga}
        />
        <FilaCredencial
          label="Contraseña"
          valor="••••••••"
          onEditar={() => setModalAbierto('password')}
          last
        />
      </CardConfig>

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

// ═══════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar PIN admin
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModalCambiarPin
 * Form modal de 3 campos (PIN actual / nuevo / confirmar). Cada uno acepta
 * solo 4 dígitos (filter + slice). Submit habilitado solo si los 3 están
 * completos y nuevo === confirmar.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} props.onSuccess
 */
function ModalCambiarPin({ open, onClose, onSuccess }) {
  const [pinActual,    setPinActual]    = useState('');
  const [pinNuevo,     setPinNuevo]     = useState('');
  const [pinConfirmar, setPinConfirmar] = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (open) {
      setPinActual(''); setPinNuevo(''); setPinConfirmar('');
      setError(null); setGuardando(false);
    }
  }, [open]);

  const pinsCoinciden = pinNuevo === pinConfirmar;
  const confirmConflict = pinConfirmar.length === 4 && !pinsCoinciden;
  const puedeGuardar =
    pinActual.length === 4 &&
    pinNuevo.length === 4 &&
    pinConfirmar.length === 4 &&
    pinsCoinciden;

  const handleChange = (setter) => (v) => {
    setter(v.replace(/\D/g, '').slice(0, 4));
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
        const data = await res.json().catch(() => ({}));
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
    <Modal
      open={open}
      onClose={onClose}
      loading={guardando}
      title="Cambiar PIN de administrador"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
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
          label="PIN actual"
          type="password"
          inputMode="numeric"
          value={pinActual}
          onChange={handleChange(setPinActual)}
          placeholder="4 dígitos"
        />
        <Field
          label="Nuevo PIN"
          type="password"
          inputMode="numeric"
          value={pinNuevo}
          onChange={handleChange(setPinNuevo)}
          placeholder="4 dígitos"
        />
        <Field
          label="Confirmar nuevo PIN"
          type="password"
          inputMode="numeric"
          value={pinConfirmar}
          onChange={handleChange(setPinConfirmar)}
          placeholder="4 dígitos"
          invalid={confirmConflict}
          error={confirmConflict ? 'Los PINs no coinciden.' : undefined}
        />

        {error && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error}
          </Toast>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar usuario operativo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModalCambiarUsuario
 * Form modal de 1 campo. Submit habilitado si el usuario cambió y mide ≥3.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.usuarioActual - Para precargar y detectar cambios.
 * @param {(nuevo: string) => void} props.onSuccess
 */
function ModalCambiarUsuario({ open, onClose, usuarioActual, onSuccess }) {
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [pinAdmin, setPinAdmin]         = useState(''); // re-autenticación (deuda #35)
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (open) {
      setNuevoUsuario(usuarioActual); setPinAdmin('');
      setError(null); setGuardando(false);
    }
  }, [open, usuarioActual]);

  const usuarioLimpio = nuevoUsuario.trim();
  const hayCambio     = usuarioLimpio !== usuarioActual;
  const esValido      = usuarioLimpio.length >= 3;
  const puedeGuardar  = hayCambio && esValido && pinAdmin.length === 4;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarCredencialesOperativas({ usuario: usuarioLimpio, pin_admin: pinAdmin });
      onSuccess(usuarioLimpio);
    } catch (err) {
      console.error('[modalCambiarUsuario] Error:', err.message);
      setError(err.message || 'No se pudo cambiar el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      loading={guardando}
      title="Cambiar usuario del modo operativo"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
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
          label="Nuevo usuario"
          value={nuevoUsuario}
          onChange={(v) => { setNuevoUsuario(v); setError(null); }}
          placeholder="Mínimo 3 caracteres"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Field
          label="PIN de administrador"
          type="password"
          inputMode="numeric"
          value={pinAdmin}
          onChange={(v) => { setPinAdmin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          placeholder="Confirmá con tu PIN"
          autoComplete="off"
        />

        {error && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error}
          </Toast>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar contraseña operativa
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModalCambiarPassword
 * Form modal de 2 campos (nueva / confirmar). Min 8 chars + ambas iguales.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} props.onSuccess
 */
function ModalCambiarPassword({ open, onClose, onSuccess }) {
  const [password,  setPassword]  = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [pinAdmin,  setPinAdmin]  = useState(''); // re-autenticación (deuda #35)
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (open) {
      setPassword(''); setConfirmar(''); setPinAdmin('');
      setError(null); setGuardando(false);
    }
  }, [open]);

  const esValida     = password.length >= 8;
  const coincide     = password === confirmar;
  const lenError     = password.length > 0 && !esValida;
  const matchError   = confirmar.length > 0 && !coincide;
  const puedeGuardar = esValida && coincide && confirmar.length > 0 && pinAdmin.length === 4;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarCredencialesOperativas({ password, pin_admin: pinAdmin });
      onSuccess();
    } catch (err) {
      console.error('[modalCambiarPassword] Error:', err.message);
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      loading={guardando}
      title="Cambiar contraseña del modo operativo"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
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
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(v) => { setPassword(v); setError(null); }}
          placeholder="Mínimo 8 caracteres"
          invalid={lenError}
          error={lenError ? 'Mínimo 8 caracteres.' : undefined}
        />
        <Field
          label="Confirmar nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(v) => { setConfirmar(v); setError(null); }}
          placeholder="Reescribila"
          invalid={matchError}
          error={matchError ? 'Las contraseñas no coinciden.' : undefined}
        />
        <Field
          label="PIN de administrador"
          type="password"
          inputMode="numeric"
          value={pinAdmin}
          onChange={(v) => { setPinAdmin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          placeholder="Confirmá con tu PIN"
          autoComplete="off"
        />

        {error && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error}
          </Toast>
        )}
      </div>
    </Modal>
  );
}
