// /frontend-turnero/src/screens/SeleccionServicio.jsx
// Pantalla 2: el cliente elige un servicio de la lista.

import { useState, useEffect } from 'react';
import { getServicios } from '../services/api.js';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Card, Skeleton, EmptyState,
} from '../components/ui';

/**
 * SeleccionServicio
 * Carga y muestra los servicios activos del tenant.
 * @param {Object|null} props.seleccionado - Servicio previamente seleccionado (para volver)
 * @param {Function} props.onSeleccionar - Callback con el servicio elegido
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionServicio({ seleccionado, onSeleccionar, onVolver }) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getServicios();
        setServicios(data);
      } catch (err) {
        console.error('[SeleccionServicio] Error:', err.message);
        setError('No pudimos cargar los servicios. Probá de nuevo en unos minutos.');
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
        eyebrow="Paso 1 de 6"
        title="Elegí un servicio"
        subtitle="Cuánto demora y cuánto sale."
      />
      <Progress step={1}/>

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {cargando ? (
          <ServicioSkeletons />
        ) : error ? (
          <EmptyState
            glyph={<IconoAlerta/>}
            title="Algo no funcionó"
            body={error}
          />
        ) : servicios.length === 0 ? (
          <EmptyState
            glyph={<IconoTijera/>}
            title="Sin servicios disponibles"
            body="El negocio todavía no cargó servicios. Volvé a intentar más tarde."
          />
        ) : (
          servicios.map(s => (
            <ServicioCard
              key={s.id}
              servicio={s}
              selected={seleccionado?.id === s.id}
              onClick={() => onSeleccionar(s)}
            />
          ))
        )}
      </div>
    </PageContainer>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * ServicioCard
 * Card de un servicio individual.
 * @param {Object} props.servicio - { nombre, precio, duracion_minutos }
 * @param {boolean} props.selected
 * @param {Function} props.onClick
 */
function ServicioCard({ servicio, selected, onClick }) {
  return (
    <Card selected={selected} onClick={onClick}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}>{servicio.nombre}</div>

          <div style={{
            fontFamily: theme.mono,
            fontWeight: theme.weightMedium,
            fontSize: theme.sizeMicro,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.muted,
            marginTop: 4,
          }}>
            {servicio.duracion_minutos} min
          </div>
        </div>

        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightMedium,
          fontSize: 15,
          color: theme.ink,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {fmtPesos(servicio.precio)}
        </div>
      </div>
    </Card>
  );
}

/**
 * ServicioSkeletons
 * Placeholder animado mientras carga la lista. 4 cards skeleton.
 */
function ServicioSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            background: theme.surface,
            border: `1px solid ${theme.hairline}`,
            borderRadius: theme.radius,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={16} width="55%" />
            <Skeleton height={11} width="30%" />
          </div>
          <Skeleton height={15} width={60} />
        </div>
      ))}
    </>
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
 * IconoTijera
 * SVG para EmptyState de "sin servicios".
 */
function IconoTijera() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="17" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8.5 8.5L20 17M8.5 15.5L20 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default SeleccionServicio;
