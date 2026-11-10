// /frontend-alta/src/components/TarjetaBarberia.jsx
// La tarjeta "Tu barbería", que crece con cada respuesta (plan §5.2 y D7).
// Arriba, el nombre (con su avatar) y el link elegido. Debajo, un renglón por
// dato del local: la dirección y los días con su horario. Las fases 4 y 5 le
// suman el equipo, los servicios y el contacto, y la Revisión la muestra
// completa con "Editar" por bloque.
//
// Cómo crece: el renglón de un dato aparece cuando el formulario llega a la
// pantalla que lo pregunta (vacío, con el nombre del dato en gris) y se llena
// mientras se contesta. Así la tarjeta se agranda al cambiar de pantalla, y no
// mientras el cliente toca los botones de abajo (los movería bajo su dedo). Un
// renglón que aparece entra creciendo (al-crecer); los que ya estaban al
// montar la tarjeta (ej. al recargar) no se animan.
//
// Vive en components/ y no en ui/: es del dominio del formulario, y la usan el
// formulario, la pantalla de "Ya enviada" y (fase 5) la Revisión.

import { useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { PANTALLA } from '../config/pantallas.js';
import { gruposPorRango, leerHorarioLocal } from '../utils/horarioLocal.js';
import { resumirDias } from '../utils/semana.js';
import { fmtRango } from '../utils/horas.js';
import { AvatarIniciales } from './ui';
import { estiloSoloLector } from './ui/estilos.js';

// Dominio de los links de las barberías.
const DOMINIO = 'barbermanager.app';

/**
 * Crece
 * Envuelve algo que puede aparecer después de montada la tarjeta: si no
 * estaba al montarla, entra creciendo (al-crecer, index.css).
 * @param {boolean} props.animar - Si entra creciendo
 * @param {ReactNode} props.children
 * @returns {JSX.Element}
 */
function Crece({ animar, children }) {
  if (!animar) return children;
  return (
    <div className="al-crecer">
      <div>{children}</div>
    </div>
  );
}

/**
 * Renglon
 * Un dato de la tarjeta: ícono y texto. Vacío, muestra `placeholder` en gris.
 * @param {ReactNode} props.icono - Ícono Lucide de 16 (decorativo)
 * @param {string} props.etiqueta - Qué dato es, para el lector ("Dirección")
 * @param {ReactNode} [props.children] - El valor; si no hay, va el placeholder
 * @param {string} props.placeholder
 * @returns {JSX.Element}
 */
function Renglon({ icono, etiqueta, children, placeholder }) {
  const vacio = !children;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', paddingTop: 2, color: theme.muted, flexShrink: 0 }}>
        {icono}
      </span>
      <div style={{
        minWidth: 0,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: 1.45,
        color: vacio ? theme.muted : theme.ink,
        overflowWrap: 'anywhere',
      }}>
        <span style={estiloSoloLector}>{`${etiqueta}: `}</span>
        {vacio ? placeholder : children}
      </div>
    </div>
  );
}

/**
 * TextoHorario
 * El horario resumido: una línea por grupo de días con el mismo rango
 * ("Lun a vie · 10:00 a 20:00", "Sáb · 10:00 a 18:00") y la pausa, si hay.
 * @param {Object} props.datos
 * @returns {JSX.Element|null} null si no abre ningún día.
 */
function TextoHorario({ datos }) {
  const grupos = gruposPorRango(datos);
  if (grupos.length === 0) return null;
  const { pausa } = leerHorarioLocal(datos);
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      {grupos.map((g) => (
        <span key={g.dias.join('-')}>
          {`${resumirDias(g.dias)} · ${fmtRango(g.rango)}`}
        </span>
      ))}
      {pausa && <span style={{ color: theme.muted }}>{`Cierran de ${fmtRango(pausa)}`}</span>}
    </span>
  );
}

/**
 * TarjetaBarberia
 * @param {Object} props.datos - El formulario completo (utils/datosSolicitud.js)
 * @param {number} [props.pantalla] - Pantalla actual del formulario: muestra
 *   vacíos los renglones de lo que ya se preguntó. Sin ella (ej. "Ya
 *   enviada"), solo van los renglones con datos.
 * @returns {JSX.Element}
 */
function TarjetaBarberia({ datos, pantalla }) {
  const nombre = datos?.local?.nombre?.trim() ?? '';
  const subdominio = datos?.local?.subdominio?.trim() ?? '';
  const direccion = datos?.local?.direccion?.trim() ?? '';
  const hayDias = (datos?.local?.horario?.length ?? 0) > 0;

  // Desde qué pantalla se ve cada renglón, aunque esté vacío.
  const llego = (numero) => pantalla !== undefined && pantalla >= numero;
  const verDireccion = Boolean(direccion) || llego(PANTALLA.DIRECCION);
  const verHorario = hayDias || llego(PANTALLA.DIAS);
  const verDetalle = verDireccion || verHorario;

  // Lo que ya se veía al montar la tarjeta no entra creciendo.
  const [alMontar] = useState(() => ({ detalle: verDetalle, direccion: verDireccion, horario: verHorario }));

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

      {verDetalle && (
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
          </div>
        </Crece>
      )}
    </section>
  );
}

export default TarjetaBarberia;
