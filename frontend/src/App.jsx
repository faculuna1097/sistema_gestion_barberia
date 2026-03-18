// /frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PanelAdmin from "./screens/admin/PanelAdmin";
import { getBarberos, getServicios, getProductos, getCategorias } from "./services/api";


export default function App() {
  const [currentScreen, setCurrentScreen] = useState("main");

  // Datos precargados — se cargan al arrancar y cada vez que se cierra el panel admin
  const [datos, setDatos] = useState({
    barberos: [],
    servicios: [],
    productos: [],
    categorias: [],
    cargando: true,
    error: null,
  });

  /**
   * precargarDatos — carga barberos, servicios, productos y categorías en paralelo.
   * Se llama al arrancar la app, al cerrar el panel admin, y al volver de FlujoVenta
   * (que modifica el stock de productos).
   */
  const precargarDatos = useCallback(async () => {
    console.log('[App] Iniciando precarga de datos...');
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

  const volverAlInicio = () => {
    console.log('[App] Volviendo a pantalla principal — pantalla anterior:', currentScreen);
    setCurrentScreen("main");
  };

  /**
   * cerrarSesionAdmin — recarga los datos antes de volver a la pantalla principal,
   * para que los flujos reflejen cualquier cambio hecho desde Gestión.
   */
  const cerrarSesionAdmin = () => {
    console.log('[App] Cerrando sesión admin — recargando datos...');
    precargarDatos();
    setCurrentScreen("main");
  };

  if (datos.cargando) {
    console.log('[App] Esperando precarga de datos...');
  }

  if (datos.error) {
    console.error('[App] Estado de error activo:', datos.error);
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
        onAcceso={() => {
          console.log('[App] Acceso admin concedido — navegando a panel admin');
          setCurrentScreen("admin");
        }}
        onCancelar={volverAlInicio}
        pinCorrecto="1234" // <- temporal, reemplazar con tenant.pin_admin cuando haya auth
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
    />
  );
}
