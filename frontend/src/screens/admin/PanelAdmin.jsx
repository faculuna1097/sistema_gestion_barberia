// /frontend/src/screens/admin/PanelAdmin.jsx
// Panel de administrador. Layout: sidebar claro fijo a la izquierda (220px /
// 64px colapsado) + área de contenido a la derecha. Cada sección del sidebar
// renderiza su componente correspondiente en el main.
//
// Props:
//   onCerrarSesion  — callback para volver a la pantalla operativa.
//   avisosPago      — si true, muestra el banner de aviso de pago al tope.
//   nombreNegocio   — viene desde App.jsx (no hace fetch propio para evitar
//                     duplicar getNegocio).
//   rol             — 'admin' | 'barbero'. Lo resuelve el login unificado por PIN.
//                     Admin ve las 8 secciones; barbero ve la vista reducida
//                     (solo su Planilla y su Turnero). Default 'admin'.
//   barberoSesion   — { id, nombre } del barbero logueado, o null si es admin.
//                     Se usa para su identidad en el sidebar (D5) y se propaga a
//                     las secciones (lo consumen recién en la Fase 6).

import { useState, lazy, Suspense } from "react";
import {
  Home, DollarSign, ClipboardList, BarChart3, ShoppingBag,
  Receipt, Calendar, Settings, LogOut, ChevronLeft, ChevronRight,
  AlertTriangle, X,
} from "lucide-react";
import { theme } from "../../theme/tokens.js";
import { AvatarIniciales, LoadingState, ErrorBoundary } from "../../components/ui";

// Las 8 secciones se cargan con React.lazy: cada una baja en su propio chunk JS
// on-demand recién al abrirla (#7 de docs/performance_frontends.md). El render
// va envuelto en <Suspense> (fallback LoadingState) + <ErrorBoundary> (más
// abajo, en el <main>). Antes eran imports estáticos → todo el panel viajaba en
// el bundle inicial aunque el usuario estuviera en el login/operativo.
const SeccionInicio    = lazy(() => import("./sections/SeccionInicio"));
const SeccionCaja      = lazy(() => import("./sections/SeccionCaja"));
const SeccionPlanillas = lazy(() => import("./sections/SeccionPlanillas"));
const SeccionGastos    = lazy(() => import("./sections/SeccionGastos"));
const SeccionVentas    = lazy(() => import("./sections/SeccionVentas"));
const SeccionGestion   = lazy(() => import("./sections/SeccionGestion"));
const SeccionBalances  = lazy(() => import("./sections/SeccionBalances.jsx"));
const SeccionTurnero   = lazy(() => import("./sections/SeccionTurnero.jsx"));

// Items del sidebar — cada uno con su ícono Lucide, label y componente.
const SECCIONES = [
  { id: "inicio",    Icon: Home,          label: "Inicio",    componente: SeccionInicio    },
  { id: "caja",      Icon: DollarSign,    label: "Caja",      componente: SeccionCaja      },
  { id: "planillas", Icon: ClipboardList, label: "Planillas", componente: SeccionPlanillas },
  { id: "balances",  Icon: BarChart3,     label: "Balances",  componente: SeccionBalances  },
  { id: "ventas",    Icon: ShoppingBag,   label: "Ventas",    componente: SeccionVentas    },
  { id: "gastos",    Icon: Receipt,       label: "Gastos",    componente: SeccionGastos    },
  { id: "turnero",   Icon: Calendar,      label: "Turnero",   componente: SeccionTurnero   },
  { id: "gestion",   Icon: Settings,      label: "Gestión",   componente: SeccionGestion   },
];

// Ids de las secciones visibles en modo barbero (vista reducida): solo su
// Planilla y su Turnero. Se filtra sobre SECCIONES en vez de redefinir la lista,
// así el orden y la config de cada ítem quedan en un único lugar (SECCIONES).
const SECCIONES_BARBERO = ['planillas', 'turnero'];

/**
 * BannerAviso
 * Banner amarillo al tope del área de contenido cuando hay aviso de pago pendiente.
 * @param {Function} props.onCerrar - callback para descartarlo.
 */
