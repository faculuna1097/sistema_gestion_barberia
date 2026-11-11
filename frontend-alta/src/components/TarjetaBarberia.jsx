// /frontend-alta/src/components/TarjetaBarberia.jsx
// La tarjeta "Tu barbería", que crece con cada respuesta (plan §5.2 y D7).
// Arriba, el nombre (con su avatar) y el link elegido. Debajo, un renglón por
// dato: la dirección, los días con su horario, el equipo (los avatares, los
// dueños y la comisión), los servicios (con el turno y los productos) y el
// contacto.
//
// Tiene dos formas:
//   - La del formulario (sin `completa`): crece arriba de cada pantalla, con un
//     renglón corto por dato.
//   - La completa (`completa`): el detalle entero por bloques
//     (tarjeta/BloquesTarjeta.jsx). La usan la Revisión, con "Editar" por
//     bloque (`onEditar`), y "Ya enviada", sin edición.
//
// Cómo crece: el renglón de un dato aparece cuando el formulario llega a la
// pantalla que lo pregunta (vacío, con el nombre del dato en gris) y se llena
// mientras se contesta. Así la tarjeta se agranda al cambiar de pantalla, y no
// mientras el cliente toca los botones de abajo (los movería bajo su dedo). Un
// renglón que aparece entra creciendo (al-crecer); los que ya estaban al
// montar la tarjeta (ej. al recargar) no se animan.
//
// Vive en components/ y no en ui/: es del dominio del formulario, y la usan el
// formulario, la Revisión y la pantalla de "Ya enviada".

import { useState } from 'react';
import { Clock, MapPin, MessageCircle, Scissors, Users } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { PANTALLA } from '../config/pantallas.js';
import { leerEquipo, resumirComision, unirNombres } from '../utils/equipo.js';
import { duracionTurno, leerServicios } from '../utils/servicios.js';
import { detalleServicios, fmtTelefonoGuardado, resumirServicios } from '../utils/resumen.js';
import { AvatarIniciales } from './ui';
import { Crece, Renglon, TextoHorario } from './tarjeta/PartesTarjeta.jsx';
import BloquesTarjeta from './tarjeta/BloquesTarjeta.jsx';

// Dominio de los links de las barberías.
const DOMINIO = 'barbermanager.app';

// Avatares del equipo que se dibujan; los demás van como "+N".
const AVATARES_VISIBLES = 6;

// Diámetro de los avatares del equipo: 28 px, con iniciales de 11 (sizeMicro).
// Con 24 las iniciales quedaban en 9 px. El renglón crece 8 px respecto del
// texto (20 px), y los avatares se pisan 8 px para que seis entren junto a
// los nombres en 375 px.
const TAMANIO_AVATAR = 28;

/**
 * TextoEquipo
 * El equipo en dos renglones: los avatares superpuestos con los nombres y,
 * debajo, los dueños y la comisión ("Dueño: Juan · Comisión 50 %"). Un avatar
 * que no estaba al montar la tarjeta aparece con om-pop (D7); con "reducir
 * movimiento", om-pop no anima (index.css).
 * @param {Object} props.datos
 * @param {Set<string>} props.clavesAlMontar - Barberos que ya estaban al montar
 * @returns {JSX.Element|null} null si no hay barberos.
 */
