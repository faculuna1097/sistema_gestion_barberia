// /frontend-turnero/src/screens/Landing.jsx
// Pantalla 1: Landing del tenant — hero + avatar + nombre + meta + CTA.
//
// Imágenes y meta esperadas en `tenant` (futuras columnas en DB):
//   - tenant.nombre          (existe hoy)
//   - tenant.foto_local_url  (futuro — hero horizontal)
//   - tenant.avatar_url      (futuro — logo circular, reemplaza al `tenant.logo_url` actual)
//   - tenant.direccion       (futuro)
//   - tenant.telefono        (futuro)
// Si los campos no existen todavía, se renderizan placeholders neutros.

import { theme } from '../theme/tokens.js';
import { PageContainer, Button, StickyFooter } from '../components/ui';

/**
 * Landing
 * Pantalla inicial del turnero público: muestra el tenant y arranca el wizard.
 * @param {Object} props.tenant - { nombre, logo_url, foto_local_url?, avatar_url?, direccion?, telefono? }
 * @param {Function} props.onReservar - Callback al presionar el CTA principal
 */
function Landing({ tenant, onReservar }) {
  // Avatar URL: priorizamos avatar_url futuro, caemos a logo_url actual.
  const avatarUrl = tenant.avatar_url || tenant.logo_url || null;
  const fotoLocalUrl = tenant.foto_local_url || null;

  return (
    <PageContainer>
      {/* ── Contenido scrolleable ────────────────────────────── */}
      <div style={{ flex: 1, padding: '16px 16px 24px' }}>
        {/* Hero horizontal con foto del local (placeholder si no hay) */}
        <HeroFoto src={fotoLocalUrl} altText={`Foto de ${tenant.nombre}`} />

        {/* Avatar circular, superpuesto al hero (margin-top negativo) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: -40,
          marginBottom: 16,
        }}>
          <AvatarLogo src={avatarUrl} altText={tenant.nombre} />
        </div>

        {/* Bloque de identidad — nombre + dirección + teléfono */}
        <div style={{ textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeTitle,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: theme.ink,
            margin: 0,
          }}>{tenant.nombre}</h1>

          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 8,
          }}>
            {tenant.direccion || 'Dirección del local'}
          </div>

          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 2,
          }}>
            {tenant.telefono || 'Teléfono de contacto'}
          </div>
        </div>
      </div>

      {/* ── CTA principal pegado al fondo ───────────────────── */}
      <StickyFooter>
        <Button onClick={onReservar}>Reservar turno</Button>
      </StickyFooter>
    </PageContainer>
  );
}

// ─── Subcomponentes locales ──────────────────────────────────
// Mantengo HeroFoto y AvatarLogo en este archivo porque son específicos
// de la Landing. Si en el futuro otra pantalla los necesita, los movemos a /components/ui/.

/**
 * HeroFoto
 * Caja horizontal con la foto del local. Si no hay src, renderiza placeholder con ícono cámara.
 * @param {string|null} props.src - URL de la foto (o null para mostrar placeholder)
 * @param {string} props.altText
 */
function HeroFoto({ src, altText }) {
  return (
    <div style={{
      width: '100%',
      aspectRatio: '16 / 9',
      borderRadius: theme.radiusLg,
      overflow: 'hidden',
      background: theme.surfaceAlt,
      border: `1px solid ${theme.hairline}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {src ? (
        <img
          src={src}
          alt={altText}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <PlaceholderImagen label="Foto del local" />
      )}
    </div>
  );
}

/**
 * AvatarLogo
 * Círculo 80px con el logo/avatar del tenant. Placeholder si no hay src.
 * @param {string|null} props.src - URL del avatar (o null)
 * @param {string} props.altText
 */
function AvatarLogo({ src, altText }) {
  return (
    <div style={{
      width: 80,
      height: 80,
      borderRadius: 999,
      overflow: 'hidden',
      background: theme.surface,
      border: `3px solid ${theme.bg}`,
      boxShadow: theme.shadowMd,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {src ? (
        <img
          src={src}
          alt={altText}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          background: theme.surfaceAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.mutedSoft,
        }}>
          <IconoCamara size={24} />
        </div>
      )}
    </div>
  );
}

/**
 * PlaceholderImagen
 * Marcador visual estándar para slots de imagen vacíos.
 * @param {string} props.label - Texto descriptivo bajo el ícono
 */
function PlaceholderImagen({ label }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      color: theme.mutedSoft,
    }}>
      <IconoCamara size={28} />
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}

/**
 * IconoCamara
 * SVG inline del ícono de cámara para los placeholders.
 * @param {number} props.size - Tamaño en px (ancho y alto)
 */
function IconoCamara({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export default Landing;
