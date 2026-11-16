// /frontend-barbero/src/App.jsx
// Router principal de la app del barbero.
// Sin token → Login (selector de barbero + PIN).
// Con token → PageContainer + sección activa + BottomNav (cuando aplica).
// La sesión queda guardada en el celular (utils/sesion.js): al abrir la app con
// una sesión vigente, se entra directo, sin PIN.

import { useState, useCallback, useEffect } from 'react';
import { CalendarDays, CalendarRange, ClipboardList, MoreHorizontal } from 'lucide-react';

import { setAuthToken, clearAuthToken, setOnUnauthorized, getTenant, getImagenesNegocio } from './services/api.js';
import { PageContainer, BottomNav, EmptyState } from './components/ui';

import { leerSesion, guardarSesion, borrarSesion, guardarUltimoBarbero } from './utils/sesion.js';

import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import CrearTurno from './components/CrearTurno.jsx';
import Agenda from './components/Agenda.jsx';
import MiPlanilla from './components/MiPlanilla.jsx';
import Gestion from './components/Gestion.jsx';
import Clientes from './components/Clientes.jsx';
import Mas from './components/Mas.jsx';

// IDs de sección del state machine.
const SECCION = {
  DASHBOARD:   'dashboard',
  CREAR_TURNO: 'crear-turno',
  AGENDA:      'agenda',
  PLANILLA:    'planilla',
  MAS:         'mas',
  CLIENTES:    'clientes',
  GESTION:     'gestion',
};

// Items del BottomNav. El ID coincide con SECCION para que `activo` matchee directo.
const NAV_ITEMS = [
  { id: SECCION.DASHBOARD, label: 'Hoy',      icon: CalendarDays },
  { id: SECCION.AGENDA,    label: 'Agenda',   icon: CalendarRange },
  { id: SECCION.PLANILLA,  label: 'Planilla', icon: ClipboardList },
  { id: SECCION.MAS,       label: 'Más',      icon: MoreHorizontal },
];

// Secciones donde se muestra el BottomNav. Resto = pantallas de drilldown o wizard.
const SECCIONES_CON_NAV = new Set([
  SECCION.DASHBOARD,
  SECCION.AGENDA,
  SECCION.PLANILLA,
  SECCION.MAS,
]);

/**
 * actualizarFavicon — apunta el <link rel="icon"> del documento al logo del
 * tenant. Si el link no existe, lo crea. Reemplaza el favicon placeholder de
 * index.html. Si no hay logo, deja el placeholder (marca BarberManager).
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

/**
 * elegirImagen — de las imágenes públicas del tenant, la de un tipo con menor
 * `orden` (puede no haber ninguna).
 * @param {Array<{ tipo: string, orden: number|null, url: string }>} imagenes
 * @param {'logo'|'local'} tipo - 'logo' para el favicon y el login, 'local'
 *   para la foto de fondo del login
 * @returns {string|null} URL de la imagen, o null si el tenant no tiene
 */
function elegirImagen(imagenes, tipo) {
  return (imagenes || [])
    .filter((i) => i.tipo === tipo)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0]?.url || null;
}

// Sesión guardada en el celular, leída una sola vez al cargar el módulo. El
// token va a api.js acá mismo, antes del primer render: las pantallas piden
// datos en su primer efecto y ya tienen que llevar el Authorization.
const SESION_INICIAL = leerSesion();
if (SESION_INICIAL) setAuthToken(SESION_INICIAL.token);

