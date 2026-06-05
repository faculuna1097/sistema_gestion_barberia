// /frontend-turnero/src/screens/DatosCliente.jsx
// Pantalla 6: el cliente ingresa nombre, teléfono y email.

import { useState } from 'react';
import { AsYouType, isValidPhoneNumber, getCountryCallingCode, parsePhoneNumber } from 'libphonenumber-js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Field, Button, StickyFooter,
} from '../components/ui';
import { theme } from '../theme/tokens.js';

// Regex muy permisivo para email — solo verifica forma "algo@algo.algo".
const REGEX_EMAIL = /\S+@\S+\.\S+/;

/**
 * PAISES
 * Países disponibles en el selector de prefijo telefónico: Argentina (default),
 * sus limítrofes y Estados Unidos. `iso` es el código ISO que entiende
 * libphonenumber-js; `bandera` es el emoji (se ve como bandera en mobile y como
 * las siglas "AR"/"BR" en desktop). El prefijo (+54, etc.) lo deriva la librería
 * con getCountryCallingCode, así no duplicamos ese dato.
 */
const PAISES = [
  { iso: 'AR', nombre: 'Argentina',      bandera: '🇦🇷' },
  { iso: 'BO', nombre: 'Bolivia',        bandera: '🇧🇴' },
  { iso: 'BR', nombre: 'Brasil',         bandera: '🇧🇷' },
  { iso: 'CL', nombre: 'Chile',          bandera: '🇨🇱' },
  { iso: 'PY', nombre: 'Paraguay',       bandera: '🇵🇾' },
  { iso: 'UY', nombre: 'Uruguay',        bandera: '🇺🇾' },
  { iso: 'US', nombre: 'Estados Unidos', bandera: '🇺🇸' },
];

/**
 * capitalizarNombre
 * Pone en mayúscula la primera letra de cada palabra, dejando el resto del
 * texto tal como lo escribió el cliente (no fuerza el resto a minúscula, para
 * no pelear con apellidos tipo "McLeod"). Soporta acentos y ñ (flag unicode).
 * Solo cambia mayúsculas/minúsculas — no agrega ni quita caracteres —, así que
 * al tipear normalmente el cursor no salta.
 * @param {string} texto - Texto crudo del input
 * @returns {string} Texto con la inicial de cada palabra en mayúscula
 */
