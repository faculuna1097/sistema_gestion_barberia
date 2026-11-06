// /frontend-turnero/src/screens/Landing.jsx
// Pantalla de inicio del turnero: la "vidriera" de la barbería.
// Una columna con el CTA "Reservar turno" fijo abajo, y cuatro bloques:
//   1. Hero: foto del local de borde a borde, con logo, nombre y estado
//      abierto/cerrado encima (sobre un degradado oscuro).
//   2. Servicios: filas tocables; preeligen el servicio.
//   3. Equipo: barberos tocables; preeligen el barbero.
//   4. Horarios y contacto: horario semanal desplegable, dirección (→ Maps),
//      teléfono, WhatsApp y link para dejar una reseña en Google.
//
// Las imágenes (logo, foto del local) llegan en el prop `imagenes`, que viene
// de GET /api/negocio/imagenes. Cada imagen es { id, tipo, orden, url }:
//   - tipo 'logo'  orden 1 → círculo del hero (sin logo: iniciales).
//   - tipo 'local' orden 1 → foto del hero (sin foto: bloque liso oscuro).
//
// Servicios y barberos los carga App (useListaRemota) y bajan con su estado
// de carga y error: la landing muestra skeleton, error con reintento o vacío
// en cada sección, sin bloquear el resto.
//
// También exporta LandingSkeleton, la silueta que muestra App mientras carga
// el tenant: usa los mismos bloques que la landing para que no salte nada
// cuando llegan los datos.

import { useState } from 'react';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fechaLocalISO } from '../utils/fecha.js';
import { fmtTelefono, linkWhatsApp } from '../utils/telefono.js';
import { rutaResena } from '../utils/rutas.js';
import { linkMapa } from '../utils/mapa.js';
import { useEleccionConPausa } from '../hooks/useEleccionConPausa.js';
import { useHover, PUEDE_HOVER } from '../hooks/useHover.js';
import {
  PageContainer, Button, StickyFooter, Skeleton, EmptyState, AvatarIniciales, IconoAlerta, IconoPin,
} from '../components/ui';

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
 * ALTO_HERO
 * Alto del hero con foto: ~45 % de la pantalla, con topes para pantallas muy
 * bajas o muy altas. `svh` (alto con las barras del navegador visibles) no
 * cambia al scrollear, a diferencia de `dvh`: así el hero no se redimensiona
 * cuando Safari o el navegador de Instagram esconden sus barras. Si un
 * navegador viejo no entiende `svh`, ignora ese alto y queda el mínimo.
 * Lo comparten el hero y su skeleton.
 */
const ALTO_HERO = { height: '45svh', minHeight: 260, maxHeight: 440 };

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

    if (feriados.some((f) => f.fecha === fechaLocalISO(fecha))) continue;

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
  const hoyEsFeriado = feriados.some((f) => f.fecha === fechaLocalISO(ahora));
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
 * Pantalla inicial del turnero público: muestra la barbería y arranca la
 * reserva, desde el CTA o con un servicio o un barbero ya elegido.
 * @param {Object} props.tenant - { nombre, direccion?, telefono?, whatsapp?, resena_url?, horario_atencion, feriados }
 * @param {Array<Object>} props.imagenes - [{ id, tipo, orden, url }] de GET /api/negocio/imagenes
 * @param {Object} props.servicios - Lista de useListaRemota: { datos, cargando, error, reintentar }
 * @param {Object} props.barberos - Lista de useListaRemota: { datos, cargando, error, reintentar }
 * @param {boolean} props.entradaInicial - True en la primera pantalla de la visita (reemplaza al
 *   skeleton de carga): las listas entran con su animación. Al volver a la landing, no.
 * @param {Function} props.onReservar - CTA "Reservar turno"
 * @param {Function} props.onElegirServicio - Recibe el servicio tocado (tras la pausa de la elección)
 * @param {Function} props.onElegirBarbero - Recibe el barbero tocado (tras la pausa de la elección)
 */