const BannerAviso = ({ onCerrar }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: theme.warningSoft,
    borderBottom: `1px solid ${theme.warning}`,
    padding: '10px 16px',
    flexShrink: 0,
    fontFamily: theme.body,
  }}>
    <AlertTriangle size={18} color={theme.warning} aria-hidden="true" style={{ flexShrink: 0 }} />
    <p style={{
      flex: 1,
      margin: 0,
      fontSize: theme.sizeBody,
      color: theme.warning,
      lineHeight: 1.5,
    }}>
      Tu suscripción aún no fue renovada este mes. Regularizá el pago antes del día 10 para evitar la suspensión del acceso. <strong>WhatsApp: 11 3311-1686</strong>
    </p>
    <button
      type="button"
      onClick={onCerrar}
      aria-label="Cerrar aviso"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: theme.warning,
        padding: 4,
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <X size={16} />
    </button>
  </div>
);

/**
 * NavItem
 * Item individual del sidebar. Hover/active manejados con useState (patrón
 * del sistema de diseño §4.2). Para 8 ítems el re-render por hover es trivial.
 * @param {React.ComponentType} props.Icon - Componente de ícono Lucide.
 * @param {string} props.label
 * @param {boolean} props.activo - Si esta sección es la activa actualmente.
 * @param {boolean} props.colapsado - Si el sidebar está colapsado (oculta label).
 * @param {Function} props.onClick
 */
function NavItem({ Icon, label, activo, colapsado, onClick }) {
  const [hover, setHover] = useState(false);

  const background = activo
    ? theme.accentSoft
    : (hover ? theme.surfaceAlt : 'transparent');
  const color = activo ? theme.accent : theme.inkSoft;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={colapsado ? label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: colapsado ? '10px 0' : '10px 16px 10px 20px',
        margin: '0 8px',
        width: 'calc(100% - 16px)',
        border: 'none',
        background,
        color,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: activo ? theme.weightMedium : theme.weightRegular,
        cursor: 'pointer',
        borderRadius: theme.radius,
        transition: `background ${theme.transitionFast}, color ${theme.transitionFast}`,
        justifyContent: colapsado ? 'center' : 'flex-start',
        textAlign: 'left',
      }}
    >
      {/* Indicador lateral indigo, solo en estado activo y sidebar expandido */}
      {activo && !colapsado && (
        <span style={{
          position: 'absolute',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 18,
          background: theme.accent,
          borderRadius: '0 3px 3px 0',
        }} />
      )}
      <Icon size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      {!colapsado && <span>{label}</span>}
    </button>
  );
}

/**
 * BotonToggleSidebar
 * Botón en el header del sidebar que expande/colapsa. Cuando está expandido,
 * muestra chevron izquierdo + nombre del negocio en estilo eyebrow.
 * Cuando está colapsado, solo el chevron derecho centrado.
 */
function BotonToggleSidebar({ colapsado, onToggle, nombreNegocio }) {
  const [hover, setHover] = useState(false);

  if (colapsado) {
    return (
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Expandir menú"
        title="Expandir menú"
        style={{
          width: '100%',
          padding: '12px 0',
          background: hover ? theme.surfaceAlt : 'transparent',
          border: 'none',
          color: theme.muted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: `background ${theme.transitionFast}`,
        }}
      >
        <ChevronRight size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Colapsar menú"
      title="Colapsar menú"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        margin: '0 8px',
        width: 'calc(100% - 16px)',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: theme.radius,
        transition: `background ${theme.transitionFast}`,
        fontFamily: theme.body,
      }}
    >
      <ChevronLeft size={16} color={theme.muted} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.ink,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {nombreNegocio || 'Panel'}
      </span>
    </button>
  );
}

/**
 * IdentidadBarbero
 * Bloque de identidad del barbero logueado, anclado en el footer del sidebar
 * (junto a "Cerrar sesión"). Sigue la convención de dashboards: el negocio
 * arriba, la identidad de quien entró abajo. Solo se renderiza en modo barbero (D5).
 * Expandido: avatar + nombre + rol; colapsado: solo el avatar centrado (con title).
 * @param {string} props.nombre - Nombre del barbero (para iniciales y tono del avatar).
 * @param {boolean} props.colapsado - Si el sidebar está colapsado (muestra solo el avatar).
 */
function IdentidadBarbero({ nombre, colapsado }) {
  if (colapsado) {
    return (
      <div
        title={nombre}
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
        }}
      >
        <AvatarIniciales nombre={nombre} size={32} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 16px 8px 20px',
      margin: '0 8px',
    }}>
      <AvatarIniciales nombre={nombre} size={32} />
      {/* minWidth:0 permite que el ellipsis del nombre funcione dentro del flex */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {nombre}
        </span>
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.muted,
        }}>
          Barbero
        </span>
      </div>
    </div>
  );
}

