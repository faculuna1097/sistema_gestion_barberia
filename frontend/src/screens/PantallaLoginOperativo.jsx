// /frontend/src/screens/PantallaLoginOperativo.jsx
// Pantalla de login del modo operativo. Es la primera pantalla que ve el iPad
// del local mientras no haya un tokenOperativo válido en localStorage.
// Una vez logueado el operativo, esta pantalla no vuelve a aparecer hasta que:
//   1. Alguien presione el botón de logout en MainScreen, o
//   2. El backend devuelva 401 (token expirado a los 30d, o credenciales rotadas).
//
// Layout: fondo full-screen con la foto del local vía `FondoLocal` (el mismo
// fondo compartido por MainScreen, los flujos y el login admin), con un blur
// MÁS fuerte (10px) que el resto para reforzar la sensación de "bloqueo /
// todavía no ingresaste al sistema". Card sólida centrada con shadowMd; el logo
// del tenant va dentro de un círculo arriba de la card. Sin foto, FondoLocal
// cae a `surfaceAlt` liso.
//
// La card vive dentro de un overlay scrollable (overflowY:auto): FondoLocal es
// overflow:hidden, así que el scroll propio garantiza que, si sube el teclado
// del iPad y achica el viewport, el form scrollee en vez de recortarse.
//
// Al montar este login, FondoLocal precarga la foto (`new Image()`): así, cuando
// el operativo entra a MainScreen, la foto ya está en cache y entra al instante.
// No se gatea el contenido (sin `esperarImagen`): el formulario debe ser usable
// de entrada; FondoLocal igual hace fade-in del fondo (mata el snap).
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
import FondoLocal from "../components/ui/FondoLocal.jsx";
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

  return (
    // blurPx 10: más desenfoque que MainScreen (4) → sensación de "bloqueo".
    // El velo y el fade los aporta FondoLocal (mismo fondo que el resto).
    <FondoLocal imagenLocal={imagenLocal} blurPx={10}>
      {/* Overlay scrollable: restaura el scroll que el login tenía antes
          (FondoLocal es overflow:hidden). Si sube el teclado del iPad y achica
          el viewport, el form scrollea en vez de recortarse. `margin:auto` en el
          form lo centra cuando sobra espacio y permite scroll cuando no. */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        padding: 24,
        boxSizing: 'border-box',
      }}>
        <form
          onSubmit={submit}
          style={{
            margin: 'auto',
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
    </FondoLocal>
  );
}