function Landing({
  tenant, imagenes = [], servicios, barberos, entradaInicial,
  onReservar, onElegirServicio, onElegirBarbero,
}) {
  // Logo y foto del local.
  const logoUrl = imagenes.find((img) => img.tipo === 'logo' && img.orden === 1)?.url || null;
  const fotoLocalUrl = imagenes.find((img) => img.tipo === 'local' && img.orden === 1)?.url || null;

  // Estado "abierto/cerrado" calculado desde el horario del tenant.
  const estado = calcularEstadoNegocio(tenant.horario_atencion, tenant.feriados);

  // Una sola elección en curso para servicios y barberos: la fila tocada se
  // marca ~150 ms y recién ahí se avanza; un segundo toque en ese lapso
  // (en cualquiera de las dos listas) se ignora.
  const [elegido, elegir] = useEleccionConPausa(({ tipo, item }) => (
    tipo === 'servicio' ? onElegirServicio(item) : onElegirBarbero(item)
  ));

  // Una lista se anima cuando reemplaza a un skeleton: en la primera entrada
  // (después del de App) o si al montar todavía cargaba o había fallado.
  // Al volver a la landing ya cargada, entra con la pantalla y nada más.
  const [serviciosListosAlEntrar] = useState(!servicios.cargando && !servicios.error);
  const [barberosListosAlEntrar] = useState(!barberos.cargando && !barberos.error);
  const animarServicios = entradaInicial || !serviciosListosAlEntrar;
  const animarEquipo = entradaInicial || !barberosListosAlEntrar;

  return (
    <PageContainer>
      <div style={{ flex: 1 }}>
        <Hero
          nombre={tenant.nombre}
          estado={estado}
          logoUrl={logoUrl}
          fotoUrl={fotoLocalUrl}
        />

        <Secciones>
          <Seccion id="landing-servicios" titulo="Servicios">
            <ContenidoLista
              lista={servicios}
              skeleton={<ServiciosSkeleton />}
              textoError="No pudimos cargar los servicios. Revisá tu conexión e intentá de nuevo."
              tituloVacio="Sin servicios disponibles"
              textoVacio="El negocio todavía no cargó sus servicios."
            >
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {servicios.datos.map((s, i) => (
                  <li
                    key={s.id}
                    className={animarServicios ? 'tt-escalonado' : undefined}
                    style={{
                      '--tt-indice': i,
                      borderTop: i > 0 ? `1px solid ${theme.hairline}` : 'none',
                    }}
                  >
                    <FilaServicio
                      servicio={s}
                      marcada={elegido?.tipo === 'servicio' && elegido.item.id === s.id}
                      onClick={() => elegir({ tipo: 'servicio', item: s })}
                    />
                  </li>
                ))}
              </ul>
            </ContenidoLista>
          </Seccion>

          <Seccion id="landing-equipo" titulo="Equipo">
            <ContenidoLista
              lista={barberos}
              skeleton={<EquipoSkeleton />}
              textoError="No pudimos cargar el equipo. Revisá tu conexión e intentá de nuevo."
              tituloVacio="Sin barberos disponibles"
              textoVacio="El negocio todavía no cargó su equipo."
            >
              <FilaHorizontal className={animarEquipo ? 'tt-aparecer' : undefined}>
                {barberos.datos.map((b) => (
                  <li key={b.id} style={{ flexShrink: 0 }}>
                    <ItemBarbero
                      barbero={b}
                      marcado={elegido?.tipo === 'barbero' && elegido.item.id === b.id}
                      onClick={() => elegir({ tipo: 'barbero', item: b })}
                    />
                  </li>
                ))}
              </FilaHorizontal>
            </ContenidoLista>
          </Seccion>

          <Seccion id="landing-info" titulo="Horarios y contacto">
            <HorarioSemanal horarioAtencion={tenant.horario_atencion} feriados={tenant.feriados} />

            {tenant.direccion && (
              <LineaContacto
                href={linkMapa(tenant.direccion)}
                externo
                icono={<IconoPin />}
                texto={tenant.direccion}
              />
            )}
            {tenant.telefono && (
              <LineaContacto
                href={`tel:${tenant.telefono.replace(/[^\d+]/g, '')}`}
                icono={<IconoTelefono />}
                texto={fmtTelefono(tenant.telefono)}
              />
            )}

            {tenant.whatsapp && (
              <div style={{ marginTop: 16 }}>
                <Button variant="secondary" href={linkWhatsApp(tenant.whatsapp)} externo>
                  <IconoMensaje />
                  Escribinos por WhatsApp
                </Button>
              </div>
            )}

            {/* Pasa por la ruta propia /turnos/resena, que redirige a Google
                (ver utils/rutas.js): el link de Google se puede cambiar sin
                tocar el QR impreso. */}
            {tenant.resena_url && (
              <div style={{ marginTop: tenant.whatsapp ? 8 : 0 }}>
                <LineaContacto
                  href={rutaResena('landing')}
                  externo
                  icono={<IconoEstrella />}
                  texto="Dejanos tu reseña en Google"
                />
              </div>
            )}
          </Seccion>
        </Secciones>
      </div>

      {/* ── CTA principal pegado al fondo ───────────────────── */}
      <StickyFooter>
        <Button onClick={onReservar}>Reservar turno</Button>
      </StickyFooter>
    </PageContainer>
  );
}

