// /frontend/src/screens/admin/sections/gestion/TabProductos.jsx
// ABM de productos. Listar / crear / editar. No hay eliminación física —
// se desactiva via `activo: false`. El stock se actualiza con "Unidades a
// agregar" (suma al stock_actual existente) — el campo stock_actual nunca
// se edita directamente.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Tabla densa con
// DataTable (sort + paginación a partir de 7 filas). Click en fila abre
// modal de edición. Alerta de stock bajo se muestra en la celda "Stock
// actual" (color danger + AlertTriangle) — la fila no se tinta. Loading
// via LoadingState (D6).

import { useState, useEffect } from 'react';
import { Plus, Package, AlertTriangle, RefreshCw } from 'lucide-react';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * tieneStockBajo
 * Indica si un producto está por debajo de su umbral de alerta. Si
 * `stock_minimo` es 0 (sin umbral definido), nunca alerta.
 * @param {{stock_actual: number, stock_minimo: number}} producto
 * @returns {boolean}
 */
function tieneStockBajo(producto) {
  return producto.stock_minimo > 0 && producto.stock_actual <= producto.stock_minimo;
}

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * CeldaStockActual
 * Renderiza el stock actual de un producto. Si está bajo el umbral, muestra
 * el número en danger + ícono AlertTriangle como señal accionable.
 * Local — específico de la columna "Stock actual" de esta tabla.
 *
 * @param {object} props
 * @param {{stock_actual: number, stock_minimo: number}} props.producto
 */
function CeldaStockActual({ producto }) {
  const bajo = tieneStockBajo(producto);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: bajo ? theme.danger : theme.ink,
      fontWeight: bajo ? theme.weightHeading : theme.weightRegular,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {bajo && <AlertTriangle size={14} strokeWidth={2} aria-label="Stock bajo" />}
      {producto.stock_actual} uds.
    </span>
  );
}

// ─── Modal crear / editar ─────────────────────────────────────────────────────

/**
 * ModalProducto
 * Formulario en modal para crear o editar un producto. El stock (inicial en
 * creación, "unidades a agregar" en edición) viaja en el mismo request como
 * `agregar_stock`, así datos y stock se persisten atómicamente en una sola
 * sentencia del backend (deuda #34 resuelta — antes eran dos requests).
 *
 * @param {object} props
 * @param {object|null} props.producto - null = modo crear; objeto = modo editar
 * @param {(producto: object, esEdicion: boolean) => void} props.onGuardar
 * @param {() => void} props.onCerrar
 */
