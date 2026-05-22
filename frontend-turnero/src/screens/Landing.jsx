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

import { useState } from 'react';
import { theme } from '../theme/tokens.js';
import { PageContainer, Button, StickyFooter } from '../components/ui';

/**
 * NOMBRES_DIA
 * Nombres de día de semana en español, indexados 0..6 (0=domingo),
 * misma convención que `dia_semana` del backend.
 */
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * ORDEN_SEMANA
 * Índices de día (0=domingo) ordenados de lunes a domingo, para listar
 * la grilla semanal en el orden natural de un negocio.
 */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * fechaLocalStr
 * Convierte un Date a 'YYYY-MM-DD' usando la fecha local del navegador.
 * @param {Date} d - Fecha a formatear
 * @returns {string} Ej: "2026-05-22"
 */
function fechaLocalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * buscarProximaApertura
 * Recorre los próximos 7 días buscando el primer día/hora en que el negocio
 * abre. Saltea feriados. Para el día de hoy, solo cuenta si la apertura
 * todavía no pasó.
 * @param {Array<Object>} horarioAtencion - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} feriados - feriados del tenant [{ fecha }]
 * @param {Date} ahora - Momento de referencia
 * @param {string} horaActual - Hora actual en 'HH:MM'
 * @returns {string|null} Ej: "hoy 14:00", "mañana 10:00", "el martes 10:00"; null si no abre en 7 días
 */
function buscarProximaApertura(horarioAtencion, feriados, ahora, horaActual) {
  for (let offset = 0; offset <= 7; offset++) {
    const fecha = new Date(ahora);
    fecha.setDate(ahora.getDate() + offset);

    if (feriados.some((f) => f.fecha === fechaLocalStr(fecha))) continue;

    const dia = horarioAtencion.find((h) => h.dia_semana === fecha.getDay());
    if (!dia) continue;

    // El día de hoy solo cuenta si la apertura todavía no pasó.
    if (offset === 0 && horaActual >= dia.hora_inicio) continue;

    let cuando;
    if (offset === 0) cuando = 'hoy';
    else if (offset === 1) cuando = 'mañana';
    else cuando = `el ${NOMBRES_DIA[fecha.getDay()]}`;

    return `${cuando} ${dia.hora_inicio}`;
  }
  return null;
}

/**
 * calcularEstadoNegocio
 * Determina si el negocio está abierto en este momento, según su horario
 * de atención semanal y sus feriados. Si está cerrado, calcula cuándo abre.
 * Función pura: usa la hora local del navegador.
 * @param {Array<Object>} horarioAtencion - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} feriados - feriados del tenant [{ fecha }]
 * @returns {{ abierto: boolean, texto: string }} estado + label a mostrar
 */
function calcularEstadoNegocio(horarioAtencion = [], feriados = []) {
  const ahora = new Date();

  // Hora actual en 'HH:MM' para comparar como string contra el rango.
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  // Horario de hoy — null si hoy es feriado o el negocio no atiende ese día.
  const hoyEsFeriado = feriados.some((f) => f.fecha === fechaLocalStr(ahora));
  const diaHoy = hoyEsFeriado
    ? null
    : horarioAtencion.find((h) => h.dia_semana === ahora.getDay());

  // Abierto: hay horario hoy y la hora actual cae dentro del rango.
  if (diaHoy && horaActual >= diaHoy.hora_inicio && horaActual < diaHoy.hora_fin) {
    return { abierto: true, texto: `Abierto · cierra ${diaHoy.hora_fin}` };
  }

  // Cerrado: buscar la próxima apertura en los próximos 7 días.
  const proxima = buscarProximaApertura(horarioAtencion, feriados, ahora, horaActual);
  return {
    abierto: false,
    texto: proxima ? `Cerrado · abre ${proxima}` : 'Cerrado',
  };
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

          {/* Estado del negocio + horario semanal desplegable */}
          <HorarioSemanal estado={estado} horarioAtencion={tenant.horario_atencion} />

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
 * HorarioSemanal
 * Bloque de estado del negocio + horario semanal desplegable. La fila de
 * estado (ícono reloj + texto + chevron) es un botón: al activarse muestra
 * u oculta la grilla con los 7 días de la semana, con el día de hoy resaltado.
 * @param {Object} props.estado - { abierto, texto } devuelto por calcularEstadoNegocio
 * @param {Array<Object>} props.horarioAtencion - [{ dia_semana, hora_inicio, hora_fin }]
 */
function HorarioSemanal({ estado, horarioAtencion = [] }) {
  const [expandido, setExpandido] = useState(false);
  const [foco, setFoco] = useState(false);

  const diaHoy = new Date().getDay();
  const colorIcono = estado.abierto ? theme.success : theme.mutedSoft;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Fila de estado — botón que despliega/oculta la grilla semanal */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        aria-expanded={expandido}
        aria-controls="grilla-horario"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          minHeight: 44,
          padding: '4px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.inkSoft,
          outline: foco ? `2px solid ${theme.accent}` : 'none',
          outlineOffset: 2,
          borderRadius: theme.radiusSm,
        }}
      >
        <IconoReloj size={16} color={colorIcono} />
        <span style={{ flex: 1 }}>{estado.texto}</span>
        <IconoChevron expandido={expandido} />
      </button>

      {/* Grilla semanal — visible solo al expandir */}
      {expandido && (
        <ul id="grilla-horario" style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
          {ORDEN_SEMANA.map((diaSemana, i) => {
            const dia = horarioAtencion.find((h) => h.dia_semana === diaSemana);
            const esHoy = diaSemana === diaHoy;
            return (
              <li key={diaSemana} style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '8px 0',
                borderBottom: i < ORDEN_SEMANA.length - 1 ? `1px solid ${theme.hairlineSoft}` : 'none',
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: esHoy ? theme.accent : theme.muted,
                fontWeight: esHoy ? theme.weightMedium : theme.weightRegular,
              }}>
                <span>{NOMBRES_DIA[diaSemana]}</span>
                <span>{dia ? `${dia.hora_inicio} – ${dia.hora_fin}` : 'Cerrado'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * IconoReloj
 * SVG inline de un reloj, para la fila de estado del negocio.
 * @param {number} props.size - Tamaño en px (ancho y alto)
 * @param {string} props.color - Color del trazo
 */
function IconoReloj({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/>
      <path d="M12 7v5l3.5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * IconoChevron
 * SVG inline de un chevron que apunta hacia abajo, y rota 180° al expandir.
 * @param {boolean} props.expandido - True cuando la grilla está desplegada
 */
function IconoChevron({ expandido }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        color: theme.muted,
        transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: `transform ${theme.transitionFast}`,
      }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
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
