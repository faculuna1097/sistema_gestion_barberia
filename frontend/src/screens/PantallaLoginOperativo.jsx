// /frontend/src/screens/PantallaLoginOperativo.jsx
// Pantalla de login del modo operativo. Es la primera pantalla que ve el iPad
// del local mientras no haya un tokenOperativo válido en localStorage.
// Una vez logueado el operativo, esta pantalla no vuelve a aparecer hasta que:
//   1. Alguien presione el botón de logout en MainScreen, o
//   2. El backend devuelva 401 (token expirado a los 30d, o credenciales rotadas).
//
// Layout: fondo full-screen con la imagen del local (tenant_imagen tipo='local')
// + overlay oscuro sutil para legibilidad + card sólida centrada con shadowMd.
// El logo del tenant va dentro de un círculo arriba de la card.
//
// Props:
//   onAcceso     — callback(token) tras login exitoso. App.jsx lo usa para
//                  actualizar su estado tokenOperativo y navegar a "main".
//   imagenLogo   — URL del logo (tenant_imagen tipo='logo'). Fallback: Lock.
//   imagenLocal  — URL de la foto del local (tenant_imagen tipo='local').
//                  Si no hay, el fondo cae a surfaceAlt liso.

import { useState } from "react";
import { theme } from "../theme/tokens.js";
import { Field, Button, LogoCirculo } from "../components/ui";
import { loginOperativo } from "../services/api";

/**
 * PantallaLoginOperativo
 * Renderiza el formulario de login operativo (usuario + password).
 * Maneja su propio estado local de inputs, error inline y flag de envío.
 * La persistencia del token ocurre dentro de loginOperativo() en api.js.
 */
export default function PantallaLoginOperativo({ onAcceso, imagenLogo, imagenLocal }) {
  const [usuario,  setUsuario]  = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [enviando, setEnviando] = useState(false);

  /**
   * submit — valida que los campos no estén vacíos, llama a loginOperativo y
   * dispara el callback onAcceso si todo sale bien.
   */
  const submit = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError("Ingresá usuario y contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const token = await loginOperativo(usuario.trim(), password);
      onAcceso(token);
    } catch (err) {
      console.error('[pantallaLoginOperativo] Error en submit:', err.message);
      setError(err.message || "Credenciales inválidas. Intentá de nuevo.");
      setPassword(""); // limpia la password para no exponerla
    } finally {
      setEnviando(false);
    }
  };

  // Fondo: si hay imagen del local, la usamos como cover; si no, surfaceAlt liso.
  const fondoStyle = imagenLocal
    ? {
        background: `url("${imagenLocal}") center/cover no-repeat`,
      }
    : { background: theme.surfaceAlt };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: theme.body,
      position: 'relative',
      overflow: 'auto',
      ...fondoStyle,
    }}>
      {/* Overlay oscuro sutil para asegurar contraste de la card sobre la imagen.
          No es glassmorphism — es un velo plano de sombra. */}
      {imagenLocal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.35)',
          pointerEvents: 'none',
        }} />
      )}

      <form
        onSubmit={submit}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 380,
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          boxShadow: theme.shadowMd,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          animation: 'om-fade .26s ease-out both',
        }}
      >
        <LogoCirculo imagenLogo={imagenLogo} />

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeTitle,
            color: theme.ink,
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            Modo operativo
          </h1>
          <p style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: error ? theme.weightMedium : theme.weightRegular,
            color: error ? theme.danger : theme.muted,
            margin: 0,
            minHeight: 22,
            transition: `color ${theme.transitionFast}`,
          }}>
            {error || "Ingresá las credenciales del local"}
          </p>
        </div>

        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <Field
            label="Usuario"
            value={usuario}
            onChange={(v) => { setUsuario(v); setError(null); }}
            placeholder="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={enviando}
          />
          <Field
            label="Contraseña"
            value={password}
            onChange={(v) => { setPassword(v); setError(null); }}
            placeholder="contraseña"
            type="password"
            autoComplete="current-password"
            disabled={enviando}
          />
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
