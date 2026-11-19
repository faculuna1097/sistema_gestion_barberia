// /frontend/src/screens/PantallaRecuperacion.jsx
// Pantalla del link de recuperación (F6 de plan_mejoras_operativas.md): el mail
// del "¿Olvidaste…?" lleva a <local>.barbermanager.app/#recuperar=<token>, y acá el
// dueño elige la contraseña del iPad o el PIN de administrador nuevos.
//
// La abre App.jsx antes que cualquier otra pantalla cuando la URL trae el
// fragmento (y lo saca de la URL apenas lo lee). El dueño la abre casi siempre
// desde el celular, donde no hay sesión del iPad: no depende de ningún token.
//
// Estados:
//   validando  → se pregunta al backend si el link sirve (sin usarlo).
//   invalido   → venció, ya se usó o no existe: pedir uno nuevo.
//   noValidado → no se pudo preguntar (sin red, servidor caído): "Reintentar".
//   formulario → contraseña (8+) o PIN (4 dígitos) con su confirmación. Un PIN que
//                ya usa un barbero (409) o un error de red quedan en el formulario.
//   listo      → cambiada. "Ir al inicio" sigue el flujo normal de App.jsx.
//
// Reglas y mensajes de la credencial: utils/credenciales.js (los mismos que los
// modales de Gestión → Seguridad).

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import {
  Button, Field, LogoCirculo, IconoAlerta, ContactoSoporte, MarcoAcceso, EncabezadoAcceso,
} from '../components/ui';
import { validarRecuperacion, usarRecuperacion, CODIGO_TOKEN_INVALIDO } from '../services/api';
import { ErrorServidor, mensajeDeError, problemaDeAcceso } from '../utils/errores';
import {
  PASSWORD_MIN_CARACTERES,
  soloDigitosPin,
  validarPasswordNueva,
  validarPinNuevo,
} from '../utils/credenciales';

// Textos del formulario y del final, según qué se recupera.
const TEXTOS = {
  operativo: {
    titulo: 'Nueva contraseña del iPad',
    bajada: 'Es la contraseña con la que el iPad del local entra al sistema.',
    boton: 'Guardar contraseña',
    listo: 'Ya podés entrar con tu contraseña nueva.',
    aclaracion: 'Los iPads que estaban adentro van a pedir la contraseña nueva.',
  },
  pin_admin: {
    titulo: 'Nuevo PIN de administrador',
    bajada: 'Es el PIN de 4 números con el que entrás al panel.',
    boton: 'Guardar PIN',
    listo: 'Ya podés entrar al panel con tu PIN nuevo.',
    aclaracion: 'Si el panel estaba abierto en otro dispositivo, va a pedir el PIN nuevo.',
  },
};

const MENSAJE_SIN_RED_VALIDAR = 'No se pudo revisar el link. Revisá la conexión e intentá de nuevo.';
const MENSAJE_SIN_RED_GUARDAR = 'No se pudo guardar. Revisá la conexión e intentá de nuevo.';
const MENSAJE_PIN_EN_USO = 'Ese PIN ya lo usa un barbero del local. Elegí otro.';

/**
 * esTokenInvalido
 * @param {unknown} err - Lo que atrapó el catch.
 * @returns {boolean} true si el backend dijo que el link venció, se usó o no existe.
 */
const esTokenInvalido = (err) => err instanceof ErrorServidor && err.codigo === CODIGO_TOKEN_INVALIDO;

/**
 * Parrafo (interna)
 * Texto centrado de la card.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function Parrafo({ children }) {
  return (
    <p style={{
      margin: 0, fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.5,
      color: theme.muted, textAlign: 'center',
    }}>
      {children}
    </p>
  );
}

/**
 * IconoEstado (interna)
 * Círculo con el ícono de un estado final (listo o link inválido).
 * @param {Object} props
 * @param {'success'|'danger'} props.tono
 * @param {React.ReactNode} props.children - El ícono.
 * @returns {JSX.Element}
 */
function IconoEstado({ tono, children }) {
  return (
    <span aria-hidden="true" style={{
      width: 48, height: 48, borderRadius: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tono === 'success' ? theme.successSoft : theme.dangerSoft,
      color: tono === 'success' ? theme.success : theme.danger,
    }}>
      {children}
    </span>
  );
}

