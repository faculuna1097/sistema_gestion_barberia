// /frontend-alta/src/components/TarjetaBarberia.jsx
// La tarjeta "Tu barbería", que crece con cada respuesta (plan §5.2). Hoy
// muestra lo mínimo: el nombre (con su avatar) y el link elegido. Las fases 3 a
// 5 le suman el horario, el equipo, los servicios y el contacto, y la Revisión
// la muestra completa con "Editar" por bloque.
// Vive en components/ y no en ui/: es del dominio del formulario, y la usan el
// formulario, la pantalla de "Ya enviada" y (fase 5) la Revisión.

import { theme } from '../theme/tokens.js';
import { AvatarIniciales } from './ui';

// Dominio de los links de las barberías.
const DOMINIO = 'barbermanager.app';

/**
 * TarjetaBarberia
 * @param {Object} props.datos - El formulario completo (utils/datosSolicitud.js)
 * @returns {JSX.Element}
 */
function TarjetaBarberia({ datos }) {
  const nombre = datos?.local?.nombre?.trim() ?? '';
  const subdominio = datos?.local?.subdominio?.trim() ?? '';

  return (
    <section
      aria-label="Tu barbería"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
      }}
    >
      {nombre ? (
        <AvatarIniciales nombre={nombre} size={40} />
      ) : (
        // Sin nombre todavía: el lugar del avatar, vacío.
        <div aria-hidden="true" style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 999,
          border: `1px dashed ${theme.mutedSoft}`,
        }} />
      )}

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightHeading,
          color: nombre ? theme.ink : theme.muted,
          overflowWrap: 'anywhere',
        }}>
          {nombre || 'Tu barbería'}
        </p>
        <p style={{
          fontFamily: subdominio ? theme.mono : theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          overflowWrap: 'anywhere',
        }}>
          {subdominio ? `${subdominio}.${DOMINIO}` : 'Se arma con tus respuestas.'}
        </p>
      </div>
    </section>
  );
}

export default TarjetaBarberia;
