// /frontend/src/screens/admin/sections/gestion/TabServicios.jsx
// ABM de servicios. Listar / crear / editar. No hay eliminación física —
// se desactiva via `activo: false`.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// Tabla densa con primitivo DataTable (sort por columna + paginación a partir
// de 7 filas). Click en fila abre modal de edición; sin columna de acciones.
// Loading via LoadingState (D6).

import { useState, useEffect } from 'react';
import { Plus, ClipboardList, AlertTriangle, RefreshCw } from 'lucide-react';

import { apiFetch } from '../../../../services/api';
import { fmtPesos } from '../../../../utils/formato';
import {
  Button,
  Field,
  Modal,
  DataTable,
  EmptyState,
  LoadingState,
  IconoAlerta,
  BadgeEstado,
  ToggleEstado,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// ─── Modal crear / editar ─────────────────────────────────────────────────────

/**
 * ModalServicio
 * Formulario en modal para crear o editar un servicio.
 *
 * @param {object} props
 * @param {object|null} props.servicio - null = modo crear; objeto = modo editar
 * @param {(servicio: object, esEdicion: boolean) => void} props.onGuardar
 * @param {() => void} props.onCerrar
 */
function ModalServicio({ servicio, onGuardar, onCerrar }) {
  const esEdicion = servicio !== null;

  const [nombre, setNombre]       = useState(servicio?.nombre ?? '');
  const [precio, setPrecio]       = useState(servicio?.precio ?? '');
  const [activo, setActivo]       = useState(servicio?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  const puedeGuardar = nombre.trim() !== '' && precio !== '' && Number(precio) >= 0;

  /**
   * handleGuardar
   * POST (crear) o PUT (editar) al backend. Cierra el modal en éxito.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);

    const body   = { nombre: nombre.trim(), precio: Number(precio), activo };
    const method = esEdicion ? 'PUT' : 'POST';
    const path   = esEdicion ? `/admin/servicios/${servicio.id}` : '/admin/servicios';

    try {
      const res = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }
      const servicioGuardado = await res.json();
      onGuardar(servicioGuardado, esEdicion);
    } catch (err) {
      console.error('[tabServicios] Error en handleGuardar:', err.message);
      setError(err.message || 'No se pudo guardar el servicio. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      loading={guardando}
      title={esEdicion ? 'Editar servicio' : 'Nuevo servicio'}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleGuardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Nombre"
          value={nombre}
          onChange={setNombre}
          placeholder="Ej: Corte clásico"
        />
        <Field
          label="Precio"
          type="text"
          inputMode="numeric"
          value={precio}
          onChange={(v) => setPrecio(v.replace(/\D/g, ''))}
          placeholder="Ej: 5000"
        />
        {esEdicion && <ToggleEstado value={activo} onChange={setActivo} />}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}33`,
            borderRadius: theme.radius,
            color: theme.danger,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
          }}>
            <AlertTriangle size={16} strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * TabServicios
 * Tab de gestión de servicios. Lista + crear + editar (sin eliminar físico).
 *
 * @returns {JSX.Element}
 */
export default function TabServicios() {
  const [servicios, setServicios]               = useState([]);
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [intento, setIntento]                   = useState(0);
  const [modalAbierto, setModalAbierto]         = useState(false);
  const [servicioEditando, setServicioEditando] = useState(null);

  // ── Carga inicial / reintentos ────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch('/admin/servicios');
        const data = await res.json();
        if (!cancelado) setServicios(data);
      } catch (err) {
        console.error('[tabServicios] Error en carga:', err.message);
        if (!cancelado) setError('No se pudieron cargar los servicios.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Control del modal ─────────────────────────────────────────────────────
  const abrirCrear  = ()         => { setServicioEditando(null);     setModalAbierto(true); };
  const abrirEditar = (servicio) => { setServicioEditando(servicio); setModalAbierto(true); };
  const cerrarModal = ()         => { setModalAbierto(false); setServicioEditando(null); };

  /**
   * handleGuardado
   * Actualiza la lista local sin refetch al backend tras crear / editar.
   * @param {object}  servicioGuardado - objeto devuelto por el backend
   * @param {boolean} esEdicion
   */
  const handleGuardado = (servicioGuardado, esEdicion) => {
    if (esEdicion) {
      setServicios((prev) => prev.map((s) => s.id === servicioGuardado.id ? servicioGuardado : s));
    } else {
      setServicios((prev) => [...prev, servicioGuardado]);
    }
    cerrarModal();
  };

  // ── Estados de carga / error ──────────────────────────────────────────────
  if (cargando) return <LoadingState />;
  if (error) {
    return (
      <EmptyState
        tone="danger"
        glyph={<IconoAlerta />}
        title="No se pudieron cargar los servicios"
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
      key: 'precio',
      label: 'Precio',
      sortable: true,
      align: 'right',
      render: (row) => fmtPesos(row.precio),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      align: 'right',
      // Activos primero al ordenar asc.
      sortAccessor: (row) => row.activo ? 0 : 1,
      render: (row) => <BadgeEstado activo={row.activo} />,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Fila de acción superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
        }}>
          {servicios.length} servicio{servicios.length !== 1 ? 's' : ''} registrado{servicios.length !== 1 ? 's' : ''}
        </span>
        <Button variant="primary" onClick={abrirCrear} full={false}>
          <Plus size={16} strokeWidth={2} /> Nuevo servicio
        </Button>
      </div>

      {/* Tabla o empty */}
      {servicios.length === 0 ? (
        <EmptyState
          glyph={<ClipboardList size={28} strokeWidth={1.5} />}
          title="Sin servicios registrados"
          body="Creá tu primer servicio desde el botón de arriba."
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
            rows={servicios}
            rowKey={(row) => row.id}
            onRowClick={abrirEditar}
            pageSize={6}
          />
        </div>
      )}

      {/* Modal crear / editar */}
      {modalAbierto && (
        <ModalServicio
          servicio={servicioEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  );
}
