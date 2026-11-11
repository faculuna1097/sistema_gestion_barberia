// /frontend-alta/src/screens/pantallas/PantallaServicios.jsx
// Pantalla 9: los servicios (plan §5.2). Tocar antes que escribir:
// - Botones con los servicios comunes (SERVICIOS_COMUNES). Al tocar uno se suma
//   con su duración habitual (redondeada a turnos) y el cursor va a su precio.
// - "Otro servicio": un nombre propio, con Agregar o Enter.
// - Cada servicio: su precio (CampoPrecio) y su duración con - y +, en turnos
//   (cantidad_slots, 1 a 20) mostrados en minutos.
// Si se cambió el largo del turno (pantalla 8) después de cargar duraciones,
// los turnos de cada servicio se conservan y sus minutos cambian: un aviso
// arriba lo dice y cada servicio muestra lo que duraba antes, hasta que se
// confirma con "Seguir" (utils/servicios.js → cambioDeTurno).

import { useEffect, useId, useImperativeHandle, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_ITEM, SLOTS_MAXIMOS, erroresDePantalla } from '../../utils/validaciones.js';
import {
  agregarServicio, cambiarServicio, cambioDeTurno, confirmarServicios, duracionTurno, errorAlAgregarServicio,
  fmtMinutos, leerServicios, minutosServicio, pasoSlots, quitarServicio, serviciosComunesDisponibles,
} from '../../utils/servicios.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useHover } from '../../hooks/useHover.js';
import BotonPaso from '../../components/BotonPaso.jsx';
import CampoAgregarNombre from '../../components/CampoAgregarNombre.jsx';
import CampoPrecio from '../../components/CampoPrecio.jsx';
import TarjetaItem from '../../components/TarjetaItem.jsx';
import { TextoError } from '../../components/ui';
import { estiloEtiquetaCampo } from '../../components/ui/estilos.js';

/**
 * BotonComun
 * Un servicio común para sumar de un toque: "+ Corte".
 * @param {string} props.nombre
 * @param {Function} props.onClick
 * @param {string} [props.describedBy]
 * @param {Object} [props.ref]
 * @returns {JSX.Element}
 */
function BotonComun({ nombre, onClick, describedBy, ref }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-label={`Sumar ${nombre}`}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px 8px 10px',
        background: hover ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 999,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: theme.ink,
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      <Plus size={16} strokeWidth={2} aria-hidden="true" style={{ color: theme.accent }} />
      {nombre}
    </button>
  );
}

/**
 * SelectorDuracion
 * La duración de un servicio: [-] 45 min [+], de a un turno. Debajo del valor,
 * cuántos turnos son; si el largo del turno cambió, lo que duraba antes.
 * @param {string} props.nombre - Del servicio, para las etiquetas del lector
 * @param {number|null} props.slots - cantidad_slots
 * @param {number|null} props.duracion - Largo del turno
 * @param {number|null} [props.minutosAntes] - Con el turno anterior (aviso de cambio)
 * @param {Function} props.onCambiar - Recibe los slots nuevos
 * @param {string} [props.errorId]
 * @param {Function} [props.refMas] - Ref al botón + (foco de un error)
 * @returns {JSX.Element}
 */
function SelectorDuracion({ nombre, slots, duracion, minutosAntes, onCambiar, errorId, refMas }) {
  const etiquetaId = useId();
  const minutos = minutosServicio({ cantidad_slots: slots }, duracion);
  const valido = minutos !== null;
  const turnos = valido ? `${slots} ${slots === 1 ? 'turno' : 'turnos'}` : '';

  return (
    <div role="group" aria-labelledby={etiquetaId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span id={etiquetaId} style={estiloEtiquetaCampo}>Duración</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <BotonPaso
          etiqueta={`${nombre}: un turno menos`}
          deshabilitado={valido && slots <= 1}
          onClick={() => onCambiar(pasoSlots(slots, -1))}
          describedBy={errorId}
        >
          <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
        <span aria-live="polite" style={{
          minWidth: 76,
          textAlign: 'center',
          fontFamily: theme.body,
          fontSize: theme.sizeInput,
          fontWeight: theme.weightMedium,
          fontVariantNumeric: 'tabular-nums',
          color: valido ? theme.ink : theme.muted,
          whiteSpace: 'nowrap',
        }}>
          {valido ? fmtMinutos(minutos) : '—'}
        </span>
        <BotonPaso
          ref={refMas}
          etiqueta={`${nombre}: un turno más`}
          deshabilitado={valido && slots >= SLOTS_MAXIMOS}
          onClick={() => onCambiar(pasoSlots(slots, 1))}
          describedBy={errorId}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
      </div>
      <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, textAlign: 'center' }}>
        {minutosAntes ? `Antes ${fmtMinutos(minutosAntes)}` : turnos}
      </span>
    </div>
  );
}

