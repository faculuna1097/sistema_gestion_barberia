// /frontend-turnero/src/screens/SeleccionFecha.jsx
// Pantalla 4: el cliente elige una fecha — calendario 7× con próximos 14 días.

import { generarProximosDias } from '../utils/fecha.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress, MiniCalendario,
} from '../components/ui';

// Cuántos días hacia adelante mostramos en el calendario.
const DIAS_VISIBLES = 15;

/**
 * SeleccionFecha
 * Muestra un mini-calendario 7× con los próximos DIAS_VISIBLES días.
 * @param {Object} props.tenant - Datos del tenant (horario_atencion, feriados)
 * @param {string|null} props.seleccionada - Fecha previamente seleccionada (YYYY-MM-DD)
 * @param {Function} props.onSeleccionar - Callback con la fecha elegida
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionFecha({ tenant, seleccionada, onSeleccionar, onVolver }) {
  const dias = generarProximosDias(DIAS_VISIBLES);

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow="Paso 3 de 6"
        title="Elegí una fecha"
        subtitle={`Próximos ${DIAS_VISIBLES} días.`}
      />
      <Progress step={3}/>

      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        <MiniCalendario
          dias={dias}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          horarioAtencion={tenant.horario_atencion}
          feriados={tenant.feriados}
        />
      </div>
    </PageContainer>
  );
}

export default SeleccionFecha;
