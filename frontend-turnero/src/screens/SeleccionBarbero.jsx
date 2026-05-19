// /frontend-turnero/src/screens/SeleccionBarbero.jsx
// Pantalla 3: el cliente elige un barbero.

import { useState, useEffect } from 'react';
import { getBarberos } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Card, Skeleton, EmptyState, AvatarIniciales,
} from '../components/ui';

/**
 * SeleccionBarbero
 * Carga y muestra los barberos activos del tenant.
 * @param {Object|null} props.seleccionado - Barbero previamente seleccionado
 * @param {Function} props.onSeleccionar - Callback con el barbero elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionBarbero({ seleccionado, onSeleccionar, onVolver }) {
  const [barberos, setBarberos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getBarberos();
        setBarberos(data);
        console.log('[SeleccionBarbero] barberos cargados |', data.length);
      } catch (err) {
        console.error('[SeleccionBarbero] Error:', err.message);
        setError('No pudimos cargar los barberos. Probá de nuevo en unos minutos.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <ScreenHeader
        eyebrow="Paso 2 de 6"
        title="Elegí un barbero"
        subtitle="Con quién te vas a atender."
      />
      <Progress step={2}/>

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {cargando ? (
          <BarberoSkeletons/>
        ) : error ? (
          <EmptyState
            glyph={<IconoAlerta/>}
            title="Algo no funcionó"
            body={error}
          />
        ) : barberos.length === 0 ? (
          <EmptyState
            glyph={<IconoPersona/>}
            title="Sin barberos disponibles"
            body="El negocio todavía no cargó barberos. Volvé a intentar más tarde."
          />
        ) : (
          barberos.map(b => (
            <BarberoCard
              key={b.id}
              barbero={b}
              selected={seleccionado?.id === b.id}
              onClick={() => onSeleccionar(b)}
            />
          ))
        )}
      </div>
    </PageContainer>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * BarberoCard
 * Card individual de barbero — avatar de iniciales + nombre + chevron.
 * @param {Object} props.barbero - { id, nombre }
 * @param {boolean} props.selected
 * @param {Function} props.onClick
 */
function BarberoCard({ barbero, selected, onClick }) {
  return (
    <Card selected={selected} onClick={onClick} padding={12}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AvatarIniciales nombre={barbero.nombre} size={40}/>

        <div style={{
          flex: 1,
          minWidth: 0,
          fontFamily: theme.body,
          fontWeight: theme.weightMedium,
          fontSize: theme.sizeBody,
          color: theme.ink,
        }}>
          {barbero.nombre}
        </div>

        <ChevronRight/>
      </div>
    </Card>
  );
}

/**
 * BarberoSkeletons
 * Placeholder mientras carga la lista — 4 cards skeleton.
 */
function BarberoSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            background: theme.surface,
            border: `1px solid ${theme.hairline}`,
            borderRadius: theme.radius,
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Skeleton height={40} width={40} radius={999}/>
          <div style={{ flex: 1 }}>
            <Skeleton height={14} width="50%"/>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * ChevronRight
 * Flecha derecha discreta para indicar que la card es navegable.
 */
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6 3l5 5-5 5" stroke={theme.mutedSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * IconoAlerta
 * SVG para EmptyState de error.
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
 * IconoPersona
 * SVG para EmptyState de "sin barberos".
 */
function IconoPersona() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default SeleccionBarbero;
