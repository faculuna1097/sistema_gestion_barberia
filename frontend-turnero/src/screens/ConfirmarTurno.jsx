// /frontend-turnero/src/screens/ConfirmarTurno.jsx
// Paso 3 del flujo, "Datos": resumen del turno, datos del cliente y
// "Confirmar turno", en una sola pantalla. Reemplaza a DatosCliente y a la
// vista "Revisar" de Confirmacion, que eran dos pantallas seguidas.

import { useId, useRef, useState } from 'react';
import { AsYouType, isValidPhoneNumber, getCountryCallingCode } from 'libphonenumber-js';
import { crearTurno, getDisponibilidad } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fechaDeISO } from '../utils/fecha.js';
import { mensajeDeError } from '../utils/errores.js';
import {
  PAISES, topeDigitos, telefonoAE164, normalizarTelefonoCompleto,
} from '../utils/telefono.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Field, Button, StickyFooter, ResumenTurno,
} from '../components/ui';
import { estiloEyebrow, MARGEN_SCROLL_CAMPO } from '../components/ui/estilos.js';

// Formato de email: el mismo que valida el backend (utils/validarTexto.js), así
// un email que el backend rechazaría se marca acá, en el campo.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// id del <form>: el botón del StickyFooter queda fuera del form y se asocia por este id.
const FORM_ID = 'form-confirmar-turno';

// Campos del formulario, en el orden en que se ven: el primero con error es el que se enfoca.
const CAMPOS = ['nombre', 'telefono', 'email'];

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
 * enfocarCampo
 * Enfoca un input y lo centra en la pantalla: con el foco solo, el navegador
 * lo deja pegado al borde, y abajo lo taparía el botón fijo.
 * @param {HTMLElement|null} input
 */
function enfocarCampo(input) {
  if (!input) return;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: 'center' });
}

/**
 * buscarOtroBarbero
 * Después de un 409 con "Cualquiera": vuelve a pedir los horarios del día
 * para todos los barberos y se fija si el horario sigue libre con otro.
 * Compara instantes, no strings, por si el ISO cambia de forma.
 * Si no puede consultar, lo da por ocupado: el 409 ya dijo que con el barbero
 * asignado no hay lugar.
 * @param {Object} datos
 * @param {string} datos.servicioId
 * @param {string} datos.horario - ISO del turno
 * @param {string} datos.barberoId - Barbero con el que dio 409
 * @param {Array<Object>} datos.barberos - Lista de App, para el nombre del nuevo
 * @returns {Promise<Object|null>} { id, nombre } del barbero que lo tiene
 *   libre (nombre null si no está en la lista), o null si no hay otro
 */
async function buscarOtroBarbero({ servicioId, horario, barberoId, barberos }) {
  let asignaciones;
  try {
    ({ asignaciones = {} } = await getDisponibilidad(null, servicioId, fechaDeISO(horario)));
  } catch (err) {
    console.error('[ConfirmarTurno] Error verificando el horario para reintentar:', err.message);
    return null;
  }
  const instante = new Date(horario).getTime();
  const clave = Object.keys(asignaciones).find((iso) => new Date(iso).getTime() === instante);
  const id = clave ? asignaciones[clave] : null;
  if (!id || id === barberoId) return null;
  return barberos.find((b) => b.id === id) ?? { id, nombre: null };
}

