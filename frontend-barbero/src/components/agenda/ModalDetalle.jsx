// /frontend-barbero/src/components/agenda/ModalDetalle.jsx
// Cáscara común de los detalles de la Agenda (turno y descanso) y la fila
// label / valor que usan los dos.

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { theme } from '../../theme/tokens.js';

/**
 * ModalDetalle
 * Cáscara común de los detalles de la Agenda: overlay, tarjeta centrada,
 * encabezado con título + subtítulo y botón de cerrar. Cierra con Escape y con
 * click afuera, salvo que esté bloqueado (una acción en curso).
 * @param {string} props.etiqueta - aria-label del diálogo (ej. "Detalle del turno")
 * @param {string} props.titulo - título grande (ej. "15:00 – 16:00")
 * @param {ReactNode} [props.subtitulo] - debajo del título (pill, eyebrow)
 * @param {boolean} [props.bloqueado=false] - si es true, no se puede cerrar
 * @param {() => void} props.onCerrar
 * @param {ReactNode} props.children - cuerpo del detalle
 */
export function ModalDetalle({ etiqueta, titulo, subtitulo, bloqueado = false, onCerrar, children }) {
  // Cerrar con Escape.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !bloqueado) onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bloqueado, onCerrar]);

  return (
    <div
      onClick={bloqueado ? undefined : onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={etiqueta}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: theme.radiusLg,
          padding: 20,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          animation: 'om-dialog-in .2s ease-out both',
        }}
      >
        {/* Encabezado: título + cerrar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeTitle,
              letterSpacing: '-0.02em',
              color: theme.ink,
              lineHeight: 1.1,
            }}>
              {titulo}
            </div>
            {subtitulo && <div style={{ marginTop: 6 }}>{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: bloqueado ? 'not-allowed' : 'pointer',
              color: theme.muted,
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * DatoDetalle
 * Fila label / valor dentro de un modal de detalle.
 * @param {string} props.label
 * @param {string|ReactNode} props.valor
 */
export function DatoDetalle({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontFamily: theme.mono,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.ink,
        textAlign: 'right',
        wordBreak: 'break-word',
      }}>{valor}</span>
    </div>
  );
}
