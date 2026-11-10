// /frontend-alta/src/screens/pantallas/PantallaNombre.jsx
// Pantalla 1: el nombre de la barbería y su link (plan §5.2).
// - Mientras se escribe el nombre aparece el link sugerido
//   (<sugerencia>.barbermanager.app, sugerirSubdominio) con su estado:
//   revisando, disponible, ocupado, reservado o formato inválido.
// - El link se puede cambiar a mano. Desde que se edita, deja de seguir al
//   nombre: la marca va en progreso.subdominio_editado (el backend descarta
//   cualquier clave fuera de la forma de §5.6, y progreso es parte de ella).
// - El "Seguir" frena también con lo que dijo el backend (plan §7.1):
//   validaciones.js no sabe si el link está ocupado. Si todavía se está
//   revisando, espera la respuesta y sigue solo. Si la consulta falló, avisa y
//   deja seguir: el backend lo vuelve a revisar al enviar.

import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_NEGOCIO, erroresDePantalla } from '../../utils/validaciones.js';
import {
  MENSAJES_SUBDOMINIO, SUBDOMINIO_MAX, limpiarSubdominioEscrito, sugerirSubdominio,
} from '../../utils/subdominio.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useEstadoSubdominio, ESTADOS_SUBDOMINIO } from '../../hooks/useEstadoSubdominio.js';
import { Button, Field, TextoError } from '../../components/ui';
import { estiloEtiquetaCampo, estiloSoloLector, MARGEN_SCROLL_CAMPO } from '../../components/ui/estilos.js';

// Dominio de los links de las barberías.
const SUFIJO = '.barbermanager.app';

// Mensajes propios del front (no son reglas de validaciones.js: dicen en qué
// está la consulta al backend, no si el dato es válido).
const TEXTO_REVISANDO = 'Revisando si está libre…';
const TEXTO_SIN_RESPUESTA = 'No pudimos revisar si está libre. Podés seguir igual: lo revisamos al enviar.';

/**
 * EstadoDelLink
 * El renglón debajo del link. Un error ya visible (al salir del campo o al
 * seguir) manda; si no, lo que dijo la consulta. El formato inválido no se
 * muestra mientras se escribe: recién cuando se revela.
 * Es una región `aria-live`: el lector anuncia "Disponible" o el problema.
 * @param {string} props.id - Lo apunta el aria-describedby del campo del link
 * @param {string} props.estado - Uno de ESTADOS_SUBDOMINIO
 * @param {string} [props.error] - Mensaje de error ya revelado
 * @returns {JSX.Element}
 */
function EstadoDelLink({ id, estado, error }) {
  let contenido = null;
  if (error) {
    contenido = <TextoError id={id}>{error}</TextoError>;
  } else if (estado === ESTADOS_SUBDOMINIO.OCUPADO || estado === ESTADOS_SUBDOMINIO.RESERVADO) {
    contenido = <TextoError id={id}>{MENSAJES_SUBDOMINIO[estado]}</TextoError>;
  } else if (estado === ESTADOS_SUBDOMINIO.DISPONIBLE) {
    contenido = (
      <p id={id} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.success,
      }}>
        <Check size={16} strokeWidth={2} aria-hidden="true" />
        Disponible
      </p>
    );
  } else if (estado === ESTADOS_SUBDOMINIO.VERIFICANDO || estado === ESTADOS_SUBDOMINIO.SIN_RESPUESTA) {
    contenido = (
      <p id={id} style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.4, color: theme.muted }}>
        {estado === ESTADOS_SUBDOMINIO.VERIFICANDO ? TEXTO_REVISANDO : TEXTO_SIN_RESPUESTA}
      </p>
    );
  }
  // Alto mínimo de un renglón: el estado cambia sin mover lo de abajo.
  return <div aria-live="polite" style={{ minHeight: 21 }}>{contenido}</div>;
}

