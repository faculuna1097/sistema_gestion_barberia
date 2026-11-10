// /frontend-alta/src/screens/pantallas/PantallaBarberos.jsx
// Pantalla 5: quiénes cortan (plan §5.2). Tres bloques, de arriba abajo:
// - El equipo: un renglón por barbero (avatar con iniciales, nombre, cambiar
//   el nombre y quitar) y, al final, el campo para sumar otro. Nombre y Enter:
//   aparece su avatar arriba del campo, que queda vacío para el siguiente.
// - La comisión: una barra que salta de 5 en 5. Por defecto, "Mismo % para
//   todos" (una sola barra); si se apaga, una por barbero.
// - El mail de cada barbero, opcional: con él, sus turnos le llegan a su Google
//   Calendar (el mail es el interruptor de esa sincronización, onboarding.md).
// La lógica del equipo vive en utils/equipo.js; lo de interfaz que se
// conserva (la marca de "Mismo %"), en progreso.

import { useEffect, useId, useImperativeHandle, useState } from 'react';
import { Mail } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_PERSONA, erroresDePantalla } from '../../utils/validaciones.js';
import {
  agregarBarbero, cambiarComisionBarbero, cambiarComisionComun, cambiarComisionIgual, cambiarEmailBarbero,
  errorAlAgregarBarbero, leerEquipo, nuevaClave, quitarBarbero, renombrarBarbero,
} from '../../utils/equipo.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import CampoAgregarNombre from '../../components/CampoAgregarNombre.jsx';
import FilaPersona from '../../components/FilaPersona.jsx';
import SelectorComision from '../../components/SelectorComision.jsx';
import { Button, Casilla, Field, TextoError } from '../../components/ui';
import { estiloSoloLector } from '../../components/ui/estilos.js';

// Ayuda del campo vacío: cómo se suma, y que el dueño que corta también va.
const AYUDA_NOMBRE = 'Escribí el nombre y tocá Agregar. Si vos también cortás, sumate.';
const AYUDA_NOMBRE_OTRO = 'Para sumar a otro, escribí su nombre.';

/**
 * TituloBloque
 * El encabezado de un bloque de la pantalla: un h2 chico y una línea que
 * explica, en muted.
 * @param {string} props.id - Lo usa el aria-labelledby del bloque
 * @param {string} props.titulo
 * @param {string} [props.texto]
 * @returns {JSX.Element}
 */
function TituloBloque({ id, titulo, texto }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <h2 id={id} style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightHeading, color: theme.ink }}>
        {titulo}
      </h2>
      {texto && (
        <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.45, color: theme.muted, textWrap: 'pretty' }}>
          {texto}
        </p>
      )}
    </div>
  );
}

