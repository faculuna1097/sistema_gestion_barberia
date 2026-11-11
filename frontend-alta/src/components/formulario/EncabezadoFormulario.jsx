// /frontend-alta/src/components/formulario/EncabezadoFormulario.jsx
// Encabezado fijo de las pantallas del formulario: "Volver", el capítulo y el
// estado del guardado, y debajo el aviso si un guardado falló. No entra con la
// transición de pantalla: queda quieto mientras cambia el contenido.
// Local de Formulario (sistema_de_disenio.md §7.1).

import { ChevronLeft } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { ESTADOS_GUARDADO } from '../../utils/autoguardado.js';
import { useHover } from '../../hooks/useHover.js';
import IndicadorCapitulos from './IndicadorCapitulos.jsx';
import IndicadorGuardado from './IndicadorGuardado.jsx';
import AvisoSinGuardar from './AvisoSinGuardar.jsx';

/**
 * BotonVolver
 * Flecha de 44 × 44 que vuelve una pantalla (el mismo camino que el "atrás"
 * del navegador).
 * @param {Function} props.onClick
 * @returns {JSX.Element}
 */
function BotonVolver({ onClick }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-label="Volver"
      className="al-presionable"
      style={{
        width: 44,
        height: 44,
        marginLeft: -12,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        color: theme.ink,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

/**
 * EncabezadoFormulario
 * @param {number} props.pantalla - Número de la pantalla actual
 * @param {Function|null} props.onVolver - Vuelve una pantalla; null en la primera (sin flecha)
 * @param {string} props.guardado - Uno de ESTADOS_GUARDADO
 * @param {Function} props.onReintentar - Reintenta el guardado (aviso de error)
 * @param {Function} [props.enfocarTitulo] - Lleva el foco al título de la
 *   pantalla (cuando el aviso de error desaparece con el foco adentro)
 * @returns {JSX.Element}
 */
function EncabezadoFormulario({ pantalla, onVolver, guardado, onReintentar, enfocarTitulo }) {
  return (
    <header style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
        {onVolver && <BotonVolver onClick={onVolver} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <IndicadorCapitulos pantalla={pantalla} />
        </div>
        <IndicadorGuardado estado={guardado} />
      </div>
      {guardado === ESTADOS_GUARDADO.ERROR && <AvisoSinGuardar onReintentar={onReintentar} alSalirConFoco={enfocarTitulo} />}
    </header>
  );
}

export default EncabezadoFormulario;