/**
 * PanelAdmin
 * Shell del panel de administración. Sidebar claro + área de contenido.
 */
export default function PanelAdmin({ onCerrarSesion, avisosPago, nombreNegocio, rol = 'admin', barberoSesion }) {
  const esBarbero = rol === 'barbero';

  // Secciones visibles según rol: el barbero ve la vista reducida (su Planilla y
  // su Turnero); el admin ve las 8. Se deriva de SECCIONES sin mutarla.
  const seccionesVisibles = esBarbero
    ? SECCIONES.filter((s) => SECCIONES_BARBERO.includes(s.id))
    : SECCIONES;

  // Aterrizaje: el barbero cae en Turnero (D3, lo más accionable al llegar); el
  // admin en Inicio. rol es fijo durante la vida del componente (se remonta en
  // cada login/cierre de sesión), así que sirve como valor inicial del estado.
  const [seccionActiva, setSeccionActiva] = useState(esBarbero ? "turnero" : "inicio");
  const [mostrarAviso, setMostrarAviso]   = useState(avisosPago);
  const [colapsado, setColapsado]         = useState(false);
  const [hoverLogout, setHoverLogout]     = useState(false);

  const SeccionActual = seccionesVisibles.find((s) => s.id === seccionActiva)?.componente;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'row',
      fontFamily: theme.body,
      background: theme.bg,
      color: theme.ink,
      overflow: 'hidden',
    }}>
      {/* ── SIDEBAR (tema claro) ─────────────────────────────────────────── */}
      <aside style={{
        width: colapsado ? 64 : 220,
        minWidth: colapsado ? 64 : 220,
        height: '100vh',
        background: theme.surface,
        borderRight: `1px solid ${theme.hairline}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: `width ${theme.transitionMedium}, min-width ${theme.transitionMedium}`,
      }}>
        <div style={{ padding: '16px 0 12px' }}>
          <BotonToggleSidebar
            colapsado={colapsado}
            onToggle={() => setColapsado(!colapsado)}
            nombreNegocio={nombreNegocio}
          />
        </div>

        <div style={{
          height: 1,
          background: theme.hairline,
          margin: '0 12px 12px',
        }} />

        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {seccionesVisibles.map((s) => (
            <NavItem
              key={s.id}
              Icon={s.Icon}
              label={s.label}
              activo={seccionActiva === s.id}
              colapsado={colapsado}
              onClick={() => setSeccionActiva(s.id)}
            />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{
          height: 1,
          background: theme.hairline,
          margin: '12px',
        }} />

        {/* Identidad de quien entró (D5): solo en modo barbero, sobre el logout. */}
        {esBarbero && barberoSesion && (
          <IdentidadBarbero nombre={barberoSesion.nombre} colapsado={colapsado} />
        )}

        {/* Footer: cerrar sesión */}
        <div style={{ padding: '0 0 12px' }}>
          <button
            type="button"
            onClick={onCerrarSesion}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            title={colapsado ? "Cerrar sesión" : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: colapsado ? '10px 0' : '10px 16px 10px 20px',
              margin: '0 8px',
              width: 'calc(100% - 16px)',
              border: 'none',
              background: hoverLogout ? theme.surfaceAlt : 'transparent',
              color: theme.inkSoft,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightRegular,
              cursor: 'pointer',
              borderRadius: theme.radius,
              justifyContent: colapsado ? 'center' : 'flex-start',
              textAlign: 'left',
              transition: `background ${theme.transitionFast}`,
            }}
          >
            <LogOut size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            {!colapsado && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── ÁREA DE CONTENIDO ────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {mostrarAviso && <BannerAviso onCerrar={() => setMostrarAviso(false)} />}
        {/* Fondo `surfaceAlt` (gris suave) para que las cards blancas de las
            secciones tengan contraste y se lea claramente la jerarquía. Regla
            general del admin — las secciones NO deben override su contenedor. */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: theme.surfaceAlt,
        }}>
          {/* key={seccionActiva}: remonta el boundary al cambiar de sección, así
              un error en una sección no "pega" a la siguiente (su estado de error
              se resetea). El <Suspense> muestra LoadingState mientras baja el
              chunk de la sección — idéntico al spinner que la sección usa después
              mientras trae datos, así se ve un solo loader continuo. */}
          {SeccionActual && (
            <ErrorBoundary key={seccionActiva}>
              <Suspense fallback={<LoadingState />}>
                <SeccionActual modoBarbero={esBarbero} barberoSesion={barberoSesion} />
              </Suspense>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
