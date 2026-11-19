// /frontend-barbero/src/components/ui/HojaInferior.jsx
// Hoja que sube desde abajo, para una tarea corta sin salir de la pantalla (ej.
// reservar un turno o asignar un cliente desde la Agenda). Tiene un encabezado
// fijo, un cuerpo con scroll propio y un pie fijo con la acción: con el teclado
// abierto o mucho contenido, el botón queda siempre a la vista.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { theme } from '../../theme/tokens.js';

/**
 * HojaInferior
 * Overlay con una hoja pegada abajo (ancho máximo de la columna, 90 % del alto).
 * Cierra con Escape, con la X y tocando afuera, salvo que esté bloqueada (una
 * acción en curso). Al abrirse lleva el foco a la hoja, y al cerrarse lo
 * devuelve al elemento que tenía el foco antes.
 * @param {string} props.titulo - título de la hoja (también su nombre accesible)
 * @param {ReactNode} [props.subtitulo] - línea debajo del título
 * @param {boolean} [props.bloqueada=false] - si es true, no se puede cerrar
 * @param {() => void} props.onCerrar
 * @param {ReactNode} [props.pie] - lo fijo de abajo (error y botón de la acción)
 * @param {ReactNode} props.children - el cuerpo, con scroll propio
 * @returns {JSX.Element}
 */
function HojaInferior({ titulo, subtitulo, bloqueada = false, onCerrar, pie, children }) {
  const refHoja = useRef(null);

  // Foco: a la hoja al abrir, y de vuelta a quien la abrió al cerrar. Sin
  // scroll (`preventScroll`): el botón que la abre suele estar en un footer
  // sticky, y enfocarlo llevaba la página a la posición de ese footer en el flujo.
  useEffect(() => {
    const anterior = document.activeElement;
    refHoja.current?.focus({ preventScroll: true });
    return () => {
      if (anterior && typeof anterior.focus === 'function') anterior.focus({ preventScroll: true });
    };
  }, []);

  // Cerrar con Escape.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !bloqueada) onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bloqueada, onCerrar]);

  return (
    <div
      onClick={bloqueada ? undefined : onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 11, 0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'om-overlay-in .15s ease-out both',
      }}
    >
      <div
        ref={refHoja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: theme.maxWidth,
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          background: theme.surface,
          borderTopLeftRadius: theme.radiusLg,
          borderTopRightRadius: theme.radiusLg,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          outline: 'none',
          animation: 'om-hoja-in .22s ease-out both',
        }}
      >
        {/* Encabezado: título + cerrar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 8px 8px 16px',
          borderBottom: `1px solid ${theme.hairlineSoft}`,
        }}>
          <div style={{ paddingTop: 8, minWidth: 0 }}>
            <div style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: theme.sizeHeading,
              color: theme.ink,
              lineHeight: 1.2,
            }}>
              {titulo}
            </div>
            {subtitulo && (
              <div style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, marginTop: 2 }}>
                {subtitulo}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={bloqueada}
            aria-label="Cerrar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: bloqueada ? 'not-allowed' : 'pointer',
              color: theme.muted,
            }}
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo con scroll propio */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          {children}
        </div>

        {/* Pie fijo */}
        {pie && (
          <div style={{
            padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
            borderTop: `1px solid ${theme.hairline}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

export default HojaInferior;