function TextoEquipo({ datos, clavesAlMontar }) {
  const { barberos, duenios } = leerEquipo(datos);
  if (barberos.length === 0) return null;
  const nombres = barberos.map((b) => (b.nombre ?? '').trim()).filter(Boolean);
  const visibles = barberos.slice(0, AVATARES_VISIBLES);
  const resto = barberos.length - visibles.length;
  const comision = resumirComision(datos);

  const detalle = [
    duenios.length > 0 ? `${duenios.length === 1 ? 'Dueño' : 'Dueños'}: ${unirNombres(duenios)}` : null,
    comision ? `Comisión ${comision}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
          {visibles.map((b, i) => (
            <span key={b.clave ?? i} style={{
              display: 'inline-flex',
              marginLeft: i === 0 ? 0 : -8,
              borderRadius: 999,
              // El anillo del color de la tarjeta separa un avatar del de al lado.
              boxShadow: `0 0 0 2px ${theme.surface}`,
              animation: clavesAlMontar.has(b.clave) ? undefined : 'om-pop 220ms cubic-bezier(0.25, 1, 0.5, 1) backwards',
            }}>
              <AvatarIniciales nombre={(b.nombre ?? '').trim()} size={TAMANIO_AVATAR} />
            </span>
          ))}
        </span>
        <span style={{ minWidth: 0 }}>
          {unirNombres(nombres)}
          {resto > 0 && <span style={{ color: theme.muted }}>{` y ${resto} más`}</span>}
        </span>
      </span>
      {detalle && <span style={{ color: theme.muted }}>{detalle}</span>}
    </span>
  );
}

/**
 * TextoServicios
 * Los servicios en dos renglones: los nombres ("Corte, Barba y Corte y
 * barba") y, debajo, el turno y los productos ("Turnos de 30 min · 2 productos").
 * Sin servicios todavía, el turno va arriba.
 * @param {Object} props.datos
 * @returns {JSX.Element|null} null si no hay ni turno ni servicios.
 */
function TextoServicios({ datos }) {
  const nombres = resumirServicios(datos);
  const detalle = detalleServicios(datos);
  if (!nombres && !detalle) return null;
  if (!nombres) return <span>{detalle}</span>;
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      <span>{nombres}</span>
      {detalle && <span style={{ color: theme.muted }}>{detalle}</span>}
    </span>
  );
}

/**
 * TextoContacto
 * El WhatsApp del local y, debajo, a quién contactar ("Contacto: Juan").
 * @param {Object} props.datos
 * @returns {JSX.Element|null} null si no hay ninguno de los dos.
 */
function TextoContacto({ datos }) {
  const whatsapp = fmtTelefonoGuardado(datos?.local?.whatsapp);
  const contacto = (datos?.contacto?.nombre ?? '').trim();
  if (!whatsapp && !contacto) return null;
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      {whatsapp && <span>{whatsapp}</span>}
      {contacto && <span style={{ color: theme.muted }}>{`Contacto: ${contacto}`}</span>}
    </span>
  );
}

/**
 * TarjetaBarberia
 * @param {Object} props.datos - El formulario completo (utils/datosSolicitud.js)
 * @param {number} [props.pantalla] - Pantalla actual del formulario: muestra
 *   vacíos los renglones de lo que ya se preguntó. Sin ella, solo van los
 *   renglones con datos.
 * @param {boolean} [props.completa=false] - El detalle entero por bloques
 *   (Revisión y "Ya enviada"), en lugar de los renglones cortos
 * @param {Function} [props.onEditar] - Con `completa`: recibe el bloque a
 *   editar; sin él, no hay "Editar"
 * @returns {JSX.Element}
 */
function TarjetaBarberia({ datos, pantalla, completa = false, onEditar }) {
  const nombre = datos?.local?.nombre?.trim() ?? '';
  const subdominio = datos?.local?.subdominio?.trim() ?? '';
  const direccion = datos?.local?.direccion?.trim() ?? '';
  const hayDias = (datos?.local?.horario?.length ?? 0) > 0;
  const hayEquipo = (datos?.barberos?.length ?? 0) > 0;
  const hayServicios = leerServicios(datos ?? {}).length > 0 || duracionTurno(datos) !== null;
  const hayContacto = Boolean(fmtTelefonoGuardado(datos?.local?.whatsapp) || (datos?.contacto?.nombre ?? '').trim());

  // Desde qué pantalla se ve cada renglón, aunque esté vacío.
  const llego = (numero) => pantalla !== undefined && pantalla >= numero;
  const verDireccion = Boolean(direccion) || llego(PANTALLA.DIRECCION);
  const verHorario = hayDias || llego(PANTALLA.DIAS);
  const verEquipo = hayEquipo || llego(PANTALLA.BARBEROS);
  const verServicios = hayServicios || llego(PANTALLA.LARGO_TURNO);
  const verContacto = hayContacto || llego(PANTALLA.CONTACTO_LOCAL);
  const verDetalle = verDireccion || verHorario || verEquipo || verServicios || verContacto;

  // Lo que ya se veía al montar la tarjeta no entra creciendo.
  const [alMontar] = useState(() => ({
    detalle: verDetalle,
    direccion: verDireccion,
    horario: verHorario,
    equipo: verEquipo,
    servicios: verServicios,
    contacto: verContacto,
    claves: new Set((datos?.barberos ?? []).map((b) => b.clave)),
  }));

  return (
    <section
      aria-label="Tu barbería"
      style={{
        padding: 16,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {nombre ? (
          <AvatarIniciales nombre={nombre} size={40} />
        ) : (
          // Sin nombre todavía: el lugar del avatar, vacío.
          <div aria-hidden="true" style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 999,
            border: `1px dashed ${theme.mutedSoft}`,
          }} />
        )}

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <p style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightHeading,
            color: nombre ? theme.ink : theme.muted,
            overflowWrap: 'anywhere',
          }}>
            {nombre || 'Tu barbería'}
          </p>
          <p style={{
            fontFamily: subdominio ? theme.mono : theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            overflowWrap: 'anywhere',
          }}>
            {subdominio ? (
              // Bloques en línea: si no entra, corta entre el link y el dominio, no en un guion.
              <>
                <span style={{ display: 'inline-block', maxWidth: '100%' }}>{subdominio}</span>
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{`.${DOMINIO}`}</span>
              </>
            ) : 'Se arma con tus respuestas.'}
          </p>
        </div>
      </div>

      {completa && <BloquesTarjeta datos={datos} onEditar={onEditar} />}

      {!completa && verDetalle && (
        <Crece animar={!alMontar.detalle}>
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${theme.hairline}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {verDireccion && (
              <Crece animar={alMontar.detalle && !alMontar.direccion}>
                <Renglon icono={<MapPin size={16} strokeWidth={1.75} />} etiqueta="Dirección" placeholder="Dirección">
                  {direccion}
                </Renglon>
              </Crece>
            )}
            {verHorario && (
              <Crece animar={alMontar.detalle && !alMontar.horario}>
                <Renglon icono={<Clock size={16} strokeWidth={1.75} />} etiqueta="Horario" placeholder="Días y horario">
                  {hayDias ? <TextoHorario datos={datos} /> : null}
                </Renglon>
              </Crece>
            )}
            {verEquipo && (
              <Crece animar={alMontar.detalle && !alMontar.equipo}>
                <Renglon icono={<Users size={16} strokeWidth={1.75} />} etiqueta="Equipo" placeholder="Barberos y dueños">
                  {hayEquipo ? <TextoEquipo datos={datos} clavesAlMontar={alMontar.claves} /> : null}
                </Renglon>
              </Crece>
            )}
            {verServicios && (
              <Crece animar={alMontar.detalle && !alMontar.servicios}>
                <Renglon icono={<Scissors size={16} strokeWidth={1.75} />} etiqueta="Servicios" placeholder="Turnos y servicios">
                  {hayServicios ? <TextoServicios datos={datos} /> : null}
                </Renglon>
              </Crece>
            )}
            {verContacto && (
              <Crece animar={alMontar.detalle && !alMontar.contacto}>
                <Renglon icono={<MessageCircle size={16} strokeWidth={1.75} />} etiqueta="Contacto" placeholder="WhatsApp y contacto">
                  {hayContacto ? <TextoContacto datos={datos} /> : null}
                </Renglon>
              </Crece>
            )}
          </div>
        </Crece>
      )}
    </section>
  );
}

export default TarjetaBarberia;
