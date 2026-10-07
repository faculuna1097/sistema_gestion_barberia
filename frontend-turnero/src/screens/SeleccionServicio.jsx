// /frontend-turnero/src/screens/SeleccionServicio.jsx
// Pantalla 2: el cliente elige un servicio de la lista.

import { useState } from 'react';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { useEleccionConPausa } from '../hooks/useEleccionConPausa.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress,
  Card, Skeleton, EmptyState, Button, IconoAlerta,
} from '../components/ui';

/**
 * SeleccionServicio
 * Muestra los servicios activos del tenant. La lista la carga App (una sola
 * vez) y llega por props; el reintento ante un error también vive en App.
 * @param {Array<Object>} props.servicios - Servicios activos [{ id, nombre, precio, duracion_minutos }]
 * @param {boolean} props.cargando - True mientras App los está pidiendo
 * @param {boolean} props.error - True si la carga falló
 * @param {Function} props.onReintentar - Vuelve a pedir los servicios
 * @param {Object|null} props.seleccionado - Servicio previamente seleccionado (para volver)
 * @param {Function} props.onSeleccionar - Callback con el servicio elegido (tras la pausa de confirmación)
 * @param {Function} props.onVolver - Callback para retroceder
 */
function SeleccionServicio({
  servicios, cargando, error, onReintentar, seleccionado, onSeleccionar, onVolver,
}) {
  // La opción tocada se marca ~150 ms antes de avanzar.
  const [elegido, elegir] = useEleccionConPausa(onSeleccionar);
  const marcado = elegido ?? seleccionado;

  // Si la lista no estaba visible al entrar (cargaba, o falló y se reintenta),
  // aparece con un fundido cuando reemplaza al skeleton.
  const [listaVisibleAlEntrar] = useState(!cargando && !error);

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
            body="No pudimos cargar los servicios. Revisá tu conexión e intentá de nuevo."
            action={
              <Button variant="secondary" onClick={onReintentar} full={false}>
                Reintentar
              </Button>
            }
          />
        ) : servicios.length === 0 ? (
          <EmptyState
            glyph={<IconoTijera/>}
            title="Sin servicios disponibles"
            body="El negocio todavía no cargó servicios. Volvé a intentar más tarde."
          />
        ) : (
          <div
            className={listaVisibleAlEntrar ? undefined : 'tt-aparecer'}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {servicios.map(s => (
              <ServicioCard
                key={s.id}
                servicio={s}
                selected={marcado?.id === s.id}
                onClick={() => elegir(s)}
              />
            ))}
          </div>
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
