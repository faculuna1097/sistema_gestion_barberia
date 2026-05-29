// /frontend/src/screens/admin/sections/SeccionGestion.jsx
// Sección Gestión del panel admin.
// Shell con 6 tabs: Barberos, Servicios, Productos, Turnero (config booking
// online), Negocio, Seguridad. Cada tab carga sus propios datos al
// activarse — no hay precarga global.
//
// Estructura visual: Tabs underline (D8) arriba + contenido del tab activo.
// Sin ScreenHeader (D15: el usuario decidió sacar el header de esta sección).
// Sin padding/fondo propios en el <main> — los hereda del PanelAdmin (D7).

import { useState } from 'react';
import {
  Scissors,
  ClipboardList,
  Package,
  Calendar,
  Building2,
  Shield,
} from 'lucide-react';

import Tabs from '../../../components/ui/Tabs.jsx';

import TabBarberos  from './gestion/TabBarberos.jsx';
import TabServicios from './gestion/TabServicios.jsx';
import TabProductos from './gestion/TabProductos.jsx';
import TabTurnero   from './gestion/TabTurnero.jsx';
import TabNegocio   from './gestion/TabNegocio.jsx';
import TabSeguridad from './gestion/TabSeguridad.jsx';

// ─── Items del tablist ────────────────────────────────────────────────────────
const TABS_ITEMS = [
  { key: 'barberos',  label: 'Barberos',          icon: Scissors      },
  { key: 'servicios', label: 'Servicios',         icon: ClipboardList },
  { key: 'productos', label: 'Productos',         icon: Package       },
  { key: 'turnero',   label: 'Turnero',           icon: Calendar      },
  { key: 'negocio',   label: 'Negocio',           icon: Building2     },
  { key: 'seguridad', label: 'Seguridad',         icon: Shield        },
];

/**
 * SeccionGestion
 * Shell padre de las 6 tabs de administración del negocio. Mantiene cuál tab
 * está activa y renderiza solo el contenido correspondiente.
 *
 * @returns {JSX.Element}
 */
export default function SeccionGestion() {
  const [tabActiva, setTabActiva] = useState('barberos');

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs
        items={TABS_ITEMS}
        value={tabActiva}
        onChange={setTabActiva}
      />

      <div>
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
