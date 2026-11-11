// /frontend-alta/src/components/formulario/AvisoSinGuardar.jsx
// Aviso de un guardado que falló (plan §5.3: "No pudimos guardar", con
// reintento). Va en un renglón propio debajo del encabezado: junto al capítulo
// no entra en un celular de 375 px, y tiene que tranquilizar (lo cargado sigue
// ahí) además de ofrecer el reintento.
// Local de Formulario (sistema_de_disenio.md §7.1).

import { useLayoutEffect, useRef } from 'react';
import { CloudOff } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { Button } from '../ui';

/**
 * AvisoSinGuardar
 * Renglón en tono danger con el texto y "Reintentar". Es `role="alert"`: el
 * lector de pantalla lo anuncia al aparecer. El autoguardado también reintenta
 * solo, al volver la conexión y en el próximo cambio.
 * Desaparece cuando el guardado sale. Si el foco estaba adentro (se tocó
 * "Reintentar" con el teclado), se lo pasa a `alSalirConFoco` en vez de dejarlo
 * caer al principio de la página.
 * @param {Function} props.onReintentar - Guarda lo pendiente ya
 * @param {Function} [props.alSalirConFoco] - Lleva el foco a otro lado (el título)
 * @returns {JSX.Element}
 */
function AvisoSinGuardar({ onReintentar, alSalirConFoco }) {
  const ref = useRef(null);
  const alSalirRef = useRef(alSalirConFoco);
  useLayoutEffect(() => {
    alSalirRef.current = alSalirConFoco;
  });
  useLayoutEffect(() => {
    const aviso = ref.current;
    return () => {
      // La limpieza corre con el aviso todavía en la página; el foco se mueve
      // apenas termina de sacarse (microtarea), cuando ya cayó en el body.
      if (aviso?.contains(document.activeElement)) queueMicrotask(() => alSalirRef.current?.());
    };
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '4px 4px 4px 12px',
        background: theme.dangerSoft,
        borderRadius: theme.radius,
        color: theme.danger,
      }}
    >
      <CloudOff size={20} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
      <p style={{ flex: 1, fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.4 }}>
        No pudimos guardar. Lo que cargaste sigue acá.
      </p>
      <Button
        variant="ghost"
        full={false}
        onClick={onReintentar}
        style={{ color: theme.danger, padding: '8px 12px', flexShrink: 0 }}
      >
        Reintentar
      </Button>
    </div>
  );
}

export default AvisoSinGuardar;
