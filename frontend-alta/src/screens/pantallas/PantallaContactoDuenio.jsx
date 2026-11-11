// /frontend-alta/src/screens/pantallas/PantallaContactoDuenio.jsx
// Pantalla 12: cómo contactar al dueño (plan §5.2). Nombre, celular y mail,
// los tres obligatorios, con su autocompletado (name, tel, email).
// - El nombre llega precargado con el del primer dueño, una sola vez (si el
//   cliente lo borra, no vuelve).
// - El celular no se precarga a ciegas: si el WhatsApp del local ya es un
//   número completo, un botón lo copia de un toque.
// La lógica vive en utils/contacto.js.

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_PERSONA } from '../../utils/validaciones.js';
import {
  cambiarContacto, cambiarTelefono, escribirTelefono, leerTelefono, precargarNombreContacto, usarWhatsappComoCelular,
  whatsappValido,
} from '../../utils/contacto.js';
import { fmtTelefonoGuardado } from '../../utils/resumen.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import CampoTelefono from '../../components/CampoTelefono.jsx';
import { Button, Field } from '../../components/ui';

/**
 * PantallaContactoDuenio
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaContactoDuenio({ datos, actualizar, onSeguir, ref }) {
  const { nombre, email } = datos.contacto;
  const celular = leerTelefono(datos, 'celular');
  const errores = useErroresDePantalla(PANTALLA.CONTACTO_DUENIO, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const nombreRef = useRef(null);
  const celularRef = useRef(null);
  const emailRef = useRef(null);

  // Al llegar, el nombre del primer dueño (si corresponde: precargarNombreContacto).
  useEffect(() => {
    actualizar((d) => precargarNombreContacto(d));
  }, [actualizar]);

  // El foco arranca en el nombre solo si va a quedar vacío (sin dueño para precargar).
  const [nombreVacioAlEntrar] = useState(() => precargarNombreContacto(datos).contacto.nombre.trim() === '');

  const whatsapp = datos.local.whatsapp;
  const ofrecerWhatsapp = whatsappValido(datos) && celular.nacional.trim() === '';

  /**
   * salirDe — al salir de un campo de texto: lo guarda recortado y, si se
   * escribió algo, muestra su error.
   * @param {'nombre'|'email'} campo
   */
  const salirDe = (campo) => {
    const valor = datos.contacto[campo] ?? '';
    const recortado = valor.trim();
    if (recortado !== valor) actualizar((d) => cambiarContacto(d, { [campo]: recortado }));
    if (recortado) revelar(`contacto.${campo}`);
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   enfoca el campo del primero.
     */
    intentarSeguir() {
      if (errores.length === 0) {
        // Con Enter no hay blur: se recorta acá.
        if (nombre.trim() !== nombre || email.trim() !== email) {
          actualizar((d) => cambiarContacto(d, { nombre: d.contacto.nombre.trim(), email: d.contacto.email.trim() }));
        }
        return true;
      }
      revelarTodos();
      const porCampo = { 'contacto.nombre': nombreRef, 'contacto.celular': celularRef, 'contacto.email': emailRef };
      (porCampo[errores[0].campo] ?? nombreRef).current?.focus();
      return false;
    },
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field
        ref={nombreRef}
        label="Tu nombre"
        value={nombre ?? ''}
        onChange={(valor) => actualizar((d) => cambiarContacto(d, { nombre: valor }))}
        onBlur={() => salirDe('nombre')}
        onKeyDown={(e) => alPresionarEnter(() => celularRef.current?.focus())(e)}
        error={errorDe('contacto.nombre')}
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={LARGO_NOMBRE_PERSONA.max}
        autoFocus={nombreVacioAlEntrar}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CampoTelefono
          ref={celularRef}
          label="Tu celular"
          pais={celular.pais}
          onCambiarPais={(pais) => actualizar((d) => cambiarTelefono(d, 'celular', { pais, nacional: '' }))}
          valor={celular.nacional}
          onCambiar={(crudo) => {
            const nuevo = escribirTelefono(crudo, celular.pais);
            if (nuevo) actualizar((d) => cambiarTelefono(d, 'celular', nuevo));
          }}
          onBlur={() => celular.nacional.trim() && revelar('contacto.celular')}
          onKeyDown={(e) => alPresionarEnter(() => emailRef.current?.focus())(e)}
          error={errorDe('contacto.celular')}
          helper="Te escribimos por WhatsApp a este número."
          name="tel"
          autoComplete="tel"
          placeholder={celular.pais === 'AR' ? '11 3311-1686' : undefined}
        />
        {ofrecerWhatsapp && (
          <div>
            <Button
              variant="ghost"
              full={false}
              onClick={() => {
                actualizar((d) => usarWhatsappComoCelular(d));
                emailRef.current?.focus();
              }}
              style={{ color: theme.accent, marginLeft: -16 }}
            >
              <Phone size={20} strokeWidth={1.75} aria-hidden="true" />
              {`Usar el del local (${fmtTelefonoGuardado(whatsapp)})`}
            </Button>
          </div>
        )}
      </div>

      <Field
        ref={emailRef}
        label="Tu mail"
        type="email"
        value={email ?? ''}
        onChange={(valor) => actualizar((d) => cambiarContacto(d, { email: valor }))}
        onBlur={() => salirDe('email')}
        onKeyDown={alPresionarEnter(onSeguir)}
        error={errorDe('contacto.email')}
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
      />
    </div>
  );
}

export default PantallaContactoDuenio;
