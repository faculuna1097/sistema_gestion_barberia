// /frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PanelAdmin from "./screens/admin/PanelAdmin";
import {
  getBarberos,
  getServicios,
  getProductos,
  getCategorias,
  getNegocio,
  setAuthToken,
  clearAuthToken,
} from "./services/api";

const PantallaCargando = () => (
  <div style={stylesEstado.pantalla}>
    <div style={stylesEstado.lineaSuperior} />
    <div style={stylesEstado.spinner} />
    <p style={stylesEstado.mensaje}>Cargando...</p>
  </div>
);

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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("main");
  const [token, setToken] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bookingUrl, setBookingUrl] = useState(null); // ← NUEVO

  const [datos, setDatos] = useState({
    barberos: [],
    servicios: [],
    productos: [],
    categorias: [],
    cargando: true,
    error: null,
  });

  /**
   * cargarLogo — obtiene logo y booking_url desde la DB.
   * No forma parte de precargarDatos porque no cambia durante el uso normal.
   */
  const cargarLogo = useCallback(async () => {
    try {
      const data = await getNegocio();
      setLogoUrl(data.logo || null);
      setBookingUrl(data.booking_url || null); // ← NUEVO
      console.log('[app] cargarLogo — completado | logo:', data.logo ? 'sí' : 'no',
        '| booking_url:', data.booking_url ? 'sí' : 'no');
    } catch (err) {
      console.error('[app] Error en cargarLogo:', err.message);
    }
  }, []);

  useEffect(() => {
    cargarLogo();
  }, [cargarLogo]);

  const precargarDatos = useCallback(async () => {
    setDatos(prev => ({ ...prev, cargando: true, error: null }));
    try {
      const [barberos, servicios, productos, categorias] = await Promise.all([
        getBarberos(),
        getServicios(),
        getProductos(),
        getCategorias(),
      ]);
      console.log('[app] precargarDatos — completado | barberos:', barberos.length,
        '| servicios:', servicios.length,
        '| productos:', productos.length,
        '| categorias:', categorias.length
      );
      setDatos({ barberos, servicios, productos, categorias, cargando: false, error: null });
    } catch (err) {
      console.error('[app] Error en precargarDatos:', err.message);
      setDatos(prev => ({ ...prev, cargando: false, error: "Error al cargar datos" }));
    }
  }, []);

  useEffect(() => {
    precargarDatos();
  }, [precargarDatos]);

  const reintentar = useCallback(() => {
    console.log('[app] reintentar — iniciado');
    precargarDatos();
    cargarLogo();
  }, [precargarDatos, cargarLogo]);

  const volverAlInicio = () => {
    console.log('[App] Volviendo a pantalla principal — pantalla anterior:', currentScreen);
    setCurrentScreen("main");
  };

  const cerrarSesionAdmin = () => {
    console.log('[app] cerrarSesionAdmin — iniciado');
    setToken(null);
    clearAuthToken();
    precargarDatos();
    setCurrentScreen("main");
  };

  if (datos.cargando && datos.barberos.length === 0) return <PantallaCargando />;

  if (datos.error && datos.barberos.length === 0) {
    console.error('[app] precargarDatos — mostrando PantallaError');
    return <PantallaError onReintentar={reintentar} />;
  }

  if (currentScreen === "nuevoCorte") {
    console.log('[app] Renderizando FlujoCorte');
    return <FlujoCorte onVolver={volverAlInicio}
      barberos={datos.barberos} servicios={datos.servicios} />;
  }

  if (currentScreen === "nuevaVenta") {
    console.log('[app] Renderizando FlujoVenta');
    return <FlujoVenta
      onVolver={() => {
        console.log('[app] Volviendo desde FlujoVenta — recargando datos de productos...');
        precargarDatos();
        setCurrentScreen("main");
      }}
      productos={datos.productos}
    />;
  }

  if (currentScreen === "nuevoGasto") {
    console.log('[app] Renderizando FlujoGasto');
    return <FlujoGasto onVolver={volverAlInicio} categorias={datos.categorias} />;
  }

  if (currentScreen === "loginAdmin") {
    console.log('[app] Renderizando PantallaLoginAdmin');
    return (
      <PantallaLoginAdmin
        onAcceso={(tokenRecibido) => {
          console.log('[app] Acceso admin concedido — guardando token y navegando a panel admin');
          setToken(tokenRecibido);
          setAuthToken(tokenRecibido);
          setCurrentScreen("admin");
        }}
        onCancelar={volverAlInicio}
      />
    );
  }

  if (currentScreen === "admin") {
    console.log('[app] Renderizando PanelAdmin');
    return <PanelAdmin onCerrarSesion={cerrarSesionAdmin} />;
  }

  return (
    <MainScreen
      onNuevoCorte={() => {
        console.log('[app] Navegando a → nuevoCorte');
        setCurrentScreen("nuevoCorte");
      }}
      onNuevaVenta={() => {
        console.log('[app] Navegando a → nuevaVenta');
        setCurrentScreen("nuevaVenta");
      }}
      onNuevoGasto={() => {
        console.log('[app] Navegando a → nuevoGasto');
        setCurrentScreen("nuevoGasto");
      }}
      onAdminAccess={() => {
        console.log('[app] Navegando a → loginAdmin');
        setCurrentScreen("loginAdmin");
      }}
      onSpotify={() => {
        console.log('[app] Abriendo Spotify');
        window.open("https://open.spotify.com", "_blank");
      }}
      logoUrl={logoUrl}
      bookingUrl={bookingUrl} 
    />
  );
}