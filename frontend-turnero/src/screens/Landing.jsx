// /frontend-turnero/src/screens/Landing.jsx
// Pantalla 1: Landing del tenant — hero + avatar + nombre + meta + estado + CTA.
//
// Las imágenes (logo, foto del local) llegan en el prop `imagenes`, que viene
// de GET /api/negocio/imagenes. Cada imagen es { id, tipo, orden, url }:
//   - tipo 'logo'  orden 1 → avatar circular.
//   - tipo 'local' orden 1 → hero horizontal.
// Si un slot no tiene imagen cargada, se renderiza un placeholder neutro.
//
// `tenant.direccion` y `tenant.telefono` son columnas futuras en DB; mientras
// no existan se muestran placeholders de texto.

import { theme } from '../theme/tokens.js';
import { PageContainer, Button, StickyFooter } from '../components/ui';

/**
 * calcularEstadoNegocio
 * Determina si el negocio está abierto en este momento, según su horario
 * de atención semanal y sus feriados. Función pura: usa la hora local del
 * navegador.
 * @param {Array<Object>} horarioAtencion - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} feriados - feriados del tenant [{ fecha }]
 * @returns {{ abierto: boolean, texto: string }} estado + label a mostrar
 */
function calcularEstadoNegocio(horarioAtencion = [], feriados = []) {
  const ahora = new Date();

  // Fecha de hoy en YYYY-MM-DD local, para cruzar contra feriados.
  const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  if (feriados.some((f) => f.fecha === hoyStr)) {
    return { abierto: false, texto: 'Cerrado' };
  }

  // Día de semana 0..6 (0=domingo), misma convención que el backend.
  const dia = horarioAtencion.find((h) => h.dia_semana === ahora.getDay());
  if (!dia) {
    return { abierto: false, texto: 'Cerrado' };
  }

  // Hora actual en 'HH:MM' para comparar como string contra el rango.
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  if (horaActual < dia.hora_inicio) {
    return { abierto: false, texto: `Cerrado · abre ${dia.hora_inicio}` };
  }
  if (horaActual >= dia.hora_fin) {
    return { abierto: false, texto: 'Cerrado' };
  }
  return { abierto: true, texto: `Abierto · cierra ${dia.hora_fin}` };
}

/**
 * Landing
 * Pantalla inicial del turnero público: muestra el tenant y arranca el wizard.
 * @param {Object} props.tenant - { nombre, direccion?, telefono?, horario_atencion, feriados }
 * @param {Array<Object>} props.imagenes - [{ id, tipo, orden, url }] de GET /api/negocio/imagenes
 * @param {Function} props.onReservar - Callback al presionar el CTA principal
 */
function Landing({ tenant, imagenes = [], onReservar }) {
  // Resolvemos los slots usados por la landing (logo y foto del local).
  const logoUrl = imagenes.find((img) => img.tipo === 'logo' && img.orden === 1)?.url || null;
  const fotoLocalUrl = imagenes.find((img) => img.tipo === 'local' && img.orden === 1)?.url || null;

  // Estado "abierto/cerrado" calculado desde el horario del tenant.
  const estado = calcularEstadoNegocio(tenant.horario_atencion, tenant.feriados);

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
          marginTop: -48,
          marginBottom: 16,
        }}>
          <AvatarLogo src={logoUrl} altText={tenant.nombre} />
        </div>

        {/* Bloque de identidad — nombre centrado; info (estado + contacto) a la izquierda */}
        <div style={{ padding: '0 16px' }}>
          <h1 style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeTitle,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: theme.ink,
            margin: 0,
            textAlign: 'center',
          }}>{tenant.nombre}</h1>

          {/* Estado del negocio — eyebrow debajo del nombre, alineado a la izquierda */}
          <EstadoNegocio abierto={estado.abierto} texto={estado.texto} />

          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 4,
          }}>
            {tenant.direccion || 'Dirección del local'}
          </div>

          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 4,
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
      aspectRatio: '4 / 3',
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
 * Círculo 96px con el logo/avatar del tenant. Placeholder si no hay src.
 * @param {string|null} props.src - URL del avatar (o null)
 * @param {string} props.altText
 */
function AvatarLogo({ src, altText }) {
  return (
    <div style={{
      width: 96,
      height: 96,
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
 * EstadoNegocio
 * Eyebrow que indica si el negocio está abierto ahora: dot de color + texto
 * en mono mayúsculas, sin fondo. Dot verde si está abierto, gris si cerrado.
 * @param {boolean} props.abierto - True si el negocio atiende en este momento
 * @param {string} props.texto - Label a mostrar (ej: "Abierto · cierra 20:00")
 */
function EstadoNegocio({ abierto, texto }) {
  const dotColor = abierto ? theme.success : theme.mutedSoft;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      fontFamily: theme.mono,
      fontWeight: theme.weightMedium,
      fontSize: theme.sizeMicro,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: theme.inkSoft,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: dotColor,
      }}/>
      {texto}
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
