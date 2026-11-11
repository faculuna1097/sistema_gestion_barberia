// /frontend-alta/src/components/tarjeta/BloquesTarjeta.jsx
// La tarjeta "Tu barbería" completa, por bloques (BLOQUES_REVISION): tu local,
// horario, equipo, servicios y productos, y contacto. La muestran la Revisión
// (pantalla 13), con "Editar" en cada bloque, y "Ya enviada", sin edición.
// A diferencia de la tarjeta del formulario, acá va el detalle entero: cada
// barbero con su comisión y su horario, cada servicio con su precio y su
// duración, cada producto con su stock y todos los datos de contacto.
// Lo que falta se ve como "Falta…" en gris (en la Revisión, el envío igual lo
// marca y lleva a corregirlo).

import { useId } from 'react';
import {
  AtSign, Clock, MapPin, MessageCircle, Package, Phone, Scissors, Star, User,
} from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { BLOQUES_REVISION } from '../../config/pantallas.js';
import { leerEquipo, unirNombres } from '../../utils/equipo.js';
import { fmtPesos } from '../../utils/precio.js';
import {
  duracionTurno, fmtMinutos, leerProductos, leerServicios, minutosServicio,
} from '../../utils/servicios.js';
import { mismoNumero, resenaParaDespues } from '../../utils/contacto.js';
import { fmtTelefonoGuardado, linkCorto, resumirHorarioBarbero } from '../../utils/resumen.js';
import { Button, AvatarIniciales } from '../ui';
import { estiloSoloLector } from '../ui/estilos.js';
import { Renglon, TextoHorario } from './PartesTarjeta.jsx';

/**
 * estiloSecundario
 * Texto de un segundo renglón: chico de jerarquía, mismo tamaño (§3.6: nunca
 * bajar de 14 en texto que se lee).
 */
const estiloSecundario = { fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted };

/**
 * FilaConMonto
 * Un ítem con su precio a la derecha (servicios y productos). El precio va en
 * `ink`, como todo precio (sistema_de_disenio.md §3.1.1).
 * @param {string} props.nombre
 * @param {string} props.monto - Ya formateado ('' si falta)
 * @param {string} [props.detalle] - Segundo renglón, en muted
 * @returns {JSX.Element}
 */
function FilaConMonto({ nombre, monto, detalle }) {
  return (
    <li style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: nombre ? theme.ink : theme.muted }}>{nombre || 'Sin nombre'}</span>
        <span style={{
          flexShrink: 0,
          fontWeight: theme.weightMedium,
          fontVariantNumeric: 'tabular-nums',
          color: monto ? theme.ink : theme.muted,
        }}>
          {monto || 'Sin precio'}
        </span>
      </div>
      {detalle && <span style={estiloSecundario}>{detalle}</span>}
    </li>
  );
}

/**
 * ContenidoLocal — la dirección (el nombre y el link van en la cabecera de la tarjeta).
 * @param {Object} props.datos
 * @returns {JSX.Element}
 */
function ContenidoLocal({ datos }) {
  return (
    <Renglon icono={<MapPin size={16} strokeWidth={1.75} />} etiqueta="Dirección" placeholder="Falta la dirección">
      {datos.local?.direccion?.trim()}
    </Renglon>
  );
}

/**
 * ContenidoHorario — los días y el horario del local, con la pausa.
 * @param {Object} props.datos
 * @returns {JSX.Element}
 */
function ContenidoHorario({ datos }) {
  const hayDias = (datos.local?.horario?.length ?? 0) > 0;
  return (
    <Renglon icono={<Clock size={16} strokeWidth={1.75} />} etiqueta="Horario" placeholder="Faltan los días y el horario">
      {hayDias ? <TextoHorario datos={datos} /> : null}
    </Renglon>
  );
}

/**
 * ContenidoEquipo — cada barbero (avatar, nombre, comisión, si es dueño, su
 * horario y su mail) y los dueños que no cortan.
 * @param {Object} props.datos
 * @returns {JSX.Element}
 */
