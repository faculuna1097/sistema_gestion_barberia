// /frontend-barbero/src/components/Login.jsx
// Pantalla de login de la app del barbero.
// Dos fases:
//   1. Selector de barbero (lista del tenant, cards con avatar de iniciales).
//   2. Teclado de PIN de 4 dígitos.
// Props:
//   onAcceso(token, barbero) — callback cuando el login es exitoso.

import { useState, useEffect, useCallback } from 'react';
import { Delete, AlertCircle, ChevronRight } from 'lucide-react';

import { getBarberos, loginBarbero, getImagenesNegocio, getTenant } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import {
  PageContainer,
  TopBar,
  Card,
  Skeleton,
  EmptyState,
  AvatarIniciales,
  Button,
} from './ui';

// Estados de la fase PIN. Renombramos para evitar shadowing con `estado` local.
const PIN_ESTADO = { IDLE: 'idle', ERROR: 'error', EXITO: 'exito' };

// Distribución del teclado de PIN. `null` = celda vacía (esquina inferior izquierda).
const TECLAS_PIN = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'borrar'],
];

/**
 * Login
 * Maneja la autenticación del barbero. Internamente alterna entre dos sub-pantallas:
 * SelectorBarbero (elegir nombre) y PinKeyboard (ingresar PIN).
 * @param {(token: string, barbero: {id, nombre}) => void} props.onAcceso
 */
