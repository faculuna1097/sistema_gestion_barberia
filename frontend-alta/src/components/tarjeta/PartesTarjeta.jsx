// /frontend-alta/src/components/tarjeta/PartesTarjeta.jsx
// Piezas de la tarjeta "Tu barbería" que comparten sus dos formas: la que
// crece arriba del formulario (TarjetaBarberia) y la completa de la Revisión y
// "Ya enviada" (BloquesTarjeta). Salieron de TarjetaBarberia.jsx en la fase 5,
// al tener un segundo uso.

import { theme } from '../../theme/tokens.js';
import { gruposPorRango, leerHorarioLocal } from '../../utils/horarioLocal.js';
import { resumirDias } from '../../utils/semana.js';
import { fmtRango } from '../../utils/horas.js';
import { estiloSoloLector } from '../ui/estilos.js';

/**
 * Crece
 * Envuelve algo que puede aparecer después de montada la tarjeta: si no
 * estaba al montarla, entra creciendo (al-crecer, index.css).
 * @param {boolean} props.animar - Si entra creciendo
 * @param {ReactNode} props.children
 * @returns {JSX.Element}
 */
export function Crece({ animar, children }) {
  if (!animar) return children;
  return (
    <div className="al-crecer">
      <div>{children}</div>
    </div>
  );
}

/**
 * Renglon
 * Un dato de la tarjeta: ícono y texto. Vacío, muestra `placeholder` en gris.
 * @param {ReactNode} props.icono - Ícono de 16 (decorativo)
 * @param {string} props.etiqueta - Qué dato es, para el lector ("Dirección")
 * @param {ReactNode} [props.children] - El valor; si no hay, va el placeholder
 * @param {string} props.placeholder
 * @returns {JSX.Element}
 */
export function Renglon({ icono, etiqueta, children, placeholder }) {
  const vacio = !children;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', paddingTop: 2, color: theme.muted, flexShrink: 0 }}>
        {icono}
      </span>
      <div style={{
        flex: 1,
        minWidth: 0,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: 1.45,
        color: vacio ? theme.muted : theme.ink,
        overflowWrap: 'anywhere',
      }}>
        <span style={estiloSoloLector}>{`${etiqueta}: `}</span>
        {vacio ? placeholder : children}
      </div>
    </div>
  );
}

/**
 * TextoHorario
 * El horario resumido: una línea por grupo de días con el mismo rango
 * ("Lun a vie · 10:00 a 20:00", "Sáb · 10:00 a 18:00") y la pausa, si hay.
 * @param {Object} props.datos
 * @returns {JSX.Element|null} null si no abre ningún día.
 */
export function TextoHorario({ datos }) {
  const grupos = gruposPorRango(datos);
  if (grupos.length === 0) return null;
  const { pausa } = leerHorarioLocal(datos);
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      {grupos.map((g) => (
        <span key={g.dias.join('-')}>
          {`${resumirDias(g.dias)} · ${fmtRango(g.rango)}`}
        </span>
      ))}
      {pausa && <span style={{ color: theme.muted }}>{`Cierran de ${fmtRango(pausa)}`}</span>}
    </span>
  );
}