/**
 * CampoLink
 * El link editable: [ subdominio ].barbermanager.app en una sola caja, con
 * las tres reglas de Field (label asociada, aria-invalid y aria-describedby;
 * sistema_de_disenio.md §5.2). Lo escrito se limpia tecla a tecla
 * (limpiarSubdominioEscrito): minúsculas, sin tildes, espacios como guion.
 * @param {string} props.id - id del input (la label lo usa)
 * @param {string} props.valor
 * @param {Function} props.onCambiar - Recibe el texto tal como se escribió
 * @param {Function} props.onSalir - Blur
 * @param {Function} props.onEnter - Enter: el "Seguir"
 * @param {boolean} props.invalido
 * @param {string} props.describedBy - id del renglón de estado
 * @param {Object} props.ref - Ref al input
 * @returns {JSX.Element}
 */
function CampoLink({ id, valor, onCambiar, onSalir, onEnter, invalido, describedBy, ref }) {
  const [foco, setFoco] = useState(false);
  let borde = theme.hairline;
  if (foco) borde = theme.accent;
  if (invalido) borde = theme.danger;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      background: theme.surface,
      border: `1px solid ${borde}`,
      borderRadius: theme.radius,
      boxShadow: foco ? `0 0 0 3px ${theme.accent}26` : 'none',
      transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
    }}>
      <input
        ref={ref}
        id={id}
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onFocus={() => setFoco(true)}
        onBlur={() => { setFoco(false); onSalir(); }}
        onKeyDown={alPresionarEnter(onEnter)}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={SUBDOMINIO_MAX}
        aria-invalid={invalido ? 'true' : undefined}
        aria-describedby={describedBy}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: theme.mono,
          // sizeInput (16): con menos, Safari hace zoom al enfocar en el iPhone.
          fontSize: theme.sizeInput,
          color: theme.ink,
          scrollMarginBottom: MARGEN_SCROLL_CAMPO,
        }}
      />
      <span aria-hidden="true" style={{ fontFamily: theme.mono, fontSize: theme.sizeBody, color: theme.muted, whiteSpace: 'nowrap' }}>
        {SUFIJO}
      </span>
    </div>
  );
}