/**
 * PantallaServicios
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaServicios({ datos, actualizar, onSeguir, ref }) {
  const servicios = leerServicios(datos);
  const duracion = duracionTurno(datos);
  const cambio = cambioDeTurno(datos);
  const comunes = serviciosComunesDisponibles(datos);
  const errores = useErroresDePantalla(PANTALLA.SERVICIOS, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState(null);
  const [editando, setEditando] = useState(null);
  // Los que ya estaban al entrar no entran creciendo.
  const [clavesAlMontar] = useState(() => new Set(servicios.map((s) => s.clave)));
  const errorListaId = useId();
  const idComunes = useId();

  // Elementos enfocables por nombre ('nuevo', 'comun', 'precio:<clave>',
  // 'nombre:<clave>', 'editar:<clave>', 'duracion:<clave>'). El foco se pide
  // con setFocoPedido y se cumple después del render que monta el elemento
  // (igual que en PantallaBarberos).
  const [elementos] = useState(() => new Map());
  const [focoPedido, setFocoPedido] = useState(null);
  /**
   * registrar — arma el ref callback de un elemento enfocable.
   * @param {string} nombre
   * @returns {Function}
   */
  const registrar = (nombre) => (el) => {
    if (el) elementos.set(nombre, el);
    else elementos.delete(nombre);
  };
  useEffect(() => {
    if (!focoPedido) return;
    setFocoPedido(null);
    elementos.get(focoPedido)?.focus();
  }, [focoPedido, elementos]);

  /**
   * sumarComun — suma un servicio común y lleva el cursor a su precio.
   * @param {{nombre: string, minutos: number}} comun
   */
  const sumarComun = (comun) => {
    const nuevos = agregarServicio(datos, comun);
    actualizar(nuevos);
    setFocoPedido(`precio:${nuevos.servicios.at(-1).clave}`);
  };

  /**
   * intentarAgregar — suma el servicio escrito si pasa la validación; si no,
   * muestra por qué.
   * @returns {Object|null} Los datos con el servicio nuevo, o null si no se pudo.
   */
  const intentarAgregar = () => {
    const error = errorAlAgregarServicio(datos, nombreNuevo);
    if (error) {
      setErrorNuevo(error);
      setFocoPedido('nuevo');
      return null;
    }
    const nuevos = agregarServicio(datos, { nombre: nombreNuevo });
    actualizar(nuevos);
    setNombreNuevo('');
    setErrorNuevo(null);
    setFocoPedido(`precio:${nuevos.servicios.at(-1).clave}`);
    return nuevos;
  };

  /**
   * enfocarError — lleva el foco a donde se corrige un error.
   * @param {{campo: string}} error
   * @param {Object} conDatos
   */
  const enfocarError = (error, conDatos) => {
    const [, posicion, dato] = error.campo.split('.');
    const servicio = leerServicios(conDatos)[Number(posicion)];
    if (!servicio) {
      setFocoPedido(comunes.length > 0 ? 'comun' : 'nuevo');
    } else if (dato === 'nombre') {
      setEditando(servicio.clave);
      setFocoPedido(`nombre:${servicio.clave}`);
    } else if (dato === 'cantidad_slots') {
      setFocoPedido(`duracion:${servicio.clave}`);
    } else {
      setFocoPedido(`precio:${servicio.clave}`);
    }
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * Si quedó un nombre escrito sin agregar, lo agrega primero. Si se puede
     * avanzar, las duraciones quedan confirmadas con el turno actual.
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   lleva el foco al primero.
     */
    intentarSeguir() {
      let conDatos = datos;
      if (nombreNuevo.trim() !== '') {
        conDatos = intentarAgregar();
        if (!conDatos) return false;
      }
      const erroresActuales = conDatos === datos ? errores : erroresDePantalla(PANTALLA.SERVICIOS, conDatos);
      if (erroresActuales.length === 0) {
        actualizar((d) => confirmarServicios(d));
        return true;
      }
      revelarTodos();
      enfocarError(erroresActuales[0], conDatos);
      return false;
    },
  }));

  /**
   * terminarEdicion — cierra el campo del nombre (recortado) y muestra su error.
   * @param {Object} servicio
   * @param {number} i
   */
  const terminarEdicion = (servicio, i) => {
    const recortado = (servicio.nombre ?? '').trim();
    if (recortado !== servicio.nombre) actualizar((d) => cambiarServicio(d, servicio.clave, { nombre: recortado }));
    revelar(`servicios.${i}.nombre`);
    setEditando(null);
    setFocoPedido(`editar:${servicio.clave}`);
  };

  /**
   * quitar — saca un servicio. El foco va al campo para sumar otro.
   * @param {string} clave
   */
  const quitar = (clave) => {
    actualizar((d) => quitarServicio(d, clave));
    if (editando === clave) setEditando(null);
    setFocoPedido('nuevo');
  };

  const errorLista = errorNuevo ?? (servicios.length === 0 ? errorDe('servicios') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {cambio && (
        <p role="status" style={{
          padding: '12px 16px',
          background: theme.surfaceAlt,
          borderRadius: theme.radius,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.5,
          color: theme.inkSoft,
          textWrap: 'pretty',
        }}>
          {`Cambiaste los turnos de ${cambio.antes} a ${cambio.ahora} min. Cada servicio ocupa los mismos turnos que antes, así que su duración cambió: revisala.`}
        </p>
      )}

      {servicios.length > 0 && (
        <ul aria-label="Tus servicios" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {servicios.map((servicio, i) => {
            const nombre = (servicio.nombre ?? '').trim() || 'este servicio';
            const errorDuracion = errorDe(`servicios.${i}.cantidad_slots`);
            const errorDuracionId = `${errorListaId}-duracion-${i}`;
            return (
              <li key={servicio.clave ?? i}>
                <TarjetaItem
                  nombre={servicio.nombre}
                  tipo="servicio"
                  animar={!clavesAlMontar.has(servicio.clave)}
                  editando={editando === servicio.clave}
                  onEditar={() => setEditando(servicio.clave)}
                  onCambiarNombre={(valor) => actualizar((d) => cambiarServicio(d, servicio.clave, { nombre: valor }))}
                  onTerminarEdicion={() => terminarEdicion(servicio, i)}
                  onQuitar={() => quitar(servicio.clave)}
                  errorNombre={errorDe(`servicios.${i}.nombre`)}
                  maxLength={LARGO_NOMBRE_ITEM.max}
                  refNombre={registrar(`nombre:${servicio.clave}`)}
                  refEditar={registrar(`editar:${servicio.clave}`)}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <CampoPrecio
                      ref={registrar(`precio:${servicio.clave}`)}
                      label="Precio"
                      etiquetaLector={`Precio de ${nombre}`}
                      valor={servicio.precio}
                      onCambiar={(precio) => actualizar((d) => cambiarServicio(d, servicio.clave, { precio }))}
                      onBlur={() => servicio.precio !== null && servicio.precio !== undefined && revelar(`servicios.${i}.precio`)}
                      onKeyDown={alPresionarEnter(onSeguir)}
                      error={errorDe(`servicios.${i}.precio`)}
                    />
                    <SelectorDuracion
                      nombre={nombre}
                      slots={servicio.cantidad_slots}
                      duracion={duracion}
                      minutosAntes={cambio ? minutosServicio(servicio, cambio.antes) : null}
                      onCambiar={(slots) => {
                        actualizar((d) => cambiarServicio(d, servicio.clave, { cantidad_slots: slots }));
                        revelar(`servicios.${i}.cantidad_slots`);
                      }}
                      errorId={errorDuracion ? errorDuracionId : undefined}
                      refMas={registrar(`duracion:${servicio.clave}`)}
                    />
                  </div>
                  {errorDuracion && <div style={{ paddingTop: 8 }}><TextoError id={errorDuracionId}>{errorDuracion}</TextoError></div>}
                </TarjetaItem>
              </li>
            );
          })}
        </ul>
      )}

      {comunes.length > 0 && (
        <section aria-labelledby={idComunes} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id={idComunes} style={estiloEtiquetaCampo}>
            {servicios.length === 0 ? 'Los más comunes' : 'Sumá otro'}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {comunes.map((comun, k) => (
              <BotonComun
                key={comun.nombre}
                ref={k === 0 ? registrar('comun') : undefined}
                nombre={comun.nombre}
                onClick={() => sumarComun(comun)}
                describedBy={errorLista ? errorListaId : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CampoAgregarNombre
          ref={registrar('nuevo')}
          label="Otro servicio"
          valor={nombreNuevo}
          onCambiar={(valor) => { setNombreNuevo(valor); setErrorNuevo(null); }}
          onAgregar={intentarAgregar}
          onEnterVacio={onSeguir}
          error={errorNuevo ?? undefined}
          helper={servicios.length === 0 && comunes.length > 0 ? undefined : 'Escribí el nombre y tocá Agregar.'}
          maxLength={LARGO_NOMBRE_ITEM.max}
        />
        {!errorNuevo && errorLista && <TextoError id={errorListaId}>{errorLista}</TextoError>}
      </div>
    </div>
  );
}

export default PantallaServicios;
