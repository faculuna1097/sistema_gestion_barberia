// /frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PanelAdmin from "./screens/admin/PanelAdmin";
import { getBarberos, getServicios, getProductos, getCategorias } from "./services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ─── Pantalla de carga inicial ────────────────────────────────────────────────
// Se muestra mientras precargarDatos está en vuelo al arrancar la app.
const PantallaCargando = () => (
  <div style={stylesEstado.pantalla}>
    <div style={stylesEstado.lineaSuperior} />
    <div style={stylesEstado.spinner} />
    <p style={stylesEstado.mensaje}>Cargando...</p>
  </div>
);

// ─── Pantalla de error de conexión ────────────────────────────────────────────
// Se muestra cuando precargarDatos falla (sin WiFi, backend caído, etc.).
// El prop onReintentar dispara precargarDatos + cargarLogo desde App.
const PantallaError = ({ onReintentar }) => (
  <div style={stylesEstado.pantalla}>
    <div style={stylesEstado.lineaSuperior} />
    <div style={stylesEstado.iconoError}>⚠️</div>
    <p style={stylesEstado.titulo}>Sin conexión</p>
    <p style={stylesEstado.mensaje}>Revisá el WiFi e intentá de nuevo.</p>
    <button style={stylesEstado.btnReintentar} onClick={onReintentar}>
      Reintentar
    </button>
  </div>
);

