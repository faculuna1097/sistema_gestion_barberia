// /frontend-turnero/src/App.jsx
// Router principal del turnero del cliente.
// Si la URL contiene /turnos/gestionar/:token → muestra GestionTurno.
// Si no → muestra el wizard de reserva (pasos 1-7).

import { useState, useEffect } from 'react';
import { getTenant, getImagenesNegocio } from './services/api.js';
import { theme } from './theme/tokens.js';
import { PageContainer, Skeleton, EmptyState, Button, IconoAlerta } from './components/ui';
import Landing from './screens/Landing.jsx';
import SeleccionServicio from './screens/SeleccionServicio.jsx';
import SeleccionBarbero from './screens/SeleccionBarbero.jsx';
import SeleccionFecha from './screens/SeleccionFecha.jsx';
import SeleccionHorario from './screens/SeleccionHorario.jsx';
import DatosCliente from './screens/DatosCliente.jsx';
import Confirmacion from './screens/Confirmacion.jsx';
import GestionTurno from './screens/GestionTurno.jsx';

/**
 * extraerTokenDeURL
 * Busca el patrón /turnos/gestionar/:token en el pathname.
 * @returns {string|null} El token si existe, null si no
 */
function extraerTokenDeURL() {
  const path = window.location.pathname;
  const match = path.match(/\/turnos\/gestionar\/([^/]+)/);
  return match ? match[1] : null;
}

function App() {
  const [tenant, setTenant] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Token de gestión si la URL es /turnos/gestionar/:token
  const [tokenGestion] = useState(() => extraerTokenDeURL());

  // Estado del wizard de reserva
  const [paso, setPaso] = useState(0);
  const [reserva, setReserva] = useState({
    servicio: null,
    barbero: null,
    fecha: null,
    horario: null,
    nombre: '',
    telefono: '',
    email: '',
  });

  // Resultado post-confirmación
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        // El tenant es obligatorio: si falla, se muestra el error de carga.
        // Las imágenes son best-effort: si fallan, la Landing cae a sus
        // placeholders en vez de tumbar toda la app.
        const [tenantData, imagenesData] = await Promise.all([
          getTenant(),
          getImagenesNegocio().catch((err) => {
            console.warn('[App] getImagenesNegocio — falló, se usan placeholders:', err.message);
            return [];
          }),
        ]);
        setTenant(tenantData);
        setImagenes(imagenesData);
      } catch (err) {
        console.error('[App] Error cargando tenant:', err.message);
        setError('No se pudo cargar la información del negocio');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // ── Render: loading ───────────────────────────────────────
  // Silueta del Landing (hero + avatar + nombre + meta) para evitar
  // layout shift cuando llega la data del tenant.
  if (cargando) {
    return (
      <PageContainer>
        <div style={{ flex: 1, padding: '16px 16px 24px' }}>
          {/* Hero 16:9 */}
          <Skeleton
            height="auto"
            radius={theme.radiusLg}
            style={{ aspectRatio: '16 / 9', width: '100%' }}
          />
          {/* Avatar circular superpuesto */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: -40,
            marginBottom: 16,
          }}>
            <Skeleton height={80} width={80} radius={999} />
          </div>
          {/* Nombre + meta */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <Skeleton height={24} width={180} />
            <Skeleton height={14} width={140} />
            <Skeleton height={14} width={120} />
          </div>
        </div>
      </PageContainer>
    );
  }

  // ── Render: error de carga ────────────────────────────────
  if (error) {
    return (
      <PageContainer>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            glyph={<IconoAlerta />}
            title="No pudimos cargar"
            body={error}
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  // Ruta especial: gestión del turno desde link del mail
  if (tokenGestion) {
    return <GestionTurno token={tokenGestion} tenant={tenant} />;
  }

  /**
   * actualizarReserva
   * Merge parcial sobre el estado de reserva.
   * @param {Object} datos - Campos a actualizar
   */
  const actualizarReserva = (datos) => {
    setReserva(prev => ({ ...prev, ...datos }));
  };

  /**
   * siguiente
   * Avanza al próximo paso del wizard.
   */
  const siguiente = () => setPaso(prev => prev + 1);

  /**
   * volver
   * Retrocede al paso anterior del wizard.
   */
  const volver = () => setPaso(prev => prev - 1);

  // Wizard de reserva — paso 0 a 6 (7 pantallas)
  switch (paso) {
    case 0:
      return <Landing tenant={tenant} imagenes={imagenes} onReservar={siguiente} />;
    case 1:
      return (
        <SeleccionServicio
          seleccionado={reserva.servicio}
          onSeleccionar={(s) => { actualizarReserva({ servicio: s }); siguiente(); }}
          onVolver={volver}
        />
      );
    case 2:
      return (
        <SeleccionBarbero
          seleccionado={reserva.barbero}
          onSeleccionar={(b) => { actualizarReserva({ barbero: b }); siguiente(); }}
          onVolver={volver}
        />
      );
    case 3:
      return (
        <SeleccionFecha
          barbero={reserva.barbero}
          servicio={reserva.servicio}
          seleccionada={reserva.fecha}
          onSeleccionar={(f) => { actualizarReserva({ fecha: f, horario: null }); siguiente(); }}
          onVolver={volver}
        />
      );
    case 4:
      return (
        <SeleccionHorario
          barbero={reserva.barbero}
          servicio={reserva.servicio}
          fecha={reserva.fecha}
          seleccionado={reserva.horario}
          onSeleccionar={(h) => { actualizarReserva({ horario: h }); siguiente(); }}
          onVolver={volver}
        />
      );
    case 5:
      return (
        <DatosCliente
          datos={{ nombre: reserva.nombre, telefono: reserva.telefono, email: reserva.email }}
          onConfirmar={(d) => { actualizarReserva(d); siguiente(); }}
          onVolver={volver}
        />
      );
    case 6:
      return (
        <Confirmacion
          reserva={reserva}
          tenant={tenant}
          onExito={(res) => setResultado(res)}
          onVolver={volver}
          resultado={resultado}
          onNuevaReserva={() => { setReserva({ servicio: null, barbero: null, fecha: null, horario: null, nombre: '', telefono: '', email: '' }); setResultado(null); setPaso(0); }}
        />
      );
    default:
      return <p>Paso desconocido</p>;
  }
}

export default App;
