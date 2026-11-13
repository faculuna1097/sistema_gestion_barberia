// /frontend/src/screens/admin/sections/gestion/BloqueContacto.jsx
// Bloque "Contacto" de Gestión → Negocio (F6 de plan_mejoras_operativas.md): el
// mail y el celular del dueño y el teléfono del local.
//   - Al mail del dueño llega la recuperación de la contraseña del iPad y del PIN
//     de administrador ("¿Olvidaste…?" en los logins).
//   - El teléfono del local es el que muestra el turnero.
// Se renderiza dentro de TabNegocio. "Editar" abre un modal con los tres datos y
// el PIN de administrador (re-autenticación: quien cambia el mail decide a dónde
// llega la recuperación).
//
// Validación: utils/contactoNegocio.js (espejo del backend). Un 400 con `campo` o
// un 403 del PIN van al campo que corresponde.

import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';

import { getNegocioAdmin, guardarContactoNegocio } from '../../../../services/api';
import {
  Button,
  Field,
  FilaAjuste,
  LoadingState,
  Modal,
  PillSinConfigurar,
  Toast,
} from '../../../../components/ui';
import { ErrorServidor, mensajeDeError } from '../../../../utils/errores';
import { toast } from '../../../../utils/toast';
import { soloDigitosPin } from '../../../../utils/credenciales';
import {
  MAX_EMAIL,
  MAX_TELEFONO_LOCAL,
  formatearCelular,
  validarContactoNegocio,
} from '../../../../utils/contactoNegocio';
import { theme } from '../../../../theme/tokens.js';

const CONTENT_STYLE = { display: 'flex', flexDirection: 'column', gap: 4 };

// Los campos del contacto, en el orden del formulario.
const CAMPOS = ['email_duenio', 'telefono_duenio', 'telefono_local'];

/**
 * EncabezadoContacto (interna)
 * Título, explicación y (opcional) el botón "Editar", con la tipografía de los
 * otros bloques de Negocio.
 * @param {Object} props
 * @param {React.ReactNode} [props.accion]
 * @returns {JSX.Element}
 */
function EncabezadoContacto({ accion = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' }}>
        <span style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeBody,
          color: theme.ink,
        }}>
          Contacto
        </span>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, lineHeight: 1.5 }}>
          Al mail del dueño llega el link para recuperar la contraseña del iPad o el PIN
          de administrador si se olvidan.
        </span>
      </div>
      {accion}
    </div>
  );
}

/**
 * valorOVacio (interna)
 * El dato, o la pill de "sin cargar" si está vacío.
 * @param {string|null} valor
 * @returns {React.ReactNode}
 */
const valorOVacio = (valor) => valor || <PillSinConfigurar texto="Sin cargar" />;

/**
 * BloqueContacto
 * Muestra el contacto del negocio y lo edita en un modal.
 * @returns {JSX.Element}
 */
