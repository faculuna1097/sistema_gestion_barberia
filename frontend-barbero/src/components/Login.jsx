// /frontend-barbero/src/components/Login.jsx
// Pantalla de login de la app del barbero.
// Dos fases dentro de la misma card (MarcoAcceso, con la foto del local de
// fondo, como los logins del iPad y del panel):
//   1. Selector: la marca del local y los barberos en una grilla de avatares.
//      El último que entró desde este celular va primero.
//   2. Teclado de PIN de 4 dígitos.
// Rediseñada el 2026-11-13 (F5 de plan_mejoras_operativas.md). El flujo del PIN
// (pasos, llamadas, estados y mensajes) es el de antes.
// Props:
//   onAcceso(token, barbero) — callback cuando el login es exitoso.
//   marca — { cargando, nombreNegocio, logoUrl, imagenLocal }: la carga App
//     (una sola vez, también para el título y el favicon del tab).

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Delete, AlertCircle } from 'lucide-react';

import { getBarberos, loginBarbero } from '../services/api.js';
import { problemaDeAcceso, fallaDeLogin } from '../utils/errores.js';
import { leerUltimoBarbero } from '../utils/sesion.js';
import { theme } from '../theme/tokens.js';
import { useHover, useHoverPresion } from '../hooks/useHover.js';
import {
  MarcoAcceso,
  EncabezadoAcceso,
  Skeleton,
  EmptyState,
  AvatarIniciales,
  Button,
} from './ui';

// Estados de la fase PIN. Renombramos para evitar shadowing con `estado` local.
const PIN_ESTADO = { IDLE: 'idle', ERROR: 'error', EXITO: 'exito' };

const MENSAJE_PIN_INCORRECTO = 'PIN incorrecto. Intentá de nuevo.';

// Largo del PIN.
const LARGO_PIN = 4;

// Distribución del teclado de PIN. `null` = celda vacía (esquina inferior izquierda).
const TECLAS_PIN = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'borrar'],
];

/**
 * ordenarConUltimo
 * Pone primero al último barbero que entró desde este celular y deja el resto
 * en el orden que vino del backend (alfabético). Si ese barbero ya no está en
 * la lista (dado de baja), la lista queda igual.
 * @param {Array<{id: string, nombre: string}>} barberos
 * @param {string|null} idUltimo
 * @returns {Array<{id: string, nombre: string}>} Lista nueva (no muta la original)
 */
function ordenarConUltimo(barberos, idUltimo) {
  const ultimo = barberos.find((b) => b.id === idUltimo);
  if (!ultimo) return barberos;
  return [ultimo, ...barberos.filter((b) => b.id !== idUltimo)];
}

/**
 * medidasGrilla
 * Columnas y tamaño de avatar de la grilla de barberos según cuántos son, para
 * que se vea llena con los casos de hoy (2 a 5) y entre sin scroll hasta 9:
 * 2 → 2 columnas; 3 → una fila de 3; 4 → 2×2; 5 o más → 3 columnas (la última
 * fila, centrada). Avatar de 64 hasta 4 barberos y de 56 desde 5.
 * @param {number} cantidad - Cantidad de barberos
 * @returns {{ columnas: number, avatar: number }}
 */
function medidasGrilla(cantidad) {
  if (cantidad === 3) return { columnas: 3, avatar: 64 };
  if (cantidad <= 4) return { columnas: 2, avatar: 64 };
  return { columnas: 3, avatar: 56 };
}

/**
 * Login
 * Maneja la autenticación del barbero. Alterna entre dos fases dentro de la
 * misma card: SelectorBarbero (elegir quién es) y PantallaPin (ingresar PIN).
 * @param {(token: string, barbero: {id, nombre}) => void} props.onAcceso
 * @param {{ cargando: boolean, nombreNegocio: string|null, logoUrl: string|null,
 *   imagenLocal: string|null }} props.marca - Marca del local. `cargando` es
 *   true hasta que App termina de pedirla; después, lo que falte queda en null
 *   y la pantalla funciona igual sin eso.
 */
