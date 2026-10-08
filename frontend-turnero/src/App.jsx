// /frontend-turnero/src/App.jsx
// Router principal del turnero del cliente.
// Si la URL es la de gestión (/turnos/gestionar/:token) → muestra GestionTurno.
// Si es la de reseñas (/turnos/resena) → redirige al link de Google del local.
// Si no → muestra el flujo de reserva: una pila de pantallas integrada con el
// historial del navegador (useNavegacion), así el "atrás" del celular vuelve
// un paso en vez de sacar al cliente del turnero.
// Lee una sola vez el `?origen=` con el que llegó el cliente y lo manda con la
// reserva (turno.origen_link).

import { Fragment, useState, useEffect } from 'react';
import { getTenant, getImagenesNegocio, getServicios, getBarberos } from './services/api.js';
import { RUTA_TURNERO, extraerTokenGestion, esRutaResena, leerOrigen } from './utils/rutas.js';
import { useNavegacion } from './hooks/useNavegacion.js';
import { useListaRemota } from './hooks/useListaRemota.js';
import { PageContainer, EmptyState, Button, IconoAlerta } from './components/ui';
import Landing, { LandingSkeleton } from './screens/Landing.jsx';
import SeleccionServicio from './screens/SeleccionServicio.jsx';
import SeleccionCuando from './screens/SeleccionCuando.jsx';
import ConfirmarTurno from './screens/ConfirmarTurno.jsx';
import TurnoConfirmado from './screens/TurnoConfirmado.jsx';
import GestionTurno from './screens/GestionTurno.jsx';

/**
 * SELECCION_VACIA
 * La parte de la reserva que se elige en el flujo (sin los datos del
 * cliente). Cada entrada desde la landing arranca de acá.
 * - `barbero`: antes de elegir horario, el barbero que se marca al entrar a
 *   "¿Cuándo?" (null = "Cualquiera"; viene de la landing si se tocó un
 *   barbero). Después, el barbero que atiende el turno.
 * - `barberoAsignado`: true si el barbero lo asignó "Cualquiera" (el resumen
 *   dice "te atiende X").
 * - `horario`: ISO del turno elegido. El día sale de acá (fechaDeISO).
 */
const SELECCION_VACIA = {
  servicio: null,
  barbero: null,
  barberoAsignado: false,
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

  // Por qué link llegó el cliente (`?origen=instagram`): se lee una sola vez,
  // al cargar. Vive fuera de la reserva para que "Reservar otro turno" no lo
  // borre: sigue siendo la misma visita. La navegación del flujo no cambia la
  // URL (pushState sin URL), y una recarga la vuelve a leer.
  const [origen] = useState(() => leerOrigen(window.location.search));

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
   * - con un servicio → "¿Cuándo?", con "Cualquiera";
   * - con un barbero → servicio, y después "¿Cuándo?" con ese barbero marcado;
   * - desde el CTA → servicio, y después "¿Cuándo?" con "Cualquiera".
   * "Volver" desde ahí regresa a la landing (es la entrada anterior del historial).
   * @param {Object} [preeleccion] - { servicio } o { barbero }; vacío para el CTA
   */
  const entrarDesdeLanding = (preeleccion = {}) => {
    actualizarReserva({ ...SELECCION_VACIA, ...preeleccion });
    nav.irA(preeleccion.servicio ? 'cuando' : 'servicio');
  };

  /**
   * renderPantalla
   * Elige qué pantalla mostrar según la que está arriba de la pila.
   * El orden del flujo: landing → servicio → cuando → datos → exito. "datos"
   * (ConfirmarTurno) junta el resumen, los datos del cliente y la
   * confirmación. Desde la landing se puede entrar con el servicio ya elegido,
   * y su pantalla se saltea (ver entrarDesdeLanding).
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
        return (
          <SeleccionServicio
            servicios={servicios.datos}
            cargando={servicios.cargando}
            error={servicios.error}
            onReintentar={servicios.reintentar}
            seleccionado={reserva.servicio}
            // Si cambia el servicio, el horario elegido antes (con otra duración)
            // deja de valer: "¿Cuándo?" no lo marca ni abre su día.
            onSeleccionar={(s) => {
              actualizarReserva(s.id === reserva.servicio?.id ? { servicio: s } : { servicio: s, horario: null });
              nav.irA('cuando');
            }}
            onVolver={nav.volver}
          />
        );
      case 'cuando':
        // El barbero que se marca al entrar: el de la reserva, salvo que
        // lo haya asignado "Cualquiera" (al volver de Datos, sigue "Cualquiera").
        // La reserva se escribe recién al tocar un horario: barbero y horario
        // juntos, así nunca queda un barbero con el horario de otro.
        return (
          <SeleccionCuando
            servicio={reserva.servicio}
            barberos={barberos}
            barberoInicial={reserva.barberoAsignado ? null : reserva.barbero}
            horarioInicial={reserva.horario}
            onElegir={({ horario, barbero, barberoAsignado }) => {
              actualizarReserva({ horario, barbero, barberoAsignado });
              nav.irA('datos');
            }}
            onVolver={nav.volver}
          />
        );
      case 'datos':
        // Al confirmar, la pantalla se reemplaza por 'exito' y se cierra el
        // flujo: el "atrás" ya no vuelve acá ni puede reenviar la reserva.
        return (
          <ConfirmarTurno
            reserva={reserva}
            tenant={tenant}
            barberos={barberos.datos}
            origen={origen}
            onGuardarDatos={actualizarReserva}
            onCambiarBarbero={(barbero) => actualizarReserva({ barbero })}
            onExito={(res) => { setResultado(res); nav.cerrarFlujo('exito'); }}
            onVolver={nav.volver}
          />
        );
      case 'exito':
        // Nunca se renderiza el éxito sin un turno creado.
        if (!resultado) return landing;
        return (
          <TurnoConfirmado
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