export default function Login({ onAcceso }) {
  const [barberos, setBarberos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [fase, setFase] = useState('selector'); // 'selector' | 'pin'
  const [barberoSel, setBarberoSel] = useState(null);

  // Logo y nombre del tenant para brandear la pantalla de login. Cargan
  // best-effort: si fallan, la pantalla funciona igual sin esos datos.
  const [logoUrl, setLogoUrl] = useState(null);
  const [nombreNegocio, setNombreNegocio] = useState(null);

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
      console.error('[Login] Error cargando barberos:', err.message);
      setErrorCarga('No se pudo cargar la lista de barberos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarBarberos(); }, [cargarBarberos]);

  // Carga del branding del tenant (logo + nombre) — independiente de los
  // barberos y best-effort: si algo falla, el login funciona igual.
  useEffect(() => {
    let activo = true;
    getImagenesNegocio()
      .then((imagenes) => {
        if (!activo) return;
        const logo = imagenes.find((img) => img.tipo === 'logo' && img.orden === 1);
        if (logo) setLogoUrl(logo.url);
      })
      .catch((err) => {
        console.warn('[Login] getImagenesNegocio — falló, login sin logo:', err.message);
      });
    getTenant()
      .then((tenant) => {
        if (activo && tenant?.nombre) setNombreNegocio(tenant.nombre);
      })
      .catch((err) => {
        console.warn('[Login] getTenant — falló, login sin nombre:', err.message);
      });
    return () => { activo = false; };
  }, []);

  /**
   * seleccionarBarbero
   * Avanza a la fase de PIN con el barbero elegido.
   */
  const seleccionarBarbero = (b) => {
    setBarberoSel(b);
    setFase('pin');
  };

  /**
   * volverASelector
   * Regresa a la fase de selección. Limpia el barbero seleccionado.
   */
  const volverASelector = () => {
    setFase('selector');
    setBarberoSel(null);
  };

  return (
    <PageContainer>
      {fase === 'selector' ? (
        <SelectorBarbero
          barberos={barberos}
          cargando={cargando}
          error={errorCarga}
          logoUrl={logoUrl}
          nombreNegocio={nombreNegocio}
          onReintentar={cargarBarberos}
          onElegir={seleccionarBarbero}
        />
      ) : (
        <PantallaPin
          barbero={barberoSel}
          onVolver={volverASelector}
          onAcceso={onAcceso}
        />
      )}
    </PageContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1 — Selector de barbero
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SelectorBarbero
 * Login del barbero: bloque de marca (logo en círculo sutil + nombre del local)
 * y, debajo, la lista vertical de barberos donde cada uno es una fila clickeable.
 * Todo el bloque queda centrado verticalmente en el alto disponible.
 * Tres estados: cargando (skeletons), error (EmptyState con reintentar), o la
 * lista de barberos.
 * @param {Array<{id, nombre}>} props.barberos
 * @param {boolean} props.cargando
 * @param {string|null} props.error
 * @param {string|null} props.logoUrl - URL del logo del tenant (o null)
 * @param {string|null} props.nombreNegocio - Nombre del local (o null)
 * @param {() => void} props.onReintentar
 * @param {(b) => void} props.onElegir
 */
function SelectorBarbero({ barberos, cargando, error, logoUrl, nombreNegocio, onReintentar, onElegir }) {
  // La lista solo aparece mientras carga o cuando hay barberos; en error /
  // lista vacía se muestra un EmptyState en su lugar.
  const mostrarLista = cargando || (!error && barberos.length > 0);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 24,
      padding: '32px 16px 112px',
    }}>
      {/* Bloque de marca — logo + encabezado */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        <LogoNegocio src={logoUrl} />
        <EncabezadoLogin nombreNegocio={nombreNegocio} />
      </div>

      {/* Lista de barberos */}
      {mostrarLista && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cargando
            ? Array.from({ length: 5 }).map((_, i) => <BarberoSkeleton key={i} />)
            : barberos.map((b) => (
                <FilaBarbero key={b.id} barbero={b} onClick={() => onElegir(b)} />
              ))}
        </div>
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
    </div>
  );
}

/**
 * LogoNegocio
 * Logo del tenant dentro de un círculo sutil de 88px (`surface` + borde
 * hairline). `objectFit: contain` no deforma logos no cuadrados. Solo se
 * renderiza si hay URL.
 * @param {string|null} props.src - URL del logo del tenant
 */
function LogoNegocio({ src }) {
  if (!src) return null;
  return (
    <div style={{
      width: 88,
      height: 88,
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
 * EncabezadoLogin
 * Encabezado de texto del login: el nombre del local como título y, debajo,
 * una línea secundaria que indica la acción. Si el nombre no cargó, el título
 * pasa a ser "Iniciar sesión".
 * @param {string|null} props.nombreNegocio - Nombre del local (o null)
 */
function EncabezadoLogin({ nombreNegocio }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeTitle,
        letterSpacing: '-0.02em',
        color: theme.ink,
        margin: 0,
      }}>
        {nombreNegocio || 'Iniciar sesión'}
      </h1>
      <p style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        lineHeight: 1.5,
        margin: '4px 0 0',
      }}>
        Elegí tu perfil para continuar
      </p>
    </div>
  );
}

/**
 * FilaBarbero
 * Fila clickeable para elegir un barbero: avatar de iniciales (40px) + nombre
 * + chevron a la derecha. Usa el primitivo Card, que ya aporta borde, hover y
 * navegación por teclado — así se nota que es clickeable.
 * @param {{id, nombre}} props.barbero
 * @param {() => void} props.onClick
 */
function FilaBarbero({ barbero, onClick }) {
  return (
    <Card onClick={onClick} padding={12}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <AvatarIniciales nombre={barbero.nombre} size={40} />
        <span style={{
          flex: 1,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {barbero.nombre}
        </span>
        <ChevronRight size={20} strokeWidth={1.75} color={theme.mutedSoft} aria-hidden="true" />
      </div>
    </Card>
  );
}

/**
 * BarberoSkeleton
 * Silueta de una fila de barbero mientras carga la lista: círculo del avatar
 * + línea del nombre, dentro de una Card. Mismas medidas que FilaBarbero.
 */
function BarberoSkeleton() {
  return (
    <Card padding={12}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <Skeleton width={40} height={40} radius={999} />
        <Skeleton width={120} height={14} />
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — Pantalla del PIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PantallaPin
 * Avatar del barbero + indicadores + teclado. Maneja shake en error
 * y un timeout de 600ms post-éxito antes de invocar onAcceso.
 * @param {{id, nombre}} props.barbero
 * @param {() => void} props.onVolver - Vuelve al selector
 * @param {(token, barbero) => void} props.onAcceso
 */
function PantallaPin({ barbero, onVolver, onAcceso }) {
  const [pin, setPin] = useState('');
  const [estado, setEstado] = useState(PIN_ESTADO.IDLE);
  const [shake, setShake] = useState(false);

  /**
   * validarPin
   * Llama al backend con el PIN ingresado. Maneja éxito (timeout + onAcceso)
   * y error (shake + reset).
   */
  const validarPin = useCallback(async (pinIngresado) => {
    try {
      const { token, barbero: bDevuelto } = await loginBarbero(barbero.id, pinIngresado);
      setEstado(PIN_ESTADO.EXITO);
      setTimeout(() => onAcceso(token, bDevuelto), 600);
    } catch (err) {
      console.error('[Login] Error en validarPin:', err.message);
      setEstado(PIN_ESTADO.ERROR);
      setShake(true);
      setTimeout(() => {
        setPin('');
        setEstado(PIN_ESTADO.IDLE);
        setShake(false);
      }, 800);
    }
  }, [barbero, onAcceso]);

  /**
   * agregarDigito
   * Agrega un dígito. Si completa 4, dispara la validación.
   */
  const agregarDigito = useCallback((digito) => {
    setPin((actual) => {
      if (actual.length >= 4 || estado === PIN_ESTADO.EXITO) return actual;
      const nuevo = actual + digito;
      setEstado(PIN_ESTADO.IDLE);
      if (nuevo.length === 4) validarPin(nuevo);
      return nuevo;
    });
  }, [estado, validarPin]);

  /**
   * borrarDigito
   * Borra el último dígito si hay alguno y no estamos en éxito.
   */
  const borrarDigito = useCallback(() => {
    if (estado === PIN_ESTADO.EXITO) return;
    setEstado(PIN_ESTADO.IDLE);
    setPin((p) => p.slice(0, -1));
  }, [estado]);

  // Teclado físico para desarrollo en desktop (números + backspace).
  useEffect(() => {
    const manejarTeclado = (e) => {
      if (e.key >= '0' && e.key <= '9') agregarDigito(e.key);
      if (e.key === 'Backspace') borrarDigito();
    };
    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [agregarDigito, borrarDigito]);

  // Color contextual del mensaje de subtítulo.
  const mensajeColor = estado === PIN_ESTADO.ERROR ? theme.danger : theme.muted;
  const mensaje = estado === PIN_ESTADO.ERROR
    ? 'PIN incorrecto. Intentá de nuevo.'
    : 'Ingresá tu PIN de 4 dígitos';

  return (
    <>
      <TopBar onVolver={onVolver} />

      {/* Header centrado: avatar grande + nombre + mensaje */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px 16px',
        textAlign: 'center',
      }}>
        <AvatarIniciales nombre={barbero.nombre} size={72} />
        <h1 style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeTitle,
          letterSpacing: '-0.02em',
          color: theme.ink,
          margin: 0,
        }}>
          {barbero.nombre}
        </h1>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: mensajeColor,
          minHeight: 22,
          transition: `color ${theme.transitionMedium}`,
        }}>
          {mensaje}
        </div>
      </div>

      {/* Indicadores de dígito (4 dots) con shake en error */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          padding: '8px 0 24px',
          animation: shake ? 'om-shake 0.5s ease' : undefined,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <DotIndicador key={i} llenoYActivo={i < pin.length} estado={estado} />
        ))}
      </div>

      {/* Teclado numérico */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '0 16px 24px',
        marginTop: 'auto',
      }}>
        {TECLAS_PIN.map((fila, fi) => (
          <div key={fi} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}>
            {fila.map((tecla, ti) => {
              if (tecla === null) return <div key={ti} />;
              if (tecla === 'borrar') {
                return (
                  <TeclaPin
                    key={ti}
                    onClick={borrarDigito}
                    aria="Borrar último dígito"
                  >
                    <Delete size={22} strokeWidth={1.75} aria-hidden="true" />
                  </TeclaPin>
                );
              }
              return (
                <TeclaPin
                  key={ti}
                  onClick={() => agregarDigito(tecla)}
                  aria={`Dígito ${tecla}`}
                >
                  {tecla}
                </TeclaPin>
              );
            })}
          </div>
        ))}
      </div>

      {/* Keyframe local del shake — no se usa en el resto del sistema */}
      <style>{`
        @keyframes om-shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-10px); }
          40%      { transform: translateX(10px); }
          60%      { transform: translateX(-8px); }
          80%      { transform: translateX(8px); }
        }
      `}</style>
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
    border = theme.hairline;
  }

  return (
    <div style={{
      width: 16,
      height: 16,
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
 * Botón individual del teclado. Hover con useState (MD §4.2).
 * Touch target ≥ 64px en alto para uso mobile cómodo.
 * @param {Function} props.onClick
 * @param {string} props.aria - aria-label del botón
 * @param {ReactNode} props.children
 */
function TeclaPin({ onClick, aria, children }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      aria-label={aria}
      style={{
        height: 64,
        borderRadius: theme.radius,
        background: press ? theme.hairline : (hover ? theme.surfaceAlt : theme.surface),
        border: `1px solid ${theme.hairline}`,
        color: theme.ink,
        fontFamily: theme.body,
        fontSize: 24,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  );
}
