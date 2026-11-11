// /frontend-alta/src/screens/pantallas/PantallaProductos.jsx
// Pantalla 10: "¿Vendés productos?" (plan §5.2). No se saltea: su primera
// parte es la pregunta, igual que la pantalla 7.
// - "Ahora no": no se manda ningún producto y se avanza (la opción queda
//   marcada ~150 ms, useEleccionConPausa). Los que había quedan apartados por
//   si se vuelve a "Sí" (utils/servicios.js → contestarNoVende).
// - "Sí": el nombre de cada producto (Agregar o Enter) y, por producto, su
//   precio (CampoPrecio), el stock y el stock mínimo (desde cuánto el panel
//   avisa que hay que reponer; 0 es sin aviso).

import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { LARGO_NOMBRE_ITEM, erroresDePantalla } from '../../utils/validaciones.js';
import {
  DIGITOS_STOCK_MAXIMOS, agregarProducto, cambiarProducto, contestarNoVende, contestarVende, errorAlAgregarProducto,
  leerEnteroEscrito, leerProductos, quitarProducto, respuestaProductos,
} from '../../utils/servicios.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useEleccionConPausa } from '../../hooks/useEleccionConPausa.js';
import CampoAgregarNombre from '../../components/CampoAgregarNombre.jsx';
import CampoPrecio from '../../components/CampoPrecio.jsx';
import TarjetaItem from '../../components/TarjetaItem.jsx';
import { BotonOpcion, Field, TextoError } from '../../components/ui';

// Mensajes propios del front: la pregunta no es un dato del backend (los
// productos son opcionales y el envío pasa sin ellos).
const TEXTO_SIN_RESPUESTA = 'Elegí una opción.';
const TEXTO_SIN_PRODUCTOS = 'Agregá un producto, o elegí “Ahora no”.';

/**
 * textoEntero (interna)
 * @param {*} valor - stock o stock_minimo
 * @returns {string} Lo que se ve en el campo ('' si está vacío).
 */
const textoEntero = (valor) => (Number.isInteger(valor) ? String(valor) : '');

