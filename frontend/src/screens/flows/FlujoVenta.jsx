// /frontend/src/screens/flows/FlujoVenta.jsx
// Flujo para registrar una nueva venta. 4 pasos: producto → cantidad →
// forma de pago → resumen/confirmación.
//
// Superficie operativa del iPad del local: el wizard vive en un panel claro
// sobre la foto del local (ver flows/wizard.jsx + FondoLocal). Acento indigo
// (ingreso). La lógica de negocio (límite por stock) se mantiene intacta.

import { useState } from "react";
import { Banknote, Minus, Plus } from "lucide-react";
import { registrarVenta } from "../../services/api";
import { theme } from "../../theme/tokens.js";
import { fmtPesos } from "../../utils/formato.js";
import { Button, BadgeFormaPago } from "../../components/ui";
import {
  PanelWizard,
  BotonOpcion,
  FilaResumen,
  FilaTotal,
  PantallaExito,
  wizardStyles,
} from "./wizard.jsx";

/**
 * BtnCantidad
 * Botón cuadrado de − / + para el stepper de cantidad. Press vía clase scoped
 * `om-opcion` (definida en PanelWizard). Sin onPointerDown.
 *
 * @param {Object} props
 * @param {Function} props.onClick
 * @param {boolean} [props.disabled=false]
 * @param {string} props.ariaLabel
 * @param {React.ReactNode} props.children — ícono (Minus/Plus)
 * @returns {JSX.Element}
 */