/**
 * ConfirmarTurno
 * Arriba, el resumen del turno; abajo, nombre, teléfono y email; fijo al pie,
 * "Confirmar turno". El botón siempre está habilitado: si falta algo, marca
 * todos los errores y enfoca el primer campo con error. Mientras envía, se
 * deshabilita (sin doble envío).
 *
 * Si el horario se ocupó justo (409):
 * - con "Cualquiera", vuelve a pedir los horarios del día y, si sigue libre
 *   con otro barbero, cambia el barbero de la reserva y reintenta una vez;
 * - si no (o con un barbero elegido a mano), avisa "Ese horario se acaba de
 *   ocupar" y el botón pasa a ser "Elegir otro horario" (vuelve a "¿Cuándo?").
 * Cualquier otro error muestra el mensaje del backend y deja reintentar.
 *
 * Los datos del cliente viven en App (no acá): cada cambio sube con
 * `onCambiarCliente`, así siguen escritos si el cliente vuelve a "¿Cuándo?" o
 * reserva otro turno.
 *
 * @param {Object} props.reserva - Reserva de App: servicio, barbero, barberoAsignado, horario
 * @param {Object} props.cliente - Datos del cliente de App: { nombre, pais, telefono
 *   (nacional, como se ve en el campo), email }
 * @param {Object} props.tenant - { nombre, direccion }
 * @param {Array<Object>} props.barberos - Lista de App ({ id, nombre }), para el reintento
 * @param {string|null} props.origen - Por qué link llegó el cliente; se manda en el POST
 * @param {Function} props.onCambiarCliente - Recibe los campos de `cliente` que cambiaron
 * @param {Function} props.onCambiarBarbero - Recibe el barbero nuevo del reintento
 * @param {Function} props.onExito - Recibe { turno_id, token_gestion }
 * @param {Function} props.onVolver - Vuelve a "¿Cuándo?"
 */
