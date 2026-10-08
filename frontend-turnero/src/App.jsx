// /frontend-turnero/src/App.jsx
// Router principal del turnero del cliente.
// Si la URL es la de gestión (/turnos/gestionar/:token) → muestra GestionTurno.
// Si es la de reseñas (/turnos/resena) → redirige al link de Google del local.
// Si no → muestra el flujo de reserva: una pila de pantallas integrada con el
// historial del navegador (useNavegacion), así el "atrás" del celular vuelve
// un paso en vez de sacar al cliente del turnero.

import { Fragment, useState, useEffect } from 'react';
import { getTenant, getImagenesNegocio, getServicios, getBarberos } from './services/api.js';
import { RUTA_TURNERO, extraerTokenGestion, esRutaResena } from './utils/rutas.js';
import { useNavegacion } from './hooks/useNavegacion.js';
import { useListaRemota } from './hooks/useListaRemota.js';
import { PageContainer, EmptyState, Button, IconoAlerta } from './components/ui';
import Landing, { LandingSkeleton } from './screens/Landing.jsx';
import SeleccionServicio from './screens/SeleccionServicio.jsx';
import SeleccionBarbero from './screens/SeleccionBarbero.jsx';
import SeleccionFecha from './screens/SeleccionFecha.jsx';
import SeleccionHorario from './screens/SeleccionHorario.jsx';
import DatosCliente from './screens/DatosCliente.jsx';
import Confirmacion from './screens/Confirmacion.jsx';
import GestionTurno from './screens/GestionTurno.jsx';

/**
 * SELECCION_VACIA
 * La parte de la reserva que se elige en el flujo (sin los datos del
 * cliente). Cada entrada desde la landing arranca de acá.
 * `barberoPreelegido`: el barbero se eligió en la landing, así que después
 * del servicio se saltea su pantalla.
 */
const SELECCION_VACIA = {
  servicio: null,
  barbero: null,
  barberoPreelegido: false,
  fecha: null,
  horario: null,
};

/**
 * RESERVA_VACIA
 * Estado inicial de la reserva en memoria (y el de cada flujo nuevo).
 */
const RESERVA_VACIA = {
  ...SELECCION_VACIA,
  nombre: '',
  telefono: '',
  email: '',
};

/**
 * esUrlHttps
 * True si `url` es una dirección https. Red defensiva antes de redirigir a un
 * dato del tenant (el backend ya lo valida): `location.replace` con un
 * `javascript:` ejecutaría código.
 * @param {string|null} url
 * @returns {boolean}
 */
function esUrlHttps(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url);
}

