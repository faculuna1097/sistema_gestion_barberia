// /frontend/src/screens/admin/PanelAdmin.jsx
// Panel de administrador completo.
// Layout: sidebar fijo a la izquierda (220px) + área de contenido a la derecha.
// El sidebar controla qué sección se muestra. Cada sección es autónoma.
//
// Props:
//   onCerrarSesion — callback para volver a la pantalla principal

import { useState, useEffect } from "react";
import { getNegocio } from "../../services/api";

import SeccionInicio     from "./sections/SeccionInicio";
import SeccionCaja       from "./sections/SeccionCaja";
import SeccionPlanillas  from "./sections/SeccionPlanillas";
import SeccionGastos     from "./sections/SeccionGastos";
import SeccionVentas     from "./sections/SeccionVentas";
import SeccionGestion    from "./sections/SeccionGestion";
import SeccionBalances   from './sections/SeccionBalances.jsx';
import SeccionTurnero   from './sections/SeccionTurnero.jsx';

// ─── Items del sidebar ────────────────────────────────────────────────────────
// Cada ítem tiene: id, emoji, label, componente a renderizar
const SECCIONES = [
  { id: "inicio",    emoji: "🏠", label: "Inicio",    componente: SeccionInicio    },
  { id: "caja",      emoji: "💰", label: "Caja",      componente: SeccionCaja      },
  { id: "planillas", emoji: "📋", label: "Planillas", componente: SeccionPlanillas },
  { id: "balances",  emoji: "📊", label: "Balances",  componente: SeccionBalances  },
  { id: "ventas",    emoji: "🛍️", label: "Ventas",    componente: SeccionVentas    },
  { id: "gastos",    emoji: "💸", label: "Gastos",    componente: SeccionGastos    },
  { id: "turnero",   emoji: "📅", label: "Turnero",   componente: SeccionTurnero  },
  { id: "gestion",   emoji: "⚙️", label: "Gestión",   componente: SeccionGestion   },
];


