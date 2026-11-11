// /frontend-alta/src/components/TarjetaItem.jsx
// Un servicio (pantalla 9) o un producto (pantalla 10) de la lista: arriba el
// nombre, con "cambiar el nombre" y "quitar"; abajo, sus campos (precio,
// duración o stock), que pone la pantalla.
// Un ítem nuevo entra creciendo (al-crecer, plan D7); los que ya estaban al
// montar la pantalla, no.

import { useId } from 'react';
import { Pencil, X } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { alPresionarEnter } from '../utils/teclado.js';
import { useHover } from '../hooks/useHover.js';
import { TextoError } from './ui';
import { estiloSoloLector, MARGEN_SCROLL_CAMPO } from './ui/estilos.js';

/**
 * BotonIcono
 * Botón de 44 × 44 con un ícono y su nombre para el lector.
 * @param {ReactNode} props.children - Ícono de 20
 * @param {string} props.etiqueta - aria-label
 * @param {Function} props.onClick
 * @param {Object} [props.ref]
 * @returns {JSX.Element}
 */
function BotonIcono({ children, etiqueta, onClick, ref }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-label={etiqueta}
      className="al-presionable"
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        color: theme.muted,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * TarjetaItem
 * @param {string} props.nombre
 * @param {string} props.tipo - 'servicio' | 'producto' (para las etiquetas del lector)
 * @param {boolean} [props.animar=false] - Entra creciendo (es nuevo)
 * @param {boolean} props.editando - El nombre está en un campo
 * @param {Function} props.onEditar
 * @param {Function} props.onCambiarNombre - Mientras se edita
 * @param {Function} props.onTerminarEdicion - Al salir del campo, Enter o Escape
 * @param {Function} props.onQuitar
 * @param {string} [props.errorNombre]
 * @param {number} [props.maxLength]
 * @param {Object} [props.refNombre] - Ref al campo del nombre (mientras se edita)
 * @param {Object} [props.refEditar] - Ref al botón de editar
 * @param {ReactNode} props.children - Los campos del ítem
 * @returns {JSX.Element}
 */
function TarjetaItem({
  nombre, tipo, animar = false, editando, onEditar, onCambiarNombre, onTerminarEdicion, onQuitar,
  errorNombre, maxLength, refNombre, refEditar, children,
}) {
  const errorId = useId();
  const tituloId = useId();
  const visible = (nombre ?? '').trim() || 'Sin nombre';
  const articulo = tipo === 'producto' ? 'este producto' : 'este servicio';

  const contenido = (
    <section
      aria-labelledby={tituloId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '8px 8px 16px 16px',
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
          {editando ? (
            <input
              ref={refNombre}
              type="text"
              value={nombre ?? ''}
              onChange={(e) => onCambiarNombre(e.target.value)}
              onBlur={onTerminarEdicion}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); onTerminarEdicion(); return; }
                alPresionarEnter(onTerminarEdicion)(e);
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={maxLength}
              aria-label={`Nombre de ${visible}`}
              aria-invalid={errorNombre ? 'true' : undefined}
              aria-describedby={errorNombre ? errorId : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                height: 44,
                marginRight: 4,
                padding: '0 12px',
                marginLeft: -8,
                background: theme.surface,
                border: `1px solid ${errorNombre ? theme.danger : theme.accent}`,
                borderRadius: theme.radius,
                boxShadow: `0 0 0 3px ${theme.accent}26`,
                fontFamily: theme.body,
                fontSize: theme.sizeInput,
                color: theme.ink,
                scrollMarginBottom: MARGEN_SCROLL_CAMPO,
              }}
            />
          ) : (
            <h2 id={tituloId} style={{
              flex: 1,
              minWidth: 0,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightHeading,
              color: (nombre ?? '').trim() ? theme.ink : theme.muted,
              overflowWrap: 'anywhere',
            }}>
              {visible}
            </h2>
          )}
          {/* El título para el lector mientras se edita (el h2 no está). */}
          {editando && <span id={tituloId} style={estiloSoloLector}>{visible}</span>}
          {!editando && (
            <BotonIcono ref={refEditar} etiqueta={`Cambiar el nombre de ${(nombre ?? '').trim() || articulo}`} onClick={onEditar}>
              <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
            </BotonIcono>
          )}
          <BotonIcono etiqueta={`Quitar ${(nombre ?? '').trim() || articulo}`} onClick={onQuitar}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </BotonIcono>
        </div>
        {errorNombre && <TextoError id={errorId}>{errorNombre}</TextoError>}
      </div>

      <div style={{ paddingRight: 8 }}>{children}</div>
    </section>
  );

  if (!animar) return contenido;
  return (
    <div className="al-crecer">
      <div>{contenido}</div>
    </div>
  );
}

export default TarjetaItem;
