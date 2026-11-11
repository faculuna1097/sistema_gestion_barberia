// /frontend-alta/src/screens/pantallas/PantallaDuenios.jsx
// Pantalla 6: quiénes son los dueños (plan §5.2).
// - Los barberos como avatares grandes que se tocan: el que es dueño queda
//   marcado (barberos[].es_duenio). Va por la clave del barbero: si después se
//   le cambia el nombre, sigue siendo dueño.
// - "Agregar un dueño que no corta": nombres que van a duenios_sin_corte (en
//   la DB, socios que no son barberos), con su avatar y para quitar.
// Al menos un dueño en total, sin nombres repetidos (validaciones.js).
// Si el cliente ya pasó esta pantalla (progreso.duenios_confirmados) y vuelve
// después de quitar al único dueño, el error se ve apenas llega.

import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_PERSONA, erroresDePantalla } from '../../utils/validaciones.js';
import {
  agregarDuenioSinCorte, alternarDuenio, confirmarDuenios, errorAlAgregarDuenio, leerEquipo, quitarDuenioSinCorte,
} from '../../utils/equipo.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useFocoPendiente } from '../../hooks/useFocoPendiente.js';
import { useHover } from '../../hooks/useHover.js';
import { prefiereMenosMovimiento } from '../../utils/movimiento.js';
import CampoAgregarNombre from '../../components/CampoAgregarNombre.jsx';
import FilaPersona from '../../components/FilaPersona.jsx';
import { AvatarIniciales, Button, TextoError } from '../../components/ui';

/**
 * AvatarDuenio
 * Un barbero que se toca para marcarlo como dueño: su avatar grande y el
 * nombre. Marcado, lleva el acento suave, una tilde sobre el avatar y la
 * palabra "Dueño" (el color nunca va solo); lo dice `aria-pressed`.
 * @param {string} props.nombre
 * @param {boolean} props.duenio
 * @param {Function} props.onClick
 * @param {string} [props.describedBy] - id del error del grupo
 * @param {Object} [props.ref]
 * @returns {JSX.Element}
 */
function AvatarDuenio({ nombre, duenio, onClick, describedBy, ref }) {
  const [hover, eventosHover] = useHover();
  const transicion = prefiereMenosMovimiento()
    ? `transform ${theme.transitionFast}`
    : `background ${theme.transitionFast}, border-color ${theme.transitionFast}, transform ${theme.transitionFast}`;

  let fondo = hover ? theme.surfaceAlt : theme.surface;
  if (duenio) fondo = theme.accentSoft;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-pressed={duenio}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        width: '100%',
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 8px',
        background: fondo,
        border: `1px solid ${duenio ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        cursor: 'pointer',
        transition: transicion,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <AvatarIniciales nombre={nombre} size={48} />
        {duenio && (
          <span aria-hidden="true" style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            background: theme.accent,
            color: theme.accentInk,
            border: `2px solid ${theme.surface}`,
          }}>
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
      <span style={{
        maxWidth: '100%',
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        textAlign: 'center',
        overflowWrap: 'anywhere',
      }}>
        {nombre || 'Sin nombre'}
      </span>
      {/* El renglón existe siempre: marcar no mueve los demás avatares. */}
      <span style={{
        minHeight: 21,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.accent,
      }}>
        {duenio ? 'Dueño' : ''}
      </span>
    </button>
  );
}

/**
 * claveDuenio
 * Key de React de un dueño que no corta: no tienen clave propia (son solo un
 * nombre), así que va el nombre y cuántas veces apareció antes. Con la
 * posición, quitar al primero remontaría (y animaría) a los demás.
 * @param {Array<{nombre: string}>} lista
 * @param {number} k - Posición
 * @returns {string}
 */
function claveDuenio(lista, k) {
  const nombre = lista[k]?.nombre ?? '';
  const antes = lista.slice(0, k).filter((d) => (d?.nombre ?? '') === nombre).length;
  return `${nombre}#${antes}`;
}

