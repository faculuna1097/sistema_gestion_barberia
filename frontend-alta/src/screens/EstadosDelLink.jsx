// /frontend-alta/src/screens/EstadosDelLink.jsx
// Las pantallas de cada estado del link que no es el formulario (plan §5.3):
// cargando, link que no existe o venció, solicitud ya enviada y error al
// cargar. Cada una con Skeleton o EmptyState, nunca un texto pelado
// (sistema_de_disenio.md §4.5).

import {
  AlertCircle, CheckCircle2, Link2Off, WifiOff, ServerCrash,
} from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { linkWhatsAppContacto } from '../config/contacto.js';
import { CAUSA_SERVIDOR_CAIDO, mensajeDeError } from '../utils/errores.js';
import {
  PageContainer, EmptyState, Skeleton, Button, IconoWhatsApp,
} from '../components/ui';
import { estiloSoloLector } from '../components/ui/estilos.js';
import TarjetaBarberia from '../components/TarjetaBarberia.jsx';

// Mensajes precargados del chat con Facundo.
const MENSAJE_LINK_NUEVO = 'Hola Facundo, mi link para dar de alta la barbería no funciona. ¿Me mandás uno nuevo?';
const MENSAJE_CAMBIO = 'Hola Facundo, ya mandé los datos de mi barbería y quiero cambiar algo.';

// Tamaño y trazo de los íconos de los EmptyState (sistema_de_disenio.md §3.7).
const ICONO = { size: 24, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * PantallaCentrada (interna)
 * Columna con el contenido centrado en el alto, para los EmptyState.
 * @param {ReactNode} props.children
 * @returns {JSX.Element}
 */
function PantallaCentrada({ children }) {
  return (
    <PageContainer>
      <main className="al-aparecer" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 24,
        padding: '32px 16px calc(32px + env(safe-area-inset-bottom, 0px))',
      }}>
        {children}
      </main>
    </PageContainer>
  );
}

/**
 * CargandoSolicitud
 * La silueta del formulario mientras responde el backend: encabezado con los
 * capítulos, la tarjeta, el título, un campo y el botón de abajo. Sin
 * animación con "reducir movimiento" (el shimmer se apaga en index.css).
 * @returns {JSX.Element}
 */
export function CargandoSolicitud() {
  return (
    <PageContainer>
      <div aria-busy="true" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span role="status" style={estiloSoloLector}>Cargando tu formulario</span>

        <div aria-hidden="true" style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
            <Skeleton width={96} height={14} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={4} radius={999} style={{ flex: 1 }} />)}
          </div>
        </div>

        <div aria-hidden="true" style={{ padding: '16px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 16,
            background: theme.surface, border: `1px solid ${theme.hairline}`, borderRadius: theme.radiusLg,
          }}>
            <Skeleton width={40} height={40} radius={999} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="65%" height={14} />
            </div>
          </div>
        </div>

        <div aria-hidden="true" style={{ flex: 1, padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Skeleton width="80%" height={28} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={120} height={12} />
            <Skeleton height={48} radius={theme.radius} />
          </div>
        </div>

        <div aria-hidden="true" style={{
          padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${theme.hairline}`,
        }}>
          <Skeleton height={44} radius={theme.radius} />
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * LinkNoValido
 * El link no existe, venció o está mal formado (o se abrió sin token): no hay
 * nada que mostrar. Lleva a pedirle uno nuevo a Facundo por WhatsApp.
 * @returns {JSX.Element}
 */
export function LinkNoValido() {
  return (
    <PantallaCentrada>
      <EmptyState
        nivelTitulo={1}
        glyph={<Link2Off {...ICONO} />}
        title="Este link no existe o ya venció"
        body="Pedile un link nuevo a Facundo por WhatsApp. Los links duran 30 días."
        action={(
          <Button href={linkWhatsAppContacto(MENSAJE_LINK_NUEVO)} externo full={false} style={{ padding: '12px 24px' }}>
            <IconoWhatsApp />
            Escribirle a Facundo
          </Button>
        )}
      />
    </PantallaCentrada>
  );
}

/**
 * SolicitudEnviada
 * La solicitud ya se envió (o Facundo ya la cargó): el resumen completo de lo
 * que mandó (la tarjeta "Tu barbería" por bloques), sin edición, y el WhatsApp
 * de Facundo para pedir un cambio. Arranca arriba (no centrada como los otros
 * estados): el resumen es largo y centrado quedaría cortado arriba.
 * @param {Object} props.datos - El formulario como quedó guardado
 * @param {boolean} [props.cargada=false] - true si Facundo ya la dio de alta
 * @returns {JSX.Element}
 */
export function SolicitudEnviada({ datos, cargada = false }) {
  return (
    <PageContainer>
      <main className="al-aparecer" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '16px 16px calc(32px + env(safe-area-inset-bottom, 0px))',
      }}>
        <EmptyState
          nivelTitulo={1}
          tone="success"
          glyph={<CheckCircle2 {...ICONO} />}
          title={cargada ? 'Tu barbería ya está lista' : 'Ya recibimos tus datos'}
          body={cargada
            ? 'Facundo ya la dio de alta. Si necesitás cambiar algo, escribile.'
            : 'Facundo los revisa, arma tu barbería y te manda los accesos por WhatsApp. Desde acá ya no se pueden cambiar.'}
        />
        <TarjetaBarberia datos={datos} completa />
        <Button variant="secondary" href={linkWhatsAppContacto(MENSAJE_CAMBIO)} externo>
          <IconoWhatsApp />
          Escribirle a Facundo
        </Button>
      </main>
    </PageContainer>
  );
}

/**
 * ErrorDeCarga
 * No se pudo cargar la solicitud (sin red, servidor caído, 500, 429). Lo ya
 * cargado está guardado en el backend: se reintenta y sigue donde quedó.
 * @param {Error} props.error - El error de la carga (services/api.js)
 * @param {Function} props.onReintentar - Vuelve a pedir la solicitud
 * @returns {JSX.Element}
 */
export function ErrorDeCarga({ error, onReintentar }) {
  // El ícono dice qué pasó: sin red, el servidor, o una respuesta de error (ej. 429).
  let glyph = <AlertCircle {...ICONO} />;
  if (error?.causa === CAUSA_SERVIDOR_CAIDO || (error?.status ?? 0) >= 500) glyph = <ServerCrash {...ICONO} />;
  else if (!error?.status) glyph = <WifiOff {...ICONO} />;
  return (
    <PantallaCentrada>
      <EmptyState
        nivelTitulo={1}
        tone="warning"
        glyph={glyph}
        title="No pudimos cargar tu formulario"
        body={`${mensajeDeError(error)} Lo que ya cargaste está guardado.`}
        action={(
          <Button onClick={onReintentar} full={false} style={{ padding: '12px 24px' }}>
            Reintentar
          </Button>
        )}
      />
    </PantallaCentrada>
  );
}
