// /frontend/src/components/ui/PillSinConfigurar.jsx
// Marca de "dato vacío" en una fila de ajustes: una pill en tono warning, más
// declarativa que un texto rojo. Vivía local en TabSeguridad; se centralizó el
// 2026-11-13 cuando la usó también el contacto del dueño (BloqueContacto).

import { theme } from '../../theme/tokens.js';

/**
 * PillSinConfigurar
 * Pill warning para un dato que todavía no se cargó.
 * @param {Object} props
 * @param {string} [props.texto='Sin configurar'] - Ej. "Sin cargar".
 * @returns {JSX.Element}
 */
function PillSinConfigurar({ texto = 'Sin configurar' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      background: theme.warningSoft,
      color: theme.warning,
    }}>
      {texto}
    </span>
  );
}

export default PillSinConfigurar;