/**
 * FormularioCredencial (interna)
 * Los dos campos (nueva y confirmación) del tipo que corresponda, con el error de
 * cada uno. No guarda nada: el submit lo maneja PantallaRecuperacion.
 * @param {Object} props
 * @param {'operativo'|'pin_admin'} props.tipo
 * @param {string} props.nueva
 * @param {string} props.confirmar
 * @param {Function} props.onCambiarNueva - Recibe el texto nuevo.
 * @param {Function} props.onCambiarConfirmar
 * @param {string|null} props.errorNueva - Error del servidor o de las reglas para el primer campo.
 * @param {string|null} props.errorConfirmar
 * @param {boolean} props.disabled
 * @returns {JSX.Element}
 */
function FormularioCredencial({
  tipo, nueva, confirmar, onCambiarNueva, onCambiarConfirmar, errorNueva, errorConfirmar, disabled,
}) {
  if (tipo === 'operativo') {
    return (
      <>
        <Field
          label="Nueva contraseña"
          type="password"
          revelable
          name="new-password"
          autoComplete="new-password"
          value={nueva}
          onChange={onCambiarNueva}
          placeholder={`Mínimo ${PASSWORD_MIN_CARACTERES} caracteres`}
          error={errorNueva ?? undefined}
          disabled={disabled}
          autoFocus
        />
        <Field
          label="Confirmar contraseña"
          type="password"
          revelable
          autoComplete="new-password"
          value={confirmar}
          onChange={onCambiarConfirmar}
          placeholder="Repetila"
          error={errorConfirmar ?? undefined}
          disabled={disabled}
        />
      </>
    );
  }
  return (
    <>
      <Field
        label="Nuevo PIN"
        type="password"
        revelable="PIN"
        inputMode="numeric"
        autoComplete="off"
        value={nueva}
        onChange={(v) => onCambiarNueva(soloDigitosPin(v))}
        placeholder="4 números"
        error={errorNueva ?? undefined}
        disabled={disabled}
        autoFocus
      />
      <Field
        label="Confirmar PIN"
        type="password"
        revelable="PIN"
        inputMode="numeric"
        autoComplete="off"
        value={confirmar}
        onChange={(v) => onCambiarConfirmar(soloDigitosPin(v))}
        placeholder="Repetilo"
        error={errorConfirmar ?? undefined}
        disabled={disabled}
      />
    </>
  );
}

/**
 * PantallaRecuperacion
 * @param {Object} props
 * @param {string} props.token - El token del fragmento #recuperar=.
 * @param {string|null} [props.imagenLogo]
 * @param {string|null} [props.imagenLocal]
 * @param {Function} props.onIrAlInicio - Recibe el tipo recuperado ('operativo' |
 *   'pin_admin') si se cambió la credencial, o null si no. App.jsx decide a dónde ir.
 * @returns {JSX.Element}
 */
