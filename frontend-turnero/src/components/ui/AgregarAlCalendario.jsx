// /frontend-turnero/src/components/ui/AgregarAlCalendario.jsx
// Botón "Agregar al calendario" + link a la otra opción. Lo usan el éxito de
// la reserva y la gestión del turno (que el cliente abre desde el mail, en
// Safari: es el camino de respaldo si el .ics no anda dentro de Instagram).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';
import {
  armarIcs, linkGoogleCalendar, esDispositivoApple, nombreArchivoIcs, descargarIcs,
} from '../../utils/calendario.js';
import Button from './Button.jsx';

/**
 * estiloOtraOpcion
 * El link a la otra opción: botón fantasma subrayado, un poco separado del
 * botón principal. Mantiene los 44 px de alto del botón (touch target).
 */
const estiloOtraOpcion = {
  marginTop: 4,
  color: theme.muted,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

/**
 * AgregarAlCalendario
 * En iPhone, iPad y Mac el botón descarga el .ics (lo abre Calendario de
 * Apple) y el link de abajo abre Google Calendar. En el resto, al revés: el
 * botón abre Google Calendar y el link descarga el .ics (para Outlook u otro
 * calendario).
 * @param {Object} props.evento - De `eventoDeTurno` (utils/calendario.js)
 * @param {'primary'|'secondary'} [props.variant='primary'] - Variante del botón
 */
function AgregarAlCalendario({ evento, variant = 'primary' }) {
  // El dispositivo no cambia durante la visita: se decide una vez.
  const [apple] = useState(() => esDispositivoApple());
  const linkGoogle = linkGoogleCalendar(evento);

  /**
   * descargar
   * Arma el .ics del evento y lo descarga.
   */
  const descargar = () => {
    descargarIcs(armarIcs(evento), nombreArchivoIcs(evento.inicio));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {apple ? (
        <Button variant={variant} onClick={descargar}>
          <IconoCalendario/>
          Agregar al calendario
        </Button>
      ) : (
        <Button variant={variant} href={linkGoogle} externo>
          <IconoCalendario/>
          Agregar al calendario
        </Button>
      )}

      {/* La otra opción, en segundo plano */}
      {apple ? (
        <Button variant="ghost" href={linkGoogle} externo full={false} style={estiloOtraOpcion}>
          Usar Google Calendar
        </Button>
      ) : (
        <Button variant="ghost" onClick={descargar} full={false} style={estiloOtraOpcion}>
          Usar otro calendario (.ics)
        </Button>
      )}
    </div>
  );
}

/**
 * IconoCalendario
 * SVG inline de un calendario con una marca, para el botón. Decorativo.
 */
function IconoCalendario() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M9.5 15l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default AgregarAlCalendario;
