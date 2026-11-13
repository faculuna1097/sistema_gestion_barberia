// /frontend/src/screens/admin/sections/gestion/TabSeguridad.jsx
// Tab "Seguridad" del panel admin. Agrupa credenciales de acceso del sistema:
//   - PIN del administrador (acceso al panel desde tablets / desktop).
//   - Usuario y contraseña del modo operativo (login del iPad del local).
//
// Layout (rediseñado el 2026-11-13, F6 de plan_mejoras_operativas.md): una
// tarjeta por concepto, con un encabezado (ícono, título y para qué sirve), una
// `FilaAjuste` por credencial (qué es, el valor enmascarado y "Cambiar") y un pie
// que dice cómo se recupera si se olvida: a qué mail llega el link, o que falta
// cargarlo en Negocio → Contacto. Cada "Cambiar" abre su modal.
//
// Re-autenticación: los tres cambios piden el PIN de administrador (el del PIN,
// como "PIN actual"). Si no coincide, el backend responde 403 con `campo` y el
// error va debajo de ese campo. Las reglas y los mensajes de la credencial nueva
// están en utils/credenciales.js (las comparte la pantalla de recuperación).
// Feedback de éxito con toast flotante (utils/toast.js); un error que no es de un
// campo va inline con Toast.

import { useState, useEffect, useCallback } from 'react';
import { Info, KeyRound, MonitorSmartphone, TriangleAlert } from 'lucide-react';

import {
  apiFetch,
  getCredencialesOperativas,
  actualizarCredencialesOperativas,
  getNegocioAdmin,
} from '../../../../services/api';
import {
  Button,
  Field,
  FilaAjuste,
  Modal,
  PillSinConfigurar,
  Toast,
} from '../../../../components/ui';
import { ErrorServidor, errorDeRespuesta, mensajeDeError } from '../../../../utils/errores';
import { toast } from '../../../../utils/toast';
import {
  PASSWORD_MIN_CARACTERES,
  soloDigitosPin,
  validarPasswordNueva,
  validarPinNuevo,
} from '../../../../utils/credenciales';
import { theme } from '../../../../theme/tokens.js';

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * TarjetaSeguridad
 * Tarjeta de un concepto: encabezado con ícono, título y descripción; las filas;
 * y un pie opcional en gris. Local: hoy solo la usa esta tab (§7.1).
 *
 * @param {object} props
 * @param {React.ReactNode} props.icono - Ícono Lucide de 20.
 * @param {string} props.titulo
 * @param {string} props.descripcion
 * @param {React.ReactNode} [props.pie] - Contenido del pie (ej. NotaRecuperacion).
 * @param {React.ReactNode} props.children - Las FilaAjuste.
 */
function TarjetaSeguridad({ icono, titulo, descripcion, pie, children }) {
  return (
    <section style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <span aria-hidden="true" style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius,
            background: theme.accentSoft,
            color: theme.accent,
          }}>
            {icono}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              margin: 0,
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeHeading,
              color: theme.ink,
              letterSpacing: '-0.01em',
            }}>{titulo}</h2>
            <p style={{
              margin: '4px 0 0',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
              lineHeight: 1.5,
            }}>{descripcion}</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {children}
        </div>
      </div>
      {pie && (
        <div style={{
          padding: '12px 24px',
          background: theme.bg,
          borderTop: `1px solid ${theme.hairline}`,
        }}>
          {pie}
        </div>
      )}
    </section>
  );
}

/**
 * NotaRecuperacion
 * Pie de una tarjeta: cómo se recupera la credencial si se olvida. Con mail del
 * dueño cargado, a dónde llega el link; sin mail, un aviso de que falta.
 *
 * @param {object} props
 * @param {string} props.queSeOlvida - Ej. "el PIN", "la contraseña".
 * @param {string} props.dondeSePide - Texto del link en la pantalla de entrada.
 * @param {string|null} props.emailDuenio - El mail, o null si no hay. Mientras
 *   carga (o si no se pudo cargar) la tarjeta no lleva pie.
 */