/**
 * PantallaBarberos
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaBarberos({ datos, actualizar, onSeguir, ref }) {
  const { barberos, comisionIgual, comisionComun } = leerEquipo(datos);
  const errores = erroresDePantalla(PANTALLA.BARBEROS, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  // El nombre que se está por agregar (no se guarda hasta "Agregar") y por qué no se pudo.
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState(null);
  // El barbero cuyo nombre se está editando, y los que tienen abierto el campo del mail.
  const [editando, setEditando] = useState(null);
  const [mailsAbiertos, setMailsAbiertos] = useState(() => new Set());
  // Los que ya estaban al entrar no se animan.
  const [clavesAlMontar] = useState(() => new Set(barberos.map((b) => b.clave)));

  const idEquipo = useId();
  const idComision = useId();
  const idMails = useId();
  const errorComisionId = useId();

  // Los elementos a los que se lleva el foco, por nombre ('nuevo', 'lista',
  // 'editar:<clave>', 'comision:<clave>', 'email:<clave>'…). El foco se pide
  // con setFocoPedido y se cumple después del render que monta el elemento.
  // Es un Map estable (de useState, no de useRef: los ref callbacks se arman
  // durante el render, y la regla react-hooks/refs no deja tocar un ref ahí).
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
   * intentarAgregar — suma el nombre escrito si pasa la validación; si no,
   * muestra por qué. El campo queda con el foco en los dos casos.
   * @returns {Object|null} Los datos con el barbero nuevo, o null si no se pudo.
   */
  const intentarAgregar = () => {
    const error = errorAlAgregarBarbero(datos, nombreNuevo);
    if (error) {
      setErrorNuevo(error);
      setFocoPedido('nuevo');
      return null;
    }
    const nuevos = agregarBarbero(datos, { clave: nuevaClave(), nombre: nombreNuevo });
    actualizar(nuevos);
    setNombreNuevo('');
    setErrorNuevo(null);
    return nuevos;
  };

  /**
   * enfocarError — lleva el foco a donde se corrige un error (y abre lo que
   * haga falta: el nombre en edición, el campo del mail).
   * @param {{campo: string}} error
   * @param {Object} conDatos - Los datos sobre los que se validó
   */
  const enfocarError = (error, conDatos) => {
    const [, posicion, dato] = error.campo.split('.');
    const barbero = conDatos.barberos[Number(posicion)];
    if (!barbero) {
      setFocoPedido('nuevo');
    } else if (dato === 'nombre') {
      setEditando(barbero.clave);
      setFocoPedido(`nombre:${barbero.clave}`);
    } else if (dato === 'comision') {
      const comun = leerEquipo(conDatos).comisionIgual || conDatos.barberos.length === 1;
      setFocoPedido(comun ? 'comision:comun' : `comision:${barbero.clave}`);
    } else if (dato === 'email') {
      setMailsAbiertos((prev) => new Set(prev).add(barbero.clave));
      setFocoPedido(`email:${barbero.clave}`);
    }
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * Si quedó un nombre escrito sin agregar, lo agrega primero (o frena con
     * su error). Después valida la pantalla con los datos como quedan.
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   lleva el foco al primero.
     */
    intentarSeguir() {
      let conDatos = datos;
      if (nombreNuevo.trim() !== '') {
        conDatos = intentarAgregar();
        if (!conDatos) return false;
      }
      const erroresActuales = erroresDePantalla(PANTALLA.BARBEROS, conDatos);
      if (erroresActuales.length === 0) return true;
      revelarTodos();
      enfocarError(erroresActuales[0], conDatos);
      return false;
    },
  }));

  /**
   * quitar — saca a un barbero. El foco pasa a la lista (el botón tocado ya no existe).
   * @param {string} clave
   */
  const quitar = (clave) => {
    actualizar((d) => quitarBarbero(d, clave));
    if (editando === clave) setEditando(null);
    setFocoPedido('lista');
  };

  /**
   * terminarEdicion — cierra el campo del nombre: lo guarda recortado, muestra
   * su error si lo hay y devuelve el foco al botón de editar.
   * @param {Object} barbero
   * @param {number} i - Su posición
   */
  const terminarEdicion = (barbero, i) => {
    const recortado = (barbero.nombre ?? '').trim();
    if (recortado !== barbero.nombre) actualizar((d) => renombrarBarbero(d, barbero.clave, recortado));
    revelar(`barberos.${i}.nombre`);
    setEditando(null);
    setFocoPedido(`editar:${barbero.clave}`);
  };

  // Un error de comisión con la barra común se muestra debajo de esa barra.
  const unaBarra = comisionIgual || barberos.length === 1;
  const errorComisionComun = unaBarra
    ? barberos.map((_, i) => errorDe(`barberos.${i}.comision`)).find(Boolean)
    : undefined;
  // Con un solo barbero, su barra es la de él (aunque "Mismo %" esté apagado).
  const valorComun = barberos.length === 1 ? barberos[0].comision : comisionComun;

  const errorLista = errorNuevo ?? (barberos.length === 0 ? errorDe('barberos') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── El equipo ── */}
      <section aria-labelledby={idEquipo} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id={idEquipo} style={estiloSoloLector}>Barberos</h2>
        {barberos.length > 0 && (
          <ul
            ref={registrar('lista')}
            tabIndex={-1}
            aria-label={`${barberos.length} ${barberos.length === 1 ? 'barbero' : 'barberos'}`}
            style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', borderRadius: theme.radius }}
          >
            {barberos.map((barbero, i) => (
              <li key={barbero.clave} style={{ borderBottom: `1px solid ${theme.hairlineSoft}` }}>
                <FilaPersona
                  nombre={barbero.nombre ?? ''}
                  animar={!clavesAlMontar.has(barbero.clave)}
                  onQuitar={() => quitar(barbero.clave)}
                  editando={editando === barbero.clave}
                  onEditar={() => setEditando(barbero.clave)}
                  onCambiarNombre={(nombre) => actualizar((d) => renombrarBarbero(d, barbero.clave, nombre))}
                  onTerminarEdicion={() => terminarEdicion(barbero, i)}
                  error={errorDe(`barberos.${i}.nombre`)}
                  refCampo={registrar(`nombre:${barbero.clave}`)}
                  refEditar={registrar(`editar:${barbero.clave}`)}
                />
              </li>
            ))}
          </ul>
        )}

        <div style={{ paddingTop: barberos.length > 0 ? 8 : 0 }}>
          <CampoAgregarNombre
            ref={registrar('nuevo')}
            label={barberos.length === 0 ? 'Nombre del barbero' : 'Otro barbero'}
            valor={nombreNuevo}
            onCambiar={(valor) => { setNombreNuevo(valor); setErrorNuevo(null); }}
            onAgregar={intentarAgregar}
            onEnterVacio={onSeguir}
            error={errorLista}
            helper={barberos.length === 0 ? AYUDA_NOMBRE : AYUDA_NOMBRE_OTRO}
            maxLength={LARGO_NOMBRE_PERSONA.max}
            autoFocus={barberos.length === 0}
          />
        </div>
      </section>

      {/* ── La comisión ── */}
      {barberos.length > 0 && (
        <section aria-labelledby={idComision} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TituloBloque id={idComision} titulo="Comisión" texto="El porcentaje de cada corte que se lleva el barbero." />

          {barberos.length > 1 && (
            <div>
              <Casilla marcada={comisionIgual} onCambiar={(igual) => actualizar((d) => cambiarComisionIgual(d, igual))}>
                Mismo % para todos
              </Casilla>
            </div>
          )}

          {unaBarra ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SelectorComision
                ref={registrar('comision:comun')}
                etiqueta={barberos.length === 1 ? (barberos[0].nombre ?? '').trim() || 'Comisión' : 'Todos'}
                valor={valorComun}
                onCambiar={(comision) => {
                  actualizar((d) => cambiarComisionComun(d, comision));
                  barberos.forEach((_, i) => revelar(`barberos.${i}.comision`));
                }}
                errorId={errorComisionComun ? errorComisionId : undefined}
              />
              {errorComisionComun && <TextoError id={errorComisionId}>{errorComisionComun}</TextoError>}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {barberos.map((barbero, i) => {
                const error = errorDe(`barberos.${i}.comision`);
                const errorId = `${errorComisionId}-${i}`;
                return (
                  <li key={barbero.clave} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SelectorComision
                      ref={registrar(`comision:${barbero.clave}`)}
                      etiqueta={(barbero.nombre ?? '').trim() || 'Sin nombre'}
                      valor={barbero.comision}
                      onCambiar={(comision) => {
                        actualizar((d) => cambiarComisionBarbero(d, barbero.clave, comision));
                        revelar(`barberos.${i}.comision`);
                      }}
                      errorId={error ? errorId : undefined}
                    />
                    {error && <TextoError id={errorId}>{error}</TextoError>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ── El mail de cada uno ── */}
      {barberos.length > 0 && (
        <section aria-labelledby={idMails} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TituloBloque
            id={idMails}
            titulo={barberos.length === 1 ? 'Su mail (opcional)' : 'El mail de cada uno (opcional)'}
            texto="Si lo cargás, le llegan sus turnos a su Google Calendar como invitaciones. Avisale antes, así las acepta."
          />
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {barberos.map((barbero, i) => {
              const nombre = (barbero.nombre ?? '').trim() || 'Sin nombre';
              const abierto = (barbero.email ?? '') !== '' || mailsAbiertos.has(barbero.clave);
              return (
                <li key={barbero.clave}>
                  {abierto ? (
                    <Field
                      ref={registrar(`email:${barbero.clave}`)}
                      label={`Mail de ${nombre}`}
                      type="email"
                      value={barbero.email ?? ''}
                      onChange={(email) => actualizar((d) => cambiarEmailBarbero(d, barbero.clave, email))}
                      onBlur={() => {
                        const recortado = (barbero.email ?? '').trim();
                        if (recortado !== barbero.email) actualizar((d) => cambiarEmailBarbero(d, barbero.clave, recortado));
                        if (recortado) revelar(`barberos.${i}.email`);
                      }}
                      onKeyDown={alPresionarEnter(onSeguir)}
                      error={errorDe(`barberos.${i}.email`)}
                      inputMode="email"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      autoFocus={mailsAbiertos.has(barbero.clave) && (barbero.email ?? '') === ''}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setMailsAbiertos((prev) => new Set(prev).add(barbero.clave))}
                      style={{ justifyContent: 'flex-start' }}
                    >
                      <Mail size={20} strokeWidth={1.75} aria-hidden="true" style={{ color: theme.muted }} />
                      {`Agregar el mail de ${nombre}`}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default PantallaBarberos;
