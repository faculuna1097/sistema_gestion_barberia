// /frontend-turnero/src/screens/SeleccionFecha.jsx
// Pantalla 4: el cliente elige una fecha — calendario 7× con los próximos DIAS_RESERVABLES días.
// Los días sin disponibilidad para el (barbero, servicio) elegido se grisan;
// la disponibilidad la calcula el backend (GET /api/turnero/dias-disponibles).

import { useState, useEffect } from 'react';
import { generarProximosDias, DIAS_RESERVABLES } from '../utils/fecha.js';
import { getDiasDisponibles } from '../services/api.js';
import { useEleccionConPausa } from '../hooks/useEleccionConPausa.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress, MiniCalendario,
  EmptyState, Button, IconoAlerta,
} from '../components/ui';

/**
 * SeleccionFecha
 * Muestra un mini-calendario 7× con los próximos DIAS_RESERVABLES días, grisando
 * los que no tienen turnos disponibles para el barbero y servicio elegidos.
 * @param {Object} props.barbero - Barbero elegido ({ id, ... })
 * @param {Object} props.servicio - Servicio elegido ({ id, ... })
 * @param {string|null} props.seleccionada - Fecha previamente seleccionada (YYYY-MM-DD)
 * @param {Function} props.onSeleccionar - Callback con la fecha elegida (tras la pausa de confirmación)
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionFecha({ barbero, servicio, seleccionada, onSeleccionar, onVolver }) {
  // Lista de días visible — estable durante la vida del componente.
  const [dias] = useState(() => generarProximosDias(DIAS_RESERVABLES));

  // El día tocado se marca ~150 ms antes de avanzar.
  const [elegida, elegir] = useEleccionConPausa(onSeleccionar);

  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  // Contador para reintentar la carga sin recargar la pantalla entera.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      setError(false);
      try {
        const { dias: disponibles } = await getDiasDisponibles(
          barbero.id, servicio.id, dias[0], dias[dias.length - 1],
        );
        if (!cancelado) setDiasDisponibles(disponibles);
      } catch (err) {
        console.error('[SeleccionFecha] Error cargando días disponibles:', err.message);
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargar();
    return () => { cancelado = true; };
  }, [barbero.id, servicio.id, dias, intento]);

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow="Paso 3 de 6"
        title="Elegí una fecha"
        subtitle={`Próximos ${DIAS_RESERVABLES} días.`}
      />
      <Progress step={3}/>

      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        {error ? (
          <EmptyState
            glyph={<IconoAlerta/>}
            title="No pudimos cargar las fechas"
            body="Revisá tu conexión e intentá de nuevo."
            action={
              <Button variant="secondary" onClick={() => setIntento(n => n + 1)} full={false}>
                Reintentar
              </Button>
            }
          />
        ) : (
          <MiniCalendario
            dias={dias}
            diasDisponibles={diasDisponibles}
            cargando={cargando}
            seleccionada={elegida ?? seleccionada}
            onSeleccionar={elegir}
          />
        )}
      </div>
    </PageContainer>
  );
}

export default SeleccionFecha;
