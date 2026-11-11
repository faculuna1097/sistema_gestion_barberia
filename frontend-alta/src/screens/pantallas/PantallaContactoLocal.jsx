// /frontend-alta/src/screens/pantallas/PantallaContactoLocal.jsx
// Pantalla 11: cómo contactan al local sus clientes (plan §5.2).
// - WhatsApp: país (Argentina por defecto) y número con formato mientras se
//   escribe (CampoTelefono). Se guarda en E.164.
// - "Es el mismo número para llamadas", prendido por defecto: el teléfono del
//   local es el mismo WhatsApp. Apagado, aparece un campo propio.
// - El link de reseñas de Google, opcional, con una ayuda corta de dónde sale
//   y "Lo paso después".
// La lógica vive en utils/contacto.js; las marcas de interfaz, en progreso.

import { useImperativeHandle, useRef, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import {
  cambiarMismoNumero, cambiarResena, cambiarTelefono, completarLinkResena, escribirTelefono, leerTelefono, mismoNumero,
  pasarResenaDespues, resenaParaDespues,
} from '../../utils/contacto.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useFocoPendiente } from '../../hooks/useFocoPendiente.js';
import CampoTelefono from '../../components/CampoTelefono.jsx';
import { Button, Casilla, Field } from '../../components/ui';
import { estiloEtiquetaCampo } from '../../components/ui/estilos.js';

// Dónde sale el link de reseñas: el de "Pedir reseñas" del perfil de Google del local.
const AYUDA_RESENAS = 'Buscá tu barbería en Google, tocá “Pedir reseñas” y copiá el link. Con él, tus clientes te dejan una reseña desde la página de turnos.';

/**
 * PantallaContactoLocal
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaContactoLocal({ datos, actualizar, onSeguir, ref }) {
  const whatsapp = leerTelefono(datos, 'whatsapp');
  const telefono = leerTelefono(datos, 'telefono');
  const mismo = mismoNumero(datos);
  const despues = resenaParaDespues(datos);
  const errores = useErroresDePantalla(PANTALLA.CONTACTO_LOCAL, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);

  const whatsappRef = useRef(null);
  const telefonoRef = useRef(null);
  const resenaRef = useRef(null);
  const agregarResenaRef = useRef(null);
  const pedirFoco = useFocoPendiente();
  const [focoResena, setFocoResena] = useState(false);
  // El campo del teléfono propio y el de reseñas que ya estaban al entrar no entran creciendo.
  const [alMontar] = useState(() => ({ telefono: !mismo, resena: !despues }));

  /**
   * escribir — un teléfono después de una tecla (o un cambio de país).
   * @param {'whatsapp'|'telefono'} id
   * @param {string} crudo
   * @param {string} pais
   */
  const escribir = (id, crudo, pais) => {
    const nuevo = escribirTelefono(crudo, pais);
    if (nuevo) actualizar((d) => cambiarTelefono(d, id, nuevo));
  };

  /**
   * pasarA — el Enter de un campo: el foco va al siguiente, o sigue de
   * pantalla si no hay otro.
   * @param {Object} siguienteRef - Ref del campo que sigue
   */
  const pasarA = (siguienteRef) => {
    if (siguienteRef.current) siguienteRef.current.focus();
    else onSeguir();
  };

  /**
   * completarYSeguir — el Enter del link de reseñas: lo completa (como al
   * salir del campo) y sigue. Si hubo que completarlo, el "Seguir" espera al
   * próximo cuadro, así valida el link ya completo.
   */
  const completarYSeguir = () => {
    const completo = completarLinkResena(datos.local.resena_url);
    if (completo === datos.local.resena_url) {
      onSeguir();
      return;
    }
    actualizar((d) => cambiarResena(d, completo));
    requestAnimationFrame(() => onSeguir());
  };

  /**
   * enfocar — lleva el foco al campo de un error. Con "mismo número", un error
   * del teléfono se corrige en el WhatsApp.
   * @param {string} campo
   */
  const enfocar = (campo) => {
    if (campo === 'local.resena_url') {
      if (despues) actualizar((d) => pasarResenaDespues(d, false));
      setFocoResena(true);
      pedirFoco(() => resenaRef.current);
    } else if (campo === 'local.telefono' && !mismo) telefonoRef.current?.focus();
    else whatsappRef.current?.focus();
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
      enfocar(errores[0].campo);
      return false;
    },
  }));

  // Con "mismo número", el teléfono es el WhatsApp: su error (si el backend
  // marcó alguno que el WhatsApp no tiene) se muestra en el WhatsApp.
  const errorWhatsapp = errorDe('local.whatsapp') ?? (mismo ? errorDe('local.telefono') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CampoTelefono
          ref={whatsappRef}
          label="WhatsApp del local"
          pais={whatsapp.pais}
          onCambiarPais={(pais) => actualizar((d) => cambiarTelefono(d, 'whatsapp', { pais, nacional: '' }))}
          valor={whatsapp.nacional}
          onCambiar={(crudo) => escribir('whatsapp', crudo, whatsapp.pais)}
          onBlur={() => whatsapp.nacional.trim() && revelar('local.whatsapp')}
          onKeyDown={(e) => alPresionarEnter(() => pasarA(mismo ? resenaRef : telefonoRef))(e)}
          error={errorWhatsapp}
          helper="Por acá te escriben tus clientes."
          name="tel"
          placeholder={whatsapp.pais === 'AR' ? '11 3311-1686' : undefined}
          autoFocus={whatsapp.nacional === ''}
        />
        <div>
          <Casilla marcada={mismo} onCambiar={(valor) => actualizar((d) => cambiarMismoNumero(d, valor))}>
            Es el mismo número para llamadas
          </Casilla>
        </div>
        {!mismo && (
          <div className={alMontar.telefono ? undefined : 'al-crecer'}>
            <div>
              <CampoTelefono
                ref={telefonoRef}
                label="Teléfono para llamadas"
                pais={telefono.pais}
                onCambiarPais={(pais) => actualizar((d) => cambiarTelefono(d, 'telefono', { pais, nacional: '' }))}
                valor={telefono.nacional}
                onCambiar={(crudo) => escribir('telefono', crudo, telefono.pais)}
                onBlur={() => telefono.nacional.trim() && revelar('local.telefono')}
                onKeyDown={(e) => alPresionarEnter(() => pasarA(resenaRef))(e)}
                error={errorDe('local.telefono')}
                helper="Un fijo o el celular del local."
                name="tel-local"
                autoComplete="off"
                placeholder={telefono.pais === 'AR' ? '11 4567-8901' : undefined}
                autoFocus={!alMontar.telefono}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {despues ? (
          <>
            <span style={estiloEtiquetaCampo}>Link de reseñas</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 52,
              padding: '4px 4px 4px 14px',
              background: theme.surfaceAlt,
              borderRadius: theme.radius,
            }}>
              <p style={{ flex: 1, minWidth: 0, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
                Lo pasás después.
              </p>
              <Button
                ref={agregarResenaRef}
                variant="ghost"
                full={false}
                onClick={() => {
                  actualizar((d) => pasarResenaDespues(d, false));
                  setFocoResena(true);
                }}
                style={{ color: theme.accent, flexShrink: 0 }}
              >
                Agregarlo ahora
              </Button>
            </div>
          </>
        ) : (
          <div className={alMontar.resena || !focoResena ? undefined : 'al-crecer'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Field
                ref={resenaRef}
                label="Link de reseñas de Google (opcional)"
                type="url"
                value={datos.local.resena_url ?? ''}
                onChange={(url) => actualizar((d) => cambiarResena(d, url))}
                onBlur={() => {
                  const completo = completarLinkResena(datos.local.resena_url);
                  if (completo !== datos.local.resena_url) actualizar((d) => cambiarResena(d, completo));
                  if (completo) revelar('local.resena_url');
                }}
                onKeyDown={alPresionarEnter(completarYSeguir)}
                error={errorDe('local.resena_url')}
                helper={AYUDA_RESENAS}
                placeholder="https://g.page/r/…"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                autoFocus={focoResena}
              />
              <div>
                <Button
                  variant="ghost"
                  full={false}
                  onClick={() => {
                    actualizar((d) => pasarResenaDespues(d, true));
                    // El campo y este botón desaparecen: el foco pasa a "Agregarlo ahora".
                    pedirFoco(() => agregarResenaRef.current);
                  }}
                  style={{ color: theme.accent, marginLeft: -16 }}
                >
                  Lo paso después
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PantallaContactoLocal;