/**
 * LandingSkeleton
 * Silueta de la landing mientras App carga el tenant: el hero con su alto
 * real (oscuro, como queda antes de que pinte la foto), los títulos de
 * sección (son fijos, se muestran tal cual) y las filas en skeleton. Usa los
 * mismos bloques que la landing, así nada salta cuando llegan los datos.
 */
export function LandingSkeleton() {
  return (
    <PageContainer>
      <div style={{ flex: 1 }}>
        <div aria-hidden="true" style={{ ...ALTO_HERO, background: theme.accent }} />

        <Secciones>
          <Seccion id="landing-servicios" titulo="Servicios">
            <ServiciosSkeleton />
          </Seccion>
          <Seccion id="landing-equipo" titulo="Equipo">
            <EquipoSkeleton />
          </Seccion>
        </Secciones>
      </div>

      <StickyFooter>
        {/* El botón invisible le da al skeleton el alto exacto del CTA real. */}
        <div style={{ position: 'relative' }}>
          <div aria-hidden="true" style={{ visibility: 'hidden' }}>
            <Button disabled>Reservar turno</Button>
          </div>
          <Skeleton
            height="100%"
            radius={theme.radius}
            style={{ position: 'absolute', inset: 0 }}
          />
        </div>
      </StickyFooter>
    </PageContainer>
  );
}

// ─── Subcomponentes locales ──────────────────────────────────
// Específicos de la landing. Si otra pantalla los necesita, se mueven a
// /components/ui/.

/**
 * Hero
 * Cabecera de la landing. Con foto: la foto de borde a borde (ALTO_HERO,
 * `object-fit: cover`) y encima, abajo, el logo, el nombre y el estado sobre
 * un degradado oscuro. Sin foto (o si no carga): un bloque liso oscuro con lo
 * mismo, al alto de su contenido.
 * @param {string} props.nombre - Nombre del local (h1)
 * @param {{ abierto: boolean, texto: string }} props.estado - De calcularEstadoNegocio
 * @param {string|null} props.logoUrl - URL del logo, o null (iniciales)
 * @param {string|null} props.fotoUrl - URL de la foto del local, o null
 */
