// /frontend-turnero/src/screens/DatosCliente.jsx
// Pantalla 6: el cliente ingresa nombre, teléfono y email.

import { useState } from 'react';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Field, Button, StickyFooter,
} from '../components/ui';

// Regex muy permisivo para email — solo verifica forma "algo@algo.algo".
const REGEX_EMAIL = /\S+@\S+\.\S+/;

// Cantidad exacta de dígitos esperada en el teléfono (convención AR: cód. área + número).
const TELEFONO_DIGITOS = 10;

/**
 * DatosCliente
 * Formulario con los 3 datos del cliente. Todos obligatorios.
 * @param {Object} props.datos - { nombre, telefono, email } (valores previos si vuelve)
 * @param {Function} props.onConfirmar - Callback con { nombre, telefono, email } trimmeados
 * @param {Function} props.onVolver - Callback para retroceder
 */
function DatosCliente({ datos, onConfirmar, onVolver }) {
  const [nombre, setNombre] = useState(datos.nombre || '');
  const [telefono, setTelefono] = useState(datos.telefono || '');
  const [email, setEmail] = useState(datos.email || '');

  // touched: el campo se marca tocado al hacer blur, ahí recién mostramos el error.
  // Evita gritarle al cliente apenas entra al form.
  const [touched, setTouched] = useState({ nombre: false, telefono: false, email: false });

  // Cantidad de dígitos del teléfono (ignora espacios, guiones, paréntesis).
  const telefonoDigitos = telefono.replace(/\D/g, '').length;

  // Validaciones individuales — funciones puras sin estado.
  const errores = {
    nombre:   !nombre.trim()                          ? 'Ingresá tu nombre' : null,
    telefono: !telefono.trim()                        ? 'Ingresá un teléfono'
              : telefonoDigitos !== TELEFONO_DIGITOS  ? `El teléfono debe tener ${TELEFONO_DIGITOS} dígitos`
              : null,
    email:    !email.trim()                           ? 'Ingresá tu email'
              : !REGEX_EMAIL.test(email)              ? 'Email con formato inválido'
              : null,
  };

  const valido = !errores.nombre && !errores.telefono && !errores.email;

  /**
   * handleSubmit
   * Envía los datos limpios. Solo se llama si el form es válido (botón habilitado).
   */
  const handleSubmit = () => {
    onConfirmar({ nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim() });
  };

  /**
   * errorVisible
   * Solo se muestra el error del campo si el cliente ya hizo blur en él.
   */
  const errorVisible = (campo) => touched[campo] ? errores[campo] : null;

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow="Paso 5 de 6"
        title="Tus datos"
        subtitle="Para confirmar y mandarte el recordatorio."
      />
      <Progress step={5}/>

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <Field
          label="Nombre y apellido"
          value={nombre}
          onChange={setNombre}
          onBlur={() => setTouched(t => ({ ...t, nombre: true }))}
          placeholder="Diego Pereyra"
          error={errorVisible('nombre')}
        />

        <Field
          label="Teléfono"
          type="tel"
          value={telefono}
          onChange={setTelefono}
          onBlur={() => setTouched(t => ({ ...t, telefono: true }))}
          placeholder="11 5039 1247"
          error={errorVisible('telefono')}
        />

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched(t => ({ ...t, email: true }))}
          placeholder="vos@correo.com"
          helper={!errorVisible('email') ? 'Te mandamos el link de gestión a este correo.' : undefined}
          error={errorVisible('email')}
        />
      </div>

      <StickyFooter>
        <Button onClick={handleSubmit} disabled={!valido}>
          Revisar reserva
        </Button>
      </StickyFooter>
    </PageContainer>
  );
}

export default DatosCliente;
