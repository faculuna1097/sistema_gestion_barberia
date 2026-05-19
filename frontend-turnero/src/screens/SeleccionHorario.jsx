// /frontend-turnero/src/screens/SeleccionHorario.jsx
// Pantalla 5: el cliente elige un slot disponible para el día seleccionado.

import { useState, useEffect, useMemo } from 'react';
import { getDisponibilidad } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtFechaLarga } from '../utils/fecha.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Skeleton, EmptyState, SlotChip,
} from '../components/ui';

// Cortes horarios para agrupar slots por turno del día (convención AR).
const CORTE_MANANA = 13; // 06:00-12:59 = mañana
const CORTE_TARDE  = 20; // 13:00-19:59 = tarde, ≥ 20:00 = noche

/**
 * SeleccionHorario
 * Carga los slots disponibles para (barbero, servicio, fecha) y los muestra agrupados.
 * @param {Object} props.barbero - { id, nombre }
 * @param {Object} props.servicio - { id, nombre, duracion_minutos, precio }
 * @param {string} props.fecha - 'YYYY-MM-DD'
 * @param {string|null} props.seleccionado - ISO del slot previamente elegido
 * @param {Function} props.onSeleccionar - Callback con el ISO del slot elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionHorario({ barbero, servicio, fecha, seleccionado, onSeleccionar, onVolver }) {
  const [slots, setSlots] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const data = await getDisponibilidad(barbero.id, servicio.id, fecha);
        setSlots(data.slots);
        console.log('[SeleccionHorario] slots cargados |', data.slots.length);
      } catch (err) {
        console.error('[SeleccionHorario] Error:', err.message);
        setError('No pudimos cargar los horarios. Probá de nuevo.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [barbero.id, servicio.id, fecha]);

  // Agrupación memoizada: mañana / tarde / noche según hora local.
  const grupos = useMemo(() => agruparPorTurno(slots), [slots]);

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow={`Paso 4 de 6 · ${fmtFechaLarga(fecha)}`}
        title="Elegí un horario"
        subtitle={`${barbero.nombre} · ${servicio.duracion_minutos} min`}
      />
      <Progress step={4}/>

      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        {cargando ? (
          <SlotSkeletons/>
        ) : error ? (
          <EmptyState
            glyph={<IconoAlerta/>}
            title="Algo no funcionó"
            body={error}
          />
        ) : slots.length === 0 ? (
          <EmptyState
            glyph={<IconoReloj/>}
            title="Sin horarios libres"
            body="No hay disponibilidad para este día. Probá otra fecha o cambiá de barbero."
          />
        ) : (
          <SlotGrupos
            grupos={grupos}
            seleccionado={seleccionado}
            onSeleccionar={onSeleccionar}
          />
        )}
      </div>
    </PageContainer>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * agruparPorTurno
 * Reparte slots ISO en mañana / tarde / noche según hora local.
 * @param {Array<string>} slots - Array de ISO timestamps
 * @returns {{manana: Array, tarde: Array, noche: Array}}
 */
function agruparPorTurno(slots) {
  const manana = [], tarde = [], noche = [];
  for (const s of slots) {
    const h = new Date(s).getHours();
    if (h < CORTE_MANANA) manana.push(s);
    else if (h < CORTE_TARDE) tarde.push(s);
    else noche.push(s);
  }
  return { manana, tarde, noche };
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * SlotGrupos
 * Renderiza los 3 grupos (mañana/tarde/noche). Oculta los vacíos.
 */
function SlotGrupos({ grupos, seleccionado, onSeleccionar }) {
  const secciones = [
    { key: 'manana', label: 'Mañana' },
    { key: 'tarde',  label: 'Tarde'  },
    { key: 'noche',  label: 'Noche'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {secciones.map(s => grupos[s.key].length > 0 && (
        <div key={s.key}>
          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
            marginBottom: 8,
          }}>{s.label}</div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {grupos[s.key].map(iso => (
              <SlotChip
                key={iso}
                iso={iso}
                selected={iso === seleccionado}
                onClick={() => onSeleccionar(iso)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SlotSkeletons
 * Placeholder mientras carga. 3 secciones × 6 chips.
 */
function SlotSkeletons() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[0, 1, 2].map(g => (
        <div key={g}>
          <Skeleton height={10} width={50} style={{ marginBottom: 8 }}/>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} height={40}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * IconoAlerta
 * SVG para EmptyState de error de carga.
 */
function IconoAlerta() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="15.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}

/**
 * IconoReloj
 * SVG para EmptyState de "sin horarios".
 */
function IconoReloj() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default SeleccionHorario;
