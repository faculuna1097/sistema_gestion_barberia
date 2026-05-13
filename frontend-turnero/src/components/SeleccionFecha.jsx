// /frontend-turnero/src/components/SeleccionFecha.jsx
// Pantalla 4: el cliente elige una fecha de los próximos 14 días.

/**
 * generarProximosDias
 * Genera un array de strings YYYY-MM-DD para los próximos N días a partir de hoy.
 * @param {number} cantidad - Cantidad de días a generar
 * @returns {Array<string>} ['2026-05-13', '2026-05-14', ...]
 */
function generarProximosDias(cantidad) {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

/**
 * formatearFecha
 * Convierte YYYY-MM-DD a un formato legible (ej: "Mar 13/05").
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string}
 */
function formatearFecha(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-');
  const date = new Date(Number(anio), Number(mes) - 1, Number(dia));
  const nombreDia = date.toLocaleDateString('es-AR', { weekday: 'short' });
  return `${nombreDia} ${dia}/${mes}`;
}

const DIAS_VISIBLES = 14;

/**
 * SeleccionFecha
 * Muestra una grilla de los próximos 14 días para elegir.
 * @param {string|null} props.seleccionada - Fecha previamente seleccionada
 * @param {Function} props.onSeleccionar - Callback con la fecha elegida (YYYY-MM-DD)
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionFecha({ seleccionada, onSeleccionar, onVolver }) {
  const dias = generarProximosDias(DIAS_VISIBLES);

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Elegí una fecha</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {dias.map(f => (
          <button
            key={f}
            onPointerDown={() => onSeleccionar(f)}
            style={{
              padding: 8,
              border: f === seleccionada ? '2px solid #1a7a4a' : '1px solid #ccc',
              background: f === seleccionada ? '#e6f4ed' : 'white',
            }}
          >
            {formatearFecha(f)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SeleccionFecha;