// ─── Banner de aviso de pago ──────────────────────────────────────────────────
const BannerAviso = ({ onCerrar }) => (
  <div style={styles.banner}>
    <span style={styles.icono}>⚠️</span>
    <p style={styles.texto}>
      Tu suscripción aún no fue renovada este mes.
      Regularizá el pago antes del día 10 para evitar la suspensión del acceso.
      <strong> WhatsApp: 11 3311-1686</strong>
    </p>
    <button style={styles.btnCerrar} onPointerDown={onCerrar} aria-label="Cerrar aviso">
      ✕
    </button>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PanelAdmin({ onCerrarSesion, avisosPago }) {
  const [seccionActiva, setSeccionActiva]   = useState("inicio");
  const [nombreNegocio, setNombreNegocio]   = useState('');
  const [mostrarAviso, setMostrarAviso]   = useState(avisosPago);


  // Log de montado — solo una vez al montar el componente
  useEffect(() => {
    console.log("[panelAdmin] Montado | avisosPago:", avisosPago);
  }, []);

  // Carga el nombre del negocio para mostrarlo en el header del sidebar
  useEffect(() => {
    const cargarNombreNegocio = async () => {
      console.log('[panelAdmin] cargarNombreNegocio — request recibido');
      try {
        const data = await getNegocio();
        console.log('[panelAdmin] cargarNombreNegocio — completado | nombre:', data.nombre_negocio);
        setNombreNegocio(data.nombre_negocio);
      } catch (err) {
        console.error('[panelAdmin] Error en cargarNombreNegocio:', err.message);
      }
    };
    cargarNombreNegocio();
  }, []);

  // Busca el componente correspondiente a la sección activa
  const SeccionActual = SECCIONES.find((s) => s.id === seccionActiva)?.componente;

  const handleCerrarSesion = () => {
    console.log("[panelAdmin] handleCerrarSesion — cerrando sesión");
    onCerrarSesion();
  };

  const handleNavegar = (id) => {
    console.log("[panelAdmin] handleNavegar — navegando a sección:", id);
    setSeccionActiva(id);
  };

  return (
    <div style={styles.contenedor}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={styles.sidebar}>

        {/* Encabezado del sidebar — nombre del negocio */}
        <div style={styles.sidebarHeader}>
          <div style={styles.logoMarca}>
            <span style={styles.logoIcono}>💈</span>
            <span style={styles.logoTexto}>{nombreNegocio}</span>
          </div>
        </div>

        {/* Línea divisoria */}
        <div style={styles.divisor} />

        {/* Ítems de navegación */}
        <nav style={styles.nav}>
          {SECCIONES.map((seccion) => {
            const activo = seccionActiva === seccion.id;
            return (
              <button
                key={seccion.id}
                style={{
                  ...styles.navItem,
                  ...(activo ? styles.navItemActivo : {}),
                }}
                onPointerDown={() => handleNavegar(seccion.id)}
              >
                {/* Indicador lateral verde cuando está activo */}
                <span style={{
                  ...styles.navIndicador,
                  ...(activo ? styles.navIndicadorActivo : {}),
                }} />
                <span style={styles.navEmoji}>{seccion.emoji}</span>
                <span style={styles.navLabel}>{seccion.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Espaciador flexible — empuja el botón cerrar sesión al fondo */}
        <div style={{ flex: 1 }} />

        {/* Línea divisoria */}
        <div style={styles.divisor} />

        {/* Botón cerrar sesión */}
        <div style={styles.sidebarFooter}>
          <button
            style={styles.btnCerrarSesion}
            onPointerDown={handleCerrarSesion}
          >
            <span style={styles.navEmoji}>🔓</span>
            <span>Cerrar sesión</span>
          </button>
        </div>

      </aside>

      {/* ── ÁREA DE CONTENIDO ────────────────────────────────────────────── */}
      <div style={styles.contenidoWrapper}>
        {mostrarAviso && (
          <BannerAviso onCerrar={() => {
            console.log('[panelAdmin] aviso de pago cerrado por el usuario');
            setMostrarAviso(false);
          }} />
        )}
        <main style={styles.contenido}>
          {SeccionActual && <SeccionActual />}
        </main>
      </div>

    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  banner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "#fff8e1",
    borderBottom: "1px solid #f9a825",
    padding: "12px 20px",
    flexShrink: 0,
  },
  // Layout raíz: sidebar + contenido en fila, ocupa toda la pantalla
  contenedor: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "row",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    backgroundColor: "#f4f4f5",
    overflow: "hidden",
  },

  // ── Sidebar ────────────────────────────────────────────────────────────
  sidebar: {
    width: "220px",
    minWidth: "220px",
    height: "100vh",
    backgroundColor: "#1a1a1a",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    // Sombra sutil hacia la derecha para separar visualmente del contenido
    boxShadow: "2px 0 12px rgba(0, 0, 0, 0.25)",
  },

  sidebarHeader: {
    padding: "28px 20px 20px",
  },

  logoMarca: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  logoIcono: {
    fontSize: "22px",
    lineHeight: 1,
  },

  logoTexto: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: "'Raleway', 'DM Sans', sans-serif",
    textTransform: 'uppercase',
  },

  divisor: {
    height: "1px",
    backgroundColor: "#2e2e2e",
    margin: "0 16px",
  },

  // ── Navegación ─────────────────────────────────────────────────────────
  nav: {
    display: "flex",
    flexDirection: "column",
    padding: "12px 0",
    gap: "2px",
  },

  navItem: {
    position: "relative",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
    // Padding izquierdo amplio para dejar espacio al indicador lateral
    padding: "14px 20px 14px 24px",
    border: "none",
    backgroundColor: "transparent",
    color: "#9a9a9a",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
    transition: "background-color 0.15s, color 0.15s",
    borderRadius: "0",
  },

  // Estado activo del ítem de navegación
  navItemActivo: {
    backgroundColor: "rgba(26, 122, 74, 0.15)",
    color: "#ffffff",
  },

  // Barra indicadora lateral izquierda (visible solo en ítem activo)
  navIndicador: {
    position: "absolute",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    width: "3px",
    height: "0%",
    backgroundColor: "#1a7a4a",
    borderRadius: "0 3px 3px 0",
    transition: "height 0.2s",
  },

  navIndicadorActivo: {
    height: "60%",
  },

  navEmoji: {
    fontSize: "18px",
    lineHeight: 1,
    // Ancho fijo para alinear todos los labels
    width: "22px",
    textAlign: "center",
    flexShrink: 0,
  },

  navLabel: {
    letterSpacing: "0.01em",
  },

  // ── Footer del sidebar ─────────────────────────────────────────────────
  sidebarFooter: {
    padding: "12px 0 20px",
  },

  btnCerrarSesion: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
    padding: "14px 20px 14px 24px",
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    color: "#9a9a9a",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },

  // ── Área de contenido ──────────────────────────────────────────────────
  contenido: {
    flex: 1,
    height: "100vh",
    overflow: "auto",
    backgroundColor: "#f4f4f5",
  },
  contenidoWrapper: {
    flex: 1,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  icono: { fontSize: "20px", lineHeight: 1, flexShrink: 0 },
  texto: {
    flex: 1, margin: 0, fontSize: "14px", color: "#5d4037",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif", lineHeight: "1.5",
  },
  btnCerrar: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "16px", color: "#8d6e63", padding: "4px 8px",
    flexShrink: 0, fontFamily: "inherit", lineHeight: 1,
  },
};
