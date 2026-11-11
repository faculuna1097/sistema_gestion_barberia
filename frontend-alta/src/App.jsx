// /frontend-alta/src/App.jsx
// Raíz del formulario de alta (alta.barbermanager.app/<token>). Carga la
// solicitud del token del path y muestra la pantalla que corresponde al estado
// del link (plan §5.3): cargando, el formulario, "Listo" (recién enviada desde
// esta pestaña), ya enviada, link que no sirve o error al cargar. Sin router: la URL es siempre /<token>, y las pantallas
// del formulario viven en el historial (hooks/useNavegacion.js).

import { useSolicitud, ESTADOS_LINK } from './hooks/useSolicitud.js';
import Formulario from './screens/Formulario.jsx';
import PantallaListo from './screens/PantallaListo.jsx';
import {
  CargandoSolicitud, LinkNoValido, SolicitudEnviada, ErrorDeCarga,
} from './screens/EstadosDelLink.jsx';

/**
 * App
 * @returns {JSX.Element}
 */
function App() {
  const solicitud = useSolicitud();

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
