// /frontend/src/screens/admin/sections/gestion/TabNegocio.jsx
// Tab "Negocio" de SeccionGestion. Contenedor de layout puro: un único bloque
// con divisores que agrupa las 4 secciones del negocio. Desde el 2026-11-13 (F6
// de plan_mejoras_operativas.md) acá se edita el contacto (mail y celular del
// dueño, teléfono del local). El nombre y la URL de reservas siguen
// administrándose directo en la base de datos (cambian muy poco).
//
// Layout: Contacto y Horario de atención como franjas full-width arriba, y
// debajo dos columnas — Feriados | Imágenes — separadas por un divisor. Cada
// bloque se autocarga; TabNegocio solo aporta el contenedor y los divisores.

import { theme } from '../../../../theme/tokens.js';

import BloqueContacto from './BloqueContacto';
import BloqueHorarioAtencion from './BloqueHorarioAtencion';
import BloqueFeriados from './BloqueFeriados';
import BloqueImagenes from './BloqueImagenes';

/**
 * TabNegocio
 * Monta las 4 secciones del negocio (contacto, horario, feriados, imágenes) dentro de un
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
      {/* Franja superior: contacto del dueño y del local (full-width) */}
      <div style={{ padding: 20, borderBottom: hairline }}>
        <BloqueContacto />
      </div>

      {/* Horario de atención (full-width) */}
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
