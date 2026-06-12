// /frontend-barbero/src/App.jsx
// Router principal de la app del barbero.
// Sin token → Login (selector de barbero + PIN).
// Con token → PageContainer + sección activa + BottomNav (cuando aplica).

import { useState, useCallback } from 'react';
import { CalendarDays, CalendarRange, ClipboardList, MoreHorizontal } from 'lucide-react';

import { setAuthToken, clearAuthToken } from './services/api.js';
import { PageContainer, BottomNav, EmptyState } from './components/ui';

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

function App() {
  const [token, setToken] = useState(null);
  const [barbero, setBarbero] = useState(null);
  const [seccion, setSeccion] = useState(SECCION.DASHBOARD);

  /**
   * onLogin
   * Callback del Login exitoso. Guarda token y datos del barbero.
   * @param {string} tokenRecibido - JWT
   * @param {{id, nombre}} barberoData
   */
  const onLogin = useCallback((tokenRecibido, barberoData) => {
    setToken(tokenRecibido);
    setAuthToken(tokenRecibido);
    setBarbero(barberoData);
    setSeccion(SECCION.DASHBOARD);
  }, []);

  /**
   * cerrarSesion
   * Limpia token y vuelve al login.
   */
  const cerrarSesion = useCallback(() => {
    setToken(null);
    clearAuthToken();
    setBarbero(null);
    setSeccion(SECCION.DASHBOARD);
  }, []);

  if (!token) {
    return <Login onAcceso={onLogin} />;
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
        return <Agenda />;
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
