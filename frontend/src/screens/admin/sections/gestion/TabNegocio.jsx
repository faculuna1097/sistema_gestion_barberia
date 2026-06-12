// /frontend/src/screens/admin/sections/gestion/TabNegocio.jsx
// Tab "Negocio" de SeccionGestion. Contenedor de layout puro: un único bloque
// con divisores que agrupa las 3 secciones del negocio. El nombre y la URL de
// reservas se administran directo en la base de datos (cambian muy poco), por
// eso no hay formulario para esos campos acá.
//
// Layout (opción 1): Horario de atención como franja full-width arriba, y
// debajo dos columnas — Feriados | Imágenes — separadas por un divisor. Cada
// bloque se autocarga; TabNegocio solo aporta el contenedor y los divisores.

import { theme } from '../../../../theme/tokens.js';

import BloqueHorarioAtencion from './BloqueHorarioAtencion';
import BloqueFeriados from './BloqueFeriados';
import BloqueImagenes from './BloqueImagenes';

/**
 * TabNegocio
 * Monta las 3 secciones del negocio (horario, feriados, imágenes) dentro de un
 * único panel dividido. No hace fetch propio.
 *
 * @returns {JSX.Element}
 */
export default function TabNegocio() {
  const hairline = `1px solid ${theme.hairline}`;

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Franja superior: horario de atención (full-width) */}
      <div style={{ padding: 20, borderBottom: hairline }}>
        <BloqueHorarioAtencion />
      </div>

      {/* Fila inferior: feriados | imágenes. Wrap en pantallas angostas. */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0, padding: 20, borderRight: hairline }}>
          <BloqueFeriados />
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0, padding: 20 }}>
          <BloqueImagenes />
        </div>
      </div>
    </div>
  );
}
