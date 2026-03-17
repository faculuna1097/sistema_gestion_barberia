// frontend/src/screens/admin/sections/gestion/TabProductos.jsx
// ABM de productos. Permite listar, crear y editar productos.
// El stock_actual no se edita directamente — se usa "Agregar stock" para sumar
// unidades (Opción B acordada: stock_actual = stock_actual + cantidad_ingresada).
// No hay eliminación — se usa el campo activo (true/false) para desactivar.

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Modal crear / editar producto ───────────────────────────────────────────
/**
 * ModalProducto — formulario para crear o editar un producto.
 * En modo edición también permite agregar stock y cambiar el estado activo.
 * @param {object|null} producto - null = modo crear, objeto = modo editar
 * @param {function} onGuardar   - callback al guardar exitosamente
 * @param {function} onCerrar    - callback al cancelar o cerrar
 */
function ModalProducto({ producto, onGuardar, onCerrar }) {
  const esEdicion = producto !== null;

  // ── Campos del formulario ────────────────────────────────────────────────
  const [nombre, setNombre]         = useState(producto?.nombre      ?? '');
  const [precio, setPrecio]         = useState(producto?.precio      ?? '');
  const [stockMinimo, setStockMinimo] = useState(producto?.stock_minimo ?? 0);
  const [activo, setActivo]         = useState(producto?.activo      ?? true);

  // ── Estado para agregar stock ────────────────────────────────────────────
  const [cantidadAgregar, setCantidadAgregar] = useState('');

  // ── Estado general ───────────────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);

  const puedeGuardar =
    nombre.trim() !== '' && precio !== '' && Number(precio) >= 0;

  /**
   * handleGuardar — envía POST (crear) o PUT (editar) al backend.
   * Si hay cantidad a agregar (solo en edición), llama también a /agregar-stock
   * en la misma operación. Así cancelar nunca deja cambios a medias en la BD.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);

    const body = {
      nombre: nombre.trim(),
      precio: Number(precio),
      stock_minimo: Number(stockMinimo ?? 0),
      activo,
    };

    try {
      const url = esEdicion
        ? `${API_URL}/api/gestion/productos/${producto.id}`
        : `${API_URL}/api/gestion/productos`;
      const method = esEdicion ? 'PUT' : 'POST';

      console.log(`[TabProductos] ${method} producto —`, body);

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const productoGuardado = await res.json();
      console.log('[TabProductos] Producto guardado:', productoGuardado);

      // Si hay unidades a agregar, llamar a /agregar-stock junto con el guardado
      if (esEdicion && cantidadAgregar && Number(cantidadAgregar) > 0) {
        console.log('[TabProductos] Agregando stock junto al guardado — cantidad:', cantidadAgregar);
        const resStock = await fetch(
          `${API_URL}/api/gestion/productos/${producto.id}/agregar-stock`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cantidad: Number(cantidadAgregar) }),
          }
        );
        if (!resStock.ok) {
          const data = await resStock.json();
          throw new Error(data.error || 'Error al actualizar el stock');
        }
        const dataStock = await resStock.json();
        console.log('[TabProductos] Stock actualizado — nuevo stock:', dataStock.stock_actual);
        productoGuardado.stock_actual = dataStock.stock_actual;
      }

      onGuardar(productoGuardado, esEdicion);
    } catch (err) {
      console.error('[TabProductos] Error al guardar producto:', err);
      setError(err.message || 'No se pudo guardar el producto. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>

        {/* Título */}
        <p style={styles.modalTitulo}>
          {esEdicion ? 'Editar producto' : 'Nuevo producto'}
        </p>

        <div style={styles.camposCol}>

          {/* Nombre */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Shampoo anticaspa"
              style={styles.campoInput}
              autoFocus
            />
          </div>

          {/* Precio */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Precio</label>
            <div style={styles.precioRow}>
              <span style={styles.precioSigno}>$</span>
              <input
                type="number"
                min="0"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="0"
                style={{ ...styles.campoInput, flex: 1 }}
              />
            </div>
          </div>

          {/* Stock mínimo */}
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Stock mínimo</label>
            <p style={styles.campoHint}>
              Umbral de alerta — el sistema avisará cuando el stock baje de este número.
            </p>
            <input
              type="number"
              min="0"
              value={stockMinimo}
              onChange={e => setStockMinimo(e.target.value)}
              placeholder="0"
              style={styles.campoInput}
            />
          </div>

          {/* ── Solo en edición: stock actual + agregar stock + activo ── */}
          {esEdicion && (
            <>
              {/* Stock actual (solo lectura) + campo para agregar unidades */}
              <div style={styles.stockBox}>
                <div style={styles.stockActualRow}>
                  <span style={styles.campoLabel}>Stock actual</span>
                  <span style={styles.stockActualValor}>
                    {producto.stock_actual} uds.
                  </span>
                </div>
                <div style={styles.campoGrupo}>
                  <label style={styles.campoLabel}>Unidades a agregar</label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadAgregar}
                    onChange={e => setCantidadAgregar(e.target.value)}
                    placeholder="0"
                    style={styles.campoInput}
                  />
                </div>
              </div>

              {/* Activo / Inactivo */}
              <div style={styles.activoRow}>
                <span style={styles.campoLabel}>Estado</span>
                <button
                  style={{
                    ...styles.toggleBtn,
                    ...(activo ? styles.toggleActivo : styles.toggleInactivo),
                  }}
                  onPointerDown={() => setActivo(prev => !prev)}
                >
                  {activo ? '✓  Activo' : '✕  Inactivo'}
                </button>
              </div>
            </>
          )}

        </div>

        {/* Error */}
        {error && <p style={styles.errorTextoModal}>{error}</p>}

        {/* Botones */}
        <div style={styles.modalBotones}>
          <button
            style={styles.btnCancelar}
            onPointerDown={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            style={{
              ...styles.btnGuardar,
              ...(!puedeGuardar || guardando ? styles.btnDeshabilitado : {}),
            }}
            onPointerDown={handleGuardar}
            disabled={!puedeGuardar || guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabProductos() {
  const [productos, setProductos]               = useState([]);
  const [cargando, setCargando]                 = useState(true);
  const [error, setError]                       = useState(null);
  const [modalAbierto, setModalAbierto]         = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[TabProductos] Cargando productos...');
    fetch(`${API_URL}/api/gestion/productos`)
      .then(r => r.json())
      .then(data => {
        console.log('[TabProductos] Productos cargados:', data.length);
        setProductos(data);
        setCargando(false);
      })
      .catch(err => {
        console.error('[TabProductos] Error al cargar productos:', err);
        setError('No se pudieron cargar los productos.');
        setCargando(false);
      });
  }, []);

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    console.log('[TabProductos] Abriendo modal — modo crear');
    setProductoEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (producto) => {
    console.log('[TabProductos] Abriendo modal — modo editar:', producto.id);
    setProductoEditando(producto);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProductoEditando(null);
  };

  // ── Callback al guardar ────────────────────────────────────────────────────
  /**
   * handleGuardado — actualiza la lista local sin refetch al backend.
   * @param {object}  productoGuardado - objeto devuelto por el backend
   * @param {boolean} esEdicion        - true = edición, false = creación
   */
  const handleGuardado = (productoGuardado, esEdicion) => {
    if (esEdicion) {
      setProductos(prev =>
        prev.map(p => p.id === productoGuardado.id ? productoGuardado : p)
      );
    } else {
      setProductos(prev => [...prev, productoGuardado]);
    }
    cerrarModal();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (cargando) return <p style={styles.estadoTexto}>Cargando productos...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      {/* Modal */}
      {modalAbierto && (
        <ModalProducto
          producto={productoEditando}
          onGuardar={handleGuardado}
          onCerrar={cerrarModal}
        />
      )}

      {/* ── Fila superior: contador + botón nuevo ── */}
      <div style={styles.filaAcciones}>
        <p style={styles.subtitulo}>
          {productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}
        </p>
        <button style={styles.btnNuevo} onPointerDown={abrirCrear}>
          + Nuevo producto
        </button>
      </div>

      {/* ── Tabla ── */}
      {productos.length === 0 ? (
        <p style={styles.estadoTexto}>No hay productos registrados todavía.</p>
      ) : (
        <div style={styles.tablaWrapper}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Precio</th>
                <th style={styles.th}>Stock actual</th>
                <th style={styles.th}>Stock mínimo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.thAccion}></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    backgroundColor:
                      // Fila en rojo suave si el stock está por debajo del mínimo
                      p.stock_actual <= p.stock_minimo && p.stock_minimo > 0
                        ? '#fff8f8'
                        : i % 2 === 0 ? '#ffffff' : '#fafafa',
                  }}
                >
                  <td style={styles.td}>{p.nombre}</td>
                  <td style={styles.td}>
                    $ {Number(p.precio).toLocaleString('es-AR')}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      fontWeight: '600',
                      color: p.stock_actual <= p.stock_minimo && p.stock_minimo > 0
                        ? '#c0392b'
                        : '#111111',
                    }}>
                      {p.stock_actual} uds.
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: '#888888' }}>
                    {p.stock_minimo} uds.
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      ...(p.activo ? styles.badgeActivo : styles.badgeInactivo),
                    }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={styles.tdAccion}>
                    <button
                      style={styles.btnEditar}
                      onPointerDown={() => abrirEditar(p)}
                    >
                      ✎
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  filaAcciones: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  subtitulo: {
    margin: 0,
    fontSize: '14px',
    color: '#888888',
  },
  btnNuevo: {
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },

  // Tabla
  tablaWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1.5px solid #eeeeee',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '13px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    borderBottom: '1.5px solid #eeeeee',
    backgroundColor: '#fafafa',
  },
  thAccion: {
    padding: '13px 16px',
    width: '48px',
    borderBottom: '1.5px solid #eeeeee',
    backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px',
    color: '#333333',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '14px',
  },
  tdAccion: {
    padding: '8px 12px',
    textAlign: 'center',
    borderBottom: '1px solid #f0f0f0',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  badgeActivo: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  badgeInactivo: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },
  btnEditar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#555555',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Estados
  estadoTexto: {
    textAlign: 'center',
    color: '#888888',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },
  errorTexto: {
    textAlign: 'center',
    color: '#c0392b',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '32px',
    width: '440px',
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111111',
    margin: '0 0 24px',
    textAlign: 'center',
  },

  // Campos
  camposCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  campoGrupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  campoLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  campoHint: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: '0',
  },
  campoInput: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
  },
  precioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  precioSigno: {
    fontSize: '18px',
    fontWeight: '300',
    color: '#555555',
  },

  // Sección stock
  stockBox: {
    backgroundColor: '#f8fffe',
    border: '1.5px solid #d4edda',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stockActualRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockActualValor: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a7a4a',
  },

  // Toggle activo/inactivo
  activoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    padding: '8px 20px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  toggleActivo: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  toggleInactivo: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },

  // Error en modal
  errorTextoModal: {
    color: '#c0392b',
    fontSize: '13px',
    textAlign: 'center',
    margin: '-8px 0 8px',
  },

  // Botones modal
  modalBotones: {
    display: 'flex',
    gap: '12px',
  },
  btnCancelar: {
    flex: 1,
    padding: '13px 0',
    borderRadius: '12px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    color: '#444444',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGuardar: {
    flex: 1,
    padding: '13px 0',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
