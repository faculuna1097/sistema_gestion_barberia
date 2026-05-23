// /frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PantallaLoginOperativo from "./screens/PantallaLoginOperativo";
import PanelAdmin from "./screens/admin/PanelAdmin";
import {
  getBarberosOperativo,
  getServicios,
  getProductos,
  getCategorias,
  getNegocio,
  setAuthToken,
  clearAuthToken,
  clearAuthTokenOperativo,
  setOnUnauthorizedOperativo,
} from "./services/api";

// Lee el tokenOperativo guardado en localStorage al boot.
// Si existe, el usuario entra directo a MainScreen. Si no, va al login operativo.
// El acceso al localStorage va envuelto en try porque puede estar deshabilitado
// (modo privado agresivo, etc.) y queremos degradar a "sin token" en lugar de crashear.
const leerTokenOperativoInicial = () => {
  try {
    return localStorage.getItem('token_operativo');
  } catch (err) {
    console.warn('[app] localStorage inaccesible al leer tokenOperativo:', err.message);
    return null;
  }
};

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
  // tokenOperativo: hidratado desde localStorage al primer render (lazy init).
  // Cuando es null, la pantalla inicial es PantallaLoginOperativo en lugar de MainScreen.
  const [tokenOperativo, setTokenOperativo] = useState(leerTokenOperativoInicial);
  const [currentScreen, setCurrentScreen] = useState(tokenOperativo ? "main" : "loginOperativo");
  const [token, setToken] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bookingUrl, setBookingUrl] = useState(null);
  const [avisosPago, setAvisosPago] = useState(false);
  const [datos, setDatos] = useState({
    barberos: [],
    servicios: [],
    productos: [],
    categorias: [],
    cargando: true,
    error: null,
  });

  // Registra el handler que api.js dispara cuando apiFetchOperativo recibe 401.
  // En ese caso el token operativo está inválido (expirado, revocado, etc.) y
  // hay que sacar al usuario de cualquier pantalla operativa y mandarlo al login.
  // El token ya fue limpiado por api.js, así que acá solo tocamos estado de React.
  useEffect(() => {
    setOnUnauthorizedOperativo(() => {
      console.warn('[app] 401 operativo detectado — redirigiendo a login operativo');
      setTokenOperativo(null);
      setCurrentScreen("loginOperativo");
    });
    return () => setOnUnauthorizedOperativo(null);
  }, []);

  /**
   * cargarLogo — obtiene logo y booking_url desde la DB.
   * No forma parte de precargarDatos porque no cambia durante el uso normal.
   */
  const cargarLogo = useCallback(async () => {
    try {
      const data = await getNegocio();
      setLogoUrl(data.logo || null);
      setBookingUrl(data.booking_url || null);
      if (data.nombre_negocio) document.title = data.nombre_negocio; // ← NUEVO
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
        getBarberosOperativo(),
        getServicios(),
        getProductos(),
        getCategorias(),
      ]);
      setDatos({ barberos, servicios, productos, categorias, cargando: false, error: null });
    } catch (err) {
      console.error('[app] Error en precargarDatos:', err.message);
      setDatos(prev => ({ ...prev, cargando: false, error: "Error al cargar datos" }));
    }
  }, []);

  // Precarga gateada por tokenOperativo: solo cargamos catálogos cuando hay
  // sesión operativa activa. Antes del login no hace falta y evita disparar
  // PantallaError sobre la pantalla de login si la API está caída.
  useEffect(() => {
    if (tokenOperativo) precargarDatos();
  }, [tokenOperativo, precargarDatos]);

  const reintentar = useCallback(() => {
    precargarDatos();
    cargarLogo();
  }, [precargarDatos, cargarLogo]);

  const volverAlInicio = () => {
    setCurrentScreen("main");
  };

  const cerrarSesionAdmin = () => {
    setToken(null);
    clearAuthToken();
    precargarDatos();
    setCurrentScreen("main");
  };

  /**
   * cerrarSesionOperativo
   * Limpia el tokenOperativo (memoria + localStorage) y manda al login operativo.
   * No toca el token admin: si por algún motivo había sesión admin activa, eso
   * vive en otra variable y se mantiene; pero en la práctica el botón solo se
   * muestra en MainScreen (modo operativo), así que no debería haber admin activo.
   */
  const cerrarSesionOperativo = () => {
    clearAuthTokenOperativo();
    setTokenOperativo(null);
    setCurrentScreen("loginOperativo");
  };

  // Login operativo: pantalla inicial cuando no hay tokenOperativo. Tiene que
  // ir ANTES de los chequeos de cargando/error porque precargarDatos no corre
  // sin token, así que datos.barberos quedaría en [] permanentemente acá.
  if (currentScreen === "loginOperativo") {
    return (
      <PantallaLoginOperativo
        logoUrl={logoUrl}
        onAcceso={(tokenRecibido) => {
          setTokenOperativo(tokenRecibido);
          setCurrentScreen("main");
        }}
      />
    );
  }

  if (datos.cargando && datos.barberos.length === 0) return <PantallaCargando />;

  if (datos.error && datos.barberos.length === 0) {
    return <PantallaError onReintentar={reintentar} />;
  }

  if (currentScreen === "nuevoCorte") {
    return <FlujoCorte onVolver={volverAlInicio}
      barberos={datos.barberos} servicios={datos.servicios} />;
  }

  if (currentScreen === "nuevaVenta") {
    return <FlujoVenta
      onVolver={() => {
        precargarDatos();
        setCurrentScreen("main");
      }}
      productos={datos.productos}
    />;
  }

  if (currentScreen === "nuevoGasto") {
    return <FlujoGasto onVolver={volverAlInicio} categorias={datos.categorias} />;
  }

  if (currentScreen === "loginAdmin") {
    return (
      <PantallaLoginAdmin
        onAcceso={(tokenRecibido, aviso_pago) => {
          setToken(tokenRecibido);
          setAuthToken(tokenRecibido);
          setAvisosPago(aviso_pago || false);
          setCurrentScreen("admin");
        }}
        onCancelar={volverAlInicio}
      />
    );
  }

  if (currentScreen === "admin") {
    return <PanelAdmin onCerrarSesion={cerrarSesionAdmin} avisosPago={avisosPago} />;
  }

  return (
    <MainScreen
      onNuevoCorte={() => {
        setCurrentScreen("nuevoCorte");
      }}
      onNuevaVenta={() => {
        setCurrentScreen("nuevaVenta");
      }}
      onNuevoGasto={() => {
        setCurrentScreen("nuevoGasto");
      }}
      onAdminAccess={() => {
        setCurrentScreen("loginAdmin");
      }}
      onSpotify={() => {
        window.open("https://open.spotify.com", "_blank");
      }}
      onLogoutOperativo={cerrarSesionOperativo}
      logoUrl={logoUrl}
      bookingUrl={bookingUrl}
    />
  );
}