// /frontend/src/screens/SolicitudRecuperacion.jsx
// El "¿Olvidaste…?" de los dos logins (F6 de plan_mejoras_operativas.md): pide
// que le manden al dueño un link para crear una contraseña del iPad o un PIN de
// administrador nuevos. Se dibuja dentro de la misma card del login (debajo del
// logo), sin pantalla nueva.
//
// Pasos:
//   confirmar → explica a dónde llega el link y que vence en 1 hora.
//   enviado   → "Te mandamos un mail a fa•••@gmail.com".
//   sinMail   → el local no tiene mail del dueño cargado: escribir al soporte.
//   falla     → sin red, servidor caído, demasiados intentos (429): la causa.
// El backend responde lo mismo aunque el mail no salga, o si ya se pidió uno hace
// menos de 2 minutos: la pantalla no puede (ni debe) distinguirlo.

import { useEffect, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { Button, ContactoSoporte, EncabezadoAcceso } from '../components/ui';
import { solicitarRecuperacion } from '../services/api';
import { mensajeDeError, problemaDeAcceso } from '../utils/errores';

// Textos que cambian según qué se olvidó.
const TEXTOS = {
  operativo: {
    titulo: '¿Olvidaste tu contraseña?',
    queSeCrea: 'crear una contraseña nueva para el iPad',
  },
  pin_admin: {
    titulo: '¿Olvidaste el PIN?',
    queSeCrea: 'elegir un PIN de administrador nuevo',
  },
};

const MENSAJE_FALLA = 'No se pudo pedir el mail. Revisá la conexión e intentá de nuevo.';

/**
 * Parrafo (interna)
 * Texto de la card, centrado, en el gris de lectura.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.color] - Color del texto (default: muted).
 * @returns {JSX.Element}
 */
function Parrafo({ children, color = theme.muted }) {
  return (
    <p style={{
      margin: 0,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      lineHeight: 1.5,
      color,
      textAlign: 'center',
    }}>
      {children}
    </p>
  );
}

/**
 * Nota (interna)
 * Recuadro gris con una aclaración (ej. "Si sos barbero…").
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function Nota({ children }) {
  return (
    <p style={{
      margin: 0,
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 16px',
      background: theme.surfaceAlt,
      borderRadius: theme.radius,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      lineHeight: 1.5,
      color: theme.inkSoft,
      textAlign: 'center',
    }}>
      {children}
    </p>
  );
}

/**
 * SolicitudRecuperacion
 * Contenido de la card del login mientras se pide el link de recuperación.
 * @param {Object} props
 * @param {'operativo'|'pin_admin'} props.tipo - Qué credencial se recupera.
 * @param {Function} props.onVolver - Vuelve al formulario del login.
 * @returns {JSX.Element}
 */
export default function SolicitudRecuperacion({ tipo, onVolver }) {
  // paso: 'confirmar' | 'enviado' | 'sinMail' | 'falla'
  const [paso, setPaso] = useState('confirmar');
  const [enviando, setEnviando] = useState(false);
  const [email, setEmail] = useState('');
  // falla: { mensaje, conContacto } del último pedido que no salió.
  const [falla, setFalla] = useState(null);
  const tituloRef = useRef(null);
  const textos = TEXTOS[tipo];

  // Cada paso nuevo lleva el foco al título, así el lector de pantalla lo anuncia
  // (el contenido cambia dentro de la misma card, sin navegar).
  useEffect(() => {
    tituloRef.current?.focus();
  }, [paso]);

  /**
   * mandar — pide el mail y pasa al paso que corresponda según la respuesta.
   */
  const mandar = async () => {
    setEnviando(true);
    try {
      const respuesta = await solicitarRecuperacion(tipo);
      if (respuesta.enviado) {
        setEmail(respuesta.email ?? '');
        setPaso('enviado');
      } else {
        setPaso('sinMail');
      }
    } catch (err) {
      console.error('[solicitudRecuperacion] Error en mandar:', err.message, '| status:', err.status);
      // Subdominio, error interno o servidor caído dicen su causa; un 429 trae su
      // texto del servidor; sin red, el genérico.
      setFalla(problemaDeAcceso(err) ?? { mensaje: mensajeDeError(err, MENSAJE_FALLA), conContacto: false });
      setPaso('falla');
    } finally {
      setEnviando(false);
    }
  };

  const botonVolver = (
    <Button variant="ghost" onClick={onVolver} disabled={enviando}>Volver</Button>
  );

  if (paso === 'enviado') {
    return (
      <>
        <span aria-hidden="true" style={{
          width: 48, height: 48, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.successSoft, color: theme.success,
        }}>
          <MailCheck size={24} strokeWidth={1.75} />
        </span>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="Revisá el mail" />
        <Parrafo>
          Te mandamos un mail a <strong style={{ color: theme.ink, fontWeight: theme.weightMedium }}>{email}</strong> con
          un link para {textos.queSeCrea}. El link vence en 1 hora.
        </Parrafo>
        <Nota>Si no lo ves en unos minutos, revisá la carpeta de spam.</Nota>
        {botonVolver}
      </>
    );
  }

  if (paso === 'sinMail') {
    return (
      <>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="No hay un mail cargado" />
        <Parrafo>
          El local no tiene cargado el mail del dueño, así que no podemos mandarte el link.
          Escribinos y te ayudamos:
        </Parrafo>
        <ContactoSoporte />
        {botonVolver}
      </>
    );
  }

  return (
    <>
      <EncabezadoAcceso
        tituloRef={tituloRef}
        titulo={textos.titulo}
        bajada={paso === 'falla' ? falla?.mensaje : null}
        error={paso === 'falla'}
      />
      <Parrafo>
        Te mandamos un link al mail del dueño del local para {textos.queSeCrea}.
        El link vence en 1 hora.
      </Parrafo>
      {tipo === 'pin_admin' && (
        <Nota>Si sos barbero, pedile un PIN nuevo al dueño.</Nota>
      )}
      {paso === 'falla' && falla?.conContacto && <ContactoSoporte />}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button onClick={mandar} disabled={enviando}>
          {enviando ? 'Mandando…' : (paso === 'falla' ? 'Probar de nuevo' : 'Mandar el mail')}
        </Button>
        {botonVolver}
      </div>
    </>
  );
}
