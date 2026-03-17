// frontend/src/screens/admin/sections/SeccionGestion.jsx
// Sección Gestión del panel admin.
// Contiene 5 sub-secciones (tabs internos): Barberos, Servicios, Productos,
// Datos del negocio y Cambio de PIN admin.
// Cada tab carga sus propios datos al activarse — no hay precarga global.
// Estilo de tabs idéntico a SeccionCaja.

import { useState } from 'react';
import TabBarberos from './gestion/TabBarberos.jsx';
import TabServicios from './gestion/TabServicios.jsx';
import TabProductos from './gestion/TabProductos.jsx';
import TabNegocio from './gestion/TabNegocio.jsx';
import TabPinAdmin from './gestion/TabPinAdmin.jsx';

// ─── Tabs disponibles ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'barberos',  label: '✂️  Barberos'         },
  { key: 'servicios', label: '📋  Servicios'         },
  { key: 'productos', label: '🧴  Productos'         },
  { key: 'negocio',   label: '🏠  Datos del negocio' },
  { key: 'pin',       label: '🔑  PIN admin'         },
];

export default function SeccionGestion() {
  console.log('[SeccionGestion] Montada');

  const [tabActiva, setTabActiva] = useState('barberos');

  return (
    <div style={styles.contenedor}>

      {/* ── Tab bar ── */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tabBtn,
              ...(tabActiva === tab.key ? styles.tabBtnActivo : {}),
            }}
            onPointerDown={() => {
              console.log('[SeccionGestion] Tab seleccionada:', tab.key);
              setTabActiva(tab.key);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenido del tab activo ── */}
      <div style={styles.tabContenido}>
        {tabActiva === 'barberos'  && <TabBarberos />}
        {tabActiva === 'servicios' && <TabServicios />}
        {tabActiva === 'productos' && <TabProductos />}
        {tabActiva === 'negocio'   && <TabNegocio />}
        {tabActiva === 'pin'       && <TabPinAdmin />}
      </div>

    </div>
  );
}

// ─── Estilos — idénticos a SeccionCaja ───────────────────────────────────────
const styles = {
  contenedor: {
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    borderBottom: '2px solid #eeeeee',
    marginBottom: '28px',
  },
  tabBtn: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '500',
    color: '#888888',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    fontFamily: 'inherit',
    borderRadius: '8px 8px 0 0',
    transition: 'color 0.15s',
  },
  tabBtnActivo: {
    color: '#1a7a4a',
    borderBottom: '2px solid #1a7a4a',
    fontWeight: '600',
  },
  tabContenido: {},
};
