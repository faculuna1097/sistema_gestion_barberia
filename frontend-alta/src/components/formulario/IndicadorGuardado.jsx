// /frontend-alta/src/components/formulario/IndicadorGuardado.jsx
// Estado del guardado automático, discreto, arriba a la derecha: "Guardando…"
// o "Guardado" (plan §5.2). El error no va acá: lo muestra AvisoSinGuardar,
// en un renglón propio y con el botón de reintento.
// Local de Formulario (sistema_de_disenio.md §7.1).

import { useState } from 'react';
import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { ESTADOS_GUARDADO } from '../../utils/autoguardado.js';
import { estiloSoloLector } from '../ui/estilos.js';

/**
 * IndicadorGuardado
 * Texto chico con el estado del guardado. Antes del primer cambio (INACTIVO) y
 * con error, queda vacío.
 *
 * Qué anuncia el lector de pantalla: el guardado corre ~800 ms después de cada
 * cambio, y anunciar "Guardando…" y "Guardado" cada vez taparía lo que el
 * cliente está escribiendo. Por eso el texto visible no es una región en vivo.
 * Se anuncian solo los cambios que importan: el error (AvisoSinGuardar, con
 * role="alert") y que se volvió a guardar después de un error (acá, en una
 * región `status` que no se ve y existe siempre).
 * @param {string} props.estado - Uno de ESTADOS_GUARDADO
 * @returns {JSX.Element}
 */
function IndicadorGuardado({ estado }) {
  // Se vuelve a guardar después de un error: lo único que se anuncia desde acá.
  // Estado derivado del anterior (patrón "ajustar el estado al cambiar una prop"
  // de React), sin efecto.
  const [anterior, setAnterior] = useState(estado);
  const [huboError, setHuboError] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  if (estado !== anterior) {
    setAnterior(estado);
    if (estado === ESTADOS_GUARDADO.ERROR) {
      setHuboError(true);
      setAnuncio('');
    } else if (estado === ESTADOS_GUARDADO.GUARDADO && huboError) {
      setHuboError(false);
      setAnuncio('Se guardó todo lo que cargaste.');
    }
  }

  let contenido = null;
  if (estado === ESTADOS_GUARDADO.GUARDANDO) contenido = 'Guardando…';
  if (estado === ESTADOS_GUARDADO.GUARDADO) {
    contenido = (
      <>
        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
        Guardado
      </>
    );
  }

  return (
    <>
      <span role="status" style={estiloSoloLector}>{anuncio}</span>
      <p
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          minHeight: 20,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
          whiteSpace: 'nowrap',
        }}
      >
        {contenido}
      </p>
    </>
  );
}

export default IndicadorGuardado;
