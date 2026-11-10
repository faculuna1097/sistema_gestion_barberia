// /frontend-alta/src/components/formulario/IndicadorGuardado.jsx
// Estado del guardado automático, discreto, arriba a la derecha: "Guardando…"
// o "Guardado" (plan §5.2). El error no va acá: lo muestra AvisoSinGuardar,
// en un renglón propio y con el botón de reintento.
// Local de Formulario (sistema_de_disenio.md §7.1).

import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { ESTADOS_GUARDADO } from '../../utils/autoguardado.js';

/**
 * IndicadorGuardado
 * Texto chico con el estado del guardado. Es una región `aria-live` que existe
 * siempre, así el lector de pantalla anuncia los cambios. Antes del primer
 * cambio (INACTIVO) y con error, queda vacío.
 * @param {string} props.estado - Uno de ESTADOS_GUARDADO
 * @returns {JSX.Element}
 */
function IndicadorGuardado({ estado }) {
  let contenido = null;
  if (estado === ESTADOS_GUARDADO.GUARDANDO) contenido = 'Guardando…';
  if (estado === ESTADOS_GUARDADO.GUARDADO) {
    contenido = (
      <>
        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
        Guardado
      </>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        minHeight: 20,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        whiteSpace: 'nowrap',
      }}
    >
      {contenido}
    </p>
  );
}

export default IndicadorGuardado;
