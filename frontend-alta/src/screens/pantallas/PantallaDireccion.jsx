// /frontend-alta/src/screens/pantallas/PantallaDireccion.jsx
// Pantalla 2: la dirección del local, en partes: calle, altura (o "Sin
// número"), piso o local (opcional), provincia y ciudad (barrio en CABA).
// Pedirla en partes obliga a poner la altura y la localidad, que son las que
// hacen que Google Maps encuentre el local. Con todo completo aparece "Ver en
// Google Maps": el mismo link que abre el "Cómo llegar" del turnero, para que
// el dueño confirme que el pin cae en su local.
// Las partes van en progreso.direccion y el texto armado en local.direccion
// (utils/direccion.js).

import { useImperativeHandle, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import {
  LARGOS_DIRECCION, PROVINCIAS, cambiarPartesDireccion, direccionCompleta, erroresDeDireccion, esCaba,
  leerPartesDireccion, soloDigitos,
} from '../../utils/direccion.js';
import { linkMapa } from '../../utils/mapa.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { Button, Casilla, Field, Select, TextoError } from '../../components/ui';

/**
 * PantallaDireccion
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaDireccion({ datos, actualizar, onSeguir, ref }) {
  const partes = leerPartesDireccion(datos);
  const caba = esCaba(partes.provincia);

  // Los errores de cada parte (del front) y, si están todas bien, el del texto
  // armado (la regla del backend: hasta 120 caracteres).
  const erroresPartes = erroresDeDireccion(partes);
  const erroresArmado = useErroresDePantalla(PANTALLA.DIRECCION, datos);
  const errores = erroresPartes.length > 0 ? erroresPartes : erroresArmado;
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const calleRef = useRef(null);
  const alturaRef = useRef(null);
  const pisoRef = useRef(null);
  const provinciaRef = useRef(null);
  const ciudadRef = useRef(null);

  // El link al mapa aparece al completar la dirección; si ya estaba al entrar, no se anima.
  const completa = direccionCompleta(partes);
  const [completaAlMontar] = useState(completa);

  /**
   * cambiar — guarda una o más partes (y el texto armado).
   * @param {Object} cambios - Ej. { calle: 'Av. Corrientes' }
   */
  const cambiar = (cambios) => actualizar((d) => cambiarPartesDireccion(d, cambios));

  /**
   * salirDe — al salir de un campo de texto: lo guarda sin espacios de más y,
   * si se escribió algo, muestra su error (si hay).
   * @param {string} parte - 'calle' | 'piso' | 'ciudad'
   */
  const salirDe = (parte) => {
    const recortado = partes[parte].trim();
    if (recortado !== partes[parte]) cambiar({ [parte]: recortado });
    if (recortado) revelar(`direccion.${parte}`);
  };

  /**
   * enfocar — lleva el foco al campo de una parte. Lo usan el Enter de cada
   * campo (pasa al siguiente) y el "Seguir" (al del primer error); los
   * onKeyDown llaman a alPresionarEnter adentro del handler, no en el render.
   * @param {string} parte - 'calle' | 'altura' | 'piso' | 'provincia' | 'ciudad'
   */
  const enfocar = (parte) => {
    const porParte = { calle: calleRef, altura: alturaRef, piso: pisoRef, provincia: provinciaRef, ciudad: ciudadRef };
    // Otro campo (el texto armado, local.direccion) se corrige acortando la calle.
    (porParte[parte] ?? calleRef).current?.focus();
  };

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   enfoca el campo del primero.
     */
    intentarSeguir() {
      if (errores.length === 0) return true;
      revelarTodos();
      enfocar(errores[0].campo.split('.')[1]);
      return false;
    },
  }));

  const errorArmado = errorDe('local.direccion');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field
        ref={calleRef}
        label="Calle"
        value={partes.calle}
        onChange={(calle) => cambiar({ calle })}
        onBlur={() => salirDe('calle')}
        onKeyDown={(e) => alPresionarEnter(() => enfocar(partes.sin_numero ? 'piso' : 'altura'))(e)}
        error={errorDe('direccion.calle')}
        name="address-line1"
        autoComplete="address-line1"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={LARGOS_DIRECCION.calle}
        autoFocus={partes.calle === ''}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 12, alignItems: 'start' }}>
          <Field
            ref={alturaRef}
            label="Altura"
            value={partes.altura}
            onChange={(altura) => cambiar({ altura: soloDigitos(altura) })}
            onBlur={() => partes.altura && revelar('direccion.altura')}
            onKeyDown={(e) => alPresionarEnter(() => enfocar('piso'))(e)}
            error={errorDe('direccion.altura')}
            placeholder={partes.sin_numero ? 's/n' : undefined}
            disabled={partes.sin_numero}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={LARGOS_DIRECCION.altura}
          />
          <Field
            ref={pisoRef}
            label="Piso o local"
            value={partes.piso}
            onChange={(piso) => cambiar({ piso })}
            onBlur={() => salirDe('piso')}
            onKeyDown={(e) => alPresionarEnter(() => enfocar('provincia'))(e)}
            placeholder="Opcional"
            name="address-line2"
            autoComplete="address-line2"
            autoCapitalize="sentences"
            enterKeyHint="next"
            maxLength={LARGOS_DIRECCION.piso}
          />
        </div>
        <div>
          <Casilla
            marcada={partes.sin_numero}
            onCambiar={(sinNumero) => cambiar({ sin_numero: sinNumero, altura: '' })}
          >
            Sin número
          </Casilla>
        </div>
      </div>

      <Select
        ref={provinciaRef}
        label="Provincia"
        value={partes.provincia}
        onChange={(provincia) => cambiar({ provincia })}
        opciones={PROVINCIAS}
        placeholder="Elegí la provincia"
        error={errorDe('direccion.provincia')}
        name="address-level1"
        autoComplete="address-level1"
      />

      <Field
        ref={ciudadRef}
        label={caba ? 'Barrio' : 'Ciudad o localidad'}
        value={partes.ciudad}
        onChange={(ciudad) => cambiar({ ciudad })}
        onBlur={() => salirDe('ciudad')}
        onKeyDown={alPresionarEnter(onSeguir)}
        error={errorDe('direccion.ciudad')}
        name="address-level2"
        autoComplete="address-level2"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={LARGOS_DIRECCION.ciudad}
      />

      {errorArmado && <TextoError id="error-direccion-armada">{errorArmado}</TextoError>}

      {completa && (
        <div className={completaAlMontar ? undefined : 'al-crecer'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <Button variant="secondary" href={linkMapa(datos.local.direccion)} externo>
              <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
              Ver en Google Maps
            </Button>
            <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.4, color: theme.muted, textWrap: 'pretty' }}>
              Fijate que el pin caiga en tu local: así lo van a encontrar tus clientes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PantallaDireccion;