function ConfirmarTurno({
  reserva, cliente, tenant, barberos, origen,
  onCambiarCliente, onCambiarBarbero, onExito, onVolver,
}) {
  const { nombre, pais, telefono, email } = cliente;

  // touched: el error de un campo se muestra recién al salir de él (blur) o
  // al intentar confirmar. Evita gritarle al cliente apenas entra.
  const [touched, setTouched] = useState({ nombre: false, telefono: false, email: false });

  // Envío: `enviando` deshabilita el botón; la ref corta un segundo submit que
  // llegue antes de que React vuelva a pintar (ej. doble "Ir" del teclado).
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  // Error del POST: { tipo: 'ocupado' } o { tipo: 'envio', texto }.
  const [error, setError] = useState(null);

  // Inputs, para enfocar el primero con error.
  const nombreRef = useRef(null);
  const telefonoRef = useRef(null);
  const emailRef = useRef(null);
  const refsPorCampo = { nombre: nombreRef, telefono: telefonoRef, email: emailRef };

  // Validaciones individuales — derivadas del estado, sin efectos.
  const errores = {
    nombre:   !nombre.trim()                       ? 'Ingresá tu nombre' : null,
    telefono: !telefono.trim()                     ? 'Ingresá un teléfono'
              : !isValidPhoneNumber(telefono, pais) ? 'Revisá el número de teléfono'
              : null,
    email:    !email.trim()                        ? 'Ingresá tu email'
              : !REGEX_EMAIL.test(email.trim())    ? 'Revisá el email'
              : null,
  };

  /**
   * errorVisible
   * El error de un campo se muestra solo si el cliente ya pasó por él o
   * intentó confirmar.
   * @param {string} campo - 'nombre' | 'telefono' | 'email'
   * @returns {string|null}
   */
  const errorVisible = (campo) => (touched[campo] ? errores[campo] : null);

  /**
   * handleTelefonoChange
   * Formatea el número a medida que se escribe, con las reglas del país elegido
   * (AsYouType: "1133111686" → "11 3311 1686"). Se crea una instancia nueva por
   * llamada para reformatear el string completo (uso recomendado en inputs
   * controlados de React). Frena la entrada al llegar al tope de dígitos del país.
   * Si llega un número completo (autocompletado, pegado o tipeado con "+"),
   * lo interpreta y ajusta país + número nacional. Con "+", el tope cuenta el
   * código de país (topeDigitos), así se puede terminar de escribirlo.
   * @param {string} crudo - Valor crudo del input
   */
  const handleTelefonoChange = (crudo) => {
    const completo = normalizarTelefonoCompleto(crudo, pais);
    if (completo) {
      onCambiarCliente({ pais: completo.pais, telefono: completo.nacional });
      return;
    }
    // Freno duro: ignoramos la tecla si excede el tope de dígitos.
    const digitos = crudo.replace(/\D/g, '');
    if (digitos.length > topeDigitos(crudo, pais)) return;
    onCambiarCliente({ telefono: new AsYouType(pais).input(crudo) });
  };

  /**
   * handlePaisChange
   * Cambia el país y limpia el número. Como las reglas de formato y longitud
   * cambian según el país, es más claro que el cliente lo reescriba desde cero
   * que arrastrar un número a medio formatear con las reglas del país anterior.
   * @param {string} nuevoIso - ISO del país elegido
   */
  const handlePaisChange = (nuevoIso) => {
    onCambiarCliente({ pais: nuevoIso, telefono: '' });
  };

  /**
   * reservar
   * Manda la reserva. Con "Cualquiera", ante un 409 busca otro barbero libre
   * en el mismo horario y reintenta una sola vez; si no hay, relanza el 409.
   * @param {Object} datos - { nombre, telefono, email } ya limpios
   * @returns {Promise<Object>} { turno_id, token_gestion }
   * @throws {Error} El error del POST (con `status`), o el 409 original
   */
  const reservar = async (datos) => {
    const pedir = (barberoId) => crearTurno({
      servicio_id: reserva.servicio.id,
      barbero_id: barberoId,
      inicio: reserva.horario,
      ...datos,
      ...(origen && { origen }),
    });

    try {
      return await pedir(reserva.barbero.id);
    } catch (err) {
      if (err.status !== 409 || !reserva.barberoAsignado) throw err;
      const otro = await buscarOtroBarbero({
        servicioId: reserva.servicio.id,
        horario: reserva.horario,
        barberoId: reserva.barbero.id,
        barberos,
      });
      if (!otro) throw err;
      // La reserva pasa a ser con el barbero nuevo antes del reintento: si este
      // también falla, el resumen ya muestra con quién se intentó.
      onCambiarBarbero(otro);
      return pedir(otro.id);
    }
  };

  /**
   * confirmar
   * Manda la reserva y, si sale bien, avanza al éxito. Si falla, deja el error
   * para mostrarlo arriba del botón.
   * @param {Object} datos - { nombre, telefono (E.164), email } ya limpios
   */
  const confirmar = async (datos) => {
    enviandoRef.current = true;
    setEnviando(true);
    setError(null);
    try {
      const resultado = await reservar(datos);
      onExito(resultado);
    } catch (err) {
      console.error('[ConfirmarTurno] Error confirmando el turno:', err.message);
      setError(err.status === 409
        ? { tipo: 'ocupado' }
        : { tipo: 'envio', texto: mensajeDeError(err) });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  /**
   * handleFormSubmit
   * Submit nativo del <form> (botón del pie o tecla "Ir"/Enter del teclado).
   * Evita la recarga de la página. Si falta algo, marca todos los errores y
   * enfoca el primer campo con error; si no, confirma.
   * @param {Event} e - Evento submit del form
   */
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (enviandoRef.current) return;

    const primerConError = CAMPOS.find((campo) => errores[campo]);
    if (primerConError) {
      setTouched({ nombre: true, telefono: true, email: true });
      enfocarCampo(refsPorCampo[primerConError].current);
      return;
    }

    confirmar({
      nombre: nombre.trim(),
      telefono: telefonoAE164(telefono, pais) || telefono.trim(),
      email: email.trim(),
    });
  };

  const ocupado = error?.tipo === 'ocupado';

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <Progress paso={3}/>
      <ScreenHeader
        title="Confirmá tu turno"
        subtitle="Revisá el detalle y completá tus datos."
      />

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <ResumenTurno
          servicio={reserva.servicio}
          barbero={reserva.barbero}
          barberoAsignado={reserva.barberoAsignado}
          direccion={tenant.direccion}
          horario={reserva.horario}
          conPrecio
        />

        {/* noValidate: la validación es la nuestra (errores), no la nativa del navegador */}
        <form id={FORM_ID} onSubmit={handleFormSubmit} noValidate style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <Field
            ref={nombreRef}
            label="Nombre y apellido"
            name="name"
            autoComplete="name"
            value={nombre}
            onChange={(valor) => onCambiarCliente({ nombre: capitalizarNombre(valor) })}
            onBlur={() => setTouched(t => ({ ...t, nombre: true }))}
            placeholder="Diego Pereyra"
            error={errorVisible('nombre')}
          />

          <CampoTelefono
            ref={telefonoRef}
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
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(valor) => onCambiarCliente({ email: valor })}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            placeholder="vos@correo.com"
            helper="Te mandamos la confirmación y el link para cambiar el turno."
            error={errorVisible('email')}
          />
        </form>
      </div>

      <StickyFooter>
        {error && (
          <AvisoError texto={ocupado ? 'Ese horario se acaba de ocupar. Elegí otro.' : error.texto}/>
        )}
        {ocupado ? (
          <Button onClick={onVolver}>Elegir otro horario</Button>
        ) : (
          <Button type="submit" form={FORM_ID} disabled={enviando}>
            {enviando ? 'Confirmando…' : 'Confirmar turno'}
          </Button>
        )}
      </StickyFooter>
    </PageContainer>
  );
}

