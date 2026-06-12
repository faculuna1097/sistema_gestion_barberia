// /frontend/src/App.jsx
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PantallaLoginOperativo from "./screens/PantallaLoginOperativo";
// PanelAdmin (panel admin/barbero) se carga con React.lazy: es el subárbol más
// pesado y "frío" del front (solo el dueño/barbero, post-login). Así el login y
// el camino operativo no bajan NADA del código del panel hasta entrar (#7). El
// import() queda al final del bloque de imports porque depende de `lazy` (arriba).
const PanelAdmin = lazy(() => import("./screens/admin/PanelAdmin"));
import { Loader2 } from "lucide-react";
import { theme } from "./theme/tokens.js";
import { EmptyState, Button, IconoAlerta, ErrorBoundary } from "./components/ui";
import FondoLocal from "./components/ui/FondoLocal.jsx";
import {
  getBarberosOperativo,
  getServicios,
  getProductos,
  getCategorias,
  getNegocio,
  getImagenesNegocio,
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
 * No conoce qué pantalla viene después; mostramos un spinner circular en
 * lugar de un Skeleton porque no hay una silueta de contenido específica a
 * la cual aspirar (excepción consciente a la regla del sistema de diseño §4.5).
 * Usa el keyframe `spin` ya definido en index.css.
 *
 * Si recibe `imagenLocal`, el loader vive sobre el MISMO fondo ambiental que el
 * login y MainScreen (FondoLocal) → la transición login→carga→main NO corta a
 * blanco (la foto ya está cacheada del login). Sin foto (primer boot frío sin
 * URL aún, o el Suspense del panel admin que entra a un dashboard claro) cae al
 * contenedor de boot claro.
 *
 * @param {Object} props
 * @param {string|null} [props.imagenLocal] — foto del local para el fondo ambiental.
 * @returns {JSX.Element}
 */
const PantallaCargando = ({ imagenLocal } = {}) => {
  const spinner = (
    <Loader2
      size={32}
      strokeWidth={1.75}
      style={{
        // Sobre la foto (velo oscuro) el spinner va claro; sin foto, gris sobre el claro.
        color: imagenLocal ? '#FFFFFF' : theme.muted,
        animation: 'spin 1s linear infinite',
      }}
    />
  );
  return imagenLocal
    ? <FondoLocal imagenLocal={imagenLocal}>{spinner}</FondoLocal>
    : <ContenedorBoot>{spinner}</ContenedorBoot>;
};

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

/**
 * actualizarFavicon — apunta el <link rel="icon"> del documento al logo del
 * tenant. Si el link no existe, lo crea. Reusa la imagen del logo que ya se
 * descarga para la UI (cache hit, sin pedido extra). Reemplaza el favicon
 * placeholder de index.html. Si no hay logo, deja el placeholder.
 * @param {string|null} url — URL del logo (tenant_imagen tipo='logo').
 * @returns {void}
 */
function actualizarFavicon(url) {
  if (!url) return;
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

export default function App() {
  // tokenOperativo: hidratado desde localStorage al primer render (lazy init).
  // Cuando es null, la pantalla inicial es PantallaLoginOperativo en lugar de MainScreen.
  const [tokenOperativo, setTokenOperativo] = useState(leerTokenOperativoInicial);
  const [currentScreen, setCurrentScreen] = useState(tokenOperativo ? "main" : "loginOperativo");
  const [token, setToken] = useState(null);
  // imagenLogo: URL del logo del tenant — viene de tenant_imagen tipo='logo'.
  // Nombre evita confusión con el campo legacy tenant.logo (que se elimina al
  // mergear feature/turnero a main).
  const [imagenLogo, setImagenLogo] = useState(null);
  // imagenLocal: URL de la foto del local — viene de tenant_imagen tipo='local'.
  // La usa PantallaLoginOperativo como fondo full-screen.
  const [imagenLocal, setImagenLocal] = useState(null);
  const [bookingUrl, setBookingUrl] = useState(null);
  // nombreNegocio se hidrata en cargarDatosTenant y se pasa por prop a PanelAdmin
  // para evitar un segundo fetch de getNegocio en el sidebar (deuda #10).
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [avisosPago, setAvisosPago] = useState(false);
  // rolPanel: rol con el que se entró al panel ('admin' | 'barbero'); lo resuelve
  // el backend en el login unificado por PIN. Default 'admin' (panel completo).
  // Se setea en el onAcceso del login y se limpia al cerrar sesión.
  const [rolPanel, setRolPanel] = useState('admin');
  // barberoSesion: { id, nombre } del barbero logueado, o null si entró el admin.
  // PanelAdmin lo usa (Fase 5) para la vista reducida y para mostrar su identidad.
  const [barberoSesion, setBarberoSesion] = useState(null);
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
   * cargarDatosTenant — obtiene logo y booking_url desde la DB.
   * No forma parte de precargarDatos porque no cambia durante el uso normal.
   */
  // cargarDatosTenant — hidrata nombre, booking y logo en paralelo.
  // El logo viene de tenant_imagen (tipo='logo'); ya NO se lee tenant.logo
  // (campo legacy que se elimina al mergear feature/turnero).
  const cargarDatosTenant = useCallback(async () => {
    try {
      const [negocio, imagenes] = await Promise.all([
        getNegocio(),
        getImagenesNegocio(),
      ]);
      setBookingUrl(negocio.booking_url || null);
      setNombreNegocio(negocio.nombre_negocio || '');
      if (negocio.nombre_negocio) document.title = negocio.nombre_negocio;

      // Logo: primera imagen de tipo='logo' ordenada por `orden`.
      const logos = (imagenes || [])
        .filter((i) => i.tipo === 'logo')
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      const urlLogo = logos[0]?.url || null;
      setImagenLogo(urlLogo);
      // El favicon del tab pasa a ser el logo del tenant (reusa el cache del
      // logo de la UI). Hasta acá rige el placeholder de index.html.
      actualizarFavicon(urlLogo);

      // Foto del local: primera imagen de tipo='local' ordenada por `orden`.
      const locales = (imagenes || [])
        .filter((i) => i.tipo === 'local')
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      setImagenLocal(locales[0]?.url || null);
    } catch (err) {
      console.error('[app] Error en cargarDatosTenant:', err.message);
    }
  }, []);

  useEffect(() => {
    cargarDatosTenant();
  }, [cargarDatosTenant]);

  // Precarga (calienta el cache) de la foto del local y el logo apenas se
  // conocen sus URLs, en paralelo con el resto del boot. Así, cuando una
  // pantalla las use como fondo/imagen, ya están en cache → MainScreen "entra"
  // con la foto sin esperar la descarga, también en el camino del device ya
  // logueado que no pasa por el login (#6). Solo dispara la bajada del
  // navegador; no bloquea ni afecta el render.
  useEffect(() => {
    [imagenLocal, imagenLogo].forEach((url) => {
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [imagenLocal, imagenLogo]);

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
    cargarDatosTenant();
  }, [precargarDatos, cargarDatosTenant]);

  const volverAlInicio = () => {
    setCurrentScreen("main");
  };

  const cerrarSesionAdmin = () => {
    setToken(null);
    clearAuthToken();
    setRolPanel('admin');
    setBarberoSesion(null);
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
        imagenLogo={imagenLogo}
        imagenLocal={imagenLocal}
        onAcceso={(tokenRecibido) => {
          setTokenOperativo(tokenRecibido);
          setCurrentScreen("main");
        }}
      />
    );
  }

  if (datos.cargando && datos.barberos.length === 0) return <PantallaCargando imagenLocal={imagenLocal} />;

  if (datos.error && datos.barberos.length === 0) {
    return <PantallaError onReintentar={reintentar} />;
  }

  if (currentScreen === "nuevoCorte") {
    return <FlujoCorte onVolver={volverAlInicio}
      barberos={datos.barberos} servicios={datos.servicios} imagenLocal={imagenLocal} />;
  }

  if (currentScreen === "nuevaVenta") {
    return <FlujoVenta
      onVolver={() => {
        precargarDatos();
        setCurrentScreen("main");
      }}
      productos={datos.productos}
      imagenLocal={imagenLocal}
    />;
  }

  if (currentScreen === "nuevoGasto") {
    return <FlujoGasto onVolver={volverAlInicio} categorias={datos.categorias} imagenLocal={imagenLocal} />;
  }

  if (currentScreen === "loginAdmin") {
    return (
      <PantallaLoginAdmin
        imagenLogo={imagenLogo}
        imagenLocal={imagenLocal}
        onAcceso={(tokenRecibido, info) => {
          setToken(tokenRecibido);
          setAuthToken(tokenRecibido);
          setRolPanel(info.rol);
          setBarberoSesion(info.barbero ?? null);
          // aviso_pago solo aplica al admin (D2: al barbero no se lo bloquea ni avisa).
          setAvisosPago(info.rol === 'admin' && !!info.aviso_pago);
          setCurrentScreen("admin");
        }}
        onCancelar={volverAlInicio}
      />
    );
  }

  if (currentScreen === "admin") {
    // <Suspense> muestra el spinner full-screen del boot mientras baja el chunk
    // del panel; <ErrorBoundary> captura un fallo de descarga de ese chunk
    // (red caída o hash viejo tras redeploy) → auto-reload una vez.
    return (
      <ErrorBoundary>
        <Suspense fallback={<PantallaCargando />}>
          <PanelAdmin rol={rolPanel} barberoSesion={barberoSesion} onCerrarSesion={cerrarSesionAdmin} avisosPago={avisosPago} nombreNegocio={nombreNegocio} />
        </Suspense>
      </ErrorBoundary>
    );
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
      imagenLogo={imagenLogo}
      imagenLocal={imagenLocal}
      bookingUrl={bookingUrl}
    />
  );
}