export default function BloqueContacto() {
  const [contacto, setContacto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [editando, setEditando] = useState(false);

  /**
   * cargar — trae el contacto (GET /admin/negocio). Sirve para la carga y el reintento.
   */
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const negocio = await getNegocioAdmin();
      setContacto({
        email_duenio: negocio.email_duenio,
        telefono_duenio: negocio.telefono_duenio,
        telefono_local: negocio.telefono_local,
      });
    } catch (err) {
      console.error('[bloqueContacto] Error en cargar:', err.message);
      setErrorCarga(mensajeDeError(err, 'No se pudo cargar el contacto del negocio.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return (
      <div style={{ ...CONTENT_STYLE, gap: 16 }}>
        <EncabezadoContacto />
        <LoadingState />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div style={{ ...CONTENT_STYLE, gap: 16 }}>
        <EncabezadoContacto />
        <Toast tone="danger">{errorCarga}</Toast>
        <div>
          <Button variant="secondary" onClick={cargar} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={CONTENT_STYLE}>
      <EncabezadoContacto
        accion={
          <Button variant="secondary" full={false} onClick={() => setEditando(true)}>
            <Pencil size={16} strokeWidth={1.75} /> Editar
          </Button>
        }
      />
      <div style={{ marginTop: 8 }}>
        <FilaAjuste
          primera
          label="Mail del dueño"
          descripcion="Recibe la recuperación de las credenciales."
          valor={valorOVacio(contacto.email_duenio)}
        />
        <FilaAjuste
          label="Celular del dueño"
          descripcion="No lo ven tus clientes."
          valor={valorOVacio(formatearCelular(contacto.telefono_duenio))}
        />
        <FilaAjuste
          label="Teléfono del local"
          descripcion="El que ven tus clientes en el turnero."
          valor={contacto.telefono_local || <span style={{ color: theme.muted }}>No se muestra</span>}
        />
      </div>

      <ModalContacto
        open={editando}
        contacto={contacto}
        onClose={() => setEditando(false)}
        onGuardado={(guardado) => {
          setContacto(guardado);
          setEditando(false);
          toast.exito('Contacto actualizado.');
        }}
      />
    </div>
  );
}

/**
 * ModalContacto
 * Formulario de los tres datos + el PIN de administrador. Valida en el front con
 * las reglas del backend y marca todos los campos con error a la vez.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {{ email_duenio: string|null, telefono_duenio: string|null, telefono_local: string|null }} props.contacto
 *   Lo guardado, para precargar.
 * @param {Function} props.onClose
 * @param {Function} props.onGuardado - Recibe lo que quedó guardado (respuesta del backend).
 * @returns {JSX.Element}
 */
function ModalContacto({ open, contacto, onClose, onGuardado }) {
  const [form, setForm] = useState({ email_duenio: '', telefono_duenio: '', telefono_local: '' });
  const [pinAdmin, setPinAdmin] = useState('');
  // errores: por campo (incluye 'pin_admin'). Se muestran después del primer
  // "Guardar" (antes, el dueño todavía está escribiendo).
  const [errores, setErrores] = useState({});
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Falla que no es de un campo (sin red, servidor caído).
  const [errorGeneral, setErrorGeneral] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({
        email_duenio: contacto?.email_duenio ?? '',
        telefono_duenio: formatearCelular(contacto?.telefono_duenio) ?? '',
        telefono_local: contacto?.telefono_local ?? '',
      });
      setPinAdmin('');
      setErrores({});
      setIntentoGuardar(false);
      setGuardando(false);
      setErrorGeneral(null);
    }
  }, [open, contacto]);

  /**
   * cambiar — actualiza un campo y, si ya se intentó guardar, re-valida en vivo
   * (el error se va apenas el dato queda bien).
   * @param {string} campo
   * @param {string} valor
   */
  const cambiar = (campo, valor) => {
    const nuevo = { ...form, [campo]: valor };
    setForm(nuevo);
    setErrorGeneral(null);
    if (intentoGuardar) {
      const { errores: delFront } = validarContactoNegocio(nuevo);
      setErrores((prev) => ({ ...delFront, ...(prev.pin_admin ? { pin_admin: prev.pin_admin } : {}) }));
    }
  };

  const guardar = async () => {
    setIntentoGuardar(true);
    const { errores: delFront, valores } = validarContactoNegocio(form);
    const conPin = pinAdmin.length === 4 ? delFront : { ...delFront, pin_admin: 'Ingresá tu PIN de administrador.' };
    setErrores(conPin);
    if (Object.keys(conPin).length > 0) return;

    setGuardando(true);
    setErrorGeneral(null);
    try {
      const guardado = await guardarContactoNegocio({ ...valores, pin_admin: pinAdmin });
      onGuardado(guardado);
    } catch (err) {
      const campo = err instanceof ErrorServidor ? err.campo : null;
      if (campo && (CAMPOS.includes(campo) || campo === 'pin_admin')) {
        setErrores({ [campo]: err.message });
        if (campo === 'pin_admin') setPinAdmin('');
      } else {
        console.error('[modalContacto] Error en guardar:', err.message);
        setErrorGeneral(mensajeDeError(err, 'No se pudo guardar el contacto. Intentá de nuevo.'));
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      loading={guardando}
      title="Editar contacto"
      subtitle="Confirmá el cambio con tu PIN de administrador."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Mail del dueño"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_EMAIL}
          value={form.email_duenio}
          onChange={(v) => cambiar('email_duenio', v)}
          placeholder="nombre@gmail.com"
          error={errores.email_duenio}
          helper="A este mail llega el link si se olvida la contraseña del iPad o el PIN."
        />
        <Field
          label="Celular del dueño"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.telefono_duenio}
          onChange={(v) => cambiar('telefono_duenio', v)}
          placeholder="11 3311-1686"
          error={errores.telefono_duenio}
          helper="Código de área y número, sin 0 ni 15. Si es de otro país, empezá con +."
        />
        <Field
          label="Teléfono del local (opcional)"
          type="tel"
          inputMode="tel"
          maxLength={MAX_TELEFONO_LOCAL}
          value={form.telefono_local}
          onChange={(v) => cambiar('telefono_local', v)}
          placeholder="Ej. 11 4567-8901"
          error={errores.telefono_local}
          helper="Lo ven tus clientes en el turnero. Vacío, no se muestra."
        />
        <Field
          label="PIN de administrador"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pinAdmin}
          onChange={(v) => {
            setPinAdmin(soloDigitosPin(v));
            setErrores((prev) => ({ ...prev, pin_admin: undefined }));
            setErrorGeneral(null);
          }}
          placeholder="Confirmá con tu PIN"
          error={errores.pin_admin}
        />

        {errorGeneral && (
          <Toast tone="danger" onDismiss={() => setErrorGeneral(null)} dismissible>
            {errorGeneral}
          </Toast>
        )}
      </div>
    </Modal>
  );
}
