// /frontend-alta/src/screens/pantallas/PantallaHorariosEquipo.jsx
// Pantalla 7: el horario de cada barbero (plan §5.2). No se saltea: su
// primera parte es la pregunta "¿Todos trabajan el horario del local?"
// (en singular, con su nombre, si hay un solo barbero).
// - Sí: todos quedan con 'igual_local' y se avanza (la opción queda marcada
//   ~150 ms antes, useEleccionConPausa).
// - No: aparece cada barbero con "Igual al local" / "Otro horario". El horario
//   propio se precarga con el del local, partido por la pausa (D11), y se
//   cambia con los días (SelectorDias) y las barras de la semana
//   (SemanaEnBarras): tocar un día abre sus horas de entrada y salida.
//   Agregar o sacar un bloque no se hace a mano: un día de un bloque se puede
//   "Partir la jornada" y uno de dos, "Trabaja de corrido" (así un horario
//   propio cubre la pausa). "Usar en todos sus días" copia un día a los demás.
// Si cambió el horario del local después de cargar horarios propios, no se
// reescriben: los errores se ven apenas se llega a la pantalla.
// La lógica vive en utils/horarioEquipo.js.

import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { erroresDePantalla } from '../../utils/validaciones.js';
import { leerEquipo } from '../../utils/equipo.js';
import { leerHorarioLocal } from '../../utils/horarioLocal.js';
import {
  RESPUESTA, alternarDiaBarbero, bloquesDelDia, cambiarBloque, contestarHorariosDistintos, contestarTodosIgualLocal,
  copiarDiaATodos, diaDelError, diasDelBarbero, esDiaDistintoDelLocal, partirJornada, pasarAHorarioPropio,
  respuestaHorarios, sePuedePartir, tieneHorarioPropio, trabajarDeCorrido, volverAlHorarioDelLocal,
} from '../../utils/horarioEquipo.js';
import { fmtRango } from '../../utils/horas.js';
import { nombreDia, ordenarDias } from '../../utils/semana.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useEleccionConPausa } from '../../hooks/useEleccionConPausa.js';
import ParDeHoras from '../../components/ParDeHoras.jsx';
import SelectorDias from '../../components/SelectorDias.jsx';
import SemanaEnBarras from '../../components/SemanaEnBarras.jsx';
import { AvatarIniciales, BotonOpcion, Button, TextoError } from '../../components/ui';
import { estiloEtiquetaCampo } from '../../components/ui/estilos.js';

// Mensaje propio del front: la pregunta no es un dato del backend (sin
// contestar, todos quedan con el horario del local y el envío pasa).
const TEXTO_SIN_RESPUESTA = 'Elegí una opción.';

/**
 * etiquetaBloque
 * El nombre de un bloque dentro de su día, si hay más de uno.
 * @param {number} k - Posición en el día
 * @param {number} total - Bloques del día
 * @returns {string} "Antes de la pausa" / "Después de la pausa", o "Horario N" con tres o más.
 */
function etiquetaBloque(k, total) {
  if (total === 2) return k === 0 ? 'Antes de la pausa' : 'Después de la pausa';
  return `Horario ${k + 1}`;
}

/**
 * mensajesDeBarbero
 * Los errores del horario de un barbero, sin repetir, con el día de cada uno
 * (null si es del horario entero). Al que no dice de qué día es (ej. "Se
 * superpone…") se le antepone el día.
 * @param {Array<{campo: string, mensaje: string}>} errores - Los de la pantalla
 * @param {Object} barbero
 * @param {number} i - Su posición
 * @returns {Array<{dia: number|null, texto: string}>}
 */
function mensajesDeBarbero(errores, barbero, i) {
  const prefijo = `barberos.${i}.horario`;
  const vistos = new Set();
  return errores
    .filter((e) => e.campo === prefijo || e.campo.startsWith(`${prefijo}.`))
    .map((e) => {
      const dia = diaDelError(barbero, e.campo);
      if (dia === null || e.mensaje.includes(nombreDia(dia))) return { dia, texto: e.mensaje };
      return { dia, texto: `${nombreDia(dia, { mayuscula: true })}: ${e.mensaje.charAt(0).toLowerCase()}${e.mensaje.slice(1)}` };
    })
    .filter(({ texto }) => (vistos.has(texto) ? false : vistos.add(texto)));
}