/**
 * PantallaProductos
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaProductos({ datos, actualizar, onSeguir, ref }) {
  const productos = leerProductos(datos);
  const respuesta = respuestaProductos(datos);
  const errores = useErroresDePantalla(PANTALLA.PRODUCTOS, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const [aviso, setAviso] = useState(null);   // TEXTO_SIN_RESPUESTA o TEXTO_SIN_PRODUCTOS
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [clavesAlMontar] = useState(() => new Set(productos.map((p) => p.clave)));
  const avisoId = useId();
  const primeraOpcionRef = useRef(null);

  // Elementos enfocables por nombre, como en PantallaServicios.
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

  // "Ahora no" avanza después de la pausa (ver PantallaLargoTurno).
  const noTocadoRef = useRef(false);
  const [elegido, elegir] = useEleccionConPausa(() => {
    noTocadoRef.current = true;
    onSeguir();
  });

  /** tocarSi — "Sí": aparecen los productos. */
  const tocarSi = () => {
    actualizar((d) => contestarVende(d));
    setAviso(null);
    if (productos.length === 0) setFocoPedido('nuevo');
  };

  /** tocarNo — "Ahora no": sin productos, y avanza tras la pausa. */
  const tocarNo = () => {
    actualizar((d) => contestarNoVende(d));
    setAviso(null);
    setNombreNuevo('');
    elegir('no');
  };

  /**
   * intentarAgregar — suma el producto escrito si pasa la validación.
   * @returns {Object|null} Los datos nuevos, o null si no se pudo.
   */
  const intentarAgregar = () => {
    const error = errorAlAgregarProducto(datos, nombreNuevo);
    if (error) {
      setErrorNuevo(error);
      setFocoPedido('nuevo');
      return null;
    }
    const nuevos = agregarProducto(datos, nombreNuevo);
    actualizar(nuevos);
    setNombreNuevo('');
    setErrorNuevo(null);
    setAviso(null);
    setFocoPedido(`precio:${nuevos.productos.at(-1).clave}`);
    return nuevos;
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar. Sin contestar, pide que se
     *   elija; con "Sí" y sin productos, pide uno (o "Ahora no"); con errores,
     *   los muestra y lleva el foco al primero.
     */
    intentarSeguir() {
      if (noTocadoRef.current) {
        noTocadoRef.current = false;
        return true;
      }
      let conDatos = datos;
      if (respuesta === 'si' && nombreNuevo.trim() !== '') {
        conDatos = intentarAgregar();
        if (!conDatos) return false;
      }
      if (respuesta === null) {
        setAviso(TEXTO_SIN_RESPUESTA);
        primeraOpcionRef.current?.focus();
        return false;
      }
      if (respuesta === 'si' && leerProductos(conDatos).length === 0) {
        setAviso(TEXTO_SIN_PRODUCTOS);
        setFocoPedido('nuevo');
        return false;
      }
      const erroresActuales = conDatos === datos ? errores : erroresDePantalla(PANTALLA.PRODUCTOS, conDatos);
      if (erroresActuales.length === 0) return true;
      revelarTodos();
      const [, posicion, dato] = erroresActuales[0].campo.split('.');
      const producto = leerProductos(conDatos)[Number(posicion)];
      if (!producto) setFocoPedido('nuevo');
      else if (dato === 'nombre') {
        setEditando(producto.clave);
        setFocoPedido(`nombre:${producto.clave}`);
      } else setFocoPedido(`${dato === 'precio' ? 'precio' : dato}:${producto.clave}`);
      return false;
    },
  }));

  /**
   * terminarEdicion — cierra el campo del nombre (recortado) y muestra su error.
   * @param {Object} producto
   * @param {number} i
   */
  const terminarEdicion = (producto, i) => {
    const recortado = (producto.nombre ?? '').trim();
    if (recortado !== producto.nombre) actualizar((d) => cambiarProducto(d, producto.clave, { nombre: recortado }));
    revelar(`productos.${i}.nombre`);
    setEditando(null);
    setFocoPedido(`editar:${producto.clave}`);
  };

  /**
   * cambiarEntero — guarda el stock o el stock mínimo escrito (solo dígitos).
   * @param {string} clave
   * @param {'stock'|'stock_minimo'} campo
   * @param {string} crudo
   */
  const cambiarEntero = (clave, campo, crudo) => {
    const valor = leerEnteroEscrito(crudo);
    if (valor === undefined) return;
    actualizar((d) => cambiarProducto(d, clave, { [campo]: valor }));
  };

  const siElegido = elegido === null && respuesta === 'si';
  const noElegido = elegido === 'no' || (elegido === null && respuesta === 'no');
  // La lista que ya estaba al entrar no entra creciendo.
  const [listaAlMontar] = useState(siElegido);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div role="group" aria-label="Respuesta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BotonOpcion
            ref={primeraOpcionRef}
            elegida={siElegido}
            onClick={tocarSi}
            descripcion="Los cargás con su precio y su stock."
            describedBy={aviso === TEXTO_SIN_RESPUESTA ? avisoId : undefined}
          >
            Sí
          </BotonOpcion>
          <BotonOpcion
            elegida={noElegido}
            onClick={tocarNo}
            descripcion="Los podés sumar después desde el panel."
            describedBy={aviso === TEXTO_SIN_RESPUESTA ? avisoId : undefined}
          >
            Ahora no
          </BotonOpcion>
        </div>
        {aviso === TEXTO_SIN_RESPUESTA && <TextoError id={avisoId}>{aviso}</TextoError>}
      </div>

      {siElegido && (
        <div className={listaAlMontar ? undefined : 'al-crecer'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {productos.length > 0 && (
              <ul aria-label="Tus productos" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {productos.map((producto, i) => {
                  const nombre = (producto.nombre ?? '').trim() || 'este producto';
                  return (
                    <li key={producto.clave ?? i}>
                      <TarjetaItem
                        nombre={producto.nombre}
                        tipo="producto"
                        animar={!clavesAlMontar.has(producto.clave)}
                        editando={editando === producto.clave}
                        onEditar={() => setEditando(producto.clave)}
                        onCambiarNombre={(valor) => actualizar((d) => cambiarProducto(d, producto.clave, { nombre: valor }))}
                        onTerminarEdicion={() => terminarEdicion(producto, i)}
                        onQuitar={() => {
                          actualizar((d) => quitarProducto(d, producto.clave));
                          setFocoPedido('nuevo');
                        }}
                        errorNombre={errorDe(`productos.${i}.nombre`)}
                        maxLength={LARGO_NOMBRE_ITEM.max}
                        refNombre={registrar(`nombre:${producto.clave}`)}
                        refEditar={registrar(`editar:${producto.clave}`)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <CampoPrecio
                            ref={registrar(`precio:${producto.clave}`)}
                            label="Precio"
                            etiquetaLector={`Precio de ${nombre}`}
                            valor={producto.precio}
                            onCambiar={(precio) => actualizar((d) => cambiarProducto(d, producto.clave, { precio }))}
                            onBlur={() => producto.precio !== null && producto.precio !== undefined && revelar(`productos.${i}.precio`)}
                            onKeyDown={alPresionarEnter(() => elementos.get(`stock:${producto.clave}`)?.focus())}
                            error={errorDe(`productos.${i}.precio`)}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
                            <Field
                              ref={registrar(`stock:${producto.clave}`)}
                              label="Stock"
                              value={textoEntero(producto.stock)}
                              onChange={(crudo) => cambiarEntero(producto.clave, 'stock', crudo)}
                              onBlur={() => Number.isInteger(producto.stock) && revelar(`productos.${i}.stock`)}
                              onKeyDown={alPresionarEnter(() => elementos.get(`stock_minimo:${producto.clave}`)?.focus())}
                              error={errorDe(`productos.${i}.stock`)}
                              helper="Cuántos tenés hoy."
                              inputMode="numeric"
                              autoComplete="off"
                              enterKeyHint="next"
                              maxLength={DIGITOS_STOCK_MAXIMOS}
                            />
                            <Field
                              ref={registrar(`stock_minimo:${producto.clave}`)}
                              label="Stock mínimo"
                              value={textoEntero(producto.stock_minimo)}
                              onChange={(crudo) => cambiarEntero(producto.clave, 'stock_minimo', crudo)}
                              onBlur={() => revelar(`productos.${i}.stock_minimo`)}
                              onKeyDown={alPresionarEnter(onSeguir)}
                              error={errorDe(`productos.${i}.stock_minimo`)}
                              helper="El panel avisa al llegar a este número. Con 0, no avisa."
                              inputMode="numeric"
                              autoComplete="off"
                              enterKeyHint="next"
                              maxLength={DIGITOS_STOCK_MAXIMOS}
                            />
                          </div>
                        </div>
                      </TarjetaItem>
                    </li>
                  );
                })}
              </ul>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CampoAgregarNombre
                ref={registrar('nuevo')}
                label={productos.length === 0 ? 'Nombre del producto' : 'Otro producto'}
                valor={nombreNuevo}
                onCambiar={(valor) => { setNombreNuevo(valor); setErrorNuevo(null); }}
                onAgregar={intentarAgregar}
                onEnterVacio={onSeguir}
                error={errorNuevo ?? (aviso === TEXTO_SIN_PRODUCTOS ? aviso : undefined)}
                helper="Escribí el nombre y tocá Agregar."
                maxLength={LARGO_NOMBRE_ITEM.max}
              />
            </div>
          </div>
        </div>
      )}

      {siElegido && productos.length > 0 && (
        <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted, textWrap: 'pretty' }}>
          Si vendés muchos, cargá los principales: el resto lo sumás desde el panel.
        </p>
      )}
    </div>
  );
}

export default PantallaProductos;
