// /frontend/src/screens/flows/FlujoCorte.jsx
// Flujo para registrar un nuevo corte. 6 pasos: barbero → turnos del día →
// servicio → pago → propina → confirmación. El paso 2 permite vincular el
// corte a un turno reservado (o seguir como walk-in sin reserva).
// Efectos UX implementados:
//   (A) PressButton   — scale-down sutil al tocar, spring-back al soltar
//   (B) BarraProgreso — barra verde animada que avanza con cada paso
//   (C) navigate()    — transición slide + fade entre pasos (3 fases: salida → snap → entrada)
//   (D) PantallaExito — checkmark SVG animado + filas del resumen con stagger

import { useState, useRef, useEffect } from "react";
import { registrarCorte, getTurnosDelDia } from "../../services/api";
import { getFechaHoy, formatHora } from "../../utils/fechas";

// ─── CONFIGURACIÓN DE TAMAÑOS ─────────────────────────────────────────────────
const CONFIG = {
  alturaBotonSeleccion: "150px",
  alturaBotonGrande: "30vh",
  paddingBotonSeleccion: "0 2vw",
  tamanoTextoBoton: "clamp(16px, 2vw, 22px)",
};

// ─── Ícono volver ─────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// ─── (B) Barra de progreso animada ───────────────────────────────────────────
// Reemplaza la línea verde estática. Se llena suavemente con cada paso.
// Usada tanto en PasoLayout como en PantallaExito.
const BarraProgreso = ({ paso, total }) => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
    backgroundColor: "#e8f5ee",
  }}>
    <div style={{
      height: "100%",
      width: `${(paso / total) * 100}%`,
      background: "linear-gradient(90deg, #1a7a4a, #2dba6e 50%, #1a7a4a)",
      transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
    }} />
  </div>
);

