// /frontend/src/screens/flows/FlujoCorte.jsx
// Flujo para registrar un nuevo corte. 6 pasos: barbero → turnos del día →
// servicio → pago → propina → confirmación. El paso 2 permite vincular el
// corte a un turno reservado (o seguir como walk-in sin reserva).
//
// Superficie operativa del iPad del local: el wizard vive en un panel claro
// sobre la foto del local (ver flows/wizard.jsx + FondoLocal). Acento indigo
// (ingreso). La lógica de negocio (carga de turnos del día, walk-in,
// pre-selección del servicio del turno, payload) se mantiene intacta.

import { useState, useEffect } from "react";
import { Banknote, Check, X } from "lucide-react";
import { registrarCorte, getTurnosDelDia } from "../../services/api";
import { getFechaHoy, formatHora } from "../../utils/fecha.js";
import { theme } from "../../theme/tokens.js";
import { fmtPesos } from "../../utils/formato.js";
import { Button, BadgeFormaPago, LoadingState } from "../../components/ui";
import {
  PanelWizard,
  BotonOpcion,
  CampoMonto,
  FilaResumen,
  FilaTotal,
  PantallaExito,
  wizardStyles,
} from "./wizard.jsx";

/**
 * FlujoCorte
 * Wizard de 6 pasos para registrar un corte.
 *
 * @param {Object} props
 * @param {Function} props.onVolver  — vuelve a MainScreen
 * @param {Array} props.barberos     — catálogo de barberos
 * @param {Array} props.servicios    — catálogo de servicios
 * @param {string|null} [props.imagenLocal] — foto de fondo
 * @returns {JSX.Element}
 */