export default function PantallaRecuperacion({ token, imagenLogo, imagenLocal, onIrAlInicio }) {
  // estado: 'validando' | 'invalido' | 'noValidado' | 'formulario' | 'listo'
  const [estado, setEstado] = useState('validando');
  const [tipo, setTipo] = useState(null);
  // fallaValidar: { mensaje, conContacto } si no se pudo revisar el link.
  const [fallaValidar, setFallaValidar] = useState(null);
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  // errorServidorNueva: lo que respondió el backend sobre la credencial (PIN en uso,
  // no cumple las reglas). Va al primer campo y se borra al escribir.
  const [errorServidorNueva, setErrorServidorNueva] = useState(null);
  // fallaGuardar: { mensaje, conContacto } si el guardado no llegó (red, servidor).
  const [fallaGuardar, setFallaGuardar] = useState(null);
  const tituloRef = useRef(null);

  /**
   * validar — pregunta al backend si el link sirve y de qué tipo es.
   */
  const validar = useCallback(async () => {
    setEstado('validando');
    try {
      const respuesta = await validarRecuperacion(token);
      setTipo(respuesta.tipo);
      setEstado('formulario');
    } catch (err) {
      if (esTokenInvalido(err)) {
        setEstado('invalido');
        return;
      }
      console.error('[pantallaRecuperacion] Error en validar:', err.message, '| status:', err.status);
      setFallaValidar(problemaDeAcceso(err) ?? { mensaje: mensajeDeError(err, MENSAJE_SIN_RED_VALIDAR), conContacto: false });
      setEstado('noValidado');
    }
  }, [token]);

  useEffect(() => { validar(); }, [validar]);

  // Al llegar a un estado final, el foco va al título (el lector de pantalla lo
  // anuncia). En el formulario, el foco lo toma el primer campo (autoFocus).
  useEffect(() => {
    if (estado === 'invalido' || estado === 'listo' || estado === 'noValidado') tituloRef.current?.focus();
  }, [estado]);

  const reglas = tipo === 'pin_admin'
    ? { errorPassword: null, ...validarPinNuevo(nueva, confirmar) }
    : validarPasswordNueva(nueva, confirmar);

  /**
   * guardar — manda la credencial nueva. Si el link dejó de servir en el medio,
   * pasa a "inválido"; si la credencial no va (409, 400), el error queda en el
   * campo y el link sigue valiendo.
   * @param {Event} e - submit del formulario.
   */
  const guardar = async (e) => {
    e.preventDefault();
    if (!reglas.valida || guardando) return;
    setGuardando(true);
    setFallaGuardar(null);
    try {
      await usarRecuperacion(token, nueva);
      setNueva('');
      setConfirmar('');
      setEstado('listo');
    } catch (err) {
      if (esTokenInvalido(err)) {
        setEstado('invalido');
      } else if (err instanceof ErrorServidor && err.status === 409) {
        setErrorServidorNueva(MENSAJE_PIN_EN_USO);
      } else if (err instanceof ErrorServidor && err.status === 400 && err.message) {
        setErrorServidorNueva(err.message);
      } else {
        console.error('[pantallaRecuperacion] Error en guardar:', err.message, '| status:', err.status);
        setFallaGuardar(problemaDeAcceso(err) ?? { mensaje: mensajeDeError(err, MENSAJE_SIN_RED_GUARDAR), conContacto: false });
      }
    } finally {
      setGuardando(false);
    }
  };

  const textos = tipo ? TEXTOS[tipo] : null;
  const irAlInicio = () => onIrAlInicio(estado === 'listo' ? tipo : null);
  const botonInicio = <Button onClick={irAlInicio}>Ir al inicio</Button>;

  let contenido;
  if (estado === 'validando') {
    contenido = (
      <>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="Revisando el link…" />
        <Loader2
          size={28}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{ color: theme.muted, animation: 'spin 1s linear infinite' }}
        />
      </>
    );
  } else if (estado === 'invalido') {
    contenido = (
      <>
        <IconoEstado tono="danger"><IconoAlerta size={24} /></IconoEstado>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="El link venció o ya se usó" />
        <Parrafo>
          Pedí uno nuevo desde la pantalla de entrada, en «¿Olvidaste…?». Cada link sirve
          una sola vez y vence en 1 hora.
        </Parrafo>
        {botonInicio}
      </>
    );
  } else if (estado === 'noValidado') {
    contenido = (
      <>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="No se pudo abrir el link" bajada={fallaValidar?.mensaje} error />
        {fallaValidar?.conContacto && <ContactoSoporte />}
        <Button onClick={validar}>Reintentar</Button>
      </>
    );
  } else if (estado === 'listo') {
    contenido = (
      <>
        <IconoEstado tono="success"><CheckCircle2 size={24} strokeWidth={1.75} /></IconoEstado>
        <EncabezadoAcceso tituloRef={tituloRef} titulo="Listo" bajada={textos.listo} />
        <Parrafo>{textos.aclaracion}</Parrafo>
        {botonInicio}
      </>
    );
  } else {
    contenido = (
      <>
        <EncabezadoAcceso
          tituloRef={tituloRef}
          titulo={textos.titulo}
          bajada={fallaGuardar?.mensaje ?? textos.bajada}
          error={Boolean(fallaGuardar)}
        />
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormularioCredencial
            tipo={tipo}
            nueva={nueva}
            confirmar={confirmar}
            onCambiarNueva={(v) => { setNueva(v); setErrorServidorNueva(null); setFallaGuardar(null); }}
            onCambiarConfirmar={(v) => { setConfirmar(v); setFallaGuardar(null); }}
            errorNueva={errorServidorNueva ?? reglas.errorPassword}
            errorConfirmar={reglas.errorConfirmar}
            disabled={guardando}
          />
          <Button type="submit" disabled={!reglas.valida || guardando}>
            {guardando ? 'Guardando…' : textos.boton}
          </Button>
        </div>
        {fallaGuardar?.conContacto && <ContactoSoporte />}
      </>
    );
  }

  return (
    <MarcoAcceso
      imagenLocal={imagenLocal}
      blurPx={10}
      onSubmit={estado === 'formulario' ? guardar : undefined}
    >
      <LogoCirculo imagenLogo={imagenLogo} />
      {contenido}
    </MarcoAcceso>
  );
}
