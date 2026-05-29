// /frontend/src/screens/admin/sections/gestion/BloqueImagenes.jsx
// Bloque de gestión de las imágenes del negocio (fotos del local, cortes de
// ejemplo, logos). Se renderiza dentro de TabNegocio, debajo de los feriados.
// Las imágenes se comprimen a WebP en el navegador antes de subirse, para no
// gastar la cuota de Supabase Storage con archivos pesados.
//
// Sistema de diseño: tokens + Geist + Lucide + primitivos. El borrado usa
// ConfirmDialog; los errores se muestran con Toast.

import { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { ImagePlus, X } from 'lucide-react';

import { getImagenesAdmin, subirImagen, eliminarImagen } from '../../../../services/api';
import {
  ConfirmDialog,
  Toast,
  LoadingState,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// Definición de los tres grupos de imágenes: cuántos slots tiene cada uno y el
// texto que los acompaña. El orden de cada slot va de 1 a `cantidad`.
const GRUPOS = [
  { tipo: 'local', titulo: 'Fotos del local', cantidad: 2,
    hint: 'Cómo se ve el local por dentro.' },
  { tipo: 'corte', titulo: 'Cortes de ejemplo', cantidad: 4,
    hint: 'Trabajos realizados para mostrar a los clientes.' },
  { tipo: 'logo', titulo: 'Logo', cantidad: 2,
    hint: 'Logo del negocio. El primero es el principal.' },
];

// Parámetros de compresión por tipo. Los logos no necesitan tanta resolución
// como una foto, así que se redimensionan y comprimen más agresivamente.
const OPCIONES_COMPRESION = {
  local: { maxWidthOrHeight: 1280, maxSizeMB: 0.25 },
  corte: { maxWidthOrHeight: 1280, maxSizeMB: 0.25 },
  logo:  { maxWidthOrHeight: 512,  maxSizeMB: 0.1 },
};

// Lado de las miniaturas / tiles (px).
const SLOT = 76;

// Wrapper de contenido (sin chrome de card: el panel lo aporta TabNegocio).
// Compartido entre los estados carga/error/contenido.
const CONTENT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

/**
 * EncabezadoImagenes
 * Título + hint de la card. Compartido entre los estados de carga / error /
 * contenido para no duplicar la tipografía.
 * @returns {JSX.Element}
 */
function EncabezadoImagenes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeBody,
        color: theme.ink,
      }}>
        Imágenes del negocio
      </span>
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        lineHeight: 1.5,
      }}>
        Se muestran en la página de reservas de los clientes. Las imágenes se
        optimizan automáticamente al subirlas.
      </span>
    </div>
  );
}

/**
 * BloqueImagenes
 * Muestra los slots por tipo, permite subir (con compresión a WebP) y eliminar
 * imágenes.
 * @returns {JSX.Element}
 */