function App() {
  const [token, setToken] = useState(SESION_INICIAL?.token ?? null);
  const [barbero, setBarbero] = useState(SESION_INICIAL?.barbero ?? null);
  const [seccion, setSeccion] = useState(SECCION.DASHBOARD);
  // Marca del tenant para el Login: nombre, logo y foto del local. `cargando`
  // es true hasta que terminan los dos pedidos; después, lo que falló o no
  // existe queda en null.
  const [marca, setMarca] = useState({
    cargando: true, nombreNegocio: null, logoUrl: null, imagenLocal: null,
  });

  // Registra el handler que api.js dispara cuando apiFetch recibe 401 (token
  // expirado o revocado: cambio de PIN o barbero desactivado). El token del
  // módulo ya fue limpiado por api.js; acá solo se resetea el estado de React,
  // lo que hace render del Login (el guard `if (!token)` de abajo).
  useEffect(() => {
    setOnUnauthorized(() => {
      console.warn('[App] 401 detectado — redirigiendo al login');
      borrarSesion();
      setToken(null);
      setBarbero(null);
      setSeccion(SECCION.DASHBOARD);
    });
    return () => setOnUnauthorized(null);
  }, []);

  // Marca del tenant: una sola carga del nombre, el logo y la foto del local
  // para toda la app. El nombre y el logo se aplican acá al tab (título y
  // favicon), que tienen que verse también con la sesión abierta, cuando el
  // Login no se renderiza; el Login recibe todo por props (el logo y el nombre
  // en la card, la foto de fondo).
  // Best-effort y por separado: si falla uno, se usa el otro. Si fallan, quedan
  // el título y el favicon de index.html (marca BarberManager) y el login sin
  // marca ni foto.
  useEffect(() => {
    let activo = true;
    (async () => {
      const [tenant, imagenes] = await Promise.allSettled([getTenant(), getImagenesNegocio()]);
      if (!activo) return;
      if (tenant.status === 'rejected') {
        console.warn('[App] getTenant — falló, sin nombre del negocio:', tenant.reason?.message);
      }
      if (imagenes.status === 'rejected') {
        console.warn('[App] getImagenesNegocio — falló, sin logo ni foto del local:', imagenes.reason?.message);
      }
      const nombreNegocio = tenant.value?.nombre || null;
      const logoUrl = imagenes.status === 'fulfilled' ? elegirImagen(imagenes.value, 'logo') : null;
      const imagenLocal = imagenes.status === 'fulfilled' ? elegirImagen(imagenes.value, 'local') : null;
      if (nombreNegocio) document.title = nombreNegocio;
      actualizarFavicon(logoUrl);
      setMarca({ cargando: false, nombreNegocio, logoUrl, imagenLocal });
    })();
    return () => { activo = false; };
  }, []);

  /**
   * onLogin
   * Callback del Login exitoso. Guarda token y datos del barbero, en memoria y
   * en el celular (sesión y último barbero, para el próximo login).
   * @param {string} tokenRecibido - JWT
   * @param {{id, nombre}} barberoData
   */
  const onLogin = useCallback((tokenRecibido, barberoData) => {
    guardarSesion(tokenRecibido, barberoData);
    guardarUltimoBarbero(barberoData.id);
    setToken(tokenRecibido);
    setAuthToken(tokenRecibido);
    setBarbero(barberoData);
    setSeccion(SECCION.DASHBOARD);
  }, []);

  /**
   * cerrarSesion
   * Limpia token (memoria y celular) y vuelve al login.
   */
  const cerrarSesion = useCallback(() => {
    borrarSesion();
    setToken(null);
    clearAuthToken();
    setBarbero(null);
    setSeccion(SECCION.DASHBOARD);
  }, []);

  if (!token) {
    return (
      <Login onAcceso={onLogin} marca={marca} />
    );
  }

  /**
   * navegar
   * Cambia la sección activa.
   * @param {string} nuevaSeccion
   */
  const navegar = (nuevaSeccion) => setSeccion(nuevaSeccion);

  /**
   * renderSeccion
   * Renderiza el componente de la sección activa.
   * @returns {JSX.Element}
   */
  const renderSeccion = () => {
    switch (seccion) {
      case SECCION.DASHBOARD:
        return (
          <Dashboard
            barbero={barbero}
            onCrearTurno={() => navegar(SECCION.CREAR_TURNO)}
            onVerAgenda={() => navegar(SECCION.AGENDA)}
          />
        );
      case SECCION.CREAR_TURNO:
        return (
          <CrearTurno
            barbero={barbero}
            onVolver={() => navegar(SECCION.DASHBOARD)}
            onExito={() => navegar(SECCION.DASHBOARD)}
          />
        );
      case SECCION.AGENDA:
        return <Agenda barbero={barbero} />;
      case SECCION.PLANILLA:
        return <MiPlanilla />;
      case SECCION.MAS:
        return (
          <Mas
            barbero={barbero}
            onIrClientes={() => navegar(SECCION.CLIENTES)}
            onIrGestion={() => navegar(SECCION.GESTION)}
            onCerrarSesion={cerrarSesion}
          />
        );
      case SECCION.CLIENTES:
        // Drilldown desde Más → vuelve a Más con TopBar (lo maneja el propio componente).
        return <Clientes onVolver={() => navegar(SECCION.MAS)} />;
      case SECCION.GESTION:
        return <Gestion barbero={barbero} onVolver={() => navegar(SECCION.MAS)} />;
      default:
        return (
          <EmptyState
            title="Sección desconocida"
            body={`No se reconoce la sección "${seccion}".`}
          />
        );
    }
  };

  const mostrarNav = SECCIONES_CON_NAV.has(seccion);

  return (
    <PageContainer>
      {/* Contenido principal — flex 1 para que el nav quede pegado abajo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {renderSeccion()}
      </div>

      {mostrarNav && (
        <BottomNav
          items={NAV_ITEMS}
          activo={seccion}
          onChange={navegar}
        />
      )}
    </PageContainer>
  );
}

export default App;
