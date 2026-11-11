// /frontend-alta/src/App.jsx
// Raíz del formulario de alta (alta.barbermanager.app/<token>). Carga la
// solicitud del token del path y muestra la pantalla que corresponde al estado
// del link (plan §5.3): cargando, el formulario, "Listo" (recién enviada desde
// esta pestaña), ya enviada, link que no sirve o error al cargar. Sin router:
// la URL es siempre /<token>, y las pantallas del formulario viven en el
// historial (hooks/useNavegacion.js).

import { useEffect, useState } from 'react';
import { useSolicitud, ESTADOS_LINK } from './hooks/useSolicitud.js';
import { useLibTelefono } from './hooks/useLibTelefono.js';
import { PANTALLA } from './config/pantallas.js';
import Formulario from './screens/Formulario.jsx';
import PantallaListo from './screens/PantallaListo.jsx';
import {
  CargandoSolicitud, LinkNoValido, SolicitudEnviada, ErrorDeCarga,
} from './screens/EstadosDelLink.jsx';

/**
 * muestraTelefonos
 * Si lo primero que se dibuja puede mostrar un teléfono guardado: "Ya enviada"
 * (el resumen completo), o un borrador que ya tiene alguno o que quedó en
 * Contacto o más adelante. Ahí App espera a libphonenumber-js
 * (utils/libTelefono.js) antes de sacar el skeleton, así el número no aparece
 * sin formato y cambia un instante después.
 * @param {{estado: string, datos: Object|null}} solicitud
 * @returns {boolean}
 */
function muestraTelefonos({ estado, datos }) {
  if (estado === ESTADOS_LINK.ENVIADA || estado === ESTADOS_LINK.CARGADA) return true;
  if (estado !== ESTADOS_LINK.BORRADOR) return false;
  const hayAlguno = [datos?.local?.whatsapp, datos?.local?.telefono, datos?.contacto?.celular]
    .some((tel) => typeof tel === 'string' && tel.trim() !== '');
  return hayAlguno || (datos?.progreso?.pantalla ?? 0) >= PANTALLA.CONTACTO_LOCAL;
}

/**
 * App
 * @returns {JSX.Element}
 */
function App() {
  const solicitud = useSolicitud();
  const necesitaTelefonos = muestraTelefonos(solicitud);
  const telefonos = useLibTelefono(necesitaTelefonos);

  // Se espera solo en la carga: una vez que se mostró algo, no se vuelve al
  // skeleton (desmontaría el formulario a mitad de camino, ej. si el cliente
  // llega a Contacto antes de que termine la precarga: ahí espera la pantalla).
  // Si no se pudo bajar, se sigue igual: los números se ven sin formato y las
  // pantallas de Contacto ofrecen reintentar.
  const [yaSeMostro, setYaSeMostro] = useState(false);
  const esperarTelefonos = !yaSeMostro && necesitaTelefonos && !telefonos.lista && !telefonos.error;
  const cargando = solicitud.estado === ESTADOS_LINK.CARGANDO;
  useEffect(() => {
    if (!cargando && !esperarTelefonos) setYaSeMostro(true);
  }, [cargando, esperarTelefonos]);
  if (esperarTelefonos) return <CargandoSolicitud />;

  switch (solicitud.estado) {
    case ESTADOS_LINK.BORRADOR:
      return <Formulario solicitud={solicitud} />;
    case ESTADOS_LINK.LISTO:
      return <PantallaListo datos={solicitud.datos} />;
    case ESTADOS_LINK.ENVIADA:
    case ESTADOS_LINK.CARGADA:
      return <SolicitudEnviada datos={solicitud.datos} cargada={solicitud.estado === ESTADOS_LINK.CARGADA} />;
    case ESTADOS_LINK.NO_ENCONTRADA:
      return <LinkNoValido />;
    case ESTADOS_LINK.ERROR_CARGA:
      return <ErrorDeCarga error={solicitud.errorCarga} onReintentar={solicitud.recargar} />;
    default:
      return <CargandoSolicitud />;
  }
}

export default App;
