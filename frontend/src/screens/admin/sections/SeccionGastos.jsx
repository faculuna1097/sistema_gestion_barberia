// /frontend/src/screens/admin/sections/SeccionGastos.jsx

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../../services/api';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const mesALabel = (mesStr) => {
  const [anio, mes] = mesStr.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} ${anio}`;
};

const getMesActual = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7);

const desplazarMes = (mesStr, delta) => {
  const [anio, mes] = mesStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonto = (valor) =>
  `$ ${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const ExcelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ marginRight: '6px' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const BadgeFormaPago = ({ forma }) => {
  const estilos = forma === 'efectivo'
    ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
    : { backgroundColor: '#e3f2fd', color: '#1565c0' };
  return (
    <span style={{ ...styles.badge, ...estilos }}>
      {forma === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}
    </span>
  );
};

function ModalEditarGasto({ gasto, categorias, form, onChange, onGuardar, onCancelar, guardando, errorEditar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalCard, width: '480px' }}>
        <p style={styles.modalTitulo}>Editar gasto</p>
        <p style={styles.modalSubtitulo}>Fecha original: {gasto.fecha}</p>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Categoría</label>
          <select
            style={styles.select}
            value={form.categoria_id}
            onChange={e => onChange('categoria_id', e.target.value)}
          >
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Descripción</label>
          <input
            type="text"
            style={styles.input}
            value={form.descripcion}
            onChange={e => onChange('descripcion', e.target.value)}
            placeholder="Descripción del gasto"
          />
        </div>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Monto</label>
          <input
            type="number"
            min="0"
            style={styles.input}
            value={form.monto}
            onChange={e => onChange('monto', e.target.value)}
          />
        </div>

        <div style={styles.formGrupo}>
          <label style={styles.formLabel}>Forma de pago</label>
          <select
            style={styles.select}
            value={form.forma_pago}
            onChange={e => onChange('forma_pago', e.target.value)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="mercado_pago">Mercado Pago</option>
          </select>
        </div>

        {errorEditar && (
          <div style={styles.errorModal}>{errorEditar}</div>
        )}

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnGuardar, ...(guardando ? styles.btnGuardarDeshabilitado : {}) }}
            onPointerDown={onGuardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmarEliminar({ gasto, onConfirmar, onCancelar }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar este gasto?</p>
        <p style={styles.modalAdvertencia}>Esta acción no se puede deshacer.</p>

        <div style={styles.modalDetalle}>
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Fecha</span>
            <span style={styles.modalValor}>{gasto.fecha}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Categoría</span>
            <span style={styles.modalValor}>{gasto.categoria_nombre}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Descripción</span>
            <span style={styles.modalValor}>{gasto.descripcion}</span>
          </div>
          <div style={styles.modalDivider} />
          <div style={styles.modalFila}>
            <span style={styles.modalLabel}>Monto</span>
            <span style={{ ...styles.modalValor, color: '#c0392b', fontWeight: '700' }}>
              {formatMonto(gasto.monto)}
            </span>
          </div>
        </div>

        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar}>Cancelar</button>
          <button style={styles.btnEliminarConfirm} onPointerDown={onConfirmar}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

export default function SeccionGastos() {
  const [mes, setMes]                           = useState(getMesActual);
  const [gastos, setGastos]                     = useState([]);
  const [totalesPorCategoria, setTotalesPorCat] = useState([]);
  const [totalGeneral, setTotalGeneral]         = useState(0);
  const [cargando, setCargando]                 = useState(false);
  const [error, setError]                       = useState(null);
  const [gastoAEliminar, setGastoAEliminar]     = useState(null);
  const [eliminando, setEliminando]             = useState(false);
  const [categorias, setCategorias]             = useState([]);
  const [gastoAEditar, setGastoAEditar]         = useState(null);
  const [formEditar, setFormEditar]             = useState({});
  const [guardando, setGuardando]               = useState(false);
  const [errorEditar, setErrorEditar]           = useState(null);

  useEffect(() => {
    console.log('[seccionGastos] montado');
    const cargarCategorias = async () => {
      try {
        const res = await apiFetch('/categorias');
        if (!res.ok) return;
        const data = await res.json();
        setCategorias(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[seccionGastos] Error en cargarCategorias:', err.message);
      }
    };
    cargarCategorias();
  }, []);

  useEffect(() => {
    const cargarGastos = async () => {
      console.log('[seccionGastos] cargarGastos — request recibido | mes:', mes);
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch(`/gastos/mensual?mes=${mes}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setGastos(data.gastos);
        setTotalesPorCat(data.totalesPorCategoria);
        setTotalGeneral(data.totalGeneral);
        console.log('[seccionGastos] cargarGastos — completado | registros:', data.gastos.length);
      } catch (err) {
        console.error('[seccionGastos] Error en cargarGastos:', err.message);
        setError('No se pudieron cargar los gastos. Intentá de nuevo.');
      } finally {
        setCargando(false);
      }
    };
    cargarGastos();
  }, [mes]);

  const abrirEditar = (g) => {
    setErrorEditar(null);
    setFormEditar({
      categoria_id: g.categoria_id,
      descripcion:  g.descripcion,
      monto:        g.monto,
      forma_pago:   g.forma_pago,
    });
    setGastoAEditar(g);
  };

  const handleChangeForm = (campo, valor) => {
    setFormEditar(f => ({ ...f, [campo]: valor }));
  };

  const confirmarEditar = async () => {
    const { id } = gastoAEditar;
    console.log('[seccionGastos] confirmarEditar — request recibido | id:', id);

    /*
    if (!formEditar.categoria_id || !formEditar.descripcion.trim() || Number(formEditar.monto) <= 0) {
      setErrorEditar('Completá todos los campos correctamente.');
      return;
    }
    */

    setGuardando(true);
    setErrorEditar(null);
    try {
      const res = await apiFetch(`/gastos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          categoria_id: formEditar.categoria_id,
          descripcion:  formEditar.descripcion.trim(),
          monto:        Number(formEditar.monto),
          forma_pago:   formEditar.forma_pago,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const categoriaNombre = categorias.find(c => c.id === formEditar.categoria_id)?.nombre
        || gastoAEditar.categoria_nombre;

      const nuevosGastos = gastos.map(g => g.id === id ? {
        ...g,
        categoria_id:     formEditar.categoria_id,
        categoria_nombre: categoriaNombre,
        descripcion:      formEditar.descripcion.trim(),
        monto:            Number(formEditar.monto),
        forma_pago:       formEditar.forma_pago,
      } : g);

      setGastos(nuevosGastos);

      const totalGen = nuevosGastos.reduce((acc, g) => acc + Number(g.monto), 0);
      setTotalGeneral(totalGen);

      const totalesMap = {};
      nuevosGastos.forEach(g => {
        if (!totalesMap[g.categoria_nombre])
          totalesMap[g.categoria_nombre] = { total: 0, cantidad: 0 };
        totalesMap[g.categoria_nombre].total    += Number(g.monto);
        totalesMap[g.categoria_nombre].cantidad += 1;
      });
      const nuevosTotales = Object.entries(totalesMap)
        .map(([nombre, vals]) => ({ categoria_nombre: nombre, ...vals }))
        .sort((a, b) => b.total - a.total);
      setTotalesPorCat(nuevosTotales);

      console.log('[seccionGastos] confirmarEditar — completado | id:', id);
      setGastoAEditar(null);
    } catch (err) {
      console.error('[seccionGastos] Error en confirmarEditar:', err.message);
      setErrorEditar(err.message || 'No se pudo editar el gasto. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    const { id } = gastoAEliminar;
    console.log('[seccionGastos] confirmarEliminar — request recibido | id:', id);
    setEliminando(true);
    try {
      const res = await apiFetch(`/gastos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error del servidor');
      const nuevosGastos = gastos.filter(g => g.id !== id);
      setGastos(nuevosGastos);
      const nuevoTotal = nuevosGastos.reduce((acc, g) => acc + Number(g.monto), 0);
      setTotalGeneral(nuevoTotal);
      const totalesMap = {};
      nuevosGastos.forEach(g => {
        if (!totalesMap[g.categoria_nombre])
          totalesMap[g.categoria_nombre] = { total: 0, cantidad: 0 };
        totalesMap[g.categoria_nombre].total    += Number(g.monto);
        totalesMap[g.categoria_nombre].cantidad += 1;
      });
      const nuevosTotales = Object.entries(totalesMap)
        .map(([nombre, vals]) => ({ categoria_nombre: nombre, ...vals }))
        .sort((a, b) => b.total - a.total);
      setTotalesPorCat(nuevosTotales);
      console.log('[seccionGastos] confirmarEliminar — completado | id:', id);
    } catch (err) {
      console.error('[seccionGastos] Error en confirmarEliminar:', err.message);
    } finally {
      setEliminando(false);
      setGastoAEliminar(null);
    }
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const filas = gastos.map(g => ({
      Fecha:           g.fecha,
      Categoría:       g.categoria_nombre,
      Descripción:     g.descripcion,
      Monto:           Number(g.monto),
      'Forma de pago': g.forma_pago === 'efectivo' ? 'Efectivo' : 'Mercado Pago',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Gastos');
    const filasTotales = totalesPorCategoria.map(t => ({
      Categoría:            t.categoria_nombre,
      'Cantidad de gastos': Number(t.cantidad),
      Total:                Number(t.total),
    }));
    filasTotales.push({
      Categoría:            'TOTAL GENERAL',
      'Cantidad de gastos': gastos.length,
      Total:                totalGeneral,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTotales), 'Totales');
    XLSX.writeFile(wb, `Gastos_${mes}.xlsx`);
    console.log('[seccionGastos] exportarExcel — completado | mes:', mes);
  };

  return (
    <div style={styles.contenedor}>

      {gastoAEditar && (
        <ModalEditarGasto
          gasto={gastoAEditar}
          categorias={categorias}
          form={formEditar}
          onChange={handleChangeForm}
          onGuardar={confirmarEditar}
          onCancelar={() => setGastoAEditar(null)}
          guardando={guardando}
          errorEditar={errorEditar}
        />
      )}

      {gastoAEliminar && (
        <ModalConfirmarEliminar
          gasto={gastoAEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setGastoAEliminar(null)}
        />
      )}

      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Gastos</h2>
          <p style={styles.subtitulo}>Registro mensual de egresos</p>
        </div>
        <button
          style={{ ...styles.btnExportar, ...(gastos.length === 0 ? styles.btnExportarDeshabilitado : {}) }}
          onPointerDown={exportarExcel}
          disabled={gastos.length === 0}
        >
          <ExcelIcon /> Exportar Excel
        </button>
      </div>

      <div style={styles.selectorMes}>
        <button style={styles.btnMes} onPointerDown={() => setMes(m => desplazarMes(m, -1))}>‹</button>
        <span style={styles.labelMes}>{mesALabel(mes)}</span>
        <button
          style={{ ...styles.btnMes, ...(mes >= getMesActual() ? styles.btnMesDeshabilitado : {}) }}
          onPointerDown={() => setMes(m => desplazarMes(m, +1))}
          disabled={mes >= getMesActual()}
        >›</button>
      </div>

      {cargando && (
        <div style={styles.estadoCentrado}>
          <div style={styles.spinner} />
          <p style={styles.estadoTexto}>Cargando gastos...</p>
        </div>
      )}

      {!cargando && error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {!cargando && !error && gastos.length === 0 && (
        <div style={styles.estadoCentrado}>
          <p style={styles.estadoTexto}>No hay gastos registrados en {mesALabel(mes)}.</p>
        </div>
      )}

      {!cargando && !error && gastos.length > 0 && (
        <>
          <div style={styles.tablaWrapper}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={{ ...styles.th, width: '35%' }}>Descripción</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Forma de pago</th>
                  <th style={styles.thAccion}></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g, i) => (
                  <tr key={g.id} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={styles.td}>{g.fecha}</td>
                    <td style={styles.td}>
                      <span style={styles.badgeCategoria}>{g.categoria_nombre}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#444' }}>{g.descripcion}</td>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#c0392b', whiteSpace: 'nowrap' }}>
                      {formatMonto(g.monto)}
                    </td>
                    <td style={styles.td}><BadgeFormaPago forma={g.forma_pago} /></td>
                    <td style={styles.tdAccion}>
                      <div style={styles.accionBotones}>
                        <button
                          style={styles.btnEditar}
                          onPointerDown={() => abrirEditar(g)}
                          disabled={eliminando || guardando}
                          aria-label="Editar gasto"
                        >✎</button>
                        <button
                          style={styles.btnX}
                          onPointerDown={() => setGastoAEliminar(g)}
                          disabled={eliminando || guardando}
                          aria-label="Eliminar gasto"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={styles.filaTotalGeneral}>
                  <td colSpan={4} style={{ ...styles.tdTotal, textAlign: 'left' }}>Total del mes</td>
                  <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#c0392b' }}>
                    {formatMonto(totalGeneral)}
                  </td>
                  <td style={styles.tdTotal} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={styles.totalesWrapper}>
            <h3 style={styles.tituloTotales}>Resumen del mes</h3>
            <table style={styles.tablaTotales}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Categoría</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Cantidad</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {totalesPorCategoria.map((t, i) => (
                  <tr key={t.categoria_nombre} style={i % 2 === 0 ? styles.filaImpar : styles.filaPar}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{t.categoria_nombre}</td>
                    <td style={{ ...styles.td, textAlign: 'center', color: '#666' }}>{t.cantidad}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                      {formatMonto(t.total)}
                    </td>
                  </tr>
                ))}
                <tr style={styles.filaTotalGeneral}>
                  <td style={{ ...styles.tdTotal, textAlign: 'left' }}>Total general</td>
                  <td style={{ ...styles.tdTotal, textAlign: 'center', color: '#888', fontSize: '13px', fontWeight: '500' }}>
                    {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
                  </td>
                  <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#c0392b' }}>
                    {formatMonto(totalGeneral)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  contenedor: {
    padding: '32px 36px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '24px',
  },
  titulo:    { fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px' },
  subtitulo: { fontSize: '14px', color: '#888', margin: 0 },
  btnExportar: {
    display: 'flex', alignItems: 'center',
    padding: '10px 18px', borderRadius: '10px',
    border: '1.5px solid #1a7a4a', backgroundColor: '#fff',
    color: '#1a7a4a', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnExportarDeshabilitado: { borderColor: '#e0e0e0', color: '#bbb', cursor: 'not-allowed' },
  selectorMes: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
    marginBottom: '28px',
  },
  btnMes: {
    width: '36px', height: '36px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#fff',
    fontSize: '20px', color: '#333', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  btnMesDeshabilitado: { color: '#ccc', cursor: 'not-allowed', borderColor: '#f0f0f0' },
  labelMes: {
    fontSize: '17px', fontWeight: '600', color: '#111',
    minWidth: '160px', textAlign: 'center',
  },
  tablaWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', marginBottom: '32px', overflowX: 'auto',
  },
  tabla:    { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    padding: '13px 16px', backgroundColor: '#fafafa',
    color: '#888', fontWeight: '600', fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'left', borderBottom: '1.5px solid #eeeeee', whiteSpace: 'nowrap',
  },
  thAccion: {
    padding: '13px 12px', width: '80px',
    borderBottom: '1.5px solid #eeeeee', backgroundColor: '#fafafa',
  },
  td: {
    padding: '13px 16px', color: '#333',
    borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle', fontSize: '14px',
  },
  tdAccion: {
    padding: '8px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
  },
  accionBotones: {
    display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
  },
  filaImpar: { backgroundColor: '#ffffff' },
  filaPar:   { backgroundColor: '#fafafa' },
  btnEditar: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #c5dcf5', backgroundColor: '#f0f6ff',
    color: '#1565c0', fontSize: '15px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  btnX: {
    width: '30px', height: '30px', borderRadius: '8px',
    border: '1.5px solid #f5c6c6', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  badgeCategoria: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '500',
    backgroundColor: '#f3f4f6', color: '#374151',
  },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '600',
  },
  totalesWrapper: {
    borderRadius: '12px', border: '1.5px solid #eeeeee',
    overflow: 'hidden', maxWidth: '520px',
  },
  tituloTotales: {
    fontSize: '15px', fontWeight: '700', color: '#111',
    margin: '0', padding: '14px 16px', backgroundColor: '#fafafa',
    borderBottom: '1.5px solid #eeeeee',
  },
  tablaTotales:     { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  filaTotalGeneral: { backgroundColor: '#fff8f8', borderTop: '2px solid #e8e8e8' },
  tdTotal:          { padding: '14px 16px', fontWeight: '700', fontSize: '15px', color: '#111' },
  estadoCentrado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 0', gap: '16px',
  },
  estadoTexto: { fontSize: '15px', color: '#888', margin: 0 },
  errorBox: {
    padding: '16px 20px', borderRadius: '10px',
    backgroundColor: '#fdecea', color: '#c0392b',
    fontSize: '14px', marginBottom: '16px',
  },
  errorModal: {
    padding: '10px 14px', borderRadius: '8px',
    backgroundColor: '#fdecea', color: '#c0392b',
    fontSize: '13px', marginBottom: '16px', textAlign: 'center',
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid #e8e8e8', borderTopColor: '#1a7a4a',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: '0 0 6px', textAlign: 'center',
  },
  modalSubtitulo: {
    fontSize: '13px', color: '#888', textAlign: 'center', margin: '0 0 20px',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: '0 0 24px',
  },
  modalDetalle: {
    backgroundColor: '#fafafa', borderRadius: '12px',
    border: '1.5px solid #eeeeee', padding: '16px 20px',
    marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  modalFila:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel:   { fontSize: '13px', color: '#888888' },
  modalValor:   { fontSize: '14px', color: '#111111', fontWeight: '600' },
  modalDivider: { height: '1px', backgroundColor: '#eeeeee' },
  modalBotones: { display: 'flex', gap: '12px' },
  btnCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEliminarConfirm: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  formGrupo:   { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' },
  formLabel: {
    fontSize: '11px', fontWeight: '600', color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '14px',
    fontFamily: 'inherit', color: '#111', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '14px',
    fontFamily: 'inherit', color: '#111', outline: 'none',
    backgroundColor: '#fff', width: '100%', boxSizing: 'border-box',
  },
  btnGuardar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#1a7a4a',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnGuardarDeshabilitado: { backgroundColor: '#a8cdb8', cursor: 'not-allowed' },
};