// ─── Estilos compartidos entre PantallaCargando y PantallaError ──────────────
const stylesEstado = {
  pantalla: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
  },
  lineaSuperior: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
  },
  spinner: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "4px solid #e8e8e8",
    borderTopColor: "#1a7a4a",
    animation: "spin 0.8s linear infinite",
  },
  iconoError: {
    fontSize: "52px",
    lineHeight: 1,
  },
  titulo: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#111111",
    margin: 0,
  },
  mensaje: {
    fontSize: "16px",
    color: "#888888",
    margin: 0,
  },
  btnReintentar: {
    marginTop: "8px",
    padding: "14px 40px",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#1a7a4a",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function App() {
  const [currentScreen, setCurrentScreen] = useState("main");
  // TODO: el token queda guardado en memoria por ahora. Cuando implementemos el reemplazo
  // del TENANT_ID hardcodeado, vamos a leer el tenant_id desde este token con jwt-decode.
  const [token, setToken] = useState(null);

  // URL del logo del negocio — se carga al arrancar y se reintenta junto a los datos
  // si la carga inicial falla. No forma parte de precargarDatos porque no cambia
  // durante el uso normal de la app.
  const [logoUrl, setLogoUrl] = useState(null);

  // Datos operativos — se recargan al arrancar y cada vez que algo los modifica
  const [datos, setDatos] = useState({
    barberos: [],
    servicios: [],
    productos: [],
    categorias: [],
    cargando: true,
    error: null,
  });

  /**
   * cargarLogo — obtiene la URL del logo desde la DB.
   * Definida como useCallback para poder llamarla desde reintentar()
   * sin incluirla en precargarDatos.
   * Si falla, la app sigue funcionando sin logo (no es bloqueante).
   */
  const cargarLogo = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/gestion/negocio`);
      const data = await res.json();
      setLogoUrl(data.logo || null);
      console.log('[App] Logo del negocio cargado:', data.logo ? 'sí' : 'no');
    } catch (err) {
      console.error('[App] Error al cargar logo del negocio:', err);
    }
  }, []);

  // Carga inicial del logo — una sola vez al montar el componente
  useEffect(() => {
    cargarLogo();
  }, [cargarLogo]);

  /**
   * precargarDatos — carga barberos, servicios, productos y categorías en paralelo.
   * Se llama al arrancar la app, al cerrar el panel admin, y al volver de FlujoVenta
   * (que modifica el stock de productos). El logo NO se recarga aquí.
   */
  const precargarDatos = useCallback(async () => {
    setDatos(prev => ({ ...prev, cargando: true, error: null }));
    try {
      const [barberos, servicios, productos, categorias] = await Promise.all([
        getBarberos(),
        getServicios(),
        getProductos(),
        getCategorias(),
      ]);
      console.log('[App] Datos precargados correctamente —', {
        barberos: barberos.length,
        servicios: servicios.length,
        productos: productos.length,
        categorias: categorias.length,
      });
      setDatos({ barberos, servicios, productos, categorias, cargando: false, error: null });
    } catch (err) {
      console.error('[App] Error al precargar datos:', err);
      setDatos(prev => ({ ...prev, cargando: false, error: "Error al cargar datos" }));
    }
  }, []);

  // Carga inicial al arrancar la app
  useEffect(() => {
    precargarDatos();
  }, [precargarDatos]);

  /**
   * reintentar — llamado por el botón de PantallaError.
   * Relanza tanto los datos operativos como el logo, ya que ambos
   * pueden haber fallado si no había conexión al arrancar.
   */
  const reintentar = useCallback(() => {
    console.log('[App] Reintentando carga — datos + logo');
    precargarDatos();
    cargarLogo();
  }, [precargarDatos, cargarLogo]);

  const volverAlInicio = () => {
    console.log('[App] Volviendo a pantalla principal — pantalla anterior:', currentScreen);
    setCurrentScreen("main");
  };

  /**
   * cerrarSesionAdmin — recarga los datos operativos antes de volver a la pantalla
   * principal, para reflejar cualquier cambio hecho desde Gestión.
   */
  const cerrarSesionAdmin = () => {
    console.log('[App] Cerrando sesión admin — recargando datos...');
    precargarDatos();
    setCurrentScreen("main");
  };

  // ── Pantalla de carga inicial ──────────────────────────────────────────────
  // Solo se muestra en la carga inicial (cargando: true con listas vacías).
  // En recargas posteriores (volver de FlujoVenta, cerrar admin), los datos
  // anteriores siguen en memoria y la app no se bloquea.
  if (datos.cargando && datos.barberos.length === 0) {
    return <PantallaCargando />;
  }

  // ── Pantalla de error de conexión ──────────────────────────────────────────
  // Se muestra si la carga inicial falló. El botón llama a reintentar(),
  // que relanza precargarDatos + cargarLogo en paralelo.
  if (datos.error && datos.barberos.length === 0) {
    console.error('[App] Estado de error activo — mostrando PantallaError');
    return <PantallaError onReintentar={reintentar} />;
  }

  if (currentScreen === "nuevoCorte") {
    console.log('[App] Renderizando FlujoCorte');
    return <FlujoCorte onVolver={volverAlInicio}
      barberos={datos.barberos} servicios={datos.servicios} />;
  }

  if (currentScreen === "nuevaVenta") {
    console.log('[App] Renderizando FlujoVenta');
    return <FlujoVenta
      onVolver={() => {
        // FlujoVenta modifica el stock — hay que recargar productos al volver
        console.log('[App] Volviendo desde FlujoVenta — recargando datos de productos...');
        precargarDatos();
        setCurrentScreen("main");
      }}
      productos={datos.productos}
    />;
  }

  if (currentScreen === "nuevoGasto") {
    console.log('[App] Renderizando FlujoGasto');
    return <FlujoGasto onVolver={volverAlInicio}
      categorias={datos.categorias} />;
  }

  if (currentScreen === "loginAdmin") {
    console.log('[App] Renderizando PantallaLoginAdmin');
    return (
      <PantallaLoginAdmin
        onAcceso={(token) => {
          console.log('[App] Acceso admin concedido — token recibido, navegando a panel admin');
          setToken(token);
          setCurrentScreen("admin");
        }}
        onCancelar={volverAlInicio}
      />
    );
  }

  if (currentScreen === "admin") {
    console.log('[App] Renderizando PanelAdmin');
    return <PanelAdmin onCerrarSesion={cerrarSesionAdmin} />;
  }

  return (
    <MainScreen
      onNuevoCorte={() => {
        console.log('[App] Navegando a → nuevoCorte');
        setCurrentScreen("nuevoCorte");
      }}
      onNuevaVenta={() => {
        console.log('[App] Navegando a → nuevaVenta');
        setCurrentScreen("nuevaVenta");
      }}
      onNuevoGasto={() => {
        console.log('[App] Navegando a → nuevoGasto');
        setCurrentScreen("nuevoGasto");
      }}
      onAdminAccess={() => {
        console.log('[App] Navegando a → loginAdmin');
        setCurrentScreen("loginAdmin");
      }}
      onSpotify={() => {
        console.log('[App] Abriendo Spotify');
        window.open("https://open.spotify.com", "_blank");
      }}
      logoUrl={logoUrl}
    />
  );
}