function ContenidoEquipo({ datos }) {
  const { barberos, dueniosSinCorte } = leerEquipo(datos);
  const sinCorte = dueniosSinCorte.map((d) => (d?.nombre ?? '').trim()).filter(Boolean);
  if (barberos.length === 0) {
    return <p style={estiloSecundario}>Faltan los barberos.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {barberos.map((barbero, i) => {
          const nombre = (barbero.nombre ?? '').trim();
          const email = (barbero.email ?? '').trim();
          return (
            <li key={barbero.clave ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* 28 px (iniciales de 11): con 24 quedaban en 9 px. Sube 4 px
                  para centrarse con el primer renglón (20 px de alto). */}
              <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0, marginTop: -4 }}>
                <AvatarIniciales nombre={nombre} size={28} />
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ minWidth: 0, fontWeight: theme.weightMedium, overflowWrap: 'anywhere' }}>
                    {nombre || 'Sin nombre'}
                    {barbero.es_duenio === true && <span style={{ fontWeight: theme.weightRegular, color: theme.muted }}> · Dueño</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {Number.isInteger(barbero.comision) ? `${barbero.comision} %` : '—'}
                    <span style={estiloSoloLector}> de comisión</span>
                  </span>
                </div>
                {resumirHorarioBarbero(barbero).map((linea) => (
                  <span key={linea} style={estiloSecundario}>{linea}</span>
                ))}
                {email && <span style={{ ...estiloSecundario, overflowWrap: 'anywhere' }}>{email}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {sinCorte.length > 0 && (
        <p style={estiloSecundario}>
          {`${sinCorte.length === 1 ? 'Dueño que no corta' : 'Dueños que no cortan'}: `}
          <span style={{ color: theme.ink }}>{unirNombres(sinCorte)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * ContenidoServicios — el largo del turno, cada servicio y cada producto.
 * @param {Object} props.datos
 * @returns {JSX.Element}
 */
function ContenidoServicios({ datos }) {
  const turno = duracionTurno(datos);
  const servicios = leerServicios(datos);
  const productos = leerProductos(datos);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Renglon icono={<Clock size={16} strokeWidth={1.75} />} etiqueta="Turnos" placeholder="Falta el largo del turno">
        {turno ? `Turnos cada ${turno} min` : null}
      </Renglon>

      <Renglon icono={<Scissors size={16} strokeWidth={1.75} />} etiqueta="Servicios" placeholder="Faltan los servicios">
        {servicios.length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {servicios.map((s, i) => {
              const minutos = minutosServicio(s, turno);
              return (
                <FilaConMonto
                  key={s.clave ?? i}
                  nombre={(s.nombre ?? '').trim()}
                  monto={fmtPesos(s.precio)}
                  detalle={minutos ? fmtMinutos(minutos) : 'Sin duración'}
                />
              );
            })}
          </ul>
        ) : null}
      </Renglon>

      <Renglon icono={<Package size={16} strokeWidth={1.75} />} etiqueta="Productos" placeholder="Sin productos">
        {productos.length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {productos.map((p, i) => (
              <FilaConMonto
                key={p.clave ?? i}
                nombre={(p.nombre ?? '').trim()}
                monto={fmtPesos(p.precio)}
                detalle={[
                  Number.isInteger(p.stock) ? `Stock ${p.stock}` : 'Sin stock',
                  Number.isInteger(p.stock_minimo) && p.stock_minimo > 0 ? `mínimo ${p.stock_minimo}` : null,
                ].filter(Boolean).join(' · ')}
              />
            ))}
          </ul>
        ) : null}
      </Renglon>
    </div>
  );
}

/**
 * ContenidoContacto — WhatsApp, teléfono y reseñas del local, y el contacto del dueño.
 * @param {Object} props.datos
 * @returns {JSX.Element}
 */
function ContenidoContacto({ datos }) {
  const whatsapp = fmtTelefonoGuardado(datos.local?.whatsapp);
  const telefono = fmtTelefonoGuardado(datos.local?.telefono);
  const mismo = mismoNumero(datos) || (telefono !== '' && datos.local?.telefono === datos.local?.whatsapp);
  const resena = linkCorto(datos.local?.resena_url);
  const { nombre, celular, email } = datos.contacto ?? {};
  const celularVisible = fmtTelefonoGuardado(celular);

  let textoResena = resena;
  if (!resena) textoResena = resenaParaDespues(datos) ? 'Lo pasás después' : 'Sin link de reseñas';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Renglon icono={<MessageCircle size={16} strokeWidth={1.75} />} etiqueta="WhatsApp" placeholder="Falta el WhatsApp">
        {whatsapp ? <>{whatsapp} <span style={{ color: theme.muted }}>· WhatsApp</span></> : null}
      </Renglon>
      <Renglon icono={<Phone size={16} strokeWidth={1.75} />} etiqueta="Teléfono" placeholder="Falta el teléfono">
        {mismo && whatsapp ? <span style={{ color: theme.muted }}>Llamadas al mismo número</span> : telefono || null}
      </Renglon>
      <Renglon icono={<Star size={16} strokeWidth={1.75} />} etiqueta="Reseñas" placeholder="">
        <span style={{ color: resena ? theme.ink : theme.muted }}>{textoResena}</span>
      </Renglon>
      <div style={{ height: 4 }} aria-hidden="true" />
      <Renglon icono={<User size={16} strokeWidth={1.75} />} etiqueta="Tu contacto" placeholder="Faltan tus datos">
        {(nombre ?? '').trim() || celularVisible ? (
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{(nombre ?? '').trim() || 'Falta tu nombre'}</span>
            <span style={estiloSecundario}>{celularVisible || 'Falta tu celular'}</span>
          </span>
        ) : null}
      </Renglon>
      <Renglon icono={<AtSign size={16} strokeWidth={1.75} />} etiqueta="Tu mail" placeholder="Falta tu mail">
        {(email ?? '').trim()}
      </Renglon>
    </div>
  );
}

const CONTENIDO_POR_BLOQUE = {
  local: ContenidoLocal,
  horario: ContenidoHorario,
  equipo: ContenidoEquipo,
  servicios: ContenidoServicios,
  contacto: ContenidoContacto,
};

/**
 * BloquesTarjeta
 * @param {Object} props.datos - El formulario completo
 * @param {Function} [props.onEditar] - Recibe el bloque ({ id, titulo, pantallas });
 *   sin él, no hay botones de "Editar" ("Ya enviada")
 * @returns {JSX.Element}
 */
function BloquesTarjeta({ datos, onEditar }) {
  const idBase = useId();
  return (
    <>
      {BLOQUES_REVISION.map((bloque) => {
        const Contenido = CONTENIDO_POR_BLOQUE[bloque.id];
        const tituloId = `${idBase}-${bloque.id}`;
        return (
          <section
            key={bloque.id}
            aria-labelledby={tituloId}
            style={{
              marginTop: 12,
              paddingTop: onEditar ? 4 : 12,
              borderTop: `1px solid ${theme.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              gap: onEditar ? 4 : 8,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              lineHeight: 1.45,
              color: theme.ink,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: onEditar ? 44 : undefined }}>
              <h2 id={tituloId} style={{ fontSize: theme.sizeBody, fontWeight: theme.weightHeading, color: theme.ink }}>
                {bloque.titulo}
              </h2>
              {onEditar && (
                <Button
                  variant="ghost"
                  full={false}
                  onClick={() => onEditar(bloque)}
                  style={{ color: theme.accent, marginRight: -12, flexShrink: 0 }}
                >
                  Editar<span style={estiloSoloLector}>{` ${bloque.titulo.toLowerCase()}`}</span>
                </Button>
              )}
            </div>
            <Contenido datos={datos} />
          </section>
        );
      })}
    </>
  );
}

export default BloquesTarjeta;
