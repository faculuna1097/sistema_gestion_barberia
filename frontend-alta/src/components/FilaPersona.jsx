// /frontend-alta/src/components/FilaPersona.jsx
// Una persona de una lista del equipo: su avatar con iniciales, el nombre y
// las acciones (cambiar el nombre, quitar). Lo usan los barberos (pantalla 5)
// y los dueños que no cortan (pantalla 6).
// Una fila nueva entra creciendo (al-crecer) y su avatar aparece con om-pop
// (plan D7: "avatares que aparecen"); las que ya estaban al montar la
// pantalla, no. Con "reducir movimiento", om-pop no anima (index.css).

import { useId } from 'react';
import { Pencil, X } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { alPresionarEnter } from '../utils/teclado.js';
import { useHover } from '../hooks/useHover.js';
import { AvatarIniciales, TextoError } from './ui';
import { estiloSoloLector, MARGEN_SCROLL_CAMPO } from './ui/estilos.js';

/**
 * BotonIcono
 * Botón de 44 × 44 con un ícono y su nombre para el lector.
 * @param {ReactNode} props.children - Ícono de 20
 * @param {string} props.etiqueta - aria-label ("Quitar a Juan")
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
 * CampoNombreEnFila
 * El nombre editándose, en el lugar del texto. Enter o Escape terminan (el
 * nombre ya se fue guardando tecla a tecla).
 * @param {string} props.valor
 * @param {string} props.etiqueta - aria-label del campo ("Nombre de Juan")
 * @param {Function} props.onCambiar
 * @param {Function} props.onTerminar - Al salir del campo, Enter o Escape
 * @param {string} [props.errorId]
 * @param {Object} [props.ref]
 * @returns {JSX.Element}
 */
function CampoNombreEnFila({ valor, etiqueta, onCambiar, onTerminar, errorId, ref }) {
  return (
    <input
      ref={ref}
      type="text"
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      onBlur={onTerminar}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onTerminar(); return; }
        alPresionarEnter(onTerminar)(e);
      }}
      autoFocus
      autoComplete="off"
      autoCapitalize="words"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label={etiqueta}
      aria-invalid={errorId ? 'true' : undefined}
      aria-describedby={errorId}
      style={{
        flex: 1,
        minWidth: 0,
        height: 44,
        padding: '0 12px',
        background: theme.surface,
        border: `1px solid ${errorId ? theme.danger : theme.accent}`,
        borderRadius: theme.radius,
        boxShadow: `0 0 0 3px ${theme.accent}26`,
        fontFamily: theme.body,
        fontSize: theme.sizeInput,
        color: theme.ink,
        scrollMarginBottom: MARGEN_SCROLL_CAMPO,
      }}
    />
  );
}

/**
 * FilaPersona
 * @param {string} props.nombre
 * @param {boolean} [props.animar=false] - Entra creciendo (es nueva)
 * @param {string} [props.detalle] - Una línea debajo del nombre, en muted ("No corta")
 * @param {Function} props.onQuitar
 * @param {boolean} [props.editando=false] - El nombre está en un campo
 * @param {Function} [props.onEditar] - Sin él, no hay botón de editar
 * @param {Function} [props.onCambiarNombre] - Mientras se edita
 * @param {Function} [props.onTerminarEdicion]
 * @param {string} [props.error] - Error del nombre (de validaciones.js)
 * @param {Object} [props.refCampo] - Ref al campo del nombre (mientras se edita)
 * @param {Object} [props.refEditar] - Ref al botón de editar
 * @param {Object} [props.refQuitar] - Ref al botón de quitar
 * @returns {JSX.Element}
 */
function FilaPersona({
  nombre, animar = false, detalle, onQuitar, editando = false, onEditar, onCambiarNombre, onTerminarEdicion,
  error, refCampo, refEditar, refQuitar,
}) {
  const errorId = useId();
  const nombreVisible = nombre.trim();

  const fila = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex',
          animation: animar ? 'om-pop 220ms cubic-bezier(0.25, 1, 0.5, 1) backwards' : undefined,
        }}>
          <AvatarIniciales nombre={nombreVisible} size={40} />
        </span>

        {editando ? (
          <CampoNombreEnFila
            ref={refCampo}
            valor={nombre}
            etiqueta={`Nombre de ${nombreVisible || 'este barbero'}`}
            onCambiar={onCambiarNombre}
            onTerminar={onTerminarEdicion}
            errorId={error ? errorId : undefined}
          />
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightMedium,
              color: nombreVisible ? theme.ink : theme.muted,
              overflowWrap: 'anywhere',
            }}>
              {nombreVisible || 'Sin nombre'}
            </span>
            {detalle && (
              <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>{detalle}</span>
            )}
          </div>
        )}

        {!editando && onEditar && (
          <BotonIcono ref={refEditar} etiqueta={`Cambiar el nombre de ${nombreVisible || 'este barbero'}`} onClick={onEditar}>
            <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
          </BotonIcono>
        )}
        <BotonIcono ref={refQuitar} etiqueta={`Quitar a ${nombreVisible || 'esta persona'}`} onClick={onQuitar}>
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonIcono>
      </div>

      {error && (
        // Alineado con el nombre (avatar de 40 + 12 de separación).
        <div style={{ paddingLeft: 52 }}>
          <TextoError id={errorId}>
            <span style={estiloSoloLector}>{`${nombreVisible || 'Sin nombre'}: `}</span>
            {error}
          </TextoError>
        </div>
      )}
    </div>
  );

  if (!animar) return fila;
  return (
    <div className="al-crecer">
      <div>{fila}</div>
    </div>
  );
}

export default FilaPersona;
