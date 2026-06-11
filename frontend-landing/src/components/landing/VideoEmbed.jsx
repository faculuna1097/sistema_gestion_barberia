// /frontend-landing/src/components/landing/VideoEmbed.jsx
// Video del producto con carga liviana (patrón "facade"): muestra el poster con
// un botón de play y recién al hacer click monta el <video> o el <iframe> de
// YouTube. Así la página no descarga el video ni el iframe pesado de YouTube en
// la carga inicial. Soporta MP4 self-host (src) o YouTube "No listado"
// (youtubeId). Sin medio configurado → placeholder neutro.

import { useState } from 'react';
import { Play, Video as VideoIcon } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * VideoEmbed
 * @param {string} [props.src] - Ruta a un MP4 self-host
 * @param {string} [props.youtubeId] - Id de un video de YouTube
 * @param {string} [props.poster] - Imagen de portada
 * @param {string} [props.aspect='16 / 9'] - Relación de aspecto del marco
 * @param {string} [props.title='Video del producto'] - Título accesible
 * @param {Object} [props.style] - Override del contenedor
 */
function VideoEmbed({ src, youtubeId, poster, aspect = '16 / 9', title = 'Video del producto', style }) {
  const [playing, setPlaying] = useState(false);
  const hasMedia = Boolean(src || youtubeId);

  // Marco común (mismo aire que ScreenshotFrame, sin glassmorphism).
  const frame = {
    position: 'relative',
    aspectRatio: aspect,
    width: '100%',
    borderRadius: theme.radiusLg,
    border: `1px solid ${theme.hairline}`,
    background: theme.surfaceAlt,
    boxShadow: theme.shadowLg,
    overflow: 'hidden',
    ...style,
  };

  // Sin video todavía: placeholder.
  if (!hasMedia) {
    return (
      <div style={frame}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: theme.mutedSoft,
          }}
        >
          <VideoIcon size={30} strokeWidth={1.5} aria-hidden="true" />
          <span style={{ fontFamily: theme.body, fontSize: 13 }}>Video del producto</span>
        </div>
      </div>
    );
  }

  // Antes de reproducir: poster + botón de play (facade).
  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Reproducir: ${title}`}
        style={{ ...frame, padding: 0, cursor: 'pointer', display: 'block' }}
      >
        {poster && (
          <img
            src={poster}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 999,
              background: theme.accent,
              color: theme.accentInk,
              boxShadow: theme.shadowLg,
            }}
          >
            <Play size={26} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  }

  // Reproduciendo.
  return (
    <div style={frame}>
      {src ? (
        <video
          src={src}
          poster={poster}
          controls
          autoPlay
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
      ) : (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      )}
    </div>
  );
}

export default VideoEmbed;