function ModalProducto({ producto, onGuardar, onCerrar }) {
  const esEdicion = producto !== null;

  const [nombre, setNombre]                   = useState(producto?.nombre        ?? '');
  const [precio, setPrecio]                   = useState(producto?.precio        ?? '');
  const [stockMinimo, setStockMinimo]         = useState(producto?.stock_minimo  ?? 0);
  const [activo, setActivo]                   = useState(producto?.activo        ?? true);
  const [cantidadStock, setCantidadStock] = useState('');
  const [guardando, setGuardando]             = useState(false);
  const [error, setError]                     = useState(null);

  const puedeGuardar = nombre.trim() !== '' && precio !== '' && Number(precio) >= 0;

  /**
   * handleGuardar
   * POST (crear) o PUT (editar) en un único request. El stock (inicial en
   * creación, "unidades a agregar" en edición) viaja como `agregar_stock`:
   * el backend lo suma al stock_actual dentro de la misma sentencia, así que
   * datos y stock se guardan atómicamente. El response ya trae stock_actual.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);

    // `agregar_stock`: stock inicial (crear) o unidades a sumar (editar). 0 = sin cambio.
    const delta = cantidadStock && Number(cantidadStock) > 0 ? Number(cantidadStock) : 0;
    const body   = {
      nombre: nombre.trim(),
      precio: Number(precio),
      stock_minimo: Number(stockMinimo ?? 0),
      activo,
      agregar_stock: delta,
    };
    const method = esEdicion ? 'PUT' : 'POST';
    const path   = esEdicion ? `/admin/productos/${producto.id}` : '/admin/productos';

    try {
      const res = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error del servidor');
      }
      const productoGuardado = await res.json();

      onGuardar(productoGuardado, esEdicion);
    } catch (err) {
      console.error('[tabProductos] Error en handleGuardar:', err.message);
      setError(err.message || 'No se pudo guardar el producto. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      loading={guardando}
      title={esEdicion ? 'Editar producto' : 'Nuevo producto'}
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
          placeholder="Ej: Shampoo anticaspa"
        />
        <Field
          label="Precio"
          type="text"
          inputMode="numeric"
          value={precio}
          onChange={(v) => setPrecio(v.replace(/\D/g, ''))}
          placeholder="Ej: 5000"
        />
        {!esEdicion && (
          <Field
            label="Stock inicial"
            type="text"
            inputMode="numeric"
            value={cantidadStock}
            onChange={(v) => setCantidadStock(v.replace(/\D/g, ''))}
            placeholder="0"
            helper="Cantidad con la que ingresa el producto. El stock mínimo se ajusta más adelante."
          />
        )}

        {esEdicion && (
          <>
            <Field
              label="Stock mínimo"
              type="text"
              inputMode="numeric"
              value={stockMinimo}
              onChange={(v) => setStockMinimo(v.replace(/\D/g, ''))}
              placeholder="0"
              helper="Umbral de alerta — el sistema avisará cuando el stock baje de este número."
            />

            {/* Bloque de stock — mini-card neutra: stock actual (read-only)
                + Field para sumar unidades. Visualmente separado del resto
                de los datos del producto sin tinte semántico. */}
            <div style={{
              background: theme.surface,
              border: `1px solid ${theme.hairline}`,
              borderRadius: theme.radius,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: theme.mono,
                  fontWeight: theme.weightMedium,
                  fontSize: theme.sizeMicro,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: theme.muted,
                }}>Stock actual</span>
                <span style={{
                  fontFamily: theme.body,
                  fontSize: theme.sizeHeading,
                  fontWeight: theme.weightHeading,
                  color: theme.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {producto.stock_actual} uds.
                </span>
              </div>

              <Field
                label="Unidades a agregar"
                type="text"
                inputMode="numeric"
                value={cantidadStock}
                onChange={(v) => setCantidadStock(v.replace(/\D/g, ''))}
                placeholder="0"
              />
            </div>

            <ToggleEstado value={activo} onChange={setActivo} />
          </>
        )}

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
 * TabProductos
 * Tab de gestión de productos. Lista + crear + editar (sin eliminar físico).
 *
 * @returns {JSX.Element}
 */
export default function TabProductos() {
  const [productos, setProductos]               = useState([]);
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [intento, setIntento]                   = useState(0);
  const [modalAbierto, setModalAbierto]         = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);

  // ── Carga inicial / reintentos ────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch('/admin/productos');
        const data = await res.json();
        if (!cancelado) setProductos(data);
      } catch (err) {
        console.error('[tabProductos] Error en carga:', err.message);
        if (!cancelado) setError('No se pudieron cargar los productos.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Control del modal ─────────────────────────────────────────────────────
  const abrirCrear  = ()         => { setProductoEditando(null);     setModalAbierto(true); };
  const abrirEditar = (producto) => { setProductoEditando(producto); setModalAbierto(true); };
  const cerrarModal = ()         => { setModalAbierto(false); setProductoEditando(null); };

  /**
   * handleGuardado
   * Actualiza la lista local sin refetch al backend tras crear / editar.
   * @param {object}  productoGuardado
   * @param {boolean} esEdicion
   */
  const handleGuardado = (productoGuardado, esEdicion) => {
    if (esEdicion) {
      setProductos((prev) => prev.map((p) => p.id === productoGuardado.id ? productoGuardado : p));
    } else {
      setProductos((prev) => [...prev, productoGuardado]);
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
        title="No se pudieron cargar los productos"
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
      key: 'stock_actual',
      label: 'Stock actual',
      sortable: true,
      align: 'right',
      render: (row) => <CeldaStockActual producto={row} />,
    },
    {
      key: 'stock_minimo',
      label: 'Stock mínimo',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span style={{ color: theme.muted, fontVariantNumeric: 'tabular-nums' }}>
          {row.stock_minimo} uds.
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      align: 'right',
      sortAccessor: (row) => row.activo ? 0 : 1,
      render: (row) => <BadgeEstado activo={row.activo} />,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
        }}>
          {productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}
        </span>
        <Button variant="primary" onClick={abrirCrear} full={false}>
          <Plus size={16} strokeWidth={2} /> Nuevo producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <EmptyState
          glyph={<Package size={28} strokeWidth={1.5} />}
          title="Sin productos registrados"
          body="Creá tu primer producto desde el botón de arriba."
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
            rows={productos}
            rowKey={(row) => row.id}
            onRowClick={abrirEditar}
            pageSize={6}
          />
        </div>
      )}

      {modalAbierto && (
        <ModalProducto
          producto={productoEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  );
}