function NotaRecuperacion({ queSeOlvida, dondeSePide, emailDuenio }) {
  const sinMail = emailDuenio === null;
  const Icono = sinMail ? TriangleAlert : Info;
  return (
    <p style={{
      margin: 0,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      lineHeight: 1.5,
      color: sinMail ? theme.warning : theme.muted,
    }}>
      <Icono size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      {sinMail ? (
        <span>
          Falta el mail del dueño: si se olvida {queSeOlvida}, no se puede recuperar. Cargalo
          en Gestión → Negocio → Contacto.
        </span>
      ) : (
        <span>
          Si se olvida {queSeOlvida}, en la pantalla de entrada tocá «{dondeSePide}» y llega
          un link a <span style={{ color: theme.ink }}>{emailDuenio}</span>.
        </span>
      )}
    </p>
  );
}

/**
 * BotonCambiar
 * Acción "Cambiar" de una fila: botón secundario chico.
 * @param {object} props
 * @param {() => void} props.onClick
 * @param {string} props.ariaLabel - Qué cambia (ej. "Cambiar el PIN").
 * @param {boolean} [props.disabled=false]
 */
function BotonCambiar({ onClick, ariaLabel, disabled = false }) {
  return (
    <Button variant="secondary" full={false} onClick={onClick} disabled={disabled} ariaLabel={ariaLabel}>
      Cambiar
    </Button>
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
 */
function BotonReintentar({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: theme.accent,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      Reintentar
    </button>
  );
}

/**
 * ValorEnmascarado
 * Un valor secreto (PIN, contraseña) como puntos, en mono.
 * @param {object} props
 * @param {number} props.largo - Cantidad de puntos.
 * @param {string} props.etiqueta - Qué es, para el lector de pantalla.
 */
function ValorEnmascarado({ largo, etiqueta }) {
  return (
    <span
      aria-label={`${etiqueta} guardado, oculto`}
      style={{ fontFamily: theme.mono, letterSpacing: '0.2em', color: theme.inkSoft }}
    >
      {'•'.repeat(largo)}
    </span>
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
  // emailDuenio: undefined mientras carga o si falló (el pie no se muestra),
  // null si el local no tiene mail cargado.
  const [emailDuenio, setEmailDuenio]           = useState(undefined);
  const [modalAbierto, setModalAbierto]         = useState(null); // 'pin'|'usuario'|'password'|null

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

  // Mail del dueño, para el pie de cada tarjeta. Si falla, el pie no se muestra:
  // es información de ayuda, no hace falta para cambiar nada.
  useEffect(() => {
    let vivo = true;
    const cargarMail = async () => {
      try {
        const negocio = await getNegocioAdmin();
        if (vivo) setEmailDuenio(negocio.email_duenio ?? null);
      } catch (err) {
        console.warn('[tabSeguridad] No se pudo cargar el mail del dueño:', err.message);
      }
    };
    cargarMail();
    return () => { vivo = false; };
  }, []);

  const cerrarModal = () => setModalAbierto(null);

  const trasCambioUsuario = (nuevoUsuario) => {
    setUsuarioOperativo(nuevoUsuario);
    toast.exito('Usuario actualizado.');
    cerrarModal();
  };
  const trasCambioPassword = () => {
    toast.exito('Contraseña actualizada. Los iPads que estaban adentro van a pedir la nueva.');
    cerrarModal();
  };
  const trasCambioPin = () => {
    toast.exito('PIN actualizado.');
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
    valorUsuario = usuarioOperativo
      ? <span style={{ fontFamily: theme.mono }}>{usuarioOperativo}</span>
      : <PillSinConfigurar />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      <TarjetaSeguridad
        icono={<KeyRound size={20} strokeWidth={1.75} />}
        titulo="PIN de administrador"
        descripcion="Da acceso completo al panel desde cualquier dispositivo. Los barberos entran con su propio PIN."
        pie={emailDuenio !== undefined && <NotaRecuperacion queSeOlvida="el PIN" dondeSePide="¿Olvidaste el PIN de administrador?" emailDuenio={emailDuenio} />}
      >
        <FilaAjuste
          primera
          label="PIN"
          descripcion="4 números. Al cambiarlo, se cierran las sesiones abiertas del panel."
          valor={<ValorEnmascarado largo={4} etiqueta="PIN" />}
          accion={<BotonCambiar onClick={() => setModalAbierto('pin')} ariaLabel="Cambiar el PIN de administrador" />}
        />
      </TarjetaSeguridad>

      <TarjetaSeguridad
        icono={<MonitorSmartphone size={20} strokeWidth={1.75} />}
        titulo="Modo operativo (iPad del local)"
        descripcion="Credenciales con las que el iPad del mostrador entra a cobrar cortes, ventas y gastos. Queda adentro 30 días."
        pie={emailDuenio !== undefined && <NotaRecuperacion queSeOlvida="la contraseña" dondeSePide="¿Olvidaste tu contraseña?" emailDuenio={emailDuenio} />}
      >
        <FilaAjuste
          primera
          label="Usuario"
          descripcion="Se escribe en la pantalla de entrada del iPad."
          valor={valorUsuario}
          accion={
            <BotonCambiar
              onClick={() => setModalAbierto('usuario')}
              ariaLabel="Cambiar el usuario del modo operativo"
              disabled={cargandoUsuario || errorCarga}
            />
          }
        />
        <FilaAjuste
          label="Contraseña"
          descripcion={`Mínimo ${PASSWORD_MIN_CARACTERES} caracteres. Al cambiarla, los iPads que estaban adentro piden la nueva.`}
          valor={<ValorEnmascarado largo={8} etiqueta="Contraseña" />}
          accion={<BotonCambiar onClick={() => setModalAbierto('password')} ariaLabel="Cambiar la contraseña del modo operativo" />}
        />
      </TarjetaSeguridad>

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
// Errores de los modales
// ═══════════════════════════════════════════════════════════════════════════

/**
 * repartirError
 * Decide dónde va el error de un guardado: debajo de un campo (403 del PIN con
 * `campo`, 409 de un PIN en uso) o en el aviso general del modal (el resto).
 * @param {unknown} err - Lo que atrapó el catch.
 * @param {string} generico - Mensaje si no vino texto del servidor (ej. sin red).
 * @param {Object<number, string>} [campoPorStatus] - Campo para un status sin
 *   `campo` (ej. { 409: 'pin_nuevo' }).
 * @returns {{ campo: string|null, mensaje: string }}
 */
function repartirError(err, generico, campoPorStatus = {}) {
  const mensaje = mensajeDeError(err, generico);
  if (!(err instanceof ErrorServidor)) return { campo: null, mensaje };
  return { campo: err.campo ?? campoPorStatus[err.status] ?? null, mensaje };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL — Cambiar PIN admin
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ModalCambiarPin
 * Form modal de 3 campos (PIN actual / nuevo / confirmar). Cada uno acepta
 * solo 4 dígitos. Submit habilitado solo si los 3 están completos y
 * nuevo === confirmar. Un PIN actual incorrecto (403) o un PIN nuevo que ya usa
 * alguien (409) quedan debajo de su campo.
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
  // errores: { campo, mensaje } del último guardado, o null.
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (open) {
      setPinActual(''); setPinNuevo(''); setPinConfirmar('');
      setError(null); setGuardando(false);
    }
  }, [open]);

  const reglas = validarPinNuevo(pinNuevo, pinConfirmar);
  const puedeGuardar = pinActual.length === 4 && reglas.valida;

  const handleChange = (setter) => (v) => {
    setter(soloDigitosPin(v));
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
      if (!res.ok) throw await errorDeRespuesta(res);
      onSuccess();
    } catch (err) {
      console.error('[modalCambiarPin] Error:', err.message);
      const repartido = repartirError(err, 'No se pudo cambiar el PIN. Intentá de nuevo.', { 409: 'pin_nuevo' });
      if (repartido.campo === 'pin_actual') setPinActual('');
      setError(repartido);
    } finally {
      setGuardando(false);
    }
  };

  const errorDe = (campo) => (error?.campo === campo ? error.mensaje : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      loading={guardando}
      title="Cambiar PIN de administrador"
      subtitle="Las sesiones abiertas del panel se cierran y vuelven a pedir el PIN."
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
          revelable="PIN"
          inputMode="numeric"
          autoComplete="off"
          value={pinActual}
          onChange={handleChange(setPinActual)}
          placeholder="4 números"
          error={errorDe('pin_actual')}
        />
        <Field
          label="Nuevo PIN"
          type="password"
          revelable="PIN"
          inputMode="numeric"
          autoComplete="off"
          value={pinNuevo}
          onChange={handleChange(setPinNuevo)}
          placeholder="4 números"
          error={errorDe('pin_nuevo')}
        />
        <Field
          label="Confirmar nuevo PIN"
          type="password"
          revelable="PIN"
          inputMode="numeric"
          autoComplete="off"
          value={pinConfirmar}
          onChange={handleChange(setPinConfirmar)}
          placeholder="Repetilo"
          error={reglas.errorConfirmar ?? undefined}
        />

        {error && !error.campo && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error.mensaje}
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
 * Form modal de 1 campo + el PIN de administrador. Submit habilitado si el
 * usuario cambió y mide ≥3.
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
      const repartido = repartirError(err, 'No se pudo cambiar el usuario. Intentá de nuevo.');
      if (repartido.campo === 'pin_admin') setPinAdmin('');
      setError(repartido);
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
      subtitle="Los iPads que ya estaban adentro siguen adentro."
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
          onChange={(v) => { setPinAdmin(soloDigitosPin(v)); setError(null); }}
          placeholder="Confirmá con tu PIN"
          autoComplete="off"
          error={error?.campo === 'pin_admin' ? error.mensaje : undefined}
        />

        {error && !error.campo && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error.mensaje}
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
 * Form modal de 2 campos (nueva / confirmar, con ojo) + el PIN de administrador.
 * Reglas de utils/credenciales.js.
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

  const reglas       = validarPasswordNueva(password, confirmar);
  const puedeGuardar = reglas.valida && pinAdmin.length === 4;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarCredencialesOperativas({ password, pin_admin: pinAdmin });
      onSuccess();
    } catch (err) {
      console.error('[modalCambiarPassword] Error:', err.message);
      const repartido = repartirError(err, 'No se pudo cambiar la contraseña. Intentá de nuevo.');
      if (repartido.campo === 'pin_admin') setPinAdmin('');
      setError(repartido);
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
      subtitle="Los iPads que estaban adentro van a pedir la contraseña nueva."
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
          revelable
          autoComplete="new-password"
          value={password}
          onChange={(v) => { setPassword(v); setError(null); }}
          placeholder={`Mínimo ${PASSWORD_MIN_CARACTERES} caracteres`}
          error={reglas.errorPassword ?? undefined}
        />
        <Field
          label="Confirmar nueva contraseña"
          type="password"
          revelable
          autoComplete="new-password"
          value={confirmar}
          onChange={(v) => { setConfirmar(v); setError(null); }}
          placeholder="Repetila"
          error={reglas.errorConfirmar ?? undefined}
        />
        <Field
          label="PIN de administrador"
          type="password"
          inputMode="numeric"
          value={pinAdmin}
          onChange={(v) => { setPinAdmin(soloDigitosPin(v)); setError(null); }}
          placeholder="Confirmá con tu PIN"
          autoComplete="off"
          error={error?.campo === 'pin_admin' ? error.mensaje : undefined}
        />

        {error && !error.campo && (
          <Toast tone="danger" onDismiss={() => setError(null)} dismissible>
            {error.mensaje}
          </Toast>
        )}
      </div>
    </Modal>
  );
}
