// /frontend-turnero/src/components/ui/HeroLocal.jsx
// Hero del local: la foto del local de borde a borde y, encima, abajo, el
// logo, el nombre y el estado abierto/cerrado sobre un degradado oscuro.
// Dos lugares lo usan:
//   - la landing en el celular, arriba de todo (ALTO_HERO);
//   - el panel de la pantalla ancha (MarcoLocal), a todo el alto (`lleno`).
//
// Las imágenes llegan en `imagenes` (GET /api/negocio/imagenes). Cada una es
// { id, tipo, orden, url }:
//   - tipo 'logo'  orden 1 → círculo del hero (sin logo: iniciales).
//   - tipo 'local' orden 1 → foto del hero (sin foto: bloque liso oscuro).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { calcularEstadoNegocio } from '../../utils/estadoNegocio.js';
import AvatarIniciales from './AvatarIniciales.jsx';

/**
 * ALTO_HERO
 * Alto del hero con foto en el celular: ~45 % de la pantalla, con topes para
 * pantallas muy bajas o muy altas. `svh` (alto con las barras del navegador
 * visibles) no cambia al scrollear, a diferencia de `dvh`: así el hero no se
 * redimensiona cuando Safari o el navegador de Instagram esconden sus barras.
 * Si un navegador viejo no entiende `svh`, ignora ese alto y queda el mínimo.
 * Lo comparten el hero y su skeleton.
 */
const ALTO_HERO = { height: '45svh', minHeight: 260, maxHeight: 440 };

/**
 * HeroLocal
 * Cabecera del local. Con foto: la foto de borde a borde (`object-fit: cover`)
 * y encima, abajo, el logo, el nombre (h1) y el estado sobre un degradado
 * oscuro. Sin foto (o si no carga): un bloque liso oscuro con lo mismo.
 * - Normal (landing del celular): con foto mide ALTO_HERO; sin foto, el alto
 *   de su contenido.
 * - `lleno` (panel de la pantalla ancha): ocupa todo el alto de su contenedor,
 *   con más margen alrededor del texto.
 * @param {Object} props.tenant - { nombre, horario_atencion, feriados }
 * @param {Array<Object>} [props.imagenes] - [{ id, tipo, orden, url }]
 * @param {boolean} [props.lleno=false] - A todo el alto del contenedor (panel)
 */
function HeroLocal({ tenant, imagenes = [], lleno = false }) {
  const logoUrl = imagenes.find((img) => img.tipo === 'logo' && img.orden === 1)?.url || null;
  const fotoUrl = imagenes.find((img) => img.tipo === 'local' && img.orden === 1)?.url || null;
  const estado = calcularEstadoNegocio(tenant.horario_atencion, tenant.feriados);
  const nombre = tenant.nombre;

  // Si la foto o el logo no cargan, se cae a la variante sin imagen.
  const [fotoFallo, setFotoFallo] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  const conFoto = Boolean(fotoUrl) && !fotoFallo;

  let alto = {};
  if (lleno) alto = { height: '100%' };
  else if (conFoto) alto = ALTO_HERO;

  let padding = conFoto ? '48px 16px 20px' : '32px 16px 20px';
  if (lleno) padding = '48px 32px 40px';

  return (
    <header style={{
      ...alto,
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
            console.warn('[HeroLocal] La foto del local no cargó: se muestra el hero sin foto');
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
        padding,
        background: conFoto ? theme.heroScrim : 'none',
      }}>
        <LogoHero
          src={logoFallo ? null : logoUrl}
          nombre={nombre}
          onError={() => {
            console.warn('[HeroLocal] El logo no cargó: se muestran las iniciales');
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
 * HeroLocalSkeleton
 * Silueta del hero del celular mientras carga el tenant: el bloque oscuro con
 * el alto real (como queda antes de que pinte la foto). En el panel no hace
 * falta: el panel ya es un bloque oscuro.
 */
export function HeroLocalSkeleton() {
  return <div aria-hidden="true" style={{ ...ALTO_HERO, background: theme.accent }} />;
}

// ─── Subcomponentes ──────────────────────────────────────────

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

export default HeroLocal;
