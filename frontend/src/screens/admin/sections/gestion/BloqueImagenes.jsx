// /frontend/src/screens/admin/sections/gestion/BloqueImagenes.jsx
// Bloque de gestión de las imágenes del negocio (fotos del local, cortes de
// ejemplo, logos). Se renderiza dentro de TabNegocio, debajo de los feriados.
// Las imágenes se comprimen a WebP en el navegador antes de subirse, para no
// gastar la cuota de Supabase Storage con archivos pesados.

import { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { getImagenesAdmin, subirImagen, eliminarImagen } from '../../../../services/api';

// Definición de los tres grupos de imágenes: cuántos slots tiene cada uno
// y el texto que los acompaña. El orden de cada slot va de 1 a `cantidad`.
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

/**
 * Modal de confirmación de eliminación de una imagen.
 * @param {Function} props.onConfirmar - dispara el DELETE
 * @param {Function} props.onCancelar - cierra el modal sin hacer nada
 * @param {boolean} props.eliminando - true mientras corre el DELETE
 * @returns {JSX.Element}
 */
function ModalConfirmarEliminar({ onConfirmar, onCancelar, eliminando }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitulo}>¿Eliminar esta imagen?</p>
        <p style={styles.modalAdvertencia}>
          La imagen se borra de forma permanente. Podés volver a subir otra en su lugar.
        </p>
        <div style={styles.modalBotones}>
          <button style={styles.btnCancelar} onPointerDown={onCancelar} disabled={eliminando}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnConfirmarRojo, ...(eliminando ? styles.btnDeshabilitado : {}) }}
            onPointerDown={onConfirmar}
            disabled={eliminando}
          >
            {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bloque de imágenes del negocio. Muestra los slots por tipo, permite subir
 * (con compresión a WebP) y eliminar imágenes.
 * @returns {JSX.Element}
 */
export default function BloqueImagenes() {
  const [imagenes, setImagenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(null);

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

  useEffect(() => {
    const cargarImagenes = async () => {
      console.log('[bloqueImagenes] cargarImagenes — request recibido');
      try {
        const data = await getImagenesAdmin();
        setImagenes(data);
        console.log('[bloqueImagenes] cargarImagenes — completado |', data.length, 'imágenes');
      } catch (err) {
        console.error('[bloqueImagenes] Error en cargarImagenes:', err.message);
        setError('No se pudieron cargar las imágenes.');
      } finally {
        setCargando(false);
      }
    };
    cargarImagenes();
  }, []);

  /**
   * Busca la imagen cargada en un slot concreto.
   * @param {string} tipo
   * @param {number} orden
   * @returns {Object|undefined} la imagen, o undefined si el slot está vacío
   */
  const imagenDe = (tipo, orden) =>
    imagenes.find((img) => img.tipo === tipo && img.orden === orden);

  /**
   * Abre el selector de archivos para un slot dado.
   * @param {string} tipo
   * @param {number} orden
   */
  const abrirSelector = (tipo, orden) => {
    if (subiendo) return; // hay una subida en curso → ignorar
    slotPendiente.current = { tipo, orden };
    inputRef.current.click();
  };

  /**
   * Maneja la elección de un archivo: lo comprime a WebP y lo sube al slot.
   * @param {Event} e - evento change del input de archivo
   */
  const handleArchivo = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite re-elegir el mismo archivo después
    const slot = slotPendiente.current;
    if (!file || !slot) return;

    const { tipo, orden } = slot;
    setSubiendo(`${tipo}-${orden}`);
    setError(null);
    console.log('[bloqueImagenes] handleArchivo — request recibido | slot:', tipo, orden,
      '| original:', Math.round(file.size / 1024), 'KB');

    try {
      // Compresión + conversión a WebP en el navegador.
      const comprimida = await imageCompression(file, {
        ...OPCIONES_COMPRESION[tipo],
        fileType: 'image/webp',
        useWebWorker: true,
      });
      const nueva = await subirImagen(tipo, orden, comprimida);

      // Reemplaza la imagen del slot si ya existía, o la agrega si era nuevo.
      setImagenes((prev) => [
        ...prev.filter((img) => !(img.tipo === tipo && img.orden === orden)),
        nueva,
      ]);
      console.log('[bloqueImagenes] handleArchivo — completado | slot:', tipo, orden,
        '| comprimida:', Math.round(comprimida.size / 1024), 'KB');
    } catch (err) {
      console.error('[bloqueImagenes] Error en handleArchivo:', err.message);
      setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      setSubiendo(null);
    }
  };

  /**
   * Ejecuta el DELETE de la imagen en confirmación.
   */
  const ejecutarEliminar = async () => {
    if (!imagenAEliminar) return;
    setEliminando(true);
    setError(null);
    console.log('[bloqueImagenes] ejecutarEliminar — request recibido | imagen:',
      imagenAEliminar.id);

    try {
      await eliminarImagen(imagenAEliminar.id);
      setImagenes((prev) => prev.filter((img) => img.id !== imagenAEliminar.id));
      setAEliminar(null);
      console.log('[bloqueImagenes] ejecutarEliminar — completado');
    } catch (err) {
      console.error('[bloqueImagenes] Error en ejecutarEliminar:', err.message);
      setError('No se pudo eliminar la imagen. Intentá de nuevo.');
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  if (cargando) {
    return (
      <div style={styles.card}>
        <p style={styles.cardTitulo}>Imágenes del negocio</p>
        <p style={styles.estadoTexto}>Cargando imágenes...</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {imagenAEliminar && (
        <ModalConfirmarEliminar
          onConfirmar={ejecutarEliminar}
          onCancelar={() => setAEliminar(null)}
          eliminando={eliminando}
        />
      )}

      {/* Input de archivo oculto, compartido por todos los slots. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleArchivo}
        style={{ display: 'none' }}
      />

      <p style={styles.cardTitulo}>Imágenes del negocio</p>
      <p style={styles.cardHint}>
        Se muestran en la página de reservas de los clientes. Las imágenes se
        optimizan automáticamente al subirlas.
      </p>

      {error && <p style={styles.errorTextoInline}>{error}</p>}

      {GRUPOS.map((grupo) => (
        <div key={grupo.tipo} style={styles.grupo}>
          <p style={styles.grupoTitulo}>{grupo.titulo}</p>
          <p style={styles.grupoHint}>{grupo.hint}</p>
          <div style={styles.slots}>
            {Array.from({ length: grupo.cantidad }, (_, i) => i + 1).map((orden) => {
              const imagen = imagenDe(grupo.tipo, orden);
              const esteSubiendo = subiendo === `${grupo.tipo}-${orden}`;
              return (
                <div
                  key={orden}
                  style={styles.slot}
                  onClick={() => abrirSelector(grupo.tipo, orden)}
                  title={imagen ? 'Click para reemplazar' : 'Click para subir una imagen'}
                >
                  {esteSubiendo ? (
                    <span style={styles.slotTexto}>Subiendo...</span>
                  ) : imagen ? (
                    <>
                      <img src={imagen.url} alt="" style={styles.slotImg} />
                      <button
                        style={styles.btnBorrarSlot}
                        onClick={(e) => { e.stopPropagation(); setError(null); setAEliminar(imagen); }}
                        title="Eliminar imagen"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span style={styles.slotMas}>+</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardTitulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  cardHint: {
    fontSize: '13px',
    color: '#aaaaaa',
    margin: 0,
  },
  grupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  grupoTitulo: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
  },
  grupoHint: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: 0,
  },
  slots: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '2px',
  },
  slot: {
    position: 'relative',
    width: '96px',
    height: '96px',
    borderRadius: '12px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  slotImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  slotMas: {
    fontSize: '32px',
    color: '#cccccc',
    fontWeight: '300',
    lineHeight: '1',
  },
  slotTexto: {
    fontSize: '12px',
    color: '#888888',
  },
  btnBorrarSlot: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    borderRadius: '7px',
    border: 'none',
    backgroundColor: 'rgba(192,57,43,0.92)',
    color: '#ffffff',
    fontSize: '16px',
    lineHeight: '1',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  estadoTexto: {
    color: '#888888',
    fontSize: '14px',
    margin: 0,
  },
  errorTextoInline: {
    color: '#c0392b',
    fontSize: '13px',
    margin: 0,
  },
  // --- Modal ---
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: '20px',
    padding: '32px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: "'DM Sans', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  modalTitulo: {
    fontSize: '20px', fontWeight: '700', color: '#111111',
    margin: 0, textAlign: 'center',
  },
  modalAdvertencia: {
    fontSize: '13px', color: '#c0392b', textAlign: 'center', margin: 0,
  },
  modalBotones: { display: 'flex', gap: '12px' },
  btnCancelar: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: '1.5px solid #e0e0e0', backgroundColor: '#ffffff',
    color: '#444444', fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnConfirmarRojo: {
    flex: 1, padding: '13px 0', borderRadius: '12px',
    border: 'none', backgroundColor: '#c0392b',
    color: '#ffffff', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
