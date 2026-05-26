// /frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PantallaLoginOperativo from "./screens/PantallaLoginOperativo";
import PanelAdmin from "./screens/admin/PanelAdmin";
import { theme } from "./theme/tokens.js";
import { Skeleton, EmptyState, Button, IconoAlerta } from "./components/ui";
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

/**
 * Wrapper full-screen centrado con fondo del theme. Usado por las pantallas
 * de boot (Cargando / Error) que no entran al shell normal de la app.
 */
const ContenedorBoot = ({ children }) => (
  <div style={{
    width: '100vw',
    height: '100vh',
    background: theme.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  }}>
    {children}
  </div>
);

/**
 * PantallaCargando — placeholder mientras se hidratan los catálogos al boot.
 * No conoce qué pantalla viene después, así que muestra una silueta neutra
 * con 3 Skeletons en una columna angosta centrada.
 */
const PantallaCargando = () => (
  <ContenedorBoot>
    <div style={{
      width: '100%',
      maxWidth: 280,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      animation: 'om-fade .26s ease-out both',
    }}>
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="90%" />
      <Skeleton height={14} width="75%" />
    </div>
  </ContenedorBoot>
);

/**
 * PantallaError — pantalla full-screen cuando la precarga falla.
 * Usa el primitivo EmptyState con IconoAlerta + acción de reintentar.
 */
const PantallaError = ({ onReintentar }) => (
  <ContenedorBoot>
    <EmptyState
      glyph={<IconoAlerta size={32} />}
      title="Sin conexión"
      body="Revisá el WiFi e intentá de nuevo."
      action={<Button onClick={onReintentar} full={false}>Reintentar</Button>}
    />
  </ContenedorBoot>
);

export default function App() {
  // tokenOperativo: hidratado desde localStorage al primer render (lazy init).
  // Cuando es null, la pantalla inicial es PantallaLoginOperativo en lugar de MainScreen.
  const [tokenOperativo, setTokenOperativo] = useState(leerTokenOperativoInicial);
  const [currentScreen, setCurrentScreen] = useState(tokenOperativo ? "main" : "loginOperativo");
  const [token, setToken] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bookingUrl, setBookingUrl] = useState(null);
  // nombreNegocio se hidrata en cargarLogo y se pasa por prop a PanelAdmin
  // para evitar un segundo fetch de getNegocio en el sidebar (deuda #10).
  const [nombreNegocio, setNombreNegocio] = useState('');
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
      setNombreNegocio(data.nombre_negocio || '');
      if (data.nombre_negocio) document.title = data.nombre_negocio;
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
    return <PanelAdmin onCerrarSesion={cerrarSesionAdmin} avisosPago={avisosPago} nombreNegocio={nombreNegocio} />;
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