/**
 * ListaErrores
 * Mensajes de error uno debajo del otro, con un id para el aria-describedby.
 * @param {string} props.id
 * @param {string[]} props.mensajes
 * @returns {JSX.Element}
 */
function ListaErrores({ id, mensajes }) {
  return (
    <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {mensajes.map((mensaje) => <TextoError key={mensaje}>{mensaje}</TextoError>)}
    </div>
  );
}

/**
 * AccionDia
 * Una acción de texto en el color del acento, como "Usar el horario de los
 * demás días" de la pantalla 4.
 * @param {ReactNode} props.children
 * @param {Function} props.onClick
 * @returns {JSX.Element}
 */
function AccionDia({ children, onClick }) {
  return (
    <Button variant="ghost" full={false} onClick={onClick} style={{ color: theme.accent, marginLeft: -16 }}>
      {children}
    </Button>
  );
}

/**
 * DetalleDia
 * Las horas de un día de un barbero, debajo de su barra: la referencia del
 * local, la entrada y la salida de cada bloque y las acciones del día.
 * @param {Object} props.datos
 * @param {Object} props.barbero
 * @param {number} props.dia - dia_semana
 * @param {string[]} props.errores - Los errores visibles de ese día
 * @param {Function} props.cambiar - Recibe (datos) => datos y lo guarda
 * @returns {JSX.Element}
 */
