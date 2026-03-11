// /frontend/src/App.jsx
import { useState, useEffect } from "react";
import MainScreen from "./screens/MainScreen";
import FlujoCorte from "./screens/flows/FlujoCorte";
import FlujoVenta from "./screens/flows/FlujoVenta";
import FlujoGasto from "./screens/flows/FlujoGasto";
import PantallaLoginAdmin from "./screens/PantallaLoginAdmin";
import PanelAdmin from "./screens/admin/PanelAdmin";
import { getBarberos, getServicios, getProductos, getCategorias } from "./services/api";


export default function App() {
  const [currentScreen, setCurrentScreen] = useState("main");

  // Datos precargados — se cargan una vez al arrancar la app
  // Así los flujos no tienen demora cuando el usuario los abre
  const [datos, setDatos] = useState({
    barberos: [],
    servicios: [],
    productos: [],
    categorias: [],
    cargando: true,
    error: null,
  });

  useEffect(() => {
    console.log('[App] Iniciando precarga de datos...');
    const precargarDatos = async () => {
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
        setDatos((prev) => ({ ...prev, cargando: false, error: "Error al cargar datos" }));
      }
    };
    precargarDatos();
  }, []);

  const volverAlInicio = () => {
    console.log('[App] Volviendo a pantalla principal — pantalla anterior:', currentScreen);
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
    return <FlujoVenta onVolver={volverAlInicio}
      productos={datos.productos} />;
  }
  if (currentScreen === "nuevoGasto") {
    console.log('[App] Renderizando FlujoGasto');
    return <FlujoGasto onVolver={volverAlInicio}
      categorias={datos.categorias} />;
  }

  // ── Login de administrador ──────────────────────────────────────────────────
  if (currentScreen === "loginAdmin") {
    console.log('[App] Renderizando PantallaLoginAdmin');
    return (
      <PantallaLoginAdmin
        onAcceso={() => {
          console.log('[App] Acceso admin concedido — navegando a panel admin');
          setCurrentScreen("admin"); // <- PanelAdmin, próximo paso
        }}
        onCancelar={volverAlInicio}
        pinCorrecto="1234" // <- temporal, reemplazar con tenant.pin_admin cuando haya auth
      />
    );
  }

  // ── Panel de administrador ──────────────────────────────────────────────────
  if (currentScreen === "admin") {
    console.log('[App] Renderizando PanelAdmin');
    return <PanelAdmin onSalir={volverAlInicio} />;
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
