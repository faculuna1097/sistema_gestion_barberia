// /frontend/src/components/SelectorPeriodo.jsx

// Componente base de selector de período. Renderiza el patrón visual
// [◀] [label] [▶] que comparten SelectorMes, SelectorSemana y SelectorDia.
//
// No tiene lógica de fechas. Recibe el label ya formateado, los handlers
// de anterior/siguiente y un flag para deshabilitar el botón ▶.
//
// Prop opcional `badge`: si se pasa, se muestra un pequeño chip debajo del
// label (usado por SelectorSemana para "Esta semana" y SelectorDia para "HOY").

/**
 * @param {object} props
 * @param {string}   props.label                     - Texto central ya formateado
 * @param {() => void} props.onAnterior              - Click del botón ◀
 * @param {() => void} props.onSiguiente             - Click del botón ▶
 * @param {boolean}  [props.siguienteDeshabilitado]  - Si true, deshabilita ▶
 * @param {{ texto: string, destacado?: boolean }} [props.badge]
 *                                                   - Chip opcional debajo del label
 * @param {number}   [props.minWidth=160]            - Ancho mínimo del label en px
 * @param {number}   [props.fontSize=17]             - Tamaño de fuente del label en px
 * @param {boolean}  [props.labelDestacado]          - Si true, label en color primario
 */
export default function SelectorPeriodo({
  label,
  onAnterior,
  onSiguiente,
  siguienteDeshabilitado = false,
  badge = null,
  minWidth = 160,
  fontSize = 17,
  labelDestacado = false,
}) {
  return (
    <div style={styles.contenedor}>
      <button
        style={styles.boton}
        onPointerDown={onAnterior}
        aria-label="Anterior"
      >
        ‹
      </button>

      <div style={styles.labelWrapper}>
        <span
          style={{
            ...styles.label,
            minWidth: `${minWidth}px`,
            fontSize: `${fontSize}px`,
            color: labelDestacado ? '#1a7a4a' : '#111111',
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              ...styles.badge,
              ...(badge.destacado ? styles.badgeDestacado : styles.badgeNeutro),
            }}
          >
            {badge.texto}
          </span>
        )}
      </div>

      <button
        style={{
          ...styles.boton,
          ...(siguienteDeshabilitado ? styles.botonDeshabilitado : {}),
        }}
        onPointerDown={() => { if (!siguienteDeshabilitado) onSiguiente(); }}
        disabled={siguienteDeshabilitado}
        aria-label="Siguiente"
      >
        ›
      </button>
    </div>
  );
}

const styles = {
  contenedor: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  boton: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    borderWidth: '1.5px',          // ← longhand
    borderStyle: 'solid',          // ← longhand
    borderColor: '#e0e0e0',        // ← longhand
    backgroundColor: '#ffffff',
    fontSize: '20px',
    color: '#333333',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  botonDeshabilitado: {
    color: '#cccccc',
    cursor: 'not-allowed',
    borderColor: '#f0f0f0',        // ← solo cambia el color, no el resto
  },
  labelWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  badgeDestacado: {
    color: '#1a7a4a',
    backgroundColor: '#c8ead8',
  },
  badgeNeutro: {
    color: '#888888',
    backgroundColor: '#f0f0f0',
  },
};