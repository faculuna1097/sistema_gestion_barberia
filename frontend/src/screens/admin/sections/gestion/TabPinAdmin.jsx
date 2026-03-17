// frontend/src/screens/admin/sections/gestion/TabPinAdmin.jsx
// Permite cambiar el PIN del administrador.
// Flujo: PIN actual → nuevo PIN → confirmar nuevo PIN → guardar.
// El backend verifica el PIN actual con bcrypt antes de aceptar el cambio.

import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TabPinAdmin() {
  const [pinActual, setPinActual]       = useState('');
  const [pinNuevo, setPinNuevo]         = useState('');
  const [pinConfirmar, setPinConfirmar] = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState(null);
  const [exito, setExito]               = useState(false);

  // ── Validaciones ──────────────────────────────────────────────────────────
  const pinActualValido   = pinActual.length === 4;
  const pinNuevoValido    = pinNuevo.length === 4;
  const pinConfirmarValido = pinConfirmar.length === 4;
  const pinsCoinciden     = pinNuevo === pinConfirmar;

  const puedeGuardar =
    pinActualValido    &&
    pinNuevoValido     &&
    pinConfirmarValido &&
    pinsCoinciden;

  /**
   * handleCambiarPin — envía PUT /api/gestion/pin-admin con pin_actual y pin_nuevo.
   * El backend verifica el pin_actual con bcrypt y hashea el nuevo antes de guardarlo.
   */
  const handleCambiarPin = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    setExito(false);

    // NUNCA loguear PINs
    console.log('[TabPinAdmin] Solicitando cambio de PIN admin...');

    try {
      const res = await fetch(`${API_URL}/api/gestion/pin-admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin_actual: pinActual, pin_nuevo: pinNuevo }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      console.log('[TabPinAdmin] PIN admin cambiado exitosamente');
      setPinActual('');
      setPinNuevo('');
      setPinConfirmar('');
      setExito(true);
      setTimeout(() => setExito(false), 4000);
    } catch (err) {
      console.error('[TabPinAdmin] Error al cambiar PIN:', err);
      setError(err.message || 'No se pudo cambiar el PIN. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  /**
   * handlePinInput — filtra solo dígitos y limita a 4 caracteres.
   * @param {function} setter - función setState del campo
   * @param {string}   valor  - valor ingresado por el usuario
   */
  const handlePinInput = (setter, valor) => {
    const soloDigitos = valor.replace(/\D/g, '').slice(0, 4);
    setter(soloDigitos);
    setError(null);
    setExito(false);
  };

  return (
    <div style={styles.contenedor}>
      <div style={styles.card}>

        <p style={styles.cardTitulo}>Cambiar PIN de administrador</p>
        <p style={styles.cardHint}>
          El PIN tiene 4 dígitos numéricos y se usa para acceder al panel de administrador.
        </p>

        <div style={styles.camposCol}>

          {/* PIN actual */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>PIN actual</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinActual}
              onChange={e => handlePinInput(setPinActual, e.target.value)}
              placeholder="• • • •"
              style={{
                ...styles.campoInput,
                letterSpacing: pinActual.length > 0 ? '0.5em' : '0',
              }}
            />
          </div>

          <div style={styles.divisor} />

          {/* PIN nuevo */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Nuevo PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinNuevo}
              onChange={e => handlePinInput(setPinNuevo, e.target.value)}
              placeholder="• • • •"
              style={{
                ...styles.campoInput,
                letterSpacing: pinNuevo.length > 0 ? '0.5em' : '0',
              }}
            />
          </div>

          {/* Confirmar PIN nuevo */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Confirmar nuevo PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirmar}
              onChange={e => handlePinInput(setPinConfirmar, e.target.value)}
              placeholder="• • • •"
              style={{
                ...styles.campoInput,
                letterSpacing: pinConfirmar.length > 0 ? '0.5em' : '0',
                borderColor:
                  pinConfirmar.length === 4 && !pinsCoinciden
                    ? '#c0392b'
                    : '#e0e0e0',
              }}
            />
            {pinConfirmar.length === 4 && !pinsCoinciden && (
              <p style={styles.campoError}>Los PINs no coinciden.</p>
            )}
          </div>

        </div>

        {/* Error del servidor */}
        {error && <p style={styles.errorTexto}>{error}</p>}

        {/* Éxito */}
        {exito && (
          <p style={styles.exitoTexto}>✓ PIN actualizado correctamente.</p>
        )}

        <button
          style={{
            ...styles.btnGuardar,
            ...(!puedeGuardar || guardando ? styles.btnDeshabilitado : {}),
          }}
          onPointerDown={handleCambiarPin}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando...' : 'Cambiar PIN'}
        </button>

      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    maxWidth: '420px',
  },
  card: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardTitulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  cardHint: {
    fontSize: '13px',
    color: '#aaaaaa',
    margin: 0,
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
    fontSize: '22px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  campoError: {
    fontSize: '12px',
    color: '#c0392b',
    margin: 0,
  },
  divisor: {
    height: '1px',
    backgroundColor: '#eeeeee',
    margin: '4px 0',
  },
  btnGuardar: {
    padding: '13px 0',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
  errorTexto: {
    color: '#c0392b',
    fontSize: '13px',
    margin: 0,
    textAlign: 'center',
  },
  exitoTexto: {
    color: '#1a7a4a',
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
    textAlign: 'center',
  },
};
