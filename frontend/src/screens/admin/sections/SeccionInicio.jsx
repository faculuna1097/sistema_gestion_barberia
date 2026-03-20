// /frontend/src/screens/admin/sections/SeccionInicio.jsx
// Sección Inicio del Panel de Administrador.
// 3 cards: actividad del día, resumen del mes y alertas de stock.
// Los 3 endpoints se llaman en paralelo con Promise.all al montar el componente.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../services/api';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * formatMonto — formatea un número como moneda argentina sin decimales.
 * Ej: 504900 → "$ 504.900"
 */
const formatMonto = (n) => '$ ' + Number(n).toLocaleString('es-AR');

/**
 * BadgeVariacion — badge ▲/▼ con porcentaje de diferencia.
 * Si pct es null (sin datos previos), muestra el sinDatosLabel.
 */
const BadgeVariacion = ({ pct, sinDatosLabel = 'Sin datos previos' }) => {
  if (pct === null) {
    return <span style={styles.badgeSinDatos}>{sinDatosLabel}</span>;
  }
  const subiendo = pct >= 0;
  return (
    <span style={{
      ...styles.badge,
      backgroundColor: subiendo ? '#e8f5e9' : '#fdecea',
      color:           subiendo ? '#2e7d32' : '#c0392b',
    }}>
      {subiendo ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
};

// ─── Card base ────────────────────────────────────────────────────────────────
const Card = ({ children }) => (
  <div style={styles.card}>{children}</div>
);

// ─── Card 1 — Actividad del día ───────────────────────────────────────────────
/**
 * CardDia — muestra clientes y facturación de hoy con comparativa vs ayer.
 * Emoji a la izquierda del número, en la misma fila.
 */
function CardDia({ data }) {
  const { clientes_dia, monto_dia, diferencia_pct_dia } = data;

  return (
    <Card>
      <p style={styles.cardTitulo}>Hoy</p>

      <div style={styles.metricasRow}>

        {/* Clientes */}
        <div style={styles.metricaBloque}>
          <span style={styles.metricaEmoji}>👤</span>
          <div style={styles.metricaTextos}>
            <span style={styles.metricaNumero}>{clientes_dia}</span>
            <span style={styles.metricaLabel}>
              {clientes_dia === 1 ? 'cliente atendido' : 'clientes atendidos'}
            </span>
          </div>
        </div>

        <div style={styles.metricaDivider} />

        {/* Facturación */}
        <div style={styles.metricaBloque}>
          <span style={styles.metricaEmoji}>💵</span>
          <div style={styles.metricaTextos}>
            <span style={{ ...styles.metricaNumero, color: '#1a7a4a' }}>
              {formatMonto(monto_dia)}
            </span>
            <span style={styles.metricaLabel}>facturado hoy</span>
          </div>
        </div>

      </div>

      {/* Badge comparativa */}
      {/* <div style={styles.badgeRow}>
        <BadgeVariacion pct={diferencia_pct_dia} sinDatosLabel="Sin datos de ayer" />
        <span style={styles.badgeSubLabel}>vs ayer a esta hora</span>
      </div> */}
      
    </Card>
  );
}

// ─── Card 2 — Resumen del mes ─────────────────────────────────────────────────
/**
 * CardMes — muestra clientes y facturación del mes actual
 * con comparativa vs el mismo período del mes anterior.
 */
function CardMes({ data }) {
  const {
    clientes_actual, monto_actual,
    diferencia_pct, dia_corte, mes_actual, mes_anterior,
  } = data;

  return (
    <Card>
      <p style={styles.cardTitulo}>{mes_actual} — del 1 al {dia_corte}</p>

      <div style={styles.metricasRow}>

        {/* Clientes */}
        <div style={styles.metricaBloque}>
          <span style={styles.metricaEmoji}>👥</span>
          <div style={styles.metricaTextos}>
            <span style={styles.metricaNumero}>{clientes_actual}</span>
            <span style={styles.metricaLabel}>
              {clientes_actual === 1 ? 'cliente atendido' : 'clientes atendidos'}
            </span>
          </div>
        </div>

        <div style={styles.metricaDivider} />

        {/* Facturación */}
        <div style={styles.metricaBloque}>
          <span style={styles.metricaEmoji}>💵</span>
          <div style={styles.metricaTextos}>
            <span style={{ ...styles.metricaNumero, color: '#1a7a4a' }}>
              {formatMonto(monto_actual)}
            </span>
            <span style={styles.metricaLabel}>facturado este mes</span>
          </div>
        </div>

      </div>

      {/* Badge comparativa */}
      <div style={styles.badgeRow}>
        <BadgeVariacion
          pct={diferencia_pct}
          sinDatosLabel={`Sin datos de ${mes_anterior}`}
        />
        <span style={styles.badgeSubLabel}>vs {mes_anterior} al día {dia_corte}</span>
      </div>
    </Card>
  );
}

// ─── Card 3 — Alertas de stock ────────────────────────────────────────────────
/**
 * CardStock — lista productos con stock_actual <= stock_minimo.
 * Si no hay ninguno, muestra mensaje verde "✓ Stock en orden".
 */
function CardStock({ productos }) {
  const hayAlertas = productos.length > 0;

  return (
    <Card>
      <p style={styles.cardTitulo}>
        Alertas de stock
        {hayAlertas && (
          <span style={styles.badgeAlerta}>{productos.length}</span>
        )}
      </p>

      {hayAlertas ? (
        <div style={styles.stockLista}>
          <div style={styles.stockEncabezado}>
            <span style={styles.stockColNombre}>Producto</span>
            <span style={styles.stockColNum}>Actual</span>
            <span style={styles.stockColNum}>Mínimo</span>
          </div>
          <div style={styles.divider} />

          {productos.map((p, i) => (
            <div key={p.id}>
              <div style={styles.stockFila}>
                <span style={styles.stockNombre}>{p.nombre}</span>
                <span style={{ ...styles.stockNum, color: '#c0392b', fontWeight: '700' }}>
                  {p.stock_actual}
                </span>
                <span style={{ ...styles.stockNum, color: '#888888' }}>
                  {p.stock_minimo}
                </span>
              </div>
              {i < productos.length - 1 && <div style={styles.divider} />}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.stockEnOrden}>
          <div style={styles.stockEnOrdenIcono}>✓</div>
          <span style={styles.stockEnOrdenTexto}>Stock en orden</span>
        </div>
      )}
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
/**
 * SeccionInicio — carga los 3 endpoints en paralelo al montarse.
 * Muestra spinner mientras carga y mensaje de error si algo falla.
 */
export default function SeccionInicio() {
  const [resumen,     setResumen]     = useState(null);
  const [comparativo, setComparativo] = useState(null);
  const [stockBajo,   setStockBajo]   = useState(null);
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    console.log('[SeccionInicio] Cargando datos...');
    Promise.all([
      apiFetch(`${API_URL}/api/inicio/resumen-dia`).then(r => r.json()),
      apiFetch(`${API_URL}/api/inicio/comparativo-mes`).then(r => r.json()),
      apiFetch(`${API_URL}/api/inicio/stock-bajo`).then(r => r.json()),
    ])
      .then(([resumenData, comparativoData, stockData]) => {
        console.log('[SeccionInicio] Datos cargados —',
          'monto_dia:', resumenData.monto_dia,
          '| clientes_dia:', resumenData.clientes_dia,
          '| dif_dia:', resumenData.diferencia_pct_dia,
          '| dif_mes:', comparativoData.diferencia_pct,
          '| stock_bajo:', stockData.productos?.length
        );
        setResumen(resumenData);
        setComparativo(comparativoData);
        setStockBajo(stockData.productos || []);
        setCargando(false);
      })
      .catch(err => {
        console.error('[SeccionInicio] Error al cargar datos:', err);
        setError('No se pudieron cargar los datos. Intentá recargar la página.');
        setCargando(false);
      });
  }, []);

  if (cargando) return (
    <div style={styles.estadoCentrado}>
      <div style={styles.spinner} />
      <p style={styles.estadoTexto}>Cargando datos del día...</p>
    </div>
  );

  if (error) return (
    <div style={styles.contenedor}>
      <div style={styles.errorBox}>{error}</div>
    </div>
  );

  return (
    <div style={styles.contenedor}>
      <div style={styles.encabezado}>
        <h2 style={styles.titulo}>Inicio</h2>
        <p style={styles.subtitulo}>Resumen operativo del día</p>
      </div>

      <div style={styles.cardsColumna}>
        <CardDia   data={resumen} />
        <CardMes   data={comparativo} />
        <CardStock productos={stockBajo} />
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    padding: '36px 40px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  encabezado: { marginBottom: '28px' },
  titulo:     { fontSize: '26px', fontWeight: '700', color: '#111111', margin: '0 0 4px' },
  subtitulo:  { fontSize: '14px', color: '#888888', margin: 0 },

  cardsColumna: { display: 'flex', flexDirection: 'column', gap: '20px' },

  // Card base
  card: {
    border: '1.5px solid #eeeeee', borderRadius: '16px',
    backgroundColor: '#fafafa', padding: '28px 32px',
  },
  cardTitulo: {
    fontSize: '13px', fontWeight: '700', color: '#999999',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px',
  },

  // Fila de dos métricas
  metricasRow: {
    display: 'flex', alignItems: 'center',
    marginBottom: '20px', gap: '0', justifyContent: 'center', 
  },

  // Cada métrica: emoji a la izquierda, textos a la derecha
  metricaBloque: {
    flex: 'none', display: 'flex', flexDirection: 'row',
    alignItems: 'center', gap: '14px', padding: '8px 16px', minWidth: '260px', 
  },
  metricaEmoji: { fontSize: '32px', lineHeight: 1, flexShrink: 0 },
  metricaTextos: {
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  metricaNumero: {
    fontSize: '36px', fontWeight: '700', color: '#111111',
    lineHeight: 1, letterSpacing: '-0.02em',
  },
  metricaLabel: {
    fontSize: '13px', color: '#888888', fontWeight: '500',
  },
  metricaDivider: {
    width: '1px', height: '60px', backgroundColor: '#eeeeee', flexShrink: 0,
  },

  // Badge de variación
  badgeRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', paddingTop: '4px',
  },
  badge: {
    display: 'inline-block', padding: '5px 14px',
    borderRadius: '20px', fontSize: '14px', fontWeight: '700',
  },
  badgeSinDatos: {
    display: 'inline-block', padding: '5px 14px',
    borderRadius: '20px', fontSize: '13px', fontWeight: '600',
    backgroundColor: '#f5f5f5', color: '#aaaaaa',
  },
  badgeSubLabel: {
    fontSize: '13px', color: '#aaaaaa', fontWeight: '400',
  },

  // Badge contador de alertas en título de stock
  badgeAlerta: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '20px', height: '20px', padding: '0 6px',
    borderRadius: '10px', backgroundColor: '#fdecea',
    color: '#c0392b', fontSize: '12px', fontWeight: '700',
  },

  // Stock tabla
  stockLista:      { display: 'flex', flexDirection: 'column' },
  stockEncabezado: { display: 'flex', alignItems: 'center', marginBottom: '8px' },
  stockColNombre: {
    flex: 1, fontSize: '11px', fontWeight: '700', color: '#999999',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  stockColNum: {
    width: '100px', textAlign: 'center',
    fontSize: '11px', fontWeight: '700', color: '#999999',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  stockFila:   { display: 'flex', alignItems: 'center', padding: '10px 0' },
  stockNombre: { flex: 1, fontSize: '15px', color: '#111111', fontWeight: '500' },
  stockNum:    { width: '100px', textAlign: 'center', fontSize: '15px' },
  divider:     { height: '1px', backgroundColor: '#eeeeee' },

  // Stock en orden
  stockEnOrden: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '12px 0',
  },
  stockEnOrdenIcono: {
    width: '32px', height: '32px', borderRadius: '50%',
    backgroundColor: '#e8f5e9', color: '#2e7d32',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: '700', flexShrink: 0,
  },
  stockEnOrdenTexto: { fontSize: '16px', fontWeight: '600', color: '#2e7d32' },

  // Estados globales
  estadoCentrado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 0', gap: '16px',
  },
  estadoTexto: { fontSize: '15px', color: '#888888', margin: 0 },
  errorBox: {
    padding: '16px 20px', borderRadius: '10px',
    backgroundColor: '#fdecea', color: '#c0392b', fontSize: '14px',
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid #e8e8e8', borderTopColor: '#1a7a4a',
    animation: 'spin 0.8s linear infinite',
  },
};