/**
 * actualizarFavicon — apunta el <link rel="icon"> del documento al logo del
 * tenant. Si el link no existe, lo crea. Reusa la imagen del logo que ya se
 * descarga para la UI (cache hit, sin pedido extra). Reemplaza el favicon
 * placeholder de index.html. Si no hay logo, deja el placeholder (marca BarberManager).
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

function App() {
  const [tenant, setTenant] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Token de gestión si la URL es la de gestión de un turno (link del mail).
  const [tokenGestion] = useState(() => extraerTokenGestion(window.location.pathname));
  // Ruta de reseñas (link de la landing o QR de la puerta): solo redirige.
  const [esResena] = useState(() => esRutaResena(window.location.pathname));
  // Ni la gestión ni la reseña usan el flujo: sin historial propio ni listas.
  const enFlujoReserva = !tokenGestion && !esResena;

  // Servicios y barberos: se piden una sola vez, en paralelo con el tenant y
  // las imágenes, y bajan por props. Si fallan, cada lista expone su
  // `reintentar` y la pantalla que la muestra ofrece el botón.
  const servicios = useListaRemota(getServicios, { nombre: 'servicios', activa: enFlujoReserva });
  const barberos = useListaRemota(getBarberos, { nombre: 'barberos', activa: enFlujoReserva });

  // Estado de la reserva en curso (solo en memoria).
  const [reserva, setReserva] = useState(RESERVA_VACIA);

  // Resultado post-confirmación ({ turno_id, token_gestion }).
  const [resultado, setResultado] = useState(null);

  /**
   * reiniciarReserva
   * Descarta la reserva en memoria: arranca un flujo nuevo desde la landing.
   */
  const reiniciarReserva = () => {
    setReserva(RESERVA_VACIA);
    setResultado(null);
  };

  const nav = useNavegacion({ activa: enFlujoReserva, alReiniciar: reiniciarReserva });

  useEffect(() => {
    async function cargar() {
      try {
        // El tenant es obligatorio: si falla, se muestra el error de carga.
        // Las imágenes son best-effort: si fallan, la Landing cae a sus
        // variantes sin imagen en vez de tumbar toda la app. La ruta de
        // reseñas no las pide: no las usa y no tiene que esperarlas para
        // redirigir.
        const [tenantData, imagenesData] = await Promise.all([
          getTenant(),
          esResena ? [] : getImagenesNegocio().catch((err) => {
            console.warn('[App] getImagenesNegocio — falló, se muestra la landing sin imágenes:', err.message);
            return [];
          }),
        ]);
        setTenant(tenantData);
        setImagenes(imagenesData);

        // Branding del tab: título = nombre del tenant + sufijo; favicon = logo
        // del tenant (cae al placeholder de marca si el tenant no tiene logo).
        if (tenantData?.nombre) document.title = `${tenantData.nombre} · Reservas`;
        const logoUrl = (imagenesData || [])
          .filter((i) => i.tipo === 'logo')
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0]?.url || null;
        actualizarFavicon(logoUrl);
      } catch (err) {
        console.error('[App] Error cargando tenant:', err.message);
        setError('No se pudo cargar la información del negocio');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [esResena]);

  // Ruta de reseñas: apenas llega el tenant, redirige al link de Google del
  // local, o a la landing si no tiene. `replace` para que el "atrás" desde
  // Google no vuelva a caer en esta ruta (y redirija de nuevo).
  // El ?origen= queda en la URL; registrarlo es de la feature "Base de clientes".
  useEffect(() => {
    if (!esResena || !tenant) return;
    window.location.replace(esUrlHttps(tenant.resena_url) ? tenant.resena_url : RUTA_TURNERO);
  }, [esResena, tenant]);

  // ── Render: loading ───────────────────────────────────────
  // En la landing, su silueta (mismos bloques que la real: no salta al llegar
  // los datos). En la gestión y en la reseña, la columna vacía: mostrar la
  // landing ahí sería anunciar una pantalla que no viene.
  if (cargando) {
    return enFlujoReserva ? <LandingSkeleton /> : <PageContainer />;
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

  // Ruta de reseñas: el efecto de arriba ya está redirigiendo.
  if (esResena) {
    return <PageContainer />;
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
   * entrarDesdeLanding
   * Arranca una elección desde la landing (el CTA, un servicio o un barbero).
   * Descarta lo elegido antes —si el cliente volvió a la landing, empieza de
   * nuevo— pero conserva sus datos (nombre, teléfono, email) si ya los había
   * escrito. Va a la primera pantalla a la que le falta su dato:
   * - con un servicio → barbero;
   * - con un barbero, o desde el CTA → servicio.
   * "Volver" desde ahí regresa a la landing (es la entrada anterior del historial).
   * @param {Object} [preeleccion] - { servicio } o { barbero }; vacío para el CTA
   */
  const entrarDesdeLanding = (preeleccion = {}) => {
    actualizarReserva({
      ...SELECCION_VACIA,
      ...preeleccion,
      barberoPreelegido: Boolean(preeleccion.barbero),
    });
    nav.irA(preeleccion.servicio ? 'barbero' : 'servicio');
  };

  /**
   * renderPantalla
   * Elige qué pantalla mostrar según la que está arriba de la pila.
   * El orden del flujo: landing → servicio → barbero → fecha → horario →
   * datos → confirmacion → exito. Desde la landing se puede entrar con el
   * servicio o el barbero ya elegidos, y esa pantalla se saltea
   * (ver entrarDesdeLanding y el onSeleccionar de 'servicio').
   * @returns {JSX.Element}
   */
  const renderPantalla = () => {
    const landing = (
      <Landing
        tenant={tenant}
        imagenes={imagenes}
        servicios={servicios}
        barberos={barberos}
        // Sin dirección todavía: es la primera pantalla de la visita.
        entradaInicial={nav.direccion === null}
        onReservar={() => entrarDesdeLanding()}
        onElegirServicio={(s) => entrarDesdeLanding({ servicio: s })}
        onElegirBarbero={(b) => entrarDesdeLanding({ barbero: b })}
      />
    );

    switch (nav.pantalla) {
      case 'servicio':
        // Si el barbero vino de la landing, su pantalla se saltea. No alcanza
        // con mirar si hay barbero en la reserva: si lo eligió en su pantalla
        // y volvió atrás hasta acá, al avanzar tiene que volver a verla.
        return (
          <SeleccionServicio
            servicios={servicios.datos}
            cargando={servicios.cargando}
            error={servicios.error}
            onReintentar={servicios.reintentar}
            seleccionado={reserva.servicio}
            onSeleccionar={(s) => {
              actualizarReserva({ servicio: s });
              nav.irA(reserva.barberoPreelegido ? 'fecha' : 'barbero');
            }}
            onVolver={nav.volver}
          />
        );
      case 'barbero':
        return (
          <SeleccionBarbero
            barberos={barberos.datos}
            cargando={barberos.cargando}
            error={barberos.error}
            onReintentar={barberos.reintentar}
            seleccionado={reserva.barbero}
            onSeleccionar={(b) => { actualizarReserva({ barbero: b }); nav.irA('fecha'); }}
            onVolver={nav.volver}
          />
        );
      case 'fecha':
        return (
          <SeleccionFecha
            barbero={reserva.barbero}
            servicio={reserva.servicio}
            seleccionada={reserva.fecha}
            onSeleccionar={(f) => { actualizarReserva({ fecha: f, horario: null }); nav.irA('horario'); }}
            onVolver={nav.volver}
          />
        );
      case 'horario':
        return (
          <SeleccionHorario
            barbero={reserva.barbero}
            servicio={reserva.servicio}
            fecha={reserva.fecha}
            seleccionado={reserva.horario}
            onSeleccionar={(h) => { actualizarReserva({ horario: h }); nav.irA('datos'); }}
            onVolver={nav.volver}
          />
        );
      case 'datos':
        return (
          <DatosCliente
            datos={{ nombre: reserva.nombre, telefono: reserva.telefono, email: reserva.email }}
            onConfirmar={(d) => { actualizarReserva(d); nav.irA('confirmacion'); }}
            onVolver={nav.volver}
          />
        );
      case 'confirmacion':
        // Al confirmar, la pantalla se reemplaza por 'exito' y se cierra el
        // flujo: el "atrás" ya no vuelve acá ni puede reenviar la reserva.
        return (
          <Confirmacion
            reserva={reserva}
            tenant={tenant}
            resultado={null}
            onExito={(res) => { setResultado(res); nav.cerrarFlujo('exito'); }}
            onVolver={nav.volver}
          />
        );
      case 'exito':
        // Sin resultado, Confirmacion mostraría "Revisar" con el botón de
        // confirmar: nunca se renderiza el éxito sin un turno creado.
        if (!resultado) return landing;
        return (
          <Confirmacion
            reserva={reserva}
            tenant={tenant}
            resultado={resultado}
            onNuevaReserva={() => { reiniciarReserva(); nav.volverAlInicio(); }}
          />
        );
      default:
        return landing;
    }
  };

  return (
    // data-tt-direccion: index.css elige con él la animación de entrada de la
    // pantalla (desde la derecha al avanzar, desde la izquierda al volver).
    <div data-tt-direccion={nav.direccion}>
      {/* key: cada pantalla nueva se monta de cero y corre su transición */}
      <Fragment key={`${nav.profundidad}-${nav.pantalla}`}>
        {renderPantalla()}
      </Fragment>
    </div>
  );
}

export default App;