export default function FlujoCorte({ onVolver, barberos, servicios, imagenLocal }) {
  const [paso, setPaso] = useState(1);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [barberoSeleccionado, setBarberoSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [formaPago, setFormaPago] = useState(null);
  const [tienePropina, setTienePropina] = useState(null);
  const [montoPropina, setMontoPropina] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // ── Estado del paso 2 (turnos del día) ──────────────────────────────────────
  // turnoSeleccionado: turno elegido, o null si el corte es walk-in (sin reserva).
  const [turnosDelDia, setTurnosDelDia] = useState([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [errorTurnos, setErrorTurnos] = useState(null);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const propinaFinal = tienePropina && montoPropina ? Number(montoPropina) : 0;
  const montoTotal = (servicioSeleccionado ? Number(servicioSeleccionado.precio) : 0) + propinaFinal;

  // ── Carga de turnos del día al entrar al paso 2 ─────────────────────────────
  // Se dispara cada vez que se llega al paso 2 (también al volver con retroceder),
  // así la lista refleja turnos recién creados desde el turnero. Guard `cancelado`
  // para no setear estado si se desmonta o cambia de barbero antes de resolver.
  useEffect(() => {
    if (paso !== 2 || !barberoSeleccionado) return;
    let cancelado = false;

    const cargarTurnos = async () => {
      setCargandoTurnos(true);
      setErrorTurnos(null);
      try {
        const turnos = await getTurnosDelDia(barberoSeleccionado.id, getFechaHoy());
        if (!cancelado) setTurnosDelDia(turnos);
      } catch (err) {
        console.error('[flujoCorte] Error en cargarTurnos:', err.message);
        if (!cancelado) {
          setErrorTurnos("No se pudieron cargar los turnos del día.");
          setTurnosDelDia([]);
        }
      } finally {
        if (!cancelado) setCargandoTurnos(false);
      }
    };
    cargarTurnos();
    return () => { cancelado = true; };
  }, [paso, barberoSeleccionado]);

  // ── Navegación ────────────────────────────────────────────────────────────────
  const avanzar = () => setPaso((p) => p + 1);
  const retroceder = () => {
    if (paso === 1) { onVolver(); return; }
    // Paso 5 (propina): si estamos en el input de monto → volver a Sí/No sin cambiar de paso.
    if (paso === 5 && tienePropina !== null) {
      setTienePropina(null);
      setMontoPropina("");
      return;
    }
    if (paso === 6) {
      setTienePropina(null);
      setMontoPropina("");
    }
    setPaso((p) => p - 1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  const confirmarCorte = async () => {
    const payload = {
      barbero_id: barberoSeleccionado.id,
      servicio_id: servicioSeleccionado.id,
      precio: servicioSeleccionado.precio,
      forma_pago: formaPago,
      propina: propinaFinal,
      // Si el corte viene de un turno, el backend lo vincula y marca el turno
      // como completado. Sin turno_id es un walk-in.
      ...(turnoSeleccionado && { turno_id: turnoSeleccionado.id }),
    };
    setEnviando(true);
    setError(null);
    try {
      await registrarCorte(payload);
      setExito(true);
      setTimeout(() => {
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
    return (
      <PantallaExito
        imagenLocal={imagenLocal}
        titulo="¡Corte registrado!"
        monto={montoTotal}
      />
    );
  }

  // ─── PASO 1 — Selección de barbero ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PanelWizard paso={1} total={6} titulo="Seleccioná el barbero" onVolver={retroceder} imagenLocal={imagenLocal}>
        <div style={wizardStyles.gridOpciones}>
          {barberos.map((b) => (
            <BotonOpcion
              key={b.id}
              activo={barberoSeleccionado?.id === b.id}
              onClick={() => {
                setBarberoSeleccionado(b);
                // Resetear selección de turno/servicio: pudo haber quedado de
                // un barbero elegido antes de retroceder.
                setTurnoSeleccionado(null);
                setServicioSeleccionado(null);
                avanzar();
              }}
            >
              {b.nombre}
            </BotonOpcion>
          ))}
        </div>
      </PanelWizard>
    );
  }

  // ─── PASO 2 — Turnos del día del barbero ────────────────────────────────────
  // Lista los turnos reservados de hoy. Elegir uno pre-selecciona su servicio
  // en el paso siguiente (editable). "Sin turno" sigue el flujo como walk-in.
  if (paso === 2) {
    return (
      <PanelWizard
        paso={2}
        total={6}
        titulo="Turnos de hoy"
        subtitulo={barberoSeleccionado?.nombre}
        onVolver={retroceder}
        imagenLocal={imagenLocal}
      >
        {cargandoTurnos ? (
          <LoadingState />
        ) : (
          <>
            {errorTurnos ? (
              <p style={wizardStyles.errorTexto}>{errorTurnos}</p>
            ) : turnosDelDia.length === 0 ? (
              <p style={styles.notaVacia}>No hay turnos reservados para hoy.</p>
            ) : null}

            <div style={wizardStyles.gridOpciones}>
              {turnosDelDia.map((t) => (
                <BotonOpcion
                  key={t.id}
                  activo={turnoSeleccionado?.id === t.id}
                  onClick={() => {
                    setTurnoSeleccionado(t);
                    // Pre-selección del servicio del turno (editable en el paso 3).
                    // Si el servicio fue desactivado, no aparece en la lista → null.
                    setServicioSeleccionado(servicios.find((s) => s.id === t.servicio_id) || null);
                    avanzar();
                  }}
                >
                  <span>{t.cliente_nombre}</span>
                  <span style={styles.subLinea}>{formatHora(t.inicio)}</span>
                </BotonOpcion>
              ))}

              <BotonOpcion
                dashed
                onClick={() => {
                  setTurnoSeleccionado(null);
                  setServicioSeleccionado(null);
                  avanzar();
                }}
              >
                <span>Sin turno</span>
                <span style={styles.subLinea}>Cliente sin reserva</span>
              </BotonOpcion>
            </div>
          </>
        )}
      </PanelWizard>
    );
  }

  // ─── PASO 3 — Selección de servicio ──────────────────────────────────────────
  if (paso === 3) {
    return (
      <PanelWizard paso={3} total={6} titulo="Seleccioná el servicio" onVolver={retroceder} imagenLocal={imagenLocal}>
        <div style={wizardStyles.gridOpciones}>
          {servicios.map((s) => (
            <BotonOpcion
              key={s.id}
              activo={servicioSeleccionado?.id === s.id}
              onClick={() => {
                setServicioSeleccionado(s);
                avanzar();
              }}
            >
              <span>{s.nombre}</span>
              <span style={styles.subLinea}>{fmtPesos(s.precio)}</span>
            </BotonOpcion>
          ))}
        </div>
      </PanelWizard>
    );
  }

  // ─── PASO 4 — Forma de pago ──────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PanelWizard paso={4} total={6} titulo="Seleccioná el medio de pago" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
        <div style={wizardStyles.gridDos}>
          <BotonOpcion
            variante="grande"
            activo={formaPago === "efectivo"}
            onClick={() => { setFormaPago("efectivo"); avanzar(); }}
          >
            <Banknote size={48} strokeWidth={1.5} />
            <span>Efectivo</span>
          </BotonOpcion>
          <BotonOpcion
            variante="grande"
            activo={formaPago === "mercado_pago"}
            onClick={() => { setFormaPago("mercado_pago"); avanzar(); }}
          >
            <img
              src="/mercadopago.png"
              alt="Mercado Pago"
              style={wizardStyles.mpLogo}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span>Mercado Pago</span>
          </BotonOpcion>
        </div>
      </PanelWizard>
    );
  }

  // ─── PASO 5 — Propina ────────────────────────────────────────────────────────
  if (paso === 5) {
    return (
      <PanelWizard paso={5} total={6} titulo="¿Propina?" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
        {tienePropina === null ? (
          <div style={wizardStyles.gridDos}>
            <BotonOpcion variante="grande" onClick={() => setTienePropina(true)}>
              <Check size={48} strokeWidth={1.75} />
              <span>Sí</span>
            </BotonOpcion>
            <BotonOpcion variante="grande" onClick={() => avanzar()}>
              <X size={48} strokeWidth={1.75} />
              <span>No</span>
            </BotonOpcion>
          </div>
        ) : (
          <>
            <CampoMonto value={montoPropina} onChange={setMontoPropina} />
            <Button
              variant="primary"
              disabled={montoPropina === ""}
              onClick={() => { if (montoPropina !== "") avanzar(); }}
              style={wizardStyles.btnGrande}
            >
              Continuar
            </Button>
          </>
        )}
      </PanelWizard>
    );
  }

  // ─── PASO 6 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 6) {
    const hayPropina = propinaFinal > 0;
    return (
      <PanelWizard paso={6} total={6} titulo="Confirmá el corte" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
        <div style={wizardStyles.resumenCard}>
          <FilaResumen label="Barbero" value={barberoSeleccionado?.nombre} />
          {turnoSeleccionado && <FilaResumen label="Cliente" value={turnoSeleccionado.cliente_nombre} />}
          <FilaResumen label="Servicio" value={servicioSeleccionado?.nombre} />
          <FilaResumen label="Precio" value={fmtPesos(servicioSeleccionado?.precio)} />
          <FilaResumen label="Pago" value={<BadgeFormaPago forma={formaPago} />} ultima={!hayPropina} />
          {hayPropina && <FilaResumen label="Propina" value={fmtPesos(propinaFinal)} ultima />}
          <FilaTotal label="Total" value={fmtPesos(montoTotal)} />
        </div>

        {error && <p style={wizardStyles.errorTexto}>{error}</p>}

        <Button variant="primary" disabled={enviando} onClick={confirmarCorte} style={wizardStyles.btnGrande}>
          {enviando ? "Guardando..." : "Confirmar corte"}
        </Button>
      </PanelWizard>
    );
  }
}

// ─── Estilos específicos del flujo ────────────────────────────────────────────
const styles = {
  // Segunda línea dentro de un BotonOpcion (hora del turno, precio del servicio).
  subLinea: {
    fontFamily: theme.body,
    fontSize: 14,
    fontWeight: theme.weightRegular,
    color: theme.muted,
  },
  // Nota cuando no hay turnos reservados (sigue mostrándose el botón "Sin turno").
  notaVacia: {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.muted,
    textAlign: "center",
    margin: 0,
  },
};
