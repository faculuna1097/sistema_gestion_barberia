// /frontend/src/components/ui/FilaAjuste.jsx
// Fila de una pantalla de ajustes: qué es (rótulo y una línea que lo explica), el
// valor actual y, opcional, la acción para cambiarlo. La usan Gestión → Seguridad
// (credenciales) y Gestión → Negocio → Contacto. Creada el 2026-11-13 (F6 de
// plan_mejoras_operativas.md), con el rediseño de Seguridad.
//
// En pantallas angostas (el panel en el iPad vertical) el valor y la acción bajan
// debajo del rótulo: va con flex-wrap, sin hook de ancho.

import { theme } from '../../theme/tokens.js';

/**
 * FilaAjuste
 * @param {Object} props
 * @param {string} props.label - Qué es (ej. "PIN", "Mail del dueño").
 * @param {React.ReactNode} [props.descripcion] - Una línea que lo explica, en muted.
 * @param {React.ReactNode} props.valor - El valor actual (texto, enmascarado o una pill).
 * @param {React.ReactNode} [props.accion] - Botón para cambiarlo.
 * @param {boolean} [props.primera=false] - Sin la línea de arriba (la primera fila
 *   de un bloque que no tiene encabezado pegado).
 * @returns {JSX.Element}
 */
function FilaAjuste({ label, descripcion, valor, accion, primera = false }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 24,
      rowGap: 8,
      padding: '16px 0',
      borderTop: primera ? 'none' : `1px solid ${theme.hairlineSoft}`,
    }}>
      <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
        }}>
          {label}
        </span>
        {descripcion && (
          <span style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
          }}>
            {descripcion}
          </span>
        )}
      </div>
      <div style={{
        flex: '1 1 200px',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <span style={{
          minWidth: 0,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.ink,
          overflowWrap: 'anywhere',
        }}>
          {valor}
        </span>
        {accion && <span style={{ flexShrink: 0 }}>{accion}</span>}
      </div>
    </div>
  );
}

export default FilaAjuste;
