// /frontend-alta/src/screens/PantallaPlaceholder.jsx
// Contenido provisorio de las pantallas 0 a 14 (fase 2, esqueleto): dice qué va
// a tener cada una. Las fases 3 a 5 lo reemplazan por el contenido de verdad.
// La pantalla del nombre ya trae su campo, para probar el guardado y la tarjeta.

import { theme } from '../theme/tokens.js';
import { PANTALLA } from '../config/pantallas.js';
import { LARGO_NOMBRE_NEGOCIO } from '../utils/validaciones.js';
import { Field } from '../components/ui';

/**
 * PantallaPlaceholder
 * @param {Object} props.pantalla - Entrada de PANTALLAS (config/pantallas.js)
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - (datosActuales) => datosNuevos, del hook useSolicitud
 * @returns {JSX.Element}
 */
function PantallaPlaceholder({ pantalla, datos, actualizar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {pantalla.numero === PANTALLA.NOMBRE && (
        <Field
          label="Nombre de la barbería"
          value={datos.local.nombre}
          onChange={(nombre) => actualizar((d) => ({ ...d, local: { ...d.local, nombre } }))}
          name="organization"
          autoComplete="organization"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={LARGO_NOMBRE_NEGOCIO.max}
        />
      )}

      <p style={{
        padding: 16,
        border: `1px dashed ${theme.hairline}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
      }}>
        {`En construcción. ${pantalla.contenido}`}
      </p>
    </div>
  );
}

export default PantallaPlaceholder;