/**
 * PantallaDuenios
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaDuenios({ datos, actualizar, onSeguir, ref }) {
  const pedirFoco = useFocoPendiente();
  const { barberos, dueniosSinCorte } = leerEquipo(datos);
  const errores = useErroresDePantalla(PANTALLA.DUENIOS, datos);
  const { errorDe, revelarTodos } = useErroresVisibles(errores);

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState(null);
  // El campo del dueño que no corta: cerrado hasta que se pide (o si ya hay alguno).
  const [campoAbierto, setCampoAbierto] = useState(false);
  // Los dueños que no cortan que ya estaban al entrar no se animan.
  const [clavesAlMontar] = useState(() => new Set(dueniosSinCorte.map((_, k) => claveDuenio(dueniosSinCorte, k))));
  const errorGrupoId = useId();
  const tituloSinCorteId = useId();

  const primerAvatarRef = useRef(null);
  const campoRef = useRef(null);
  const quitarRefs = useRef([]);

  // Ya había pasado por acá: lo que quedó mal se ve apenas llega.
  const confirmados = datos.progreso?.duenios_confirmados === true;
  useEffect(() => {
    if (confirmados) revelarTodos();
    // Solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * intentarAgregar — suma el dueño escrito si pasa la validación; si no,
   * muestra por qué. El campo queda con el foco.
   * @returns {Object|null} Los datos con el dueño nuevo, o null si no se pudo.
   */
  const intentarAgregar = () => {
    const error = errorAlAgregarDuenio(datos, nombreNuevo);
    campoRef.current?.focus();
    if (error) {
      setErrorNuevo(error);
      return null;
    }
    const nuevos = agregarDuenioSinCorte(datos, nombreNuevo);
    actualizar(nuevos);
    setNombreNuevo('');
    setErrorNuevo(null);
    return nuevos;
  };

  /**
   * quitar — saca a un dueño que no corta. El foco pasa al campo para sumar otro.
   * @param {number} k - Su posición
   */
  const quitar = (k) => {
    actualizar((d) => quitarDuenioSinCorte(d, k));
    setCampoAbierto(true);
    pedirFoco(() => campoRef.current);
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * Si quedó un nombre escrito sin agregar, lo agrega primero. Si se puede
     * avanzar, anota que la pantalla ya se pasó.
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   lleva el foco al primero.
     */
    intentarSeguir() {
      let conDatos = datos;
      if (nombreNuevo.trim() !== '') {
        conDatos = intentarAgregar();
        if (!conDatos) return false;
      }
      const erroresActuales = conDatos === datos ? errores : erroresDePantalla(PANTALLA.DUENIOS, conDatos);
      if (erroresActuales.length === 0) {
        actualizar((d) => confirmarDuenios(d));
        return true;
      }
      revelarTodos();
      const [, posicion] = erroresActuales[0].campo.split('.');
      if (posicion !== undefined) quitarRefs.current[Number(posicion)]?.focus();
      else (primerAvatarRef.current ?? campoRef.current)?.focus();
      return false;
    },
  }));

  // "Marcá al menos un dueño" va debajo de los avatares; el de un nombre, en su renglón.
  const general = errores.find((e) => e.campo === 'duenios_sin_corte');
  const errorGrupo = general && errorDe('duenios_sin_corte') !== undefined ? general.mensaje : undefined;
  const mostrarCampo = campoAbierto || nombreNuevo !== '' || dueniosSinCorte.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {barberos.length > 0 && (
          <ul
            role="group"
            aria-label="Barberos. Tocá a los que son dueños."
            style={{
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 8,
            }}
          >
            {barberos.map((barbero, i) => (
              <li key={barbero.clave}>
                <AvatarDuenio
                  ref={i === 0 ? primerAvatarRef : undefined}
                  nombre={(barbero.nombre ?? '').trim()}
                  duenio={barbero.es_duenio === true}
                  onClick={() => actualizar((d) => alternarDuenio(d, barbero.clave))}
                  describedBy={errorGrupo ? errorGrupoId : undefined}
                />
              </li>
            ))}
          </ul>
        )}
        {errorGrupo && <TextoError id={errorGrupoId}>{errorGrupo}</TextoError>}
      </div>

      <section aria-labelledby={tituloSinCorteId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id={tituloSinCorteId} style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightHeading, color: theme.ink }}>
          Dueños que no cortan
        </h2>
        {dueniosSinCorte.length > 0 && (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
            {dueniosSinCorte.map((duenio, k) => (
              <li key={claveDuenio(dueniosSinCorte, k)} style={{ borderBottom: `1px solid ${theme.hairlineSoft}` }}>
                <FilaPersona
                  nombre={duenio?.nombre ?? ''}
                  detalle="No corta"
                  animar={!clavesAlMontar.has(claveDuenio(dueniosSinCorte, k))}
                  onQuitar={() => quitar(k)}
                  error={errorDe(`duenios_sin_corte.${k}`)}
                  refQuitar={(el) => { quitarRefs.current[k] = el; }}
                />
              </li>
            ))}
          </ul>
        )}

        {mostrarCampo ? (
          <div className={campoAbierto && dueniosSinCorte.length === 0 && nombreNuevo === '' ? 'al-crecer' : undefined}>
            <div style={{ paddingTop: dueniosSinCorte.length > 0 ? 8 : 0 }}>
              <CampoAgregarNombre
                ref={campoRef}
                label={dueniosSinCorte.length === 0 ? 'Nombre del dueño que no corta' : 'Otro dueño que no corta'}
                valor={nombreNuevo}
                onCambiar={(valor) => { setNombreNuevo(valor); setErrorNuevo(null); }}
                onAgregar={intentarAgregar}
                onEnterVacio={onSeguir}
                error={errorNuevo ?? undefined}
                helper="Es socio del negocio pero no atiende clientes."
                maxLength={LARGO_NOMBRE_PERSONA.max}
                autoFocus={campoAbierto}
              />
            </div>
          </div>
        ) : (
          <div>
            <Button
              variant="ghost"
              full={false}
              onClick={() => setCampoAbierto(true)}
              style={{ color: theme.accent, marginLeft: -16 }}
            >
              <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" />
              Agregar un dueño que no corta
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default PantallaDuenios;