// ─── Subcomponentes locales ──────────────────────────────────

/**
 * AvisoError
 * Aviso rojo discreto arriba del botón, para el error del envío. Va en el pie
 * fijo para que se vea aunque el formulario esté scrolleado. `role="alert"`:
 * el lector de pantalla lo anuncia al aparecer.
 * @param {string} props.texto
 */
function AvisoError({ texto }) {
  return (
    <div role="alert" style={{
      background: theme.dangerSoft,
      border: `1px solid ${theme.danger}33`,
      borderRadius: theme.radius,
      padding: '8px 12px',
      marginBottom: 12,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      color: theme.danger,
      lineHeight: 1.4,
    }}>{texto}</div>
  );
}

// CampoTelefono vive acá (y no extiende el primitivo universal `Field`) porque
// compone [select de país | input] dentro de un solo borde. Si otro front lo
// necesita, recién ahí se promueve a /components/ui/.

/**
 * CampoTelefono
 * Campo de teléfono con selector de país + input que formatea a medida que se
 * escribe. Replica el look y la accesibilidad de `Field` (label asociada,
 * `aria-invalid` y `aria-describedby` al error) sobre un contenedor que agrupa
 * los dos controles como un único campo.
 * @param {string} props.label - Label superior (eyebrow uppercase), asociada al input
 * @param {string} props.pais - ISO del país seleccionado (ej. 'AR')
 * @param {Function} props.onPaisChange - Recibe el nuevo ISO
 * @param {string} props.value - Número nacional ya formateado (lo que se ve)
 * @param {Function} props.onChange - Recibe el valor crudo del input
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.error] - Texto de error; pinta el borde de rojo
 * @param {Object} [props.ref] - Ref al <input> del número (React 19 lo pasa como prop)
 */
function CampoTelefono({
  label, pais, onPaisChange, value, onChange, onBlur, placeholder, error, ref,
}) {
  const [focus, setFocus] = useState(false);
  const inputId = useId();
  const errorId = useId();

  // Color de border según prioridad: error > focus > default.
  const borderColor = error ? theme.danger : (focus ? theme.accent : theme.hairline);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Label superior en estilo "eyebrow", asociada al input */}
      <label htmlFor={inputId} style={estiloEyebrow}>{label}</label>

      {/* Contenedor bordeado que agrupa país + número como un solo campo. El
          outline repite el *:focus-visible global: con error el borde no cambia
          y el select y el input lo anulan, así que el foco se marca acá. */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
        outline: focus ? `2px solid ${theme.accent}` : 'none',
        outlineOffset: 2,
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
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          name="tel"
          autoComplete="tel"
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
            // Al enfocarlo, que también se vea el error de abajo (como en Field).
            scrollMarginBottom: MARGEN_SCROLL_CAMPO,
          }}
        />
      </div>

      {/* Error (texto, no solo color de borde) */}
      {error && (
        <span id={errorId} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.4,
          color: theme.danger,
        }}>{error}</span>
      )}
    </div>
  );
}

export default ConfirmarTurno;
