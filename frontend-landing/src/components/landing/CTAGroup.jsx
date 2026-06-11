// /frontend-landing/src/components/landing/CTAGroup.jsx
// Par de CTA de contacto (WhatsApp + Email) reusado en Hero, Plan y CTA final.
// Centraliza los textos y los links (utils/contacto.js) para no repetirlos.

import { MessageCircle, Mail } from 'lucide-react';
import Button from '../ui/Button.jsx';
import { linkWhatsApp, linkEmail } from '../../utils/contacto.js';

/**
 * CTAGroup
 * Botón primario de WhatsApp + secundario de Email.
 * @param {'start'|'center'} [props.align='start'] - Alineación horizontal del grupo
 * @param {string} [props.primaryLabel='Probá tu primer mes gratis'] - Texto del CTA de WhatsApp
 * @param {string} [props.secondaryLabel='Escribinos por email'] - Texto del CTA de email
 * @param {string} [props.mensaje] - Mensaje pre-cargado del WhatsApp (override)
 * @param {Object} [props.emailOpts] - { asunto, cuerpo } para el mailto (override)
 * @param {Object} [props.style] - Override del wrapper
 */
function CTAGroup({
  align = 'start',
  primaryLabel = 'Probá tu primer mes gratis',
  secondaryLabel = 'Escribinos por email',
  mensaje,
  emailOpts,
  style,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        ...style,
      }}
    >
      <Button
        href={linkWhatsApp(mensaje)}
        external
        variant="primary"
        full={false}
      >
        <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
        {primaryLabel}
      </Button>
      <Button
        href={linkEmail(emailOpts)}
        variant="secondary"
        full={false}
      >
        <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
        {secondaryLabel}
      </Button>
    </div>
  );
}

export default CTAGroup;