function BtnCantidad({ onClick, disabled = false, ariaLabel, children }) {
  return (
    <button
      className="om-opcion"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 72,
        height: 72,
        borderRadius: theme.radius,
        border: `1.5px solid ${disabled ? theme.hairlineSoft : theme.hairline}`,
        background: theme.surface,
        color: disabled ? theme.mutedSoft : theme.ink,
        cursor: disabled ? "not-allowed" : "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * FlujoVenta
 * Wizard de 4 pasos para registrar una venta.
 *
 * @param {Object} props
 * @param {Function} props.onVolver  — vuelve a MainScreen (recarga catálogos)
 * @param {Array} props.productos    — catálogo de productos
 * @param {string|null} [props.imagenLocal] — foto de fondo
 * @returns {JSX.Element}
 */
export default function FlujoVenta({ onVolver, productos, imagenLocal }) {
  const [paso, setPaso] = useState(1);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [formaPago, setFormaPago] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const montoTotal = productoSeleccionado
    ? Number(productoSeleccionado.precio) * cantidad
    : 0;
  const stock = productoSeleccionado?.stock_actual ?? 0;

  // ── Navegación ────────────────────────────────────────────────────────────────
  const avanzar = () => setPaso((p) => p + 1);
  const retroceder = () => {
    if (paso === 1) { onVolver(); return; }
    setPaso((p) => p - 1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  const confirmarVenta = async () => {
    const payload = {
      producto_id: productoSeleccionado.id,
      cantidad,
      precio_unitario: productoSeleccionado.precio,
      forma_pago: formaPago,
      usuario_registro: null,
    };
    setEnviando(true);
    setError(null);
    try {
      await registrarVenta(payload);
      setExito(true);
      setTimeout(() => {
        onVolver();
      }, 2500);
    } catch (err) {
      console.error('[flujoVenta] Error en confirmarVenta:', err.message);
      setError("Error al guardar la venta. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    return (
      <PantallaExito
        imagenLocal={imagenLocal}
        titulo="¡Venta registrada!"
        monto={montoTotal}
      />
    );
  }

  // ─── PASO 1 — Selección de producto ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PanelWizard paso={1} total={4} titulo="Seleccioná el producto" onVolver={retroceder} imagenLocal={imagenLocal}>
        <div style={wizardStyles.gridOpciones}>
          {productos.map((p) => (
            <BotonOpcion
              key={p.id}
              activo={productoSeleccionado?.id === p.id}
              onClick={() => {
                setProductoSeleccionado(p);
                setCantidad(1);
                avanzar();
              }}
            >
              <span>{p.nombre}</span>
              <span style={styles.subLinea}>{fmtPesos(p.precio)}</span>
            </BotonOpcion>
          ))}
        </div>
      </PanelWizard>
    );
  }

  // ─── PASO 2 — Selección de cantidad ──────────────────────────────────────────
  if (paso === 2) {
    const sinStock = stock === 0;
    return (
      <PanelWizard
        paso={2}
        total={4}
        titulo="¿Cuántas unidades?"
        subtitulo={productoSeleccionado?.nombre}
        onVolver={retroceder}
        imagenLocal={imagenLocal}
        maxAncho={520}
      >
        <p style={sinStock ? styles.stockAgotado : styles.stock}>
          {sinStock ? "Sin stock disponible" : `Stock disponible: ${stock}`}
        </p>

        <div style={styles.cantidadRow}>
          <BtnCantidad
            ariaLabel="Restar unidad"
            disabled={cantidad <= 1}
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
          >
            <Minus size={28} strokeWidth={2} />
          </BtnCantidad>
          <span style={styles.cantidadValor}>{cantidad}</span>
          <BtnCantidad
            ariaLabel="Sumar unidad"
            disabled={cantidad >= stock}
            onClick={() => setCantidad((c) => Math.min(stock, c + 1))}
          >
            <Plus size={28} strokeWidth={2} />
          </BtnCantidad>
        </div>

        <p style={styles.subtotal}>Subtotal: {fmtPesos(montoTotal)}</p>

        <Button
          variant="primary"
          disabled={sinStock}
          onClick={() => { if (!sinStock) avanzar(); }}
          style={wizardStyles.btnGrande}
        >
          Continuar
        </Button>
      </PanelWizard>
    );
  }

  // ─── PASO 3 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PanelWizard paso={3} total={4} titulo="Seleccioná el medio de pago" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
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

  // ─── PASO 4 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 4) {
    return (
      <PanelWizard paso={4} total={4} titulo="Confirmá la venta" onVolver={retroceder} imagenLocal={imagenLocal} maxAncho={560}>
        <div style={wizardStyles.resumenCard}>
          <FilaResumen label="Producto" value={productoSeleccionado?.nombre} />
          <FilaResumen label="Precio unitario" value={fmtPesos(productoSeleccionado?.precio)} />
          <FilaResumen label="Cantidad" value={cantidad} />
          <FilaResumen label="Pago" value={<BadgeFormaPago forma={formaPago} />} ultima />
          <FilaTotal label="Total" value={fmtPesos(montoTotal)} />
        </div>

        {error && <p style={wizardStyles.errorTexto}>{error}</p>}

        <Button variant="primary" disabled={enviando} onClick={confirmarVenta} style={wizardStyles.btnGrande}>
          {enviando ? "Guardando..." : "Confirmar venta"}
        </Button>
      </PanelWizard>
    );
  }
}

// ─── Estilos específicos del flujo ────────────────────────────────────────────
const styles = {
  // Segunda línea dentro de un BotonOpcion (precio del producto).
  subLinea: {
    fontFamily: theme.body,
    fontSize: 14,
    fontWeight: theme.weightRegular,
    color: theme.muted,
  },
  stock: {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.muted,
    textAlign: "center",
    margin: 0,
  },
  stockAgotado: {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    fontWeight: theme.weightHeading,
    color: theme.danger,
    textAlign: "center",
    margin: 0,
  },
  cantidadRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  cantidadValor: {
    fontFamily: theme.body,
    fontSize: 64,
    fontWeight: theme.weightHeading,
    color: theme.ink,
    minWidth: 100,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  subtotal: {
    fontFamily: theme.body,
    fontSize: theme.sizeHeading,
    color: theme.muted,
    textAlign: "center",
    margin: 0,
  },
};
