// /frontend/src/screens/admin/sections/gestion/TabSocios.jsx
// ABM de socios (los dueños del negocio). Listar / crear / editar / activar y
// desactivar. No hay eliminación: un socio tiene aportes y retiros asociados.
//
// Ser socio sirve para dos cosas de Caja: elegir al dueño al cargar un aporte o
// un retiro, y el filtro "Solo Barberos", que saca los cortes del barbero
// vinculado. La comisión de ese barbero va aparte (Gestión → Barberos).
//
// Mismo patrón que TabServicios: DataTable con click en fila → modal de edición,
// con el estado en un ToggleEstado. Desactivar pide confirmación dentro del mismo
// modal (sin ConfirmDialog anidado, como las ausencias de TabBarberos), porque
// además saca el vínculo con el barbero.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.

import { useState, useEffect } from 'react';
import { Plus, Handshake, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../../services/api';
import { errorDeRespuesta, mensajeDeError } from '../../../../utils/errores';
import {
  Button,
  Field,
  Modal,
  Select,
  DataTable,
  EmptyState,
  LoadingState,
  IconoAlerta,
  BadgeEstado,
  ToggleEstado,
  Toast,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// Valor del selector para "sin barbero" (un <select> no admite null).
const SIN_BARBERO = '';

// Tope del nombre: espejo de MAX_NOMBRE del backend (utils/validarTexto.js).
const MAX_NOMBRE_SOCIO = 80;

const estiloTextoAyuda = {
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  color: theme.muted,
  lineHeight: 1.5,
  margin: 0,
};

/**
 * opcionesBarbero
 * Arma las opciones del selector de barbero de un socio: "Sin barbero", los
 * barberos activos que no están vinculados a otro socio y, aunque esté inactivo,
 * el barbero que el socio ya tiene (para no perder el vínculo al editarlo).
 * @param {Array<{id: string, nombre: string, activo: boolean}>} barberos - Todos los del local
 * @param {Array<{id: string, barbero_id: string|null}>} socios - Todos los socios del local
 * @param {object|null} socio - El socio que se edita (null en el alta)
 * @returns {Array<{value: string, label: string}>} Opciones para <Select>
 */
function opcionesBarbero(barberos, socios, socio) {
  const deOtroSocio = new Set(
    socios.filter((s) => s.barbero_id && s.id !== socio?.id).map((s) => s.barbero_id)
  );
  const elegibles = barberos.filter(
    (b) => b.id === socio?.barbero_id || (b.activo && !deOtroSocio.has(b.id))
  );
  return [
    { value: SIN_BARBERO, label: 'Sin barbero' },
    ...elegibles.map((b) => ({ value: b.id, label: b.activo ? b.nombre : `${b.nombre} (inactivo)` })),
  ];
}

// ─── Modal crear / editar ─────────────────────────────────────────────────────

/**
 * ModalSocio
 * Formulario en modal para crear o editar un socio: nombre, barbero vinculado y,
 * al editar, el estado. Al desactivar pasa a un paso de confirmación que avisa
 * que se saca el vínculo con el barbero. En el alta, si el nombre es de un socio
 * inactivo, ofrece reactivarlo.
 *
 * @param {object} props
 * @param {object|null} props.socio - null = modo crear; objeto = modo editar
 * @param {Array} props.socios - Todos los socios del local (para el selector)
 * @param {Array} props.barberos - Todos los barberos del local
 * @param {(socio: object) => void} props.onGuardar - Recibe el socio que devolvió el servidor
 * @param {() => void} props.onCerrar
 */
function ModalSocio({ socio, socios, barberos, onGuardar, onCerrar }) {
  const esEdicion = socio !== null;

  const [nombre, setNombre]         = useState(socio?.nombre ?? '');
  const [barberoId, setBarberoId]   = useState(socio?.barbero_id ?? SIN_BARBERO);
  const [activo, setActivo]         = useState(socio?.activo ?? true);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState(null);       // error general (Toast)
  const [errorNombre, setErrorNombre] = useState(null);     // error del campo nombre
  const [inactivoRepetido, setInactivoRepetido] = useState(null); // id del socio a reactivar

  const puedeGuardar = nombre.trim() !== '';
  // Desactivar a uno que estaba activo pide confirmación antes de guardar.
  const desactiva = esEdicion && socio.activo && !activo;
  // Un socio que queda inactivo no tiene barbero: el selector queda en "Sin barbero".
  const barberoElegido = activo ? barberoId : SIN_BARBERO;
  const barberoActual = barberos.find((b) => b.id === socio?.barbero_id);

  /**
   * cambiarNombre — actualiza el nombre y limpia los errores que dependían de él.
   * @param {string} valor
   */
  const cambiarNombre = (valor) => {
    setNombre(valor);
    setErrorNombre(null);
    setInactivoRepetido(null);
  };

  /**
   * mostrarError — reparte el error del servidor: el nombre repetido va al campo
   * (y, si el repetido está inactivo y es un alta, ofrece reactivarlo); el resto,
   * al aviso general.
   * @param {unknown} err
   */
  const mostrarError = (err) => {
    if (err?.codigo === 'socio_nombre_repetido' || err?.campo === 'nombre') {
      setErrorNombre(mensajeDeError(err, 'Revisá el nombre.'));
      const repetido = err.datos;
      if (!esEdicion && repetido?.socio_id && repetido.activo === false) {
        setInactivoRepetido(repetido.socio_id);
      }
      setConfirmandoBaja(false);
      return;
    }
    setError(mensajeDeError(err, 'No se pudo guardar el socio. Intentá de nuevo.'));
  };

  /**
   * enviar — POST (alta) o PATCH (edición o reactivación) al backend. Con éxito
   * le pasa el socio guardado a onGuardar, que cierra el modal.
   * @param {string} path
   * @param {'POST'|'PATCH'} method
   * @param {object} body
   */
  const enviar = async (path, method, body) => {
    setGuardando(true);
    setError(null);
    try {
      const res = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!res.ok) throw await errorDeRespuesta(res);
      onGuardar(await res.json());
    } catch (err) {
      console.error('[tabSocios] Error en enviar:', err.message);
      mostrarError(err);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * handleGuardar — guarda el alta o la edición; si desactiva, primero pide
   * confirmación.
   */
  const handleGuardar = () => {
    if (!puedeGuardar) return;
    if (desactiva && !confirmandoBaja) {
      setConfirmandoBaja(true);
      return;
    }
    const body = { nombre: nombre.trim(), barbero_id: barberoElegido || null };
    if (esEdicion) {
      enviar(`/admin/socios/${socio.id}`, 'PATCH', { ...body, activo });
    } else {
      enviar('/admin/socios', 'POST', body);
    }
  };

  /**
   * reactivar — en el alta, vuelve a activar al socio inactivo que ya tenía ese
   * nombre, con el barbero elegido en el formulario.
   */
  const reactivar = () => {
    enviar(`/admin/socios/${inactivoRepetido}`, 'PATCH', {
      activo: true,
      barbero_id: barberoElegido || null,
    });
  };

  const titulo = confirmandoBaja ? 'Desactivar socio' : (esEdicion ? 'Editar socio' : 'Nuevo socio');

  return (
    <Modal
      open
      onClose={onCerrar}
      loading={guardando}
      title={titulo}
      footer={confirmandoBaja ? (
        <>
          <Button variant="ghost" onClick={() => setConfirmandoBaja(false)} disabled={guardando}>
            Volver
          </Button>
          <Button variant="danger" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Procesando…' : 'Sí, desactivar'}
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleGuardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      )}
    >
      {confirmandoBaja ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ ...estiloTextoAyuda, color: theme.inkSoft }}>
            {nombre.trim()} deja de aparecer al cargar un aporte o un retiro en Caja.
            {barberoActual && (
              <>
                {' '}Se saca el vínculo con {barberoActual.nombre}: sus cortes vuelven a
                aparecer con el filtro «Solo Barberos», también los de días anteriores.
              </>
            )}
            {' '}Los movimientos que ya tiene no cambian.
          </p>
          {error && <Toast tone="danger">{error}</Toast>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Nombre"
            value={nombre}
            onChange={cambiarNombre}
            placeholder="Ej: Juan Pérez"
            maxLength={MAX_NOMBRE_SOCIO}
            invalid={Boolean(errorNombre)}
            error={errorNombre ?? undefined}
          />
          {inactivoRepetido && (
            <Toast tone="warning">
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                Podés volver a activarlo en vez de crear otro.
                <Button variant="secondary" onClick={reactivar} disabled={guardando} full={false}>
                  {guardando ? 'Procesando…' : 'Reactivarlo'}
                </Button>
              </span>
            </Toast>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Select
              label="Barbero"
              value={barberoElegido}
              onChange={setBarberoId}
              options={opcionesBarbero(barberos, socios, socio)}
              disabled={!activo}
            />
            <p style={estiloTextoAyuda}>
              {activo
                ? 'Si el socio también corta, elegí su barbero. La comisión se configura aparte, en Barberos.'
                : 'Un socio inactivo no tiene barbero. Activalo para elegir uno.'}
            </p>
          </div>
          {esEdicion && <ToggleEstado value={activo} onChange={setActivo} />}
          {error && <Toast tone="danger">{error}</Toast>}
        </div>
      )}
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * TabSocios
 * Tab de gestión de socios. Lista + crear + editar + activar/desactivar (sin
 * eliminar). Carga los socios (con los inactivos) y los barberos del local.
 *
 * @returns {JSX.Element}
 */
export default function TabSocios() {
  const [socios, setSocios]             = useState([]);
  const [barberos, setBarberos]         = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [intento, setIntento]           = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [socioEditando, setSocioEditando] = useState(null);

  // ── Carga inicial / reintentos ────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const [resSocios, resBarberos] = await Promise.all([
          apiFetch('/admin/socios?incluir_inactivos=true'),
          apiFetch('/admin/barberos'),
        ]);
        if (!resSocios.ok) throw new Error(`HTTP ${resSocios.status}`);
        if (!resBarberos.ok) throw new Error(`HTTP ${resBarberos.status}`);
        const [dataSocios, dataBarberos] = await Promise.all([resSocios.json(), resBarberos.json()]);
        if (!cancelado) {
          setSocios(dataSocios);
          setBarberos(dataBarberos);
        }
      } catch (err) {
        console.error('[tabSocios] Error en carga:', err.message);
        if (!cancelado) setError('No se pudieron cargar los socios.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Control del modal ─────────────────────────────────────────────────────
  const abrirCrear  = ()      => { setSocioEditando(null);  setModalAbierto(true); };
  const abrirEditar = (socio) => { setSocioEditando(socio); setModalAbierto(true); };
  const cerrarModal = ()      => { setModalAbierto(false);  setSocioEditando(null); };

  /**
   * handleGuardado
   * Pone en la lista local el socio que devolvió el servidor (nuevo, editado o
   * reactivado), sin refetch, y cierra el modal.
   * @param {object} socioGuardado - { id, nombre, activo, barbero_id, barbero_nombre }
   */
  const handleGuardado = (socioGuardado) => {
    setSocios((prev) => (
      prev.some((s) => s.id === socioGuardado.id)
        ? prev.map((s) => (s.id === socioGuardado.id ? socioGuardado : s))
        : [...prev, socioGuardado]
    ));
    cerrarModal();
  };

  // ── Estados de carga / error ──────────────────────────────────────────────
  if (cargando) return <LoadingState />;
  if (error) {
    return (
      <EmptyState
        tone="danger"
        glyph={<IconoAlerta />}
        title="No se pudieron cargar los socios"
        body={error}
        action={
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        }
      />
    );
  }

  // ── Columnas del DataTable ────────────────────────────────────────────────
  const columnas = [
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      grow: true,
      sortAccessor: (row) => String(row.nombre ?? '').toLowerCase(),
    },
    {
      key: 'barbero',
      label: 'Barbero',
      sortable: true,
      sortAccessor: (row) => String(row.barbero_nombre ?? '').toLowerCase(),
      render: (row) => (row.barbero_nombre
        ? row.barbero_nombre
        : <span style={{ color: theme.muted }}>No corta</span>),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      align: 'right',
      // Activos primero al ordenar asc.
      sortAccessor: (row) => (row.activo ? 0 : 1),
      render: (row) => <BadgeEstado activo={row.activo} />,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Fila de acción superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          {socios.length} socio{socios.length !== 1 ? 's' : ''} registrado{socios.length !== 1 ? 's' : ''}
        </span>
        <Button variant="primary" onClick={abrirCrear} full={false}>
          <Plus size={16} strokeWidth={2} /> Nuevo socio
        </Button>
      </div>

      {/* Para qué sirve ser socio. */}
      <p style={estiloTextoAyuda}>
        Los socios son los dueños del negocio. Se eligen al cargar un aporte o un retiro
        en Caja. Si un socio también corta, vinculalo con su barbero: el filtro «Solo
        Barberos» de Caja saca sus cortes.
      </p>

      {/* Tabla o empty */}
      {socios.length === 0 ? (
        <EmptyState
          glyph={<Handshake size={28} strokeWidth={1.5} />}
          title="Sin socios registrados"
          body="Creá el primero desde el botón de arriba."
        />
      ) : (
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          overflow: 'hidden',
        }}>
          <DataTable
            columns={columnas}
            rows={socios}
            rowKey={(row) => row.id}
            onRowClick={abrirEditar}
            pageSize={6}
          />
        </div>
      )}

      {/* Modal crear / editar */}
      {modalAbierto && (
        <ModalSocio
          socio={socioEditando}
          socios={socios}
          barberos={barberos}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  );
}
