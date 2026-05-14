// /frontend-barbero/src/App.jsx
// Router principal de la app del barbero.
// Sin token → Login (selector de barbero + PIN).
// Con token → navegación por estado "seccion".

import { useState, useCallback } from 'react';
import { setAuthToken, clearAuthToken } from './services/api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import CrearTurno from './components/CrearTurno.jsx';
import Agenda from './components/Agenda.jsx';
import MiPlanilla from './components/MiPlanilla.jsx';
import Gestion from './components/Gestion.jsx';
import Clientes from './components/Clientes.jsx';

function App() {
  const [token, setToken] = useState(null);
  const [barbero, setBarbero] = useState(null);
  const [seccion, setSeccion] = useState('dashboard');

  /**
   * onLogin
   * Callback del Login exitoso. Guarda token y datos del barbero.
   * @param {string} tokenRecibido - JWT
   * @param {Object} barberoData - { id, nombre }
   */
  const onLogin = useCallback((tokenRecibido, barberoData) => {
    console.log('[App] onLogin — acceso concedido | barbero:', barberoData.nombre);
    setToken(tokenRecibido);
    setAuthToken(tokenRecibido);
    setBarbero(barberoData);
    setSeccion('dashboard');
  }, []);

  /**
   * cerrarSesion
   * Limpia token y vuelve al login.
   */
  const cerrarSesion = useCallback(() => {
    console.log('[App] cerrarSesion — iniciado');
    setToken(null);
    clearAuthToken();
    setBarbero(null);
    setSeccion('dashboard');
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

  // Menú de navegación — visible en todas las secciones autenticadas
  const menu = (
    <nav>
      <span><strong>{barbero.nombre}</strong></span>
      {' | '}
      <button onPointerDown={() => navegar('dashboard')}>Inicio</button>
      {' | '}
      <button onPointerDown={() => navegar('agenda')}>Agenda</button>
      {' | '}
      <button onPointerDown={() => navegar('planilla')}>Planilla</button>
      {' | '}
      <button onPointerDown={() => navegar('clientes')}>Clientes</button>
      {' | '}
      <button onPointerDown={() => navegar('gestion')}>Gestión</button>
      {' | '}
      <button onPointerDown={cerrarSesion}>Salir</button>
    </nav>
  );

  /**
   * renderSeccion
   * Renderiza el componente de la sección activa.
   * @returns {JSX.Element}
   */
  const renderSeccion = () => {
    switch (seccion) {
      case 'dashboard':
        return (
          <Dashboard
            barbero={barbero}
            onCrearTurno={() => navegar('crear-turno')}
            onVerAgenda={() => navegar('agenda')}
          />
        );
      case 'crear-turno':
        return (
          <CrearTurno
            barbero={barbero}
            onVolver={() => navegar('dashboard')}
            onExito={() => navegar('dashboard')}
          />
        );
      case 'agenda':
        return <Agenda barbero={barbero} />;
      case 'planilla':
        return <MiPlanilla />;
      case 'clientes':
        return <Clientes />;
      case 'gestion':
        return <Gestion barbero={barbero} />;
      default:
        return <p>Sección desconocida</p>;
    }
  };

  return (
    <div>
      {menu}
      <hr />
      {renderSeccion()}
    </div>
  );
}

export default App;
