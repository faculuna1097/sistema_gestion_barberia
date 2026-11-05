// /frontend/src/components/ui/ContactoSoporte.jsx
// Card con el contacto del soporte (WhatsApp y mail). Antes vivía dentro de
// PantallaLoginPanel, solo para la pantalla de acceso suspendido (402). Se
// centralizó cuando también la usaron los avisos de acceso (subdominio que no
// existe o local dado de baja, error del servidor) en los dos logins y en la
// pantalla de error del arranque.

import { theme } from '../../theme/tokens.js';
import Card from './Card.jsx';

/**
 * ContactoSoporte
 * Muestra el WhatsApp y el mail del soporte, a todo el ancho del contenedor.
 * @returns {JSX.Element}
 */
function ContactoSoporte() {
  return (
    <Card style={{ width: '100%' }} padding={16}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
          WhatsApp: <strong style={{ color: theme.ink }}>11 3311-1686</strong>
        </p>
        <p style={{ margin: 0, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
          facundolunagrebe@gmail.com
        </p>
      </div>
    </Card>
  );
}

export default ContactoSoporte;