export default function Login({ onAcceso, marca }) {
  const [barberos, setBarberos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [fase, setFase] = useState('selector'); // 'selector' | 'pin'
  const [barberoSel, setBarberoSel] = useState(null);
  // Último barbero que entró desde este celular: se lee una vez al montar.
  const [idUltimo] = useState(leerUltimoBarbero);
  // true después de un cambio de fase: la fase nueva lleva el foco a su título
  // (para el lector de pantalla). En la primera carga no se mueve el foco.
  const [huboCambioDeFase, setHuboCambioDeFase] = useState(false);

  /**
   * cargarBarberos
   * Llama al endpoint público de barberos. Reusable por el botón "Reintentar".
   */
  const cargarBarberos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await getBarberos();
      setBarberos(data);
    } catch (err) {
      console.error('[Login] Error cargando barberos:', err.message, '| status:', err.status);
      // Subdominio que no existe o servidor caído: se dice la causa. Sin red,
      // el mensaje de siempre.
      setErrorCarga(problemaDeAcceso(err) ?? 'No se pudo cargar la lista de barberos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarBarberos(); }, [cargarBarberos]);

  const barberosOrdenados = useMemo(
    () => ordenarConUltimo(barberos, idUltimo),
    [barberos, idUltimo],
  );

  /**
   * seleccionarBarbero
   * Avanza a la fase de PIN con el barbero elegido.
   * @param {{id, nombre}} b
   */
  const seleccionarBarbero = (b) => {
    setHuboCambioDeFase(true);
    setBarberoSel(b);
    setFase('pin');
  };

  /**
   * volverASelector
   * Regresa a la fase de selección. Limpia el barbero seleccionado.
   */
  const volverASelector = () => {
    setHuboCambioDeFase(true);
    setFase('selector');
    setBarberoSel(null);
  };

  return (
    <MarcoAcceso
      imagenLocal={marca.imagenLocal}
      esquina={fase === 'pin' ? <BotonVolver onClick={volverASelector} /> : null}
    >
      {fase === 'selector' ? (
        <SelectorBarbero
          barberos={barberosOrdenados}
          cargando={cargando}
          error={errorCarga}
          marca={marca}
          enfocarTitulo={huboCambioDeFase}
          onReintentar={cargarBarberos}
          onElegir={seleccionarBarbero}
        />
      ) : (
        <PantallaPin
          barbero={barberoSel}
          enfocarTitulo={huboCambioDeFase}
          onAcceso={onAcceso}
        />
      )}
    </MarcoAcceso>
  );
}

/**
 * useFocoAlMontar
 * Lleva el foco a un elemento al montar, si `activo`. Lo usan las dos fases
 * para que, al pasar de una a otra, el lector de pantalla anuncie la nueva.
 * @param {boolean} activo
 * @returns {React.RefObject} Ref para el elemento a enfocar
 */
function useFocoAlMontar(activo) {
  const ref = useRef(null);
  useEffect(() => {
    if (activo) ref.current?.focus();
    // Solo al montar: `activo` se lee una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * BotonVolver
 * "← Volver" de la esquina superior izquierda de la card, en la fase del PIN.
 * 44 px de alto (§5.4). Hover solo con mouse.
 * @param {() => void} props.onClick
 */
function BotonVolver({ onClick }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px 0 8px',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        color: theme.inkSoft,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}`,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Volver
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1 — Selector de barbero
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SelectorBarbero
 * Bloque de marca (logo + nombre del local) y, debajo, la grilla de barberos.
 * Tres estados: cargando (skeletons), error (EmptyState con reintentar), o la
 * grilla. Mientras App carga la marca, el logo y el nombre son skeletons del
 * mismo tamaño, así no salta nada cuando llegan.
 * @param {Array<{id, nombre}>} props.barberos - Ya ordenados (el último primero)
 * @param {boolean} props.cargando
 * @param {string|null} props.error
 * @param {{ cargando: boolean, nombreNegocio: string|null, logoUrl: string|null }} props.marca
 * @param {boolean} props.enfocarTitulo - Llevar el foco al título al montar
 * @param {() => void} props.onReintentar
 * @param {(b) => void} props.onElegir
 */
function SelectorBarbero({ barberos, cargando, error, marca, enfocarTitulo, onReintentar, onElegir }) {
  const tituloRef = useFocoAlMontar(enfocarTitulo);
  // La grilla solo aparece mientras carga o cuando hay barberos; en error /
  // lista vacía se muestra un EmptyState en su lugar.
  const mostrarGrilla = cargando || (!error && barberos.length > 0);

  return (
    <>
      {marca.cargando
        ? <Skeleton width={72} height={72} radius={999} />
        : <LogoNegocio src={marca.logoUrl} />}

      <EncabezadoAcceso
        tituloRef={tituloRef}
        titulo={marca.cargando
          ? <Skeleton width={180} height={30} style={{ margin: '0 auto' }} />
          : (marca.nombreNegocio || 'Iniciar sesión')}
        bajada="Elegí tu perfil para continuar"
      />

      {mostrarGrilla && (
        cargando
          ? <GrillaBarberosSkeleton />
          : <GrillaBarberos barberos={barberos} onElegir={onElegir} />
      )}

      {!cargando && error && (
        <EmptyState
          glyph={<AlertCircle size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No pudimos cargar la lista"
          body={error}
          action={
            <Button variant="secondary" full={false} onClick={onReintentar}>
              Reintentar
            </Button>
          }
        />
      )}

      {!cargando && !error && barberos.length === 0 && (
        <EmptyState
          glyph={<AlertCircle size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="No hay barberos cargados"
          body="Pediles a tu admin que te dé de alta en el sistema."
        />
      )}
    </>
  );
}

/**
 * LogoNegocio
 * Logo del tenant dentro de un círculo de 72px (`surface` + borde hairline).
 * `objectFit: contain` no deforma logos no cuadrados. Solo se renderiza si hay URL.
 * @param {string|null} props.src - URL del logo del tenant
 */
function LogoNegocio({ src }) {
  if (!src) return null;
  return (
    <div style={{
      width: 72,
      height: 72,
      flexShrink: 0,
      boxSizing: 'border-box',
      borderRadius: 999,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <img
        src={src}
        alt="Logo del negocio"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

/**
 * GrillaBarberos
 * Los barberos como avatares grandes con el nombre debajo, en una grilla que
 * se acomoda a la cantidad (medidasGrilla). Es una lista (<ul>) de botones.
 * @param {Array<{id, nombre}>} props.barberos
 * @param {(b) => void} props.onElegir
 */
function GrillaBarberos({ barberos, onElegir }) {
  const { columnas, avatar } = medidasGrilla(barberos.length);
  return (
    <ul style={estiloGrilla}>
      {barberos.map((b) => (
        <li key={b.id} style={{ width: `${100 / columnas}%`, display: 'flex' }}>
          <BotonBarbero barbero={b} tamAvatar={avatar} onClick={() => onElegir(b)} />
        </li>
      ))}
    </ul>
  );
}

// Grilla de barberos: filas que se completan de izquierda a derecha, con la
// última centrada.
const estiloGrilla = {
  width: '100%',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  rowGap: 4,
};

/**
 * BotonBarbero
 * Un barbero de la grilla: avatar de iniciales y el nombre completo debajo (en
 * hasta dos renglones, sin cortar con "…"). Todo el bloque es el botón. Hover
 * solo con mouse; el "apretado" también en táctil.
 * @param {{id, nombre}} props.barbero
 * @param {number} props.tamAvatar - Diámetro del avatar en px
 * @param {() => void} props.onClick
 */
function BotonBarbero({ barbero, tamAvatar, onClick }) {
  const [{ hover, presion }, eventos] = useHoverPresion();
  return (
    <button
      type="button"
      onClick={onClick}
      {...eventos}
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '8px 4px',
        background: presion || hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Las iniciales repiten el nombre: el lector de pantalla lee solo el nombre. */}
      <span aria-hidden="true"><AvatarIniciales nombre={barbero.nombre} size={tamAvatar} /></span>
      <span style={{
        maxWidth: '100%',
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        lineHeight: 1.3,
        color: theme.ink,
        textAlign: 'center',
        overflowWrap: 'anywhere',
        // Hasta dos renglones; un nombre más largo que eso se corta.
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {barbero.nombre}
      </span>
    </button>
  );
}

/**
 * GrillaBarberosSkeleton
 * Silueta de la grilla mientras carga la lista: tres lugares (avatar + nombre)
 * con las medidas de una grilla de 3.
 */
function GrillaBarberosSkeleton() {
  const { columnas, avatar } = medidasGrilla(3);
  return (
    <ul style={estiloGrilla} aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} style={{
          width: `${100 / columnas}%`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '8px 4px',
        }}>
          <Skeleton width={avatar} height={avatar} radius={999} />
          <Skeleton width={56} height={14} style={{ margin: '2px 0 2px' }} />
        </li>
      ))}
    </ul>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — Pantalla del PIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PantallaPin
 * Avatar del barbero + indicadores + teclado. Maneja shake en error y un
 * timeout de 600ms post-éxito antes de invocar onAcceso.
 * @param {{id, nombre}} props.barbero
 * @param {boolean} props.enfocarTitulo - Llevar el foco al título al montar
 * @param {(token, barbero) => void} props.onAcceso
 */
function PantallaPin({ barbero, enfocarTitulo, onAcceso }) {
  const tituloRef = useFocoAlMontar(enfocarTitulo);
  const [pin, setPin] = useState('');
  // Copia del PIN para leerlo fuera del render (teclado físico rápido): así
  // agregarDigito no depende de un `pin` viejo ni llama a validarPin desde
  // adentro de un updater de setState (React puede ejecutarlo dos veces, y
  // salían dos POST de login por cada PIN).
  const pinRef = useRef('');
  const [estado, setEstado] = useState(PIN_ESTADO.IDLE);
  const [shake, setShake] = useState(false);
  // falla: mensaje de un login que falló por algo que no es el PIN
  // (subdominio, servidor, rate limit, sin red). Queda hasta el próximo dígito.
  const [falla, setFalla] = useState(null);

  /**
   * cambiarPin
   * Actualiza el PIN en el estado y en la ref.
   * @param {string} nuevo
   */
  const cambiarPin = useCallback((nuevo) => {
    pinRef.current = nuevo;
    setPin(nuevo);
  }, []);

  /**
   * validarPin
   * Llama al backend con el PIN ingresado. Maneja éxito (timeout + onAcceso),
   * PIN incorrecto (401: shake + reset) y cualquier otra falla (borra el PIN
   * sin shake, porque no es culpa de lo que tipeó, y muestra la causa).
   * @param {string} pinIngresado - PIN de 4 dígitos
   */
  const validarPin = useCallback(async (pinIngresado) => {
    try {
      const { token, barbero: bDevuelto } = await loginBarbero(barbero.id, pinIngresado);
      setEstado(PIN_ESTADO.EXITO);
      setTimeout(() => onAcceso(token, bDevuelto), 600);
    } catch (err) {
      console.error('[Login] Error en validarPin:', err.message, '| status:', err.status);
      if (err.status !== 401) {
        cambiarPin('');
        setFalla(fallaDeLogin(err, MENSAJE_PIN_INCORRECTO, 'No se pudo iniciar sesión. Intentá de nuevo.'));
        return;
      }
      setEstado(PIN_ESTADO.ERROR);
      setShake(true);
      setTimeout(() => {
        cambiarPin('');
        setEstado(PIN_ESTADO.IDLE);
        setShake(false);
      }, 800);
    }
  }, [barbero, onAcceso, cambiarPin]);

  /**
   * agregarDigito
   * Agrega un dígito. Si completa el PIN, dispara la validación.
   * @param {string} digito - '0' a '9'
   */
  const agregarDigito = useCallback((digito) => {
    const actual = pinRef.current;
    if (actual.length >= LARGO_PIN || estado === PIN_ESTADO.EXITO) return;
    const nuevo = actual + digito;
    cambiarPin(nuevo);
    setEstado(PIN_ESTADO.IDLE);
    setFalla(null);
    if (nuevo.length === LARGO_PIN) validarPin(nuevo);
  }, [estado, validarPin, cambiarPin]);

  /**
   * borrarDigito
   * Borra el último dígito si hay alguno y no estamos en éxito.
   */
  const borrarDigito = useCallback(() => {
    if (estado === PIN_ESTADO.EXITO) return;
    setEstado(PIN_ESTADO.IDLE);
    setFalla(null);
    cambiarPin(pinRef.current.slice(0, -1));
  }, [estado, cambiarPin]);

  // Teclado físico (números + backspace), en la compu.
  useEffect(() => {
    const manejarTeclado = (e) => {
      if (e.key >= '0' && e.key <= '9') agregarDigito(e.key);
      if (e.key === 'Backspace') borrarDigito();
    };
    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [agregarDigito, borrarDigito]);

  const enError = estado === PIN_ESTADO.ERROR || Boolean(falla);
  const mensaje = estado === PIN_ESTADO.ERROR
    ? MENSAJE_PIN_INCORRECTO
    : (falla ?? 'Ingresá tu PIN de 4 dígitos');

  return (
    <>
      <span aria-hidden="true"><AvatarIniciales nombre={barbero.nombre} size={64} /></span>

      <EncabezadoAcceso
        tituloRef={tituloRef}
        titulo={barbero.nombre}
        bajada={mensaje}
        error={enError}
      />

      {/* Indicadores de dígito (4 dots) con shake en error */}
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          padding: '4px 0',
          animation: shake ? 'om-shake 0.5s ease' : undefined,
        }}
      >
        {Array.from({ length: LARGO_PIN }).map((_, i) => (
          <DotIndicador key={i} llenoYActivo={i < pin.length} estado={estado} />
        ))}
      </div>

      {/* Teclado numérico */}
      <div style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {TECLAS_PIN.flat().map((tecla, i) => {
          if (tecla === null) return <div key={i} />;
          if (tecla === 'borrar') {
            return (
              <TeclaPin key={i} onClick={borrarDigito} aria="Borrar último dígito" sinFondo>
                <Delete size={22} strokeWidth={1.75} aria-hidden="true" />
              </TeclaPin>
            );
          }
          return (
            <TeclaPin key={i} onClick={() => agregarDigito(tecla)} aria={`Dígito ${tecla}`}>
              {tecla}
            </TeclaPin>
          );
        })}
      </div>

      <p style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        lineHeight: 1.5,
        textAlign: 'center',
        margin: 0,
      }}>
        ¿Olvidaste tu PIN? Pedile uno nuevo al dueño.
      </p>
    </>
  );
}

/**
 * DotIndicador
 * Círculo del PIN. Lleno cuando hay dígito en esa posición; en error/éxito
 * todos toman color contextual.
 * @param {boolean} props.llenoYActivo
 * @param {'idle'|'error'|'exito'} props.estado
 */
function DotIndicador({ llenoYActivo, estado }) {
  let bg, border;
  if (estado === PIN_ESTADO.ERROR) {
    bg = theme.danger;
    border = theme.danger;
  } else if (estado === PIN_ESTADO.EXITO) {
    bg = theme.success;
    border = theme.success;
  } else if (llenoYActivo) {
    bg = theme.accent;
    border = theme.accent;
  } else {
    bg = 'transparent';
    border = theme.mutedSoft;
  }

  return (
    <div style={{
      width: 14,
      height: 14,
      borderRadius: 999,
      background: bg,
      border: `2px solid ${border}`,
      transform: llenoYActivo ? 'scale(1.1)' : 'scale(1)',
      transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, transform ${theme.transitionFast}`,
    }} />
  );
}

/**
 * TeclaPin
 * Botón individual del teclado: 56 px de alto, fondo `surfaceAlt` sobre la
 * card blanca. Hover solo con mouse; el "apretado" también en táctil
 * (useHoverPresion).
 * @param {Function} props.onClick
 * @param {string} props.aria - aria-label del botón
 * @param {boolean} [props.sinFondo=false] - Sin fondo en reposo (la tecla de
 *   borrar, que es una acción y no un dígito)
 * @param {ReactNode} props.children
 */
function TeclaPin({ onClick, aria, sinFondo = false, children }) {
  const [{ hover, presion }, eventos] = useHoverPresion();
  const fondoReposo = sinFondo ? 'transparent' : theme.surfaceAlt;

  return (
    <button
      type="button"
      onClick={onClick}
      {...eventos}
      aria-label={aria}
      style={{
        height: 56,
        borderRadius: theme.radius,
        background: presion || hover ? theme.hairline : fondoReposo,
        border: 'none',
        color: theme.ink,
        fontFamily: theme.body,
        fontSize: theme.sizeTitle,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background ${theme.transitionFast}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  );
}
