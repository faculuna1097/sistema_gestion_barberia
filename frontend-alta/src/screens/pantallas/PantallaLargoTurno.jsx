// /frontend-alta/src/screens/pantallas/PantallaLargoTurno.jsx
// Pantalla 8: cada cuánto da turnos (plan §5.2). Una barra de 10 a 60
// minutos que salta de a 5 (SelectorConBarra, la misma de la comisión), con
// botones de - y + para el ajuste fino.
// Arranca en 30 (TURNO_POR_DEFECTO), el más común: el camino común es tocar
// "Seguir" sin mover nada, y ahí se guarda el 30. Mover la barra guarda en el
// momento.
// Cambiar el largo no reescribe los servicios: conservan sus turnos, y la
// pantalla 9 avisa que sus minutos cambiaron (utils/servicios.js).

import { useId, useImperativeHandle, useRef } from 'react';
import { PANTALLA } from '../../config/pantallas.js';
import { PASO_TURNO, TURNO_MAXIMO, TURNO_MINIMO } from '../../utils/validaciones.js';
import { TURNO_POR_DEFECTO, duracionTurno, elegirDuracionTurno } from '../../utils/servicios.js';
import { alPresionarEnter } from '../../utils/teclado.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import SelectorConBarra from '../../components/SelectorConBarra.jsx';
import { TextoError } from '../../components/ui';

/**
 * fmtTurno (interna)
 * @param {number} minutos
 * @returns {string} "30 min"
 */
const fmtTurno = (minutos) => `${minutos} min`;

/**
 * PantallaLargoTurno
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Function} props.onSeguir - El "Seguir" de Formulario (valida y avanza)
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaLargoTurno({ datos, actualizar, onSeguir, ref }) {
  const actual = duracionTurno(datos);
  const errores = useErroresDePantalla(PANTALLA.LARGO_TURNO, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);
  const errorId = useId();
  const barraRef = useRef(null);

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * Sin un largo elegido (la barra muestra el 30), guarda el 30 y deja
     * seguir. Si quedó algún error (ej. uno que marcó el backend), lo muestra
     * y lleva el foco a la barra.
     * @returns {boolean} true si se puede avanzar.
     */
    intentarSeguir() {
      if (actual === null) {
        actualizar((d) => elegirDuracionTurno(d, TURNO_POR_DEFECTO));
        return true;
      }
      if (errores.length === 0) return true;
      revelarTodos();
      barraRef.current?.focus();
      return false;
    },
  }));

  const error = errorDe('turno');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SelectorConBarra
        ref={barraRef}
        etiqueta="Turnos cada"
        valor={actual ?? TURNO_POR_DEFECTO}
        onCambiar={(minutos) => {
          actualizar((d) => elegirDuracionTurno(d, minutos));
          revelar('turno');
        }}
        min={TURNO_MINIMO}
        max={TURNO_MAXIMO}
        paso={PASO_TURNO}
        porDefecto={TURNO_POR_DEFECTO}
        formatear={fmtTurno}
        unidadPaso={`${PASO_TURNO} minutos`}
        onKeyDown={alPresionarEnter(onSeguir)}
        errorId={error ? errorId : undefined}
      />
      {error && <TextoError id={errorId}>{error}</TextoError>}
    </div>
  );
}

export default PantallaLargoTurno;