// ─── (A) Botón con press effect sutil ────────────────────────────────────────
// Scale-down leve (0.96) al tocar, spring-back suave al soltar.
// Reemplaza todos los <button> con acciones en el flujo.
// Acepta los mismos props que un <button> nativo.
const PressButton = ({ style, onPointerDown, children, disabled, ...props }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      style={{
        ...style,
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: pressed
          ? "transform 0.06s ease-out"
          : "transform 0.2s cubic-bezier(0.25, 1.1, 0.5, 1)",
        willChange: "transform",
      }}
      onPointerDown={(e) => {
        if (!disabled) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// ─── Layout compartido por todos los pasos ────────────────────────────────────
// slideStyle se aplica al pantallaInner (wrapper interno) para que la barra
// de progreso quede fija en el top y solo el contenido participe del slide.
const PasoLayout = ({ paso, total, titulo, subtitulo, onVolver, children, slideStyle }) => (
  <div style={styles.pantalla}>
    <BarraProgreso paso={paso} total={total} />
    <div style={{ ...styles.pantallaInner, ...slideStyle }}>
      <div style={styles.header}>
        <button style={styles.btnVolver} onClick={onVolver} aria-label="Volver">
          <ArrowLeftIcon />
        </button>
        <span style={styles.indicadorPaso}>Paso {paso} de {total}</span>
        <div style={{ width: 56 }} />
      </div>
      <div style={styles.tituloArea}>
        <h1 style={styles.titulo}>{titulo}</h1>
        {subtitulo && <p style={styles.subtitulo}>{subtitulo}</p>}
      </div>
      <div style={styles.contenido}>{children}</div>
    </div>
  </div>
);

// ─── (D) Pantalla de éxito animada ───────────────────────────────────────────
// Al montarse dispara 3 animaciones encadenadas:
//   1. Círculo SVG se dibuja (stroke-dashoffset 0.5s)
//   2. Checkmark SVG se dibuja (stroke-dashoffset 0.35s, con delay)
//   3. Filas del resumen aparecen en stagger (opacity + translateY, 70ms entre cada una)
const PantallaExito = ({ montoTotal }) => {
  const [circleDrawn, setCircleDrawn] = useState(false);
  const [checkDrawn,  setCheckDrawn]  = useState(false);

  useEffect(() => {
    console.log('[flujoCorte] PantallaExito — iniciando animaciones | total:', montoTotal);
    const t1 = setTimeout(() => setCircleDrawn(true), 60);
    const t2 = setTimeout(() => setCheckDrawn(true),  520);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const CIRCLE_LEN = 214; // 2π × r(34) ≈ 213.6 → redondeado a 214
  const CHECK_LEN  = 52;  // largo aproximado del path M24 40 L35 52 L57 28

  return (
    <div style={{ ...styles.pantallaCentrada, position: "relative" }}>
      <BarraProgreso paso={6} total={6} />

      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 24 }}>
        {/* Track: círculo de fondo fijo */}
        <circle cx="40" cy="40" r="34" fill="none" stroke="#e8f5ee" strokeWidth="3" />
        {/* Círculo animado que se dibuja */}
        <circle
          cx="40" cy="40" r="34"
          fill="none" stroke="#1a7a4a" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={CIRCLE_LEN}
          strokeDashoffset={circleDrawn ? 0 : CIRCLE_LEN}
          transform="rotate(-90 40 40)"
          style={{ transition: circleDrawn ? "stroke-dashoffset 0.5s ease-out" : "none" }}
        />
        {/* Checkmark animado */}
        <path
          d="M24 40 L35 52 L57 28"
          fill="none" stroke="#1a7a4a" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={CHECK_LEN}
          strokeDashoffset={checkDrawn ? 0 : CHECK_LEN}
          style={{ transition: checkDrawn ? "stroke-dashoffset 0.35s ease-out" : "none" }}
        />
      </svg>

      <p style={styles.exitoTexto}>¡Corte registrado!</p>
      <p style={styles.exitoMonto}>$ {montoTotal.toLocaleString("es-AR")}</p>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlujoCorte({ onVolver, barberos, servicios }) {
  console.log('[flujoCorte] montado — barberos:', barberos.length, '| servicios:', servicios.length);

  const [paso, setPaso] = useState(1);

  // ── (C) Estado de animación slide ───────────────────────────────────────────
  // slideStyle se inyecta en PasoLayout → pantallaInner para animar la transición.
  // navigatingRef bloquea doble-tap durante la animación.
  const [slideStyle,   setSlideStyle]   = useState({});
  const navigatingRef = useRef(false);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [barberoSeleccionado,  setBarberoSeleccionado]  = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [formaPago,    setFormaPago]    = useState(null);
  const [tienePropina, setTienePropina] = useState(null);
  const [montoPropina, setMontoPropina] = useState("");
  const [enviando,     setEnviando]     = useState(false);
  const [error,        setError]        = useState(null);
  const [exito,        setExito]        = useState(false);

  // ── Estado del paso 2 (turnos del día) ──────────────────────────────────────
  // turnoSeleccionado: turno elegido, o null si el corte es walk-in (sin reserva).
  const [turnosDelDia,      setTurnosDelDia]      = useState([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [cargandoTurnos,    setCargandoTurnos]    = useState(false);
  const [errorTurnos,       setErrorTurnos]       = useState(null);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const propinaFinal = tienePropina && montoPropina ? Number(montoPropina) : 0;
  const montoTotal   = (servicioSeleccionado ? Number(servicioSeleccionado.precio) : 0) + propinaFinal;

  // ── Carga de turnos del día al entrar al paso 2 ─────────────────────────────
  // Se dispara cada vez que se llega al paso 2 (también al volver con retroceder),
  // así la lista refleja turnos recién creados desde el turnero.
  useEffect(() => {
    if (paso !== 2 || !barberoSeleccionado) return;

    const cargarTurnos = async () => {
      setCargandoTurnos(true);
      setErrorTurnos(null);
      try {
        const turnos = await getTurnosDelDia(barberoSeleccionado.id, getFechaHoy());
        console.log('[flujoCorte] cargarTurnos — completado |', turnos.length, 'turnos');
        setTurnosDelDia(turnos);
      } catch (err) {
        console.error('[flujoCorte] Error en cargarTurnos:', err.message);
        setErrorTurnos("No se pudieron cargar los turnos del día.");
        setTurnosDelDia([]);
      } finally {
        setCargandoTurnos(false);
      }
    };
    cargarTurnos();
  }, [paso, barberoSeleccionado]);

  // ── (C) navigate — transición slide en 3 fases ───────────────────────────────
  // Fase 1 (150ms): contenido actual sale deslizando + fade out
  // Fase 2 (0ms):   nuevo paso se renderiza posicionado del lado opuesto (sin transición)
  // Fase 3 (200ms): nuevo contenido entra al centro con spring + fade in
  // @param {number} nuevoPaso — paso destino
  // @param {1|-1}  dir        — 1 = avanzar (sale por izquierda), -1 = retroceder (sale por derecha)
  const navigate = (nuevoPaso, dir) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    // Fase 1 — salida
    setSlideStyle({
      transform:  `translateX(${dir === 1 ? "-30px" : "30px"})`,
      opacity:    0,
      transition: "transform 0.15s ease-in, opacity 0.13s ease-in",
    });

    setTimeout(() => {
      // Fase 2 — snap: actualizar paso + posicionar en el lado de entrada (sin animación)
      // React 18 batchea estos dos setState en un solo render
      setPaso(nuevoPaso);
      setSlideStyle({
        transform:  `translateX(${dir === 1 ? "30px" : "-30px"})`,
        opacity:    0,
        transition: "none",
      });

      // Fase 3 — entrada: doble rAF para garantizar que el browser pintó la pos. inicial
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setSlideStyle({
          transform:  "translateX(0)",
          opacity:    1,
          transition: "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease-out",
        });
        setTimeout(() => {
          navigatingRef.current = false;
          setSlideStyle({});
        }, 210);
      }));
    }, 150);
  };

  const avanzar = () => navigate(paso + 1,  1);

  const retroceder = () => {
    if (paso === 1) { onVolver(); return; }

    // Paso 5 (propina): si estamos en el input de monto → volver a Sí/No sin cambiar de paso
    if (paso === 5 && tienePropina !== null) {
      console.log('[flujoCorte] retroceder — volviendo a selección propina sí/no');
      setTienePropina(null);
      setMontoPropina("");
      return;
    }

    if (paso === 6) {
      console.log('[flujoCorte] retroceder — reseteando propina');
      setTienePropina(null);
      setMontoPropina("");
    }

    console.log('[flujoCorte] retroceder — paso:', paso, '→', paso - 1);
    navigate(paso - 1, -1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  const confirmarCorte = async () => {
    const payload = {
      barbero_id:  barberoSeleccionado.id,
      servicio_id: servicioSeleccionado.id,
      precio:      servicioSeleccionado.precio,
      forma_pago:  formaPago,
      propina:     propinaFinal,
      // Si el corte viene de un turno, el backend lo vincula y marca el turno
      // como completado. Sin turno_id es un walk-in.
      ...(turnoSeleccionado && { turno_id: turnoSeleccionado.id }),
    };
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await registrarCorte(payload);
      console.log('[flujoCorte] confirmarCorte — completado | corte_id:', respuesta.corte_id);
      setExito(true);
      setTimeout(() => {
        console.log('[flujoCorte] confirmarCorte — redirigiendo a pantalla principal');
        onVolver();
      }, 2500);
    } catch (err) {
      console.error('[flujoCorte] Error en confirmarCorte:', err.message);
      setError("Error al guardar el corte. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    console.log('[flujoCorte] exito — monto total:', montoTotal);
    return (
      <PantallaExito
        montoTotal={montoTotal}
      />
    );
  }

  // ─── PASO 1 — Selección de barbero ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={6} titulo="Seleccione el barbero" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridOpciones}>
          {barberos.map((b) => (
            <PressButton
              key={b.id}
              style={{
                ...styles.btnOpcion,
                ...(barberoSeleccionado?.id === b.id ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                console.log('[flujoCorte] paso 1 — barbero seleccionado:', b.nombre);
                setBarberoSeleccionado(b);
                // Resetear selección de turno/servicio: pudo haber quedado de
                // un barbero elegido antes de retroceder.
                setTurnoSeleccionado(null);
                setServicioSeleccionado(null);
                avanzar();
              }}
            >
              {b.nombre}
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Turnos del día del barbero ────────────────────────────────────
  // Lista los turnos reservados de hoy. Elegir uno pre-selecciona su servicio
  // en el paso siguiente (editable). "Sin turno" sigue el flujo como walk-in.
  if (paso === 2) {
    return (
      <PasoLayout
        paso={2}
        total={6}
        titulo="Turnos de hoy"
        subtitulo={barberoSeleccionado?.nombre}
        onVolver={retroceder}
        slideStyle={slideStyle}
      >
        {cargandoTurnos ? (
          <p style={styles.turnosMensaje}>Cargando turnos...</p>
        ) : (
          <>
            {errorTurnos ? (
              <p style={styles.errorTexto}>{errorTurnos}</p>
            ) : (
              turnosDelDia.length === 0 && (
                <p style={styles.turnosMensaje}>No hay turnos reservados para hoy.</p>
              )
            )}
            <div style={styles.gridOpciones}>
              {turnosDelDia.map((t) => (
                <PressButton
                  key={t.id}
                  style={{
                    ...styles.btnOpcion,
                    ...(turnoSeleccionado?.id === t.id ? styles.btnOpcionActivo : {}),
                  }}
                  onPointerDown={() => {
                    console.log('[flujoCorte] paso 2 — turno seleccionado:', t.cliente_nombre);
                    setTurnoSeleccionado(t);
                    // Pre-selección del servicio del turno (editable en el paso 3).
                    // Si el servicio fue desactivado, no aparece en la lista → null.
                    setServicioSeleccionado(servicios.find((s) => s.id === t.servicio_id) || null);
                    avanzar();
                  }}
                >
                  <span>{t.cliente_nombre}</span>
                  <span style={styles.turnoHora}>{formatHora(t.inicio)}</span>
                </PressButton>
              ))}

              <PressButton
                style={styles.btnWalkIn}
                onPointerDown={() => {
                  console.log('[flujoCorte] paso 2 — walk-in (sin turno)');
                  setTurnoSeleccionado(null);
                  setServicioSeleccionado(null);
                  avanzar();
                }}
              >
                <span>Sin turno</span>
                <span style={styles.walkInSub}>Cliente sin reserva</span>
              </PressButton>
            </div>
          </>
        )}
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Selección de servicio ──────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={6} titulo="Seleccione el servicio" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridOpciones}>
          {servicios.map((s) => (
            <PressButton
              key={s.id}
              style={{
                ...styles.btnOpcion,
                ...(servicioSeleccionado?.id === s.id ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                console.log('[flujoCorte] paso 3 — servicio seleccionado:', s.nombre);
                setServicioSeleccionado(s);
                avanzar();
              }}
            >
              <span>{s.nombre}</span>
              <span style={styles.precioServicio}>
                $ {Number(s.precio).toLocaleString("es-AR")}
              </span>
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 4 — Forma de pago ──────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PasoLayout paso={4} total={6} titulo="Seleccione el medio de pago" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridDos}>
          {[
            { key: "efectivo",     label: "Efectivo",     icono: <span style={styles.emoji}>💵</span> },
            { key: "mercado_pago", label: "Mercado Pago", icono: (
                <img
                  src="/mercadopago.png"
                  alt="Mercado Pago"
                  style={styles.mpLogo}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )
            },
          ].map((op) => (
            <PressButton
              key={op.key}
              style={{
                ...styles.btnOpcionGrande,
                ...(formaPago === op.key ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                console.log('[flujoCorte] paso 4 — forma de pago:', op.key);
                setFormaPago(op.key);
                avanzar();
              }}
            >
              {op.icono}
              <span>{op.label}</span>
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 5 — Propina ────────────────────────────────────────────────────────
  if (paso === 5) {
    return (
      <PasoLayout paso={5} total={6} titulo="¿Propina?" onVolver={retroceder} slideStyle={slideStyle}>
        {tienePropina === null ? (
          <div style={styles.gridDos}>
            <PressButton style={styles.btnOpcionGrande}
              onPointerDown={() => {
                console.log('[flujoCorte] paso 5 — propina: sí');
                setTienePropina(true);
              }}>
              <span style={styles.emoji}>✅</span>
              <span>Sí</span>
            </PressButton>
            <PressButton style={styles.btnOpcionGrande}
              onPointerDown={() => {
                console.log('[flujoCorte] paso 5 — propina: no');
                avanzar();
              }}>
              <span style={styles.emoji}>❌</span>
              <span>No</span>
            </PressButton>
          </div>
        ) : (
          <div style={styles.propinaContainer}>
            <p style={styles.propinaLabel}>Ingresá el monto</p>
            <div style={styles.propinaInputRow}>
              <span style={styles.propinaMoneda}>$</span>
              <input
                type="number"
                min="0"
                value={montoPropina}
                onChange={(e) => setMontoPropina(e.target.value)}
                placeholder="0"
                style={styles.propinaInput}
                autoFocus
              />
            </div>
            <PressButton
              style={{
                ...styles.btnContinuar,
                ...(montoPropina === "" ? styles.btnDeshabilitado : {}),
              }}
              onPointerDown={() => {
                if (montoPropina === "") return;
                console.log('[flujoCorte] paso 5 — propina confirmada | monto:', montoPropina);
                avanzar();
              }}
              disabled={montoPropina === ""}
            >
              Continuar
            </PressButton>
          </div>
        )}
      </PasoLayout>
    );
  }

  // ─── PASO 6 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 6) {
    console.log('[flujoCorte] paso 6 — resumen | barbero:', barberoSeleccionado?.nombre,
      '| servicio:', servicioSeleccionado?.nombre, '| total:', montoTotal);
    return (
      <PasoLayout paso={6} total={6} titulo="Confirmá el corte" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.resumenCard}>

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Barbero</span>
            <span style={styles.resumenValor}>{barberoSeleccionado?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          {turnoSeleccionado && (
            <>
              <div style={styles.resumenFila}>
                <span style={styles.resumenLabel}>Cliente</span>
                <span style={styles.resumenValor}>{turnoSeleccionado.cliente_nombre}</span>
              </div>
              <div style={styles.resumenDivider} />
            </>
          )}

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Servicio</span>
            <span style={styles.resumenValor}>{servicioSeleccionado?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Precio</span>
            <span style={styles.resumenValor}>
              $ {Number(servicioSeleccionado?.precio).toLocaleString("es-AR")}
            </span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Pago</span>
            <span style={styles.resumenValor}>
              {formaPago === "efectivo" ? "Efectivo" : "Mercado Pago"}
            </span>
          </div>

          {propinaFinal > 0 && (
            <>
              <div style={styles.resumenDivider} />
              <div style={styles.resumenFila}>
                <span style={styles.resumenLabel}>Propina</span>
                <span style={styles.resumenValor}>
                  $ {propinaFinal.toLocaleString("es-AR")}
                </span>
              </div>
            </>
          )}

          <div style={{ ...styles.resumenDivider, backgroundColor: "#1a7a4a", opacity: 0.3 }} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenTotalLabel}>Total</span>
            <span style={styles.resumenTotalValor}>
              $ {montoTotal.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {error && <p style={styles.errorTexto}>{error}</p>}

        <PressButton
          style={{
            ...styles.btnConfirmar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          onPointerDown={confirmarCorte}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Corte"}
        </PressButton>
      </PasoLayout>
    );
  }
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  pantalla: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    overflow: "hidden", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
  },
  // Wrapper interno sobre el que actúa el slide. La barra de progreso queda fuera.
  pantallaInner: {
    width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
    flex: 1, willChange: "transform",
  },
  pantallaCentrada: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", fontFamily: "'DM Sans', Arial, sans-serif",
  },
  header: {
    width: "100%", maxWidth: "820px", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "28px 5vw 0",
  },
  btnVolver: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "56px", height: "56px", borderRadius: "16px",
    border: "1.5px solid #e8e8e8", backgroundColor: "#ffffff",
    color: "#333333", cursor: "pointer",
  },
  indicadorPaso: { fontSize: "14px", fontWeight: "500", color: "#999999", letterSpacing: "0.04em" },
  tituloArea: { width: "100%", maxWidth: "820px", padding: "3vh 5vw 2vh", textAlign: "center" },
  titulo: { fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: "700", color: "#111111", margin: 0, letterSpacing: "-0.02em" },
  subtitulo: { fontSize: "clamp(14px, 1.6vw, 18px)", color: "#888888", margin: "8px 0 0" },
  contenido: {
    width: "100%", maxWidth: "820px", padding: "0 5vw",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "2vh", flex: 1, justifyContent: "center",
  },
  gridOpciones: {
    display: "flex", flexWrap: "wrap", justifyContent: "center",
    gap: "16px", width: "100%",
  },
  gridDos: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", width: "100%" },
  btnOpcion: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "8px",
    padding: CONFIG.paddingBotonSeleccion,
    minHeight: CONFIG.alturaBotonSeleccion,
    width: "calc(33.333% - 12px)",
    minWidth: "200px",
    borderRadius: "16px", border: "2px solid #e8e8e8",
    backgroundColor: "#fafafa", color: "#111111",
    fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600",
    cursor: "pointer", fontFamily: "inherit",
  },
  btnOpcionActivo: { border: "2px solid #1a7a4a", backgroundColor: "#f0faf5", color: "#1a7a4a" },
  // Botón "Sin turno" del paso 2 — borde punteado para diferenciarlo de los turnos.
  btnWalkIn: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "8px",
    padding: CONFIG.paddingBotonSeleccion,
    minHeight: CONFIG.alturaBotonSeleccion,
    width: "calc(33.333% - 12px)",
    minWidth: "200px",
    borderRadius: "16px", border: "2px dashed #1a7a4a",
    backgroundColor: "#ffffff", color: "#1a7a4a",
    fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600",
    cursor: "pointer", fontFamily: "inherit",
  },
  walkInSub: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#1a7a4a", opacity: 0.65 },
  turnoHora: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#666666" },
  turnosMensaje: { fontSize: "clamp(15px, 1.7vw, 19px)", color: "#888888", textAlign: "center", margin: 0 },
  btnOpcionGrande: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "12px", padding: "4vh 2vw", minHeight: CONFIG.alturaBotonGrande,
    borderRadius: "20px", border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    color: "#111111", fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600",
    cursor: "pointer", fontFamily: "inherit",
  },
  precioServicio: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#666666" },
  btnContinuar: {
    width: "100%", padding: "2.5vh 0", borderRadius: "16px", border: "none",
    backgroundColor: "#1a7a4a", color: "#ffffff", fontSize: "clamp(16px, 1.8vw, 20px)",
    fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
  },
  btnConfirmar: {
    width: "100%", padding: "2.8vh 0", borderRadius: "16px", border: "none",
    backgroundColor: "#1a7a4a", color: "#ffffff", fontSize: "clamp(17px, 2vw, 21px)",
    fontWeight: "700", cursor: "pointer", letterSpacing: "0.03em",
    boxShadow: "0 4px 20px rgba(26, 122, 74, 0.25)", fontFamily: "inherit",
  },
  btnDeshabilitado: { backgroundColor: "#cccccc", boxShadow: "none", cursor: "not-allowed" },
  propinaContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3vh", width: "100%" },
  propinaLabel: { fontSize: "clamp(16px, 2vw, 20px)", color: "#555555", margin: 0 },
  propinaInputRow: { display: "flex", alignItems: "center", gap: "12px" },
  propinaMoneda: { fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "300", color: "#333333" },
  propinaInput: {
    fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "600", color: "#111111",
    border: "none", borderBottom: "3px solid #1a7a4a", outline: "none",
    width: "200px", textAlign: "center", backgroundColor: "transparent", fontFamily: "inherit",
  },
  resumenCard: {
    width: "100%", backgroundColor: "#fafafa", borderRadius: "20px",
    border: "1.5px solid #eeeeee", padding: "3vh 4vw",
    display: "flex", flexDirection: "column", gap: "1.8vh",
  },
  resumenFila: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  resumenLabel: { fontSize: "clamp(14px, 1.5vw, 17px)", color: "#888888" },
  resumenValor: { fontSize: "clamp(15px, 1.6vw, 18px)", color: "#111111", fontWeight: "600" },
  resumenDivider: { height: "1px", backgroundColor: "#eeeeee", width: "100%" },
  resumenTotalLabel: { fontSize: "clamp(17px, 2vw, 21px)", fontWeight: "700", color: "#111111" },
  resumenTotalValor: { fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: "700", color: "#1a7a4a" },
  exitoTexto: {
    fontSize: "22px", fontWeight: "500", color: "#555555",
    margin: "0 0 12px", fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: "0.01em",
  },
  exitoMonto: {
    fontSize: "clamp(48px, 7vw, 72px)", fontWeight: "700",
    color: "#1a7a4a", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: "-0.02em", lineHeight: 1.1,
  },
  errorTexto: { color: "#c0392b", fontSize: "15px", textAlign: "center", margin: 0 },
  mpLogo: { height: "clamp(34px, 4vw, 62px)", width: "auto", objectFit: "contain" },
  emoji: { fontSize: "clamp(34px, 4vw, 42px)" },
};