function DetalleDia({ datos, barbero, dia, errores, cambiar }) {
  const errorId = useId();
  const rangoLocal = leerHorarioLocal(datos).porDia.get(dia);
  const delDia = bloquesDelDia(barbero, dia);
  const masDeUnDia = diasDelBarbero(barbero).length > 1;
  const { clave } = barbero;

  return (
    <div style={{ padding: '12px 8px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
        {rangoLocal
          ? `El ${nombreDia(dia)} el local abre de ${fmtRango(rangoLocal)}.`
          : `El local no abre el ${nombreDia(dia)}.`}
      </p>

      {errores.length > 0 && <ListaErrores id={errorId} mensajes={errores} />}

      {delDia.map((bloque, k) => (
        <div key={bloque.indice} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {delDia.length > 1 && (
            <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
              {etiquetaBloque(k, delDia.length)}
            </p>
          )}
          <ParDeHoras
            rango={bloque}
            onCambiar={(rango) => cambiar((d) => cambiarBloque(d, clave, bloque.indice, rango))}
            etiquetaInicio="Entra"
            etiquetaFin="Sale"
            min={rangoLocal?.hora_inicio}
            max={rangoLocal?.hora_fin}
            errorId={errores.length > 0 ? errorId : undefined}
          />
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {delDia.length === 1 && sePuedePartir(delDia[0]) && (
          <AccionDia onClick={() => cambiar((d) => partirJornada(d, clave, delDia[0].indice))}>
            Partir la jornada
          </AccionDia>
        )}
        {delDia.length > 1 && (
          <AccionDia onClick={() => cambiar((d) => trabajarDeCorrido(d, clave, dia))}>
            Trabaja de corrido
          </AccionDia>
        )}
        {masDeUnDia && (
          <AccionDia onClick={() => cambiar((d) => copiarDiaATodos(d, clave, dia))}>
            Usar en todos sus días
          </AccionDia>
        )}
      </div>
    </div>
  );
}

/**
 * HorarioDeBarbero
 * Un barbero en el detalle: su nombre, "Igual al local" / "Otro horario" y,
 * con horario propio, sus días, su semana y los errores.
 * @param {Object} props.datos
 * @param {Object} props.barbero
 * @param {number} props.i - Su posición en datos.barberos
 * @param {Array<{dia: number|null, texto: string}>} props.mensajes - Sus errores
 *   visibles (mensajesDeBarbero): los del día abierto van en su detalle, el
 *   resto debajo de la semana
 * @param {number|null} props.diaAbierto - Su día con el detalle abierto
 * @param {Function} props.onTocarDia - Recibe el dia_semana
 * @param {Function} props.cambiar - Recibe (datos) => datos, lo guarda y revela sus errores
 * @param {Function} props.refSeccion - Ref callback de la sección (foco del "Seguir")
 * @returns {JSX.Element}
 */
function HorarioDeBarbero({ datos, barbero, i, mensajes, diaAbierto, onTocarDia, cambiar, refSeccion }) {
  const nombre = (barbero.nombre ?? '').trim() || 'Sin nombre';
  const nombreId = useId();
  const errorId = useId();
  const propio = tieneHorarioPropio(barbero);
  const { clave } = barbero;

  const diasBarbero = diasDelBarbero(barbero);
  // Los días que abre el local, más los que el barbero ya tiene (si el local
  // dejó de abrir uno, se puede apagar).
  const habilitados = ordenarDias([...leerHorarioLocal(datos).dias, ...diasBarbero]);
  const bloques = diasBarbero.flatMap((dia) => bloquesDelDia(barbero, dia).map((b) => ({ dia_semana: dia, ...b })));
  const distintos = new Set(diasBarbero.filter((dia) => esDiaDistintoDelLocal(datos, barbero, dia)));
  const delDiaAbierto = mensajes.filter((m) => diaAbierto !== null && m.dia === diaAbierto).map((m) => m.texto);
  const resto = mensajes.filter((m) => diaAbierto === null || m.dia !== diaAbierto).map((m) => m.texto);
  const describedBy = resto.length > 0 ? errorId : undefined;
  // Si ya tenía horario propio al entrar (ej. al recargar), no entra creciendo.
  const [propioAlMontar] = useState(propio);

  return (
    <section
      ref={refSeccion}
      tabIndex={-1}
      aria-labelledby={nombreId}
      aria-describedby={describedBy}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0', borderTop: `1px solid ${theme.hairline}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AvatarIniciales nombre={nombre} size={32} />
        <h2 id={nombreId} style={{
          minWidth: 0, fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightHeading, color: theme.ink, overflowWrap: 'anywhere',
        }}>
          {nombre}
        </h2>
      </div>

      <div role="group" aria-label={`Horario de ${nombre}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <BotonOpcion compacta elegida={!propio} onClick={() => cambiar((d) => volverAlHorarioDelLocal(d, clave))}>
          Igual al local
        </BotonOpcion>
        <BotonOpcion compacta elegida={propio} onClick={() => cambiar((d) => pasarAHorarioPropio(d, clave))}>
          Otro horario
        </BotonOpcion>
      </div>

      {propio && (
        <div className={propioAlMontar ? undefined : 'al-crecer'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={estiloEtiquetaCampo}>Días que trabaja</span>
              <SelectorDias
                seleccionados={diasBarbero}
                habilitados={habilitados}
                onAlternar={(dia) => cambiar((d) => alternarDiaBarbero(d, clave, dia))}
                etiqueta={`Días que trabaja ${nombre}`}
                errorId={describedBy}
              />
            </div>

            {bloques.length > 0 ? (
              <SemanaEnBarras
                bloques={bloques}
                propios={distintos}
                diaAbierto={diaAbierto}
                onTocarDia={onTocarDia}
                detalle={diaAbierto !== null && (
                  <DetalleDia datos={datos} barbero={barbero} dia={diaAbierto} errores={delDiaAbierto} cambiar={cambiar} />
                )}
                etiqueta={`Semana de ${nombre}. Tocá un día para cambiar sus horas.`}
                idBase={`horario-barbero-${i}`}
              />
            ) : (
              <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
                Tocá los días que trabaja.
              </p>
            )}
          </div>
        </div>
      )}

      {resto.length > 0 && <ListaErrores id={errorId} mensajes={resto} />}
    </section>
  );
}

/**
 * PantallaHorariosEquipo
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaHorariosEquipo({ datos, actualizar, onSeguir, ref }) {
  const { barberos } = leerEquipo(datos);
  const uno = barberos.length === 1;
  const respuesta = respuestaHorarios(datos);
  const errores = erroresDePantalla(PANTALLA.HORARIOS_EQUIPO, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const [faltaRespuesta, setFaltaRespuesta] = useState(false);
  // El día abierto en la semana de un barbero: { clave, dia } o null.
  const [abierto, setAbierto] = useState(null);
  const errorPreguntaId = useId();
  const primeraOpcionRef = useRef(null);
  const secciones = useRef(new Map());

  // "Sí" avanza después de la pausa: el "Seguir" que dispara ya sabe que se
  // puede (con "reducir movimiento" la pausa es 0 y el ref de la pantalla
  // todavía tiene los datos de antes del toque).
  const siTocadoRef = useRef(false);
  const [elegido, elegir] = useEleccionConPausa(() => {
    siTocadoRef.current = true;
    onSeguir();
  });

  // Volvió con horarios propios: si el local cambió y alguno quedó afuera, se ve ya.
  const conPropios = barberos.some(tieneHorarioPropio);
  useEffect(() => {
    if (conPropios) revelarTodos();
    // Solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** tocarSi — "Sí": todos con el horario del local, y avanza tras la pausa. */
  const tocarSi = () => {
    actualizar((d) => contestarTodosIgualLocal(d));
    setFaltaRespuesta(false);
    setAbierto(null);
    elegir(RESPUESTA.SI);
  };

  /** tocarNo — "No": aparece el detalle por barbero. */
  const tocarNo = () => {
    actualizar((d) => contestarHorariosDistintos(d));
    setFaltaRespuesta(false);
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar. Sin contestar, pide que se
     *   elija; con errores en un horario propio, los muestra, abre el día del
     *   primero y lleva el foco a su barbero.
     */
    intentarSeguir() {
      if (siTocadoRef.current) {
        siTocadoRef.current = false;
        return true;
      }
      if (respuesta === null) {
        setFaltaRespuesta(true);
        primeraOpcionRef.current?.focus();
        return false;
      }
      if (errores.length === 0) return true;
      revelarTodos();
      const [primero] = errores;
      const barbero = barberos[Number(primero.campo.split('.')[1])];
      if (barbero) {
        const dia = diaDelError(barbero, primero.campo);
        if (dia !== null) setAbierto({ clave: barbero.clave, dia });
        secciones.current.get(barbero.clave)?.focus();
      }
      return false;
    },
  }));

  const siElegido = elegido === RESPUESTA.SI || (elegido === null && respuesta === RESPUESTA.SI);
  const noElegido = elegido === null && respuesta === RESPUESTA.NO;
  // El detalle que ya estaba al entrar no entra creciendo.
  const [detalleAlMontar] = useState(noElegido);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div role="group" aria-label="Respuesta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BotonOpcion
            ref={primeraOpcionRef}
            elegida={siElegido}
            onClick={tocarSi}
            descripcion={uno ? 'Trabaja mientras el local está abierto.' : 'Trabajan mientras el local está abierto.'}
            describedBy={faltaRespuesta ? errorPreguntaId : undefined}
          >
            {uno ? 'Sí' : 'Sí, todos'}
          </BotonOpcion>
          <BotonOpcion
            elegida={noElegido}
            onClick={tocarNo}
            descripcion={uno ? 'Elegís sus días y horarios.' : 'Elegís los días y horarios de cada uno.'}
            describedBy={faltaRespuesta ? errorPreguntaId : undefined}
          >
            {uno ? 'No, tiene otro horario' : 'No, alguno tiene otro'}
          </BotonOpcion>
        </div>
        {faltaRespuesta && <TextoError id={errorPreguntaId}>{TEXTO_SIN_RESPUESTA}</TextoError>}
      </div>

      {noElegido && (
        <div className={detalleAlMontar ? undefined : 'al-crecer'}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {barberos.map((barbero, i) => {
              const visibles = errorDe(`barberos.${i}.horario`) !== undefined;
              return (
                <HorarioDeBarbero
                  key={barbero.clave}
                  datos={datos}
                  barbero={barbero}
                  i={i}
                  mensajes={visibles ? mensajesDeBarbero(errores, barbero, i) : []}
                  diaAbierto={abierto?.clave === barbero.clave ? abierto.dia : null}
                  onTocarDia={(dia) => setAbierto((actual) => (
                    actual?.clave === barbero.clave && actual.dia === dia ? null : { clave: barbero.clave, dia }
                  ))}
                  cambiar={(cambio) => {
                    actualizar(cambio);
                    revelar(`barberos.${i}.horario`);
                  }}
                  refSeccion={(el) => {
                    if (el) secciones.current.set(barbero.clave, el);
                    else secciones.current.delete(barbero.clave);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PantallaHorariosEquipo;
