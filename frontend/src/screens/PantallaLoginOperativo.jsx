// /frontend/src/screens/PantallaLoginOperativo.jsx
// Pantalla de login del modo operativo. Es la primera pantalla que ve el iPad
// del local mientras no haya un tokenOperativo válido en localStorage.
// Una vez logueado el operativo, esta pantalla no vuelve a aparecer hasta que:
//   1. Alguien presione el botón de logout en MainScreen, o
//   2. El backend devuelva 401 (token expirado a los 30d, o credenciales rotadas).
//
// Layout: `MarcoAcceso` (components/ui), el marco compartido con el login del
// panel y la recuperación: la foto del local con un blur MÁS fuerte (10px) que el
// resto, para reforzar la sensación de "bloqueo / todavía no ingresaste al
// sistema", y la card clara centrada con el logo arriba. El overlay del marco
// scrollea: si sube el teclado del iPad, el form scrollea en vez de recortarse.
//
// La contraseña tiene el botón ojo de `Field` (`revelable`). Debajo de
// "Ingresar", "¿Olvidaste tu contraseña?" cambia el contenido de la card por
// `SolicitudRecuperacion`, que manda el link al mail del dueño (F6 de
// plan_mejoras_operativas.md).
//
// Props:
//   onAcceso     — callback(token) tras login exitoso. App.jsx lo usa para
//                  actualizar su estado tokenOperativo y navegar a "main".
//   imagenLogo   — URL del logo (tenant_imagen tipo='logo'). Fallback: Lock.
//   imagenLocal  — URL de la foto del local (tenant_imagen tipo='local').
//                  Si no hay, el fondo cae a surfaceAlt liso.
//   avisoAcceso  — { mensaje, conContacto } | null. Falla de acceso detectada al
//                  abrir el sistema (subdominio que no existe, servidor caído;
//                  ver `problemaDeAcceso`). Se muestra antes de que tipeen nada,
//                  hasta la primera respuesta del login.

import { useState } from "react";
import {
  Field, Button, LogoCirculo, ContactoSoporte, MarcoAcceso, EncabezadoAcceso, BotonEnlace,
} from "../components/ui";
import SolicitudRecuperacion from "./SolicitudRecuperacion.jsx";
import { loginOperativo } from "../services/api";
import { fallaDeLogin } from "../utils/errores";

/**
 * PantallaLoginOperativo
 * Renderiza el formulario de login operativo (usuario + password).
 * Maneja su propio estado local de inputs, error inline y flag de envío.
 * La persistencia del token ocurre dentro de loginOperativo() en api.js.
 */
export default function PantallaLoginOperativo({ onAcceso, imagenLogo, imagenLocal, avisoAcceso = null }) {
  const [usuario,  setUsuario]  = useState("");
  const [password, setPassword] = useState("");
  // error: { mensaje, conContacto } del último intento, o null.
  const [error,    setError]    = useState(null);
  const [enviando, setEnviando] = useState(false);
  // huboRespuesta: ya se intentó un login, así que el aviso de la carga inicial
  // (avisoAcceso) deja de aplicar: manda lo que respondió el login.
  const [huboRespuesta, setHuboRespuesta] = useState(false);
  // olvido: se está pidiendo el link de recuperación (la card muestra SolicitudRecuperacion).
  const [olvido, setOlvido] = useState(false);

  /**
   * submit — valida que los campos no estén vacíos, llama a loginOperativo y
   * dispara el callback onAcceso si todo sale bien.
   */
  const submit = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError({ mensaje: "Ingresá usuario y contraseña.", conContacto: false });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const token = await loginOperativo(usuario.trim(), password);
      onAcceso(token);
    } catch (err) {
      console.error('[pantallaLoginOperativo] Error en submit:', err.message, '| status:', err.status);
      // "Credenciales inválidas" solo con un 401. Un subdominio que no existe,
      // el servidor caído o un rate limit dicen su causa (fallaDeLogin). Sin
      // red, el genérico: no son las credenciales lo que falló.
      setError(fallaDeLogin(err, "Credenciales inválidas", "No se pudo iniciar sesión. Intentá de nuevo."));
      setPassword(""); // limpia la password para no exponerla
    } finally {
      setHuboRespuesta(true);
      setEnviando(false);
    }
  };

  // Lo que se muestra ahora: el error del último intento, o si todavía no hubo
  // ninguno, la falla que se detectó al abrir el sistema.
  const errorVisible = error ?? (huboRespuesta ? null : avisoAcceso);

  if (olvido) {
    return (
      <MarcoAcceso imagenLocal={imagenLocal} blurPx={10}>
        <LogoCirculo imagenLogo={imagenLogo} />
        <SolicitudRecuperacion tipo="operativo" onVolver={() => setOlvido(false)} />
      </MarcoAcceso>
    );
  }

  return (
    // blurPx 10: más desenfoque que MainScreen (4) → sensación de "bloqueo".
    <MarcoAcceso imagenLocal={imagenLocal} blurPx={10} onSubmit={submit}>
      <LogoCirculo imagenLogo={imagenLogo} />

      <EncabezadoAcceso
        titulo="Modo operativo"
        bajada={errorVisible?.mensaje ?? "Ingresá las credenciales del local"}
        error={Boolean(errorVisible)}
      />

      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <Field
          label="Usuario"
          name="username"
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
          name="password"
          value={password}
          onChange={(v) => { setPassword(v); setError(null); }}
          placeholder="contraseña"
          type="password"
          revelable
          autoComplete="current-password"
          disabled={enviando}
        />
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </div>

      {errorVisible?.conContacto && <ContactoSoporte />}

      {/* Margen negativo: el botón mide 44 de alto (touch target), pero el texto
          queda a la distancia de un renglón del botón de arriba. */}
      <div style={{ marginTop: -12 }}>
        <BotonEnlace onClick={() => setOlvido(true)} disabled={enviando}>
          ¿Olvidaste tu contraseña?
        </BotonEnlace>
      </div>
    </MarcoAcceso>
  );
}
