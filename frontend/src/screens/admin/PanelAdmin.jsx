// /frontend/src/screens/admin/PanelAdmin.jsx
// Panel de administrador completo.
// Layout: sidebar fijo a la izquierda (220px) + área de contenido a la derecha.
// El sidebar controla qué sección se muestra. Cada sección es autónoma.
//
// Props:
//   onCerrarSesion — callback para volver a la pantalla principal

import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';



import SeccionInicio     from "./sections/SeccionInicio";
import SeccionCaja       from "./sections/SeccionCaja";
import SeccionPlanillas  from "./sections/SeccionPlanillas";
import SeccionGastos     from "./sections/SeccionGastos";
import SeccionVentas     from "./sections/SeccionVentas";
import SeccionGestion    from "./sections/SeccionGestion";
import SeccionBalances from './sections/SeccionBalances.jsx';

// ─── Items del sidebar ────────────────────────────────────────────────────────
// Cada ítem tiene: id, emoji, label, componente a renderizar
const SECCIONES = [
  { id: "inicio",     emoji: "🏠", label: "Inicio",    componente: SeccionInicio    },
  { id: "caja",       emoji: "💰", label: "Caja",      componente: SeccionCaja      },
  { id: "planillas",  emoji: "📋", label: "Planillas", componente: SeccionPlanillas },
  { id: "balances",   emoji: "📊", label: "Balances",  componente: SeccionBalances  },
  { id: "gastos",     emoji: "💸", label: "Gastos",    componente: SeccionGastos    },
  { id: "ventas",     emoji: "🛍️", label: "Ventas",    componente: SeccionVentas    },
  { id: "gestion",    emoji: "⚙️", label: "Gestión",   componente: SeccionGestion   },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PanelAdmin({ onCerrarSesion }) {
  console.log("[PanelAdmin] Montado");

  const [nombreNegocio, setNombreNegocio] = useState('');

  useEffect(() => {
    console.log('[PanelAdmin] Cargando nombre del negocio...');
    fetch(`${API_URL}/api/gestion/negocio`)
      .then(r => r.json())
      .then(data => {
        console.log('[PanelAdmin] Nombre del negocio cargado:', data.nombre_negocio);
        setNombreNegocio(data.nombre_negocio);
      })
      .catch(err => {
        console.error('[PanelAdmin] Error al cargar nombre del negocio:', err);
      });
  }, []);

  // seccionActiva controla qué sección se muestra en el área de contenido
  const [seccionActiva, setSeccionActiva] = useState("inicio");

  // Busca el componente correspondiente a la sección activa
  const SeccionActual = SECCIONES.find((s) => s.id === seccionActiva)?.componente;

  const handleCerrarSesion = () => {
    console.log("[PanelAdmin] Cerrando sesión");
    onCerrarSesion();
  };

  const handleNavegar = (id) => {
    console.log("[PanelAdmin] Navegando a sección:", id);
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
      <main style={styles.contenido}>
        {SeccionActual && <SeccionActual />}
      </main>

    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
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
    letterSpacing: '0.08em',   // Raleway respira bien con tracking generoso
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: "'Raleway', 'DM Sans', sans-serif",
    textTransform: 'uppercase', // opcional — le da más carácter
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
};