function Hero({ nombre, estado, logoUrl, fotoUrl }) {
  // Si la foto o el logo no cargan, se cae a la variante sin imagen.
  const [fotoFallo, setFotoFallo] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  const conFoto = Boolean(fotoUrl) && !fotoFallo;

  return (
    <header style={{
      ...(conFoto ? ALTO_HERO : {}),
      position: 'relative',
      // Fondo oscuro también con foto: es lo que se ve hasta que la foto pinta,
      // y el texto blanco ya se lee encima.
      background: theme.accent,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      {conFoto && (
        <img
          src={fotoUrl}
          alt={`Local de ${nombre}`}
          fetchPriority="high"
          onError={() => {
            console.warn('[Landing] La foto del local no cargó: se muestra el hero sin foto');
            setFotoFallo(true);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Franja del texto. Con foto lleva el degradado y 48 px de transición
          arriba; sin foto, el fondo liso alcanza. */}
      <div style={{
        position: 'relative',
        padding: conFoto ? '48px 16px 20px' : '32px 16px 20px',
        background: conFoto ? theme.heroScrim : 'none',
      }}>
        <LogoHero
          src={logoFallo ? null : logoUrl}
          nombre={nombre}
          onError={() => {
            console.warn('[Landing] El logo no cargó: se muestran las iniciales');
            setLogoFallo(true);
          }}
        />

        <h1 style={{
          margin: '12px 0 0',
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeTitle,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          color: theme.accentInk,
          textWrap: 'balance',
          overflowWrap: 'anywhere',
        }}>{nombre}</h1>

        <p style={{
          margin: '4px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.heroInkSoft,
        }}>
          <DotEstado abierto={estado.abierto} />
          {estado.texto}
        </p>
      </div>
    </header>
  );
}

/**
 * LogoHero
 * Círculo de 64 px con el logo del local y un aro blanco. Sin logo, las
 * iniciales del nombre (AvatarIniciales).
 * @param {string|null} props.src - URL del logo, o null
 * @param {string} props.nombre - Nombre del local (alt y fallback de iniciales)
 * @param {Function} props.onError - Se llama si la imagen no carga
 */
function LogoHero({ src, nombre, onError }) {
  return (
    <div style={{
      width: 64,
      height: 64,
      borderRadius: 999,
      overflow: 'hidden',
      background: theme.surface,
      border: `2px solid ${theme.bg}`,
      flexShrink: 0,
    }}>
      {src ? (
        <img
          src={src}
          alt={`Logo de ${nombre}`}
          onError={onError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <AvatarIniciales nombre={nombre} size={60} />
      )}
    </div>
  );
}

/**
 * DotEstado
 * Punto de estado del negocio en el hero: verde cuando está abierto, gris
 * cuando está cerrado. Acompaña al texto (que dice lo mismo), no lo reemplaza.
 * Colores pensados para el fondo oscuro del hero.
 * @param {boolean} props.abierto - True si el negocio está abierto ahora
 */
function DotEstado({ abierto }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        flexShrink: 0,
        background: abierto ? theme.heroSuccess : theme.mutedSoft,
      }}
    />
  );
}

/**
 * Secciones
 * Contenedor de las secciones debajo del hero: padding lateral de la columna
 * y 32 px entre secciones (densidad aireada del turnero).
 * @param {ReactNode} props.children
 */
function Secciones({ children }) {
  return (
    <div style={{
      padding: '24px 16px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    }}>
      {children}
    </div>
  );
}

/**
 * Seccion
 * Bloque con título h2, asociado por aria-labelledby.
 * @param {string} props.id - id del h2 (único en la página)
 * @param {string} props.titulo - Texto del h2
 * @param {ReactNode} props.children
 */
function Seccion({ id, titulo, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} style={{
        margin: '0 0 8px',
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
        color: theme.ink,
      }}>{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * ContenidoLista
 * Resuelve el estado de una lista remota dentro de su sección: skeleton
 * mientras carga, error con "Reintentar", vacío, o el contenido.
 * @param {Object} props.lista - { datos, cargando, error, reintentar } de useListaRemota
 * @param {ReactNode} props.skeleton - Silueta mientras carga
 * @param {string} props.textoError - Cuerpo del estado de error
 * @param {string} props.tituloVacio - Título del estado vacío
 * @param {string} props.textoVacio - Cuerpo del estado vacío
 * @param {ReactNode} props.children - La lista ya cargada
 */
function ContenidoLista({ lista, skeleton, textoError, tituloVacio, textoVacio, children }) {
  if (lista.cargando) return skeleton;
  if (lista.error) {
    return (
      <EmptyState
        glyph={<IconoAlerta />}
        title="Algo no funcionó"
        body={textoError}
        action={
          <Button variant="secondary" onClick={lista.reintentar} full={false}>
            Reintentar
          </Button>
        }
      />
    );
  }
  if (lista.datos.length === 0) {
    return <EmptyState glyph={<IconoAlerta />} title={tituloVacio} body={textoVacio} />;
  }
  return children;
}

/**
 * estiloFilaServicio
 * Estilo de una fila de servicio. Lo comparten la fila y su skeleton, así
 * miden lo mismo.
 * @param {Object} opciones
 * @param {boolean} [opciones.resaltada=false] - Fondo de hover/marcado
 * @returns {Object} Estilo inline
 */
function estiloFilaServicio({ resaltada = false } = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: 'calc(100% + 16px)',
    margin: '0 -8px',
    padding: '12px 8px',
    minHeight: 44,
    background: resaltada ? theme.surfaceAlt : 'transparent',
    border: 'none',
    borderRadius: theme.radius,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    lineHeight: 1.5,
    // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
    transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
  };
}

/**
 * FilaServicio
 * Fila tocable de un servicio: nombre y duración a la izquierda, precio y
 * chevron a la derecha. El fondo de hover/marcado sobresale 8 px a cada lado
 * para que el texto quede alineado con el título de la sección. El hover solo
 * existe con mouse (useHover).
 * @param {Object} props.servicio - { nombre, precio, duracion_minutos }
 * @param {boolean} props.marcada - True mientras corre la pausa de la elección
 * @param {Function} props.onClick
 */
function FilaServicio({ servicio, marcada, onClick }) {
  const [hover, eventosHover] = useHover();

  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      className="tt-presionable"
      style={estiloFilaServicio({ resaltada: marcada || hover })}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.weightMedium, color: theme.ink }}>
          {servicio.nombre}
        </span>
        <span style={{ display: 'block', color: theme.muted }}>
          {servicio.duracion_minutos} min
        </span>
      </span>
      <span style={{
        flexShrink: 0,
        whiteSpace: 'nowrap',
        fontWeight: theme.weightMedium,
        color: theme.ink,
      }}>
        {fmtPesos(servicio.precio)}
      </span>
      <ChevronDerecha />
    </button>
  );
}

/**
 * ServiciosSkeleton
 * Tres filas de servicio en skeleton, con el mismo alto que las reales
 * (mismo estilo de fila y dos renglones de 21 px).
 */
function ServiciosSkeleton() {
  return (
    <ul aria-hidden="true" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {[0, 1, 2].map((i) => (
        <li key={i} style={{ borderTop: i > 0 ? `1px solid ${theme.hairline}` : 'none' }}>
          <div style={{ ...estiloFilaServicio(), cursor: 'default' }}>
            <div style={{ flex: 1 }}>
              <RenglonSkeleton width="50%" />
              <RenglonSkeleton width="20%" />
            </div>
            <RenglonSkeleton width={64} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * RenglonSkeleton
 * Un renglón de texto de 14 px en skeleton: caja del alto de la línea
 * (14 × 1,5 = 21 px) con la barra de 14 px centrada.
 * @param {number|string} props.width - Ancho de la barra
 */
function RenglonSkeleton({ width }) {
  return (
    <div style={{ height: 21, display: 'flex', alignItems: 'center' }}>
      <Skeleton height={14} width={width} />
    </div>
  );
}

/**
 * FilaHorizontal
 * Lista de ítems en fila que sangra hasta los bordes de la columna. El
 * padding deja lugar al anillo de foco. Si los ítems no entran:
 * - en táctil, scrollea de costado (se desliza con el dedo, sin barra);
 * - con mouse (PUEDE_HOVER), pasa a otro renglón: sin trackpad, un scroll de
 *   costado obliga a usar la barra, y con muchos barberos se veía la barra
 *   del estilo global debajo de la fila.
 * @param {string} [props.className] - Clase de movimiento (ej. tt-aparecer)
 * @param {boolean} [props.oculta] - aria-hidden (para el skeleton)
 * @param {ReactNode} props.children - Los <li>
 */
function FilaHorizontal({ className, oculta, children }) {
  return (
    <ul
      className={className}
      aria-hidden={oculta || undefined}
      style={{
        listStyle: 'none',
        display: 'flex',
        gap: 4,
        ...(PUEDE_HOVER ? { flexWrap: 'wrap' } : { overflowX: 'auto' }),
        margin: '0 -16px',
        padding: '4px 12px',
      }}
    >
      {children}
    </ul>
  );
}

/**
 * estiloItemBarbero
 * Caja de un barbero (y de su skeleton): 88 px de ancho, avatar arriba y
 * nombre abajo.
 */
const estiloItemBarbero = {
  width: 88,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '8px 4px',
  background: 'transparent',
  border: 'none',
  borderRadius: theme.radius,
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  lineHeight: 1.5,
};

/**
 * ItemBarbero
 * Barbero tocable: avatar de iniciales y nombre debajo (hasta dos renglones).
 * Hover (solo con mouse, useHover) y marcado se ven como un aro alrededor del avatar.
 * @param {Object} props.barbero - { id, nombre }
 * @param {boolean} props.marcado - True mientras corre la pausa de la elección
 * @param {Function} props.onClick
 */
function ItemBarbero({ barbero, marcado, onClick }) {
  const [hover, eventosHover] = useHover();

  let aro = 'none';
  if (marcado) aro = `0 0 0 2px ${theme.bg}, 0 0 0 4px ${theme.accent}`;
  else if (hover) aro = `0 0 0 2px ${theme.bg}, 0 0 0 4px ${theme.hairline}`;

  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      className="tt-presionable"
      style={{
        ...estiloItemBarbero,
        cursor: 'pointer',
        transition: `transform ${theme.transitionFast}`,
      }}
    >
      <span style={{
        borderRadius: 999,
        boxShadow: aro,
        transition: `box-shadow ${theme.transitionFast}`,
      }}>
        <AvatarIniciales nombre={barbero.nombre} size={56} />
      </span>
      <span style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        textAlign: 'center',
        color: theme.ink,
      }}>
        {barbero.nombre}
      </span>
    </button>
  );
}

/**
 * EquipoSkeleton
 * Tres barberos en skeleton: avatar y un renglón de nombre.
 */
function EquipoSkeleton() {
  return (
    <FilaHorizontal oculta>
      {[0, 1, 2].map((i) => (
        <li key={i} style={{ flexShrink: 0 }}>
          <div style={estiloItemBarbero}>
            <Skeleton height={56} width={56} radius={999} />
            <RenglonSkeleton width={56} />
          </div>
        </li>
      ))}
    </FilaHorizontal>
  );
}

/**
 * estiloLineaInfo
 * Fila de la sección de info (horario, dirección, teléfono, reseña): ícono +
 * texto, 44 px de alto mínimo (touch target).
 */
const estiloLineaInfo = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  padding: '4px 0',
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  color: theme.inkSoft,
  borderRadius: theme.radiusSm,
};

/**
 * estiloIconoInfo
 * Caja del ícono de una fila de info: 16 px, en `muted`.
 */
const estiloIconoInfo = { display: 'flex', flexShrink: 0, color: theme.muted };

/**
 * HorarioSemanal
 * Fila "Horario de atención" que despliega u oculta la grilla de los 7 días,
 * con el día de hoy resaltado. El estado abierto/cerrado de ahora va en el hero.
 * Cada fila es la próxima vez que cae ese día, de hoy a 6 días adelante (la
 * grilla ya marca "hoy": se lee como esta semana). Si esa fecha es feriado, la
 * fila dice "Cerrado · feriado" en vez del horario, igual que el hero hoy.
 * @param {Array<Object>} props.horarioAtencion - [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} [props.feriados] - Feriados del tenant [{ fecha: 'YYYY-MM-DD' }]
 */
function HorarioSemanal({ horarioAtencion = [], feriados = [] }) {
  const [expandido, setExpandido] = useState(false);

  const hoy = new Date();
  const diaHoy = hoy.getDay();
  const fechasFeriado = new Set(feriados.map((f) => f.fecha));

  /**
   * esFeriadoEstaSemana
   * True si la próxima fecha de ese día de la semana (hoy incluido) es feriado.
   * @param {number} diaSemana - 0=domingo … 6=sábado
   * @returns {boolean}
   */
  const esFeriadoEstaSemana = (diaSemana) => {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + ((diaSemana - diaHoy + 7) % 7));
    return fechasFeriado.has(fechaLocalISO(fecha));
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        aria-controls="grilla-horario"
        style={{
          ...estiloLineaInfo,
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={estiloIconoInfo}><IconoReloj /></span>
        <span style={{ flex: 1 }}>Horario de atención</span>
        <IconoChevron expandido={expandido} />
      </button>

      {expandido && (
        <ul id="grilla-horario" style={{ listStyle: 'none', margin: '0 0 8px', padding: '0 0 0 24px' }}>
          {ORDEN_SEMANA.map((diaSemana, i) => {
            const dia = horarioAtencion.find((h) => h.dia_semana === diaSemana);
            const esHoy = diaSemana === diaHoy;
            let horario = dia ? `${dia.hora_inicio} – ${dia.hora_fin}` : 'Cerrado';
            if (dia && esFeriadoEstaSemana(diaSemana)) horario = 'Cerrado · feriado';
            return (
              <li key={diaSemana} style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '8px 0',
                borderBottom: i < ORDEN_SEMANA.length - 1 ? `1px solid ${theme.hairlineSoft}` : 'none',
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                color: esHoy ? theme.ink : theme.muted,
                fontWeight: esHoy ? theme.weightMedium : theme.weightRegular,
              }}>
                <span>{esHoy ? `${NOMBRES_DIA[diaSemana]} (hoy)` : NOMBRES_DIA[diaSemana]}</span>
                <span>{horario}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * ALTO_RENGLON_INFO
 * Alto de un renglón de texto de la sección de info (14 px × 1,5).
 */
const ALTO_RENGLON_INFO = 21;

/**
 * LineaContacto
 * Fila de contacto clickable: ícono + texto, renderizada como `<a>`.
 * Cumple el touch target mínimo de 44 px; el foco por teclado lo dibuja
 * el :focus-visible global de index.css.
 * Ícono y texto van juntos en un bloque centrado en la fila; adentro, el
 * ícono queda a la altura del primer renglón. Con un renglón se ve igual que
 * centrado; con dos (una dirección larga), el ícono acompaña al principio del
 * texto en vez de quedar entre los dos renglones.
 * @param {string} props.href - Destino del link (`tel:`, mapa, reseñas)
 * @param {boolean} [props.externo=false] - True si el link abre en otra pestaña
 * @param {JSX.Element} props.icono - Ícono a la izquierda
 * @param {string} props.texto - Texto visible
 */
function LineaContacto({ href, externo = false, icono, texto }) {
  return (
    <a
      href={href}
      target={externo ? '_blank' : undefined}
      rel={externo ? 'noopener noreferrer' : undefined}
      style={{ ...estiloLineaInfo, textDecoration: 'none' }}
    >
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: estiloLineaInfo.gap }}>
        <span style={{ ...estiloIconoInfo, height: ALTO_RENGLON_INFO, alignItems: 'center' }}>{icono}</span>
        <span>{texto}</span>
      </span>
    </a>
  );
}

/**
 * ChevronDerecha
 * Flecha derecha de las filas de servicio: indica que la fila avanza.
 */
function ChevronDerecha() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: theme.muted }}>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
 * IconoReloj
 * SVG inline de un reloj, para la fila del horario.
 */
function IconoReloj() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * IconoTelefono
 * SVG inline de un teléfono, para la línea de contacto telefónico.
 */
function IconoTelefono() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * IconoMensaje
 * SVG inline de un globo de conversación, para el botón de WhatsApp.
 * Neutro (sin el logo ni el verde de la marca): el turnero tiene un solo acento.
 */
function IconoMensaje() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * IconoEstrella
 * SVG inline de una estrella, para el link de reseñas.
 */
function IconoEstrella() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Landing;
