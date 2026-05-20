// /frontend-barbero/src/components/Login.jsx
// Pantalla de login de la app del barbero.
// Dos fases:
//   1. Selector de barbero (lista del tenant, cards con avatar de iniciales).
//   2. Teclado de PIN de 4 dígitos.
// Props:
//   onAcceso(token, barbero) — callback cuando el login es exitoso.

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Delete, AlertCircle } from 'lucide-react';

import { getBarberos, loginBarbero } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import {
  PageContainer,
  ScreenHeader,
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
      console.log('[Login] getBarberos — cargados:', data.length);
    } catch (err) {
      console.error('[Login] Error cargando barberos:', err.message);
      setErrorCarga('No se pudo cargar la lista de barberos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarBarberos(); }, [cargarBarberos]);

  /**
   * seleccionarBarbero
   * Avanza a la fase de PIN con el barbero elegido.
   */
  const seleccionarBarbero = (b) => {
    console.log('[Login] seleccionarBarbero —', b.nombre);
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
 * Lista de barberos del tenant con tres estados visuales:
 * cargando (skeletons), error (EmptyState con reintentar), o lista (cards).
 * @param {Array<{id, nombre}>} props.barberos
 * @param {boolean} props.cargando
 * @param {string|null} props.error
 * @param {() => void} props.onReintentar
 * @param {(b) => void} props.onElegir
 */
function SelectorBarbero({ barberos, cargando, error, onReintentar, onElegir }) {
  return (
    <>
      <div style={{ height: 16 }} />
      <ScreenHeader
        eyebrow="App del barbero"
        title="Iniciá sesión"
        subtitle="Seleccioná tu nombre para continuar."
      />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 16px 24px',
      }}>
        {cargando && Array.from({ length: 4 }).map((_, i) => (
          <CardBarberoSkeleton key={i} />
        ))}

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

        {!cargando && !error && barberos.map((b) => (
          <Card key={b.id} onClick={() => onElegir(b)} padding={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AvatarIniciales nombre={b.nombre} size={40} />
              <div style={{
                flex: 1,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: theme.weightMedium,
                color: theme.ink,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {b.nombre}
              </div>
              <ChevronRight size={18} strokeWidth={1.75} color={theme.mutedSoft} aria-hidden="true" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/**
 * CardBarberoSkeleton
 * Silueta del item de barbero mientras carga la lista (sin layout shift).
 */
function CardBarberoSkeleton() {
  return (
    <Card padding={12}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton width={40} height={40} radius={999} />
        <Skeleton height={14} width="60%" />
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
    console.log('[Login] validarPin — request iniciado');
    try {
      const { token, barbero: bDevuelto } = await loginBarbero(barbero.id, pinIngresado);
      console.log('[Login] validarPin — acceso concedido');
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