function capitalizarNombre(texto) {
  return texto.replace(/(^|\s)(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
}

/**
 * telefonoDesdeE164
 * Dado un número en formato E.164 (ej. "+5491133111686"), deriva el país y el
 * número nacional ya formateado, para precargar el campo cuando el cliente
 * vuelve atrás en el wizard. Si no se puede parsear, devuelve null.
 * @param {string} e164 - Número en formato E.164
 * @returns {{ pais: string, nacional: string } | null}
 */
function telefonoDesdeE164(e164) {
  try {
    const p = parsePhoneNumber(e164);
    return { pais: p.country, nacional: new AsYouType(p.country).input(p.nationalNumber) };
  } catch {
    return null;
  }
}

/**
 * telefonoAE164
 * Convierte el número nacional escrito + el país elegido a formato E.164, que es
 * lo que se guarda. Devuelve null si no se puede parsear (no debería pasar si el
 * form es válido).
 * @param {string} nacional - Número nacional formateado (lo que se ve en el input)
 * @param {string} pais - ISO del país elegido
 * @returns {string | null}
 */
function telefonoAE164(nacional, pais) {
  try {
    return parsePhoneNumber(nacional, pais).number;
  } catch {
    return null;
  }
}

/**
 * DatosCliente
 * Formulario con los 3 datos del cliente. Todos obligatorios.
 * @param {Object} props.datos - { nombre, telefono, email } (valores previos si vuelve).
 *   `telefono` se espera en E.164 (lo que guarda este formulario al confirmar).
 * @param {Function} props.onConfirmar - Callback con { nombre, telefono (E.164), email } trimmeados
 * @param {Function} props.onVolver - Callback para retroceder
 */
function DatosCliente({ datos, onConfirmar, onVolver }) {
  // Si vuelve atrás, el teléfono viene en E.164: lo descomponemos en país + número.
  const telefonoPrevio = datos.telefono ? telefonoDesdeE164(datos.telefono) : null;

  const [nombre, setNombre] = useState(datos.nombre || '');
  const [pais, setPais] = useState(telefonoPrevio?.pais || 'AR');
  const [telefono, setTelefono] = useState(telefonoPrevio?.nacional || '');
  const [email, setEmail] = useState(datos.email || '');

  // touched: el campo se marca tocado al hacer blur, ahí recién mostramos el error.
  // Evita gritarle al cliente apenas entra al form.
  const [touched, setTouched] = useState({ nombre: false, telefono: false, email: false });

  // Validaciones individuales — funciones puras sin estado.
  const errores = {
    nombre:   !nombre.trim()                       ? 'Ingresá tu nombre' : null,
    telefono: !telefono.trim()                     ? 'Ingresá un teléfono'
              : !isValidPhoneNumber(telefono, pais) ? 'Revisá el número de teléfono'
              : null,
    email:    !email.trim()                        ? 'Ingresá tu email'
              : !REGEX_EMAIL.test(email)           ? 'Email con formato inválido'
              : null,
  };

  const valido = !errores.nombre && !errores.telefono && !errores.email;

  /**
   * handleTelefonoChange
   * Formatea el número a medida que se escribe, con las reglas del país elegido
   * (AsYouType: "1133111686" → "11 3311 1686"). Se crea una instancia nueva por
   * llamada para reformatear el string completo (uso recomendado en inputs
   * controlados de React).
   * @param {string} crudo - Valor crudo del input
   */
  const handleTelefonoChange = (crudo) => {
    setTelefono(new AsYouType(pais).input(crudo));
  };

  /**
   * handlePaisChange
   * Cambia el país y reformatea el número actual con las reglas del nuevo país.
   * @param {string} nuevoIso - ISO del país elegido
   */
  const handlePaisChange = (nuevoIso) => {
    setPais(nuevoIso);
    setTelefono(new AsYouType(nuevoIso).input(telefono));
  };

  /**
   * handleSubmit
   * Envía los datos limpios. Solo se llama si el form es válido (botón habilitado).
   * El teléfono se manda en E.164.
   */
  const handleSubmit = () => {
    onConfirmar({
      nombre: nombre.trim(),
      telefono: telefonoAE164(telefono, pais) || telefono.trim(),
      email: email.trim(),
    });
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
          onChange={(valor) => setNombre(capitalizarNombre(valor))}
          onBlur={() => setTouched(t => ({ ...t, nombre: true }))}
          placeholder="Diego Pereyra"
          error={errorVisible('nombre')}
        />

        <CampoTelefono
          label="Teléfono"
          pais={pais}
          onPaisChange={handlePaisChange}
          value={telefono}
          onChange={handleTelefonoChange}
          onBlur={() => setTouched(t => ({ ...t, telefono: true }))}
          placeholder={pais === 'AR' ? '11 3311 1686' : ''}
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

// ─── Subcomponente local ─────────────────────────────────────
// CampoTelefono vive acá (y no extiende el primitivo universal `Field`) porque
// compone [select de país | input] dentro de un solo borde. Si otro front lo
// necesita, recién ahí se promueve a /components/ui/.

/**
 * CampoTelefono
 * Campo de teléfono con selector de país + input que formatea a medida que se
 * escribe. Replica el look de `Field` (label eyebrow, borde, foco, error) sobre
 * un contenedor que agrupa los dos controles como un único campo.
 * @param {string} props.label - Label superior (eyebrow uppercase), asociada al input
 * @param {string} props.pais - ISO del país seleccionado (ej. 'AR')
 * @param {Function} props.onPaisChange - Recibe el nuevo ISO
 * @param {string} props.value - Número nacional ya formateado (lo que se ve)
 * @param {Function} props.onChange - Recibe el valor crudo del input
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.error] - Texto de error; pinta el borde de rojo
 */
function CampoTelefono({ label, pais, onPaisChange, value, onChange, onBlur, placeholder, error }) {
  const [focus, setFocus] = useState(false);

  // Color de border según prioridad: error > focus > default.
  const borderColor = error ? theme.danger : (focus ? theme.accent : theme.hairline);
  const errorId = 'campo-telefono-error';
  const inputId = 'campo-telefono-input';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Label superior en estilo "eyebrow" (uppercase + mono), asociada al input */}
      <label htmlFor={inputId} style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</label>

      {/* Contenedor bordeado que agrupa país + número como un solo campo */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
        overflow: 'hidden',
      }}>
        {/* Selector de país — select nativo (mejor UX/accesibilidad en mobile) */}
        <select
          aria-label="País"
          value={pais}
          onChange={(e) => onPaisChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '12px 8px 12px 14px',
            fontFamily: theme.body,
            fontSize: theme.sizeInput,
            color: theme.ink,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {PAISES.map((p) => (
            <option key={p.iso} value={p.iso} title={p.nombre}>
              {p.bandera} +{getCountryCallingCode(p.iso)}
            </option>
          ))}
        </select>

        {/* Divisor vertical entre país y número */}
        <span style={{ width: 1, background: theme.hairline, alignSelf: 'stretch' }} />

        {/* Input del número */}
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: '12px 14px',
            fontFamily: theme.body,
            fontSize: theme.sizeInput,
            color: theme.ink,
            outline: 'none',
          }}
        />
      </div>

      {/* Error (texto, no solo color de borde) */}
      {error && (
        <span id={errorId} style={{
          fontFamily: theme.body,
          fontSize: 12,
          color: theme.danger,
        }}>{error}</span>
      )}
    </div>
  );
}

export default DatosCliente;
