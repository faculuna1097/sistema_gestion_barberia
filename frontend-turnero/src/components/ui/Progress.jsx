// /frontend-turnero/src/components/ui/Progress.jsx
// Progreso del flujo de reserva: barra fina de 3 tramos (Servicio, Cuándo, Datos).

import { theme } from '../../theme/tokens.js';

// Pasos del flujo de reserva, en orden. El éxito no es un paso: ahí ya no hay barra.
const PASOS = ['Servicio', 'Cuándo', 'Datos'];

/**
 * Progress
 * Barra de tramos: se llenan los pasos hasta el actual, incluido. Un paso
 * salteado (ej. entrar a "¿Cuándo?" con el servicio elegido en la landing) se
 * ve completo igual, porque es anterior al actual.
 * Para lectores de pantalla es una barra de progreso con el texto del paso
 * ("Paso 2 de 3: Cuándo"); los tramos son decorativos.
 * @param {number} props.paso - Paso actual (1-based): 1 Servicio, 2 Cuándo, 3 Datos
 */
function Progress({ paso }) {
  if (paso < 1 || paso > PASOS.length) return null;

  return (
    <div
      role="progressbar"
      aria-label="Progreso de la reserva"
      aria-valuemin={1}
      aria-valuemax={PASOS.length}
      aria-valuenow={paso}
      aria-valuetext={`Paso ${paso} de ${PASOS.length}: ${PASOS[paso - 1]}`}
      style={{
        display: 'flex',
        gap: 4,
        padding: '4px 16px 12px',
      }}
    >
      {PASOS.map((nombre, i) => (
        <span
          key={nombre}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 999,
            background: i < paso ? theme.accent : theme.hairline,
          }}
        />
      ))}
    </div>
  );
}

export default Progress;