/**
 * PantallaNombre
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaNombre({ datos, actualizar, onSeguir, ref }) {
  const { nombre, subdominio } = datos.local;
  const editado = datos.progreso?.subdominio_editado === true;
  const estadoLink = useEstadoSubdominio(subdominio);

  // Los errores de validaciones.js, más "ocupado", que lo sabe solo el backend.
  const errores = erroresDePantalla(PANTALLA.NOMBRE, datos);
  if (estadoLink === ESTADOS_SUBDOMINIO.OCUPADO && !errores.some((e) => e.campo === 'local.subdominio')) {
    errores.push({ campo: 'local.subdominio', mensaje: MENSAJES_SUBDOMINIO.ocupado });
  }
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const [editando, setEditando] = useState(false);
  // Pedido de foco al campo del link: se cumple después del render que lo monta.
  const [focoAlLink, setFocoAlLink] = useState(false);
  // "Seguir" tocado mientras se revisaba el link: se sigue solo al tener respuesta.
  const [esperando, setEsperando] = useState(false);

  const nombreRef = useRef(null);
  const linkRef = useRef(null);
  const linkId = useId();
  const estadoId = useId();

  // El link aparece con el primer nombre; si ya estaba al montar, no se anima.
  const mostrarLink = nombre.trim() !== '' || subdominio !== '' || editado;
  const [linkAlMontar] = useState(mostrarLink);

  // El campo del link ya está montado: se le da el foco pedido.
  useEffect(() => {
    if (!focoAlLink) return;
    setFocoAlLink(false);
    linkRef.current?.focus();
  }, [focoAlLink]);

  // Llegó la respuesta que esperaba el "Seguir": se vuelve a intentar.
  useEffect(() => {
    if (!esperando || estadoLink === ESTADOS_SUBDOMINIO.VERIFICANDO) return;
    setEsperando(false);
    onSeguir();
  }, [esperando, estadoLink, onSeguir]);

  /**
   * abrirLink — muestra el campo del link y lo enfoca.
   */
  const abrirLink = () => {
    setEditando(true);
    setFocoAlLink(true);
  };

  /**
   * cambiarNombre — guarda el nombre y, si el link no se editó a mano, la sugerencia.
   * @param {string} valor
   */
  const cambiarNombre = (valor) => {
    setEsperando(false);
    actualizar((d) => ({
      ...d,
      local: {
        ...d.local,
        nombre: valor,
        subdominio: d.progreso?.subdominio_editado === true ? d.local.subdominio : sugerirSubdominio(valor),
      },
    }));
  };

  /**
   * cambiarLink — guarda el link escrito a mano (limpio) y marca que se editó.
   * @param {string} texto
   */
  const cambiarLink = (texto) => {
    setEsperando(false);
    actualizar((d) => ({
      ...d,
      local: { ...d.local, subdominio: limpiarSubdominioEscrito(texto) },
      progreso: { ...d.progreso, subdominio_editado: true },
    }));
  };

  /**
   * salirDelNombre — recorta y, si se escribió algo, muestra los errores del
   * nombre y del link que lo sigue.
   */
  const salirDelNombre = () => {
    const recortado = nombre.trim();
    if (recortado !== nombre) cambiarNombre(recortado);
    if (!recortado) return;
    revelar('local.nombre');
    if (!editado) revelar('local.subdominio');
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar. Si no: con errores, los
     *   muestra y enfoca el primero; con el link todavía en revisión, espera
     *   la respuesta (el efecto de abajo vuelve a llamar al "Seguir").
     */
    intentarSeguir() {
      if (errores.length === 0) {
        if (estadoLink === ESTADOS_SUBDOMINIO.VERIFICANDO) {
          setEsperando(true);
          return false;
        }
        // Con Enter no hay blur: se recorta acá.
        if (nombre.trim() !== nombre) cambiarNombre(nombre.trim());
        return true;
      }
      revelarTodos();
      if (errores[0].campo === 'local.nombre') {
        nombreRef.current?.focus();
      } else {
        // El error es del link: se abre su campo (si estaba cerrado) y se enfoca.
        abrirLink();
      }
      return false;
    },
  }));

  const errorLink = errorDe('local.subdominio');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field
        ref={nombreRef}
        label="Nombre de la barbería"
        value={nombre}
        onChange={cambiarNombre}
        onBlur={salirDelNombre}
        onKeyDown={alPresionarEnter(onSeguir)}
        error={errorDe('local.nombre')}
        name="organization"
        autoComplete="organization"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={LARGO_NOMBRE_NEGOCIO.max}
        autoFocus={nombre === ''}
      />

      {mostrarLink && (
        <div className={linkAlMontar ? undefined : 'al-crecer'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={editando ? linkId : undefined} style={estiloEtiquetaCampo}>
              Link de tu barbería
            </label>

            {editando ? (
              <CampoLink
                ref={linkRef}
                id={linkId}
                valor={subdominio}
                onCambiar={cambiarLink}
                onSalir={() => subdominio && revelar('local.subdominio')}
                onEnter={onSeguir}
                invalido={Boolean(errorLink)}
                describedBy={estadoId}
              />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 52,
                padding: '4px 4px 4px 14px',
                background: theme.surfaceAlt,
                border: `1px solid ${errorLink ? theme.danger : 'transparent'}`,
                borderRadius: theme.radius,
              }}>
                <p style={{ flex: 1, minWidth: 0, fontFamily: theme.mono, fontSize: theme.sizeBody, overflowWrap: 'anywhere' }}>
                  {/* Bloques en línea: si no entra, corta entre el link y el dominio, no en un guion. */}
                  <span style={{ display: 'inline-block', maxWidth: '100%', color: theme.ink }}>{subdominio}</span>
                  <span style={{ display: 'inline-block', color: theme.muted, whiteSpace: 'nowrap' }}>{SUFIJO}</span>
                </p>
                <Button
                  variant="ghost"
                  full={false}
                  onClick={abrirLink}
                  style={{ color: theme.accent, flexShrink: 0 }}
                >
                  Cambiar<span style={estiloSoloLector}> el link</span>
                </Button>
              </div>
            )}

            <EstadoDelLink id={estadoId} estado={estadoLink} error={errorLink} />
          </div>
        </div>
      )}
    </div>
  );
}

export default PantallaNombre;
