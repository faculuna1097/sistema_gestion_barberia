// /frontend/src/screens/admin/sections/SeccionGestion.jsx
// Sección Gestión del panel admin.
// Contiene 5 sub-secciones (tabs internos): Barberos, Servicios, Productos,
// Datos del negocio y Cambio de PIN admin.
// Cada tab carga sus propios datos al activarse — no hay precarga global.
// Estilo visual idéntico a SeccionBalances.

import { useState } from 'react';
import TabBarberos  from './gestion/TabBarberos.jsx';
import TabServicios from './gestion/TabServicios.jsx';
import TabProductos from './gestion/TabProductos.jsx';
import TabNegocio   from './gestion/TabNegocio.jsx';
import TabSeguridad from './gestion/TabSeguridad.jsx';
import TabTurnero   from './gestion/TabTurnero.jsx';

// ─── Tabs disponibles ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'barberos',  label: '✂️  Barberos'         },
  { key: 'servicios', label: '📋  Servicios'         },
  { key: 'productos', label: '🧴  Productos'         },
  { key: 'turnero',   label: '📅  Turnero'            },
  { key: 'negocio',   label: '🏠  Datos del negocio' },
  { key: 'seguridad', label: '🔐  Seguridad'         },
];

export default function SeccionGestion() {
  const [tabActiva, setTabActiva] = useState('barberos');

  return (
    <div style={styles.contenedor}>

      {/* ── Encabezado: título + tabs en el mismo row ── */}
      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Gestión</h2>
          <p style={styles.subtitulo}>Administración de barberos, servicios, productos y configuración</p>
        </div>
        <div style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              style={{
                ...styles.tabBtn,
                ...(tabActiva === tab.key ? styles.tabBtnActivo : {}),
              }}
              onPointerDown={() => setTabActiva(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido del tab activo ── */}
      <div style={styles.tabContenido}>
        {tabActiva === 'barberos'  && <TabBarberos />}
        {tabActiva === 'servicios' && <TabServicios />}
        {tabActiva === 'productos' && <TabProductos />}
        {tabActiva === 'turnero'   && <TabTurnero />}
        {tabActiva === 'negocio'   && <TabNegocio />}
        {tabActiva === 'seguridad' && <TabSeguridad />}
      </div>

    </div>
  );
}

// ─── Estilos — idénticos a SeccionBalances ────────────────────────────────────
const styles = {
  contenedor: {
    padding: '36px 40px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    color: '#111111',
  },
  encabezado: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titulo: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    padding: '4px',
  },
  tabBtn: {
    padding: '8px 20px',
    borderRadius: '9px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    transition: 'all 0.15s',
  },
  tabBtnActivo: {
    backgroundColor: '#ffffff',
    color: '#111111',
    fontWeight: '600',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  },
  tabContenido: {},
};