export default function BloqueImagenes() {
  const [imagenes, setImagenes]     = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [feedback, setFeedback]     = useState(null);  // { tone, texto } | null

  // Slot que está subiendo en este momento, identificado como 'tipo-orden'.
  // Solo uno a la vez: la subida es rápida y evita estados ambiguos.
  const [subiendo, setSubiendo] = useState(null);

  // Imagen pendiente de confirmación de borrado (objeto { id, tipo, orden }).
  const [imagenAEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando]     = useState(false);

  // Input de archivo único y oculto. Al hacer click en un slot se guarda qué
  // slot lo disparó (slotPendiente) y se abre el selector mediante este ref.
  const inputRef = useRef(null);
  const slotPendiente = useRef(null);

  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const cargarImagenes = async () => {
      setCargando(true);
      setErrorCarga(null);
      try {
        const data = await getImagenesAdmin();
        if (!cancelado) setImagenes(data);
      } catch (err) {
        console.error('[bloqueImagenes] Error en cargarImagenes:', err.message);
        if (!cancelado) setErrorCarga('No se pudieron cargar las imágenes.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargarImagenes();
    return () => { cancelado = true; };
  }, []);

  /**
   * imagenesDe — imágenes cargadas de un grupo, ordenadas por `orden`.
   * @param {string} tipo
   * @returns {Array} imágenes del grupo
   */
  const imagenesDe = (tipo) =>
    imagenes.filter((img) => img.tipo === tipo).sort((a, b) => a.orden - b.orden);

  /**
   * ordenLibre — primera posición libre (1..max) de un grupo, para saber a qué
   * `orden` subir cuando el usuario toca el tile "+".
   * @param {string} tipo
   * @param {number} max - cantidad de slots del grupo
   * @returns {number|null} la posición libre, o null si el grupo está lleno
   */
  const ordenLibre = (tipo, max) => {
    for (let o = 1; o <= max; o++) {
      if (!imagenes.some((img) => img.tipo === tipo && img.orden === o)) return o;
    }
    return null;
  };

  /**
   * abrirSelector — abre el selector de archivos para un slot dado.
   * @param {string} tipo
   * @param {number} orden
   */
  const abrirSelector = (tipo, orden) => {
    if (subiendo) return; // hay una subida en curso → ignorar
    slotPendiente.current = { tipo, orden };
    inputRef.current.click();
  };

  /**
   * handleArchivo — maneja la elección de un archivo: lo comprime a WebP y lo
   * sube al slot.
   * @param {Event} e - evento change del input de archivo
   */
  const handleArchivo = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite re-elegir el mismo archivo después
    const slot = slotPendiente.current;
    if (!file || !slot) return;

    const { tipo, orden } = slot;
    setSubiendo(`${tipo}-${orden}`);
    setFeedback(null);
    try {
      // Compresión + conversión a WebP en el navegador.
      const comprimida = await imageCompression(file, {
        ...OPCIONES_COMPRESION[tipo],
        fileType: 'image/webp',
        useWebWorker: true,
      });
      const nueva = await subirImagen(tipo, orden, comprimida);
      if (!vivoRef.current) return;

      // Reemplaza la imagen del slot si ya existía, o la agrega si era nuevo.
      setImagenes((prev) => [
        ...prev.filter((img) => !(img.tipo === tipo && img.orden === orden)),
        nueva,
      ]);
    } catch (err) {
      console.error('[bloqueImagenes] Error en handleArchivo:', err.message);
      if (vivoRef.current) setFeedback({ tone: 'danger', texto: err.message || 'No se pudo subir la imagen.' });
    } finally {
      if (vivoRef.current) setSubiendo(null);
    }
  };

  /**
   * ejecutarEliminar — ejecuta el DELETE de la imagen en confirmación.
   */
  const ejecutarEliminar = async () => {
    if (!imagenAEliminar) return;
    setEliminando(true);
    try {
      await eliminarImagen(imagenAEliminar.id);
      if (!vivoRef.current) return;
      setImagenes((prev) => prev.filter((img) => img.id !== imagenAEliminar.id));
      setAEliminar(null);
    } catch (err) {
      console.error('[bloqueImagenes] Error en ejecutarEliminar:', err.message);
      if (vivoRef.current) {
        setAEliminar(null);
        setFeedback({ tone: 'danger', texto: 'No se pudo eliminar la imagen. Intentá de nuevo.' });
      }
    } finally {
      if (vivoRef.current) setEliminando(false);
    }
  };

  if (cargando) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoImagenes />
        <LoadingState />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div style={CONTENT_STYLE}>
        <EncabezadoImagenes />
        <Toast tone="danger">{errorCarga}</Toast>
      </div>
    );
  }

  return (
    <div style={CONTENT_STYLE}>
      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={imagenAEliminar !== null}
        title="¿Eliminar esta imagen?"
        message="La imagen se borra de forma permanente. Podés volver a subir otra en su lugar."
        confirmLabel="Sí, eliminar"
        confirmVariant="danger"
        loading={eliminando}
        onConfirm={ejecutarEliminar}
        onCancel={() => { if (!eliminando) setAEliminar(null); }}
      />

      {/* Input de archivo oculto, compartido por todos los slots. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleArchivo}
        style={{ display: 'none' }}
      />

      <EncabezadoImagenes />

      {feedback && (
        <Toast
          tone={feedback.tone}
          dismissible
          onDismiss={() => setFeedback(null)}
        >
          {feedback.texto}
        </Toast>
      )}

      {GRUPOS.map((grupo) => {
        const imgs       = imagenesDe(grupo.tipo);
        const libre      = ordenLibre(grupo.tipo, grupo.cantidad);
        const ocupado    = !!subiendo;
        // ¿Está subiendo a una posición que todavía no figura en la lista?
        // (caso "agregar" vs "reemplazar"). Si es así, mostramos un tile extra.
        const subiendoNueva = subiendo === `${grupo.tipo}-${libre}`;

        return (
          <div key={grupo.tipo} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontFamily: theme.mono,
                fontWeight: theme.weightMedium,
                fontSize: theme.sizeMicro,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: theme.muted,
              }}>
                {grupo.titulo}
              </span>
              <span style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: theme.muted,
              }}>
                {grupo.hint}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {/* Miniaturas cargadas. Click = reemplazar esa posición. */}
              {imgs.map((imagen) => {
                const esteSubiendo = subiendo === `${grupo.tipo}-${imagen.orden}`;
                return (
                  <div
                    key={imagen.id}
                    role="button"
                    tabIndex={0}
                    aria-label="Reemplazar imagen"
                    onClick={() => abrirSelector(grupo.tipo, imagen.orden)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirSelector(grupo.tipo, imagen.orden);
                      }
                    }}
                    style={{
                      position: 'relative',
                      width: SLOT,
                      height: SLOT,
                      borderRadius: theme.radius,
                      border: `1px solid ${theme.hairline}`,
                      background: theme.surface,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: ocupado ? 'default' : 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    {esteSubiendo ? (
                      <span style={{ fontFamily: theme.body, fontSize: theme.sizeMicro, color: theme.muted }}>
                        Subiendo…
                      </span>
                    ) : (
                      <>
                        <img src={imagen.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          aria-label="Eliminar imagen"
                          onClick={(e) => { e.stopPropagation(); setFeedback(null); setAEliminar(imagen); }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: theme.radiusSm,
                            border: 'none',
                            background: 'rgba(9, 9, 11, 0.55)',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={13} strokeWidth={2.25} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Tile extra mientras sube una imagen nueva (posición aún no listada). */}
              {subiendoNueva && (
                <div style={{
                  width: SLOT,
                  height: SLOT,
                  borderRadius: theme.radius,
                  border: `1px solid ${theme.hairline}`,
                  background: theme.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: theme.body, fontSize: theme.sizeMicro, color: theme.muted }}>
                    Subiendo…
                  </span>
                </div>
              )}

              {/* Tile "+" para agregar, solo si el grupo no llegó al tope. */}
              {libre !== null && !subiendoNueva && (
                <button
                  type="button"
                  aria-label={`Subir imagen — ${grupo.titulo}`}
                  disabled={ocupado}
                  onClick={() => abrirSelector(grupo.tipo, libre)}
                  onMouseEnter={(e) => { if (!ocupado) e.currentTarget.style.borderColor = theme.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.hairline; }}
                  style={{
                    width: SLOT,
                    height: SLOT,
                    borderRadius: theme.radius,
                    border: `1px dashed ${theme.hairline}`,
                    background: theme.surfaceAlt,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: ocupado ? 'default' : 'pointer',
                    transition: `border-color ${theme.transitionFast}`,
                  }}
                >
                  <ImagePlus size={22} strokeWidth={1.5} color={theme.mutedSoft} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
