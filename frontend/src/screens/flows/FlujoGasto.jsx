// /frontend/src/screens/flows/FlujoGasto.jsx
// Flujo para registrar un nuevo gasto. 5 pasos: categoría → descripción →
// monto → forma de pago → resumen/confirmación.
//
// Superficie operativa del iPad del local: el wizard vive en un panel claro
// sobre la foto del local (ver flows/wizard.jsx + FondoLocal). El monto del
// éxito y del total van en `theme.danger` por ser un egreso (coherente con
// cómo el admin pinta gastos en Balances/Caja).

import { useState } from "react";
import { Banknote, Package } from "lucide-react";
import { registrarGasto } from "../../services/api";
import { theme } from "../../theme/tokens.js";
import { fmtPesos } from "../../utils/formato.js";
import { Button, BadgeFormaPago } from "../../components/ui";
import {
  PanelWizard,
  BotonOpcion,
  CampoTexto,
  CampoMonto,
  FilaResumen,
  FilaTotal,
  PantallaExito,
  wizardStyles,
} from "./wizard.jsx";

/**
 * FlujoGasto
 * Wizard de 5 pasos para registrar un gasto. La lógica de negocio (envío,
 * recordatorio de stock para categoría "Productos") se mantiene intacta.
 *
 * @param {Object} props
 * @param {Function} props.onVolver — vuelve a MainScreen
 * @param {Array} props.categorias  — catálogo de categorías de gasto
 * @param {string|null} [props.imagenLocal] — foto de fondo
 * @returns {JSX.Element}
 */
export default function FlujoGasto({ onVolver, categorias, imagenLocal }) {
  const [paso, setPaso] = useState(1);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [formaPago, setFormaPago] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const montoFinal = monto ? Number(monto) : 0;

  // ── Navegación ────────────────────────────────────────────────────────────────
  const avanzar = () => setPaso((p) => p + 1);
  const retroceder = () => {
    if (paso === 1) { onVolver(); return; }
    setPaso((p) => p - 1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  // Si la categoría es Productos se da más tiempo para leer el recordatorio de stock.
  const confirmarGasto = async () => {
    const payload = {
      categoria_id: categoriaSeleccionada.id,
      descripcion,
      monto: montoFinal,
      forma_pago: formaPago,
      usuario_registro: null,
    };
    setEnviando(true);
    setError(null);
    try {
      await registrarGasto(payload);
      setExito(true);
      const demora = categoriaSeleccionada?.nombre === "Productos" ? 4500 : 2500;
      setTimeout(() => {
        onVolver();
      }, demora);
    } catch (err) {
      console.error('[flujoGasto] Error en confirmarGasto:', err.message);
      setError("Error al guardar el gasto. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    return (
      <PantallaExito
        imagenLocal={imagenLocal}
        titulo="¡Gasto registrado!"
        monto={montoFinal}
        montoColor={theme.danger}
      >
        {categoriaSeleccionada?.nombre === "Productos" && (
          <div style={styles.recordatorio}>
            <Package size={20} strokeWidth={1.75} color={theme.warning} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={styles.recordatorioTexto}>
              Si compraste productos para vender, recordá actualizar el stock en{" "}
              <strong style={{ color: theme.ink }}>Gestión → Productos</strong>
            </p>
          </div>
        )}
      </PantallaExito>
    );
  }

  // ─── PASO 1 — Selección de categoría ─────────────────────────────────────────
  if (paso === 1) {
    return (
      <PanelWizard paso={1} total={5} titulo="Seleccioná la categoría" onVolver={retroceder} imagenLocal={imagenLocal}>
        <div style={wizardStyles.gridOpciones}>
          {categorias.map((c) => (
            <BotonOpcion
              key={c.id}
              activo={categoriaSeleccionada?.id === c.id}
              onClick={() => {
                setCategoriaSeleccionada(c);
                avanzar();
              }}
            >
              {c.nombre}
            </BotonOpcion>
          ))}
        </div>
      </PanelWizard>
    );
  }

  // ─── PASO 2 — Descripción ─────────────────────────────────────────────────────
  if (paso === 2) {
    return (
      <PanelWizard
        paso={2}
        total={5}
        titulo="Describí el gasto"
        subtitulo={categoriaSeleccionada?.nombre}
        onVolver={retroceder}
        imagenLocal={imagenLocal}
        maxAncho={520}
      >
        <CampoTexto
          value={descripcion}
          onChange={setDescripcion}
          placeholder="Ej: Compra de shampoo y acondicionador..."
          autoFocus
        />
        <Button
          variant="primary"
          disabled={descripcion.trim() === ""}
          onClick={() => { if (descripcion.trim() !== "") avanzar(); }}
          style={wizardStyles.btnGrande}
        >
          Continuar
        </Button>
      </PanelWizard>
    );
  }

  // ─── PASO 3 — Monto ───────────────────────────────────────────────────────────
  if (paso === 3) {
    const montoInvalido = monto === "" || Number(monto) <= 0;
    return (
      <PanelWizard paso={3} total={5} titulo="¿Cuánto fue?" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={520}>
        <CampoMonto value={monto} onChange={setMonto} />
        <Button
          variant="primary"
          disabled={montoInvalido}
          onClick={() => { if (!montoInvalido) avanzar(); }}
          style={wizardStyles.btnGrande}
        >
          Continuar
        </Button>
      </PanelWizard>
    );
  }

  // ─── PASO 4 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PanelWizard paso={4} total={5} titulo="Seleccioná el medio de pago" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
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

  // ─── PASO 5 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 5) {
    return (
      <PanelWizard paso={5} total={5} titulo="Confirmá el gasto" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
        <div style={wizardStyles.resumenCard}>
          <FilaResumen label="Categoría" value={categoriaSeleccionada?.nombre} />
          <FilaResumen label="Descripción" value={descripcion} />
          <FilaResumen label="Pago" value={<BadgeFormaPago forma={formaPago} />} ultima />
          <FilaTotal label="Monto" value={fmtPesos(montoFinal)} color={theme.danger} />
        </div>

        {error && <p style={wizardStyles.errorTexto}>{error}</p>}

        <Button variant="primary" disabled={enviando} onClick={confirmarGasto} style={wizardStyles.btnGrande}>
          {enviando ? "Guardando..." : "Confirmar gasto"}
        </Button>
      </PanelWizard>
    );
  }
}

// ─── Estilos específicos del flujo ────────────────────────────────────────────
const styles = {
  recordatorio: {
    marginTop: 24,
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: theme.warningSoft,
    border: `1px solid ${theme.hairline}`,
    borderRadius: theme.radius,
    padding: "14px 16px",
    textAlign: "left",
  },
  recordatorioTexto: {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.inkSoft,
    margin: 0,
    lineHeight: 1.5,
  },
};
