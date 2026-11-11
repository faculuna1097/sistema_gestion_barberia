// /frontend-alta/src/screens/pantallas/PantallaDias.jsx
// Pantalla 3: qué días abre el local (plan §5.2). Siete botones que se prenden
// y se apagan, más el atajo "Lunes a sábado". Al prender un día se crea su
// entrada en local.horario con el horario común; al apagarlo, se borra
// (utils/horarioLocal.js).

import { useEffect, useId, useImperativeHandle, useRef } from 'react';
import { CalendarCheck, Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { DIAS_LUNES_A_SABADO } from '../../utils/semana.js';
import { alternarDia, elegirDias, leerHorarioLocal } from '../../utils/horarioLocal.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import SelectorDias from '../../components/SelectorDias.jsx';
import { Button, TextoError } from '../../components/ui';

/**
 * Atajo
 * "Marcar de lunes a sábado": una acción de texto en el color del acento, con
 * el mismo lenguaje que "Cambiar" o "Usar el horario de los demás días", para
 * que no se lea como un día más. Si ya están elegidos exactamente esos días,
 * en su lugar queda una línea quieta que lo confirma (mismo alto: lo de abajo
 * no salta). Si el foco estaba en el botón, pasa a esa línea: si no, al
 * desaparecer el botón el teclado y el lector de pantalla quedarían en el aire.
 * @param {boolean} props.activo - Están elegidos exactamente lunes a sábado
 * @param {Function} props.onClick
 * @returns {JSX.Element}
 */
function Atajo({ activo, onClick }) {
  const confirmacionRef = useRef(null);

  // El botón se acaba de ir y el foco quedó en el body: va a la confirmación.
  useEffect(() => {
    if (activo && document.activeElement === document.body) confirmacionRef.current?.focus();
  }, [activo]);

  if (activo) {
    return (
      <p ref={confirmacionRef} tabIndex={-1} style={{
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
      }}>
        <Check size={20} strokeWidth={1.75} aria-hidden="true" />
        Abren de lunes a sábado
      </p>
    );
  }
  return (
    <Button variant="ghost" full={false} onClick={onClick} style={{ color: theme.accent, marginLeft: -16 }}>
      <CalendarCheck size={20} strokeWidth={1.75} aria-hidden="true" />
      Marcar de lunes a sábado
    </Button>
  );
}

/**
 * PantallaDias
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaDias({ datos, actualizar, ref }) {
  const { dias } = leerHorarioLocal(datos);
  const errores = useErroresDePantalla(PANTALLA.DIAS, datos);
  const { errorDe, revelarTodos } = useErroresVisibles(errores);
  const primerDiaRef = useRef(null);
  const errorId = useId();
  const error = errorDe('local.horario');

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar; si no, muestra el error y
     *   lleva el foco al primer día.
     */
    intentarSeguir() {
      if (errores.length === 0) return true;
      revelarTodos();
      primerDiaRef.current?.focus();
      return false;
    },
  }));

  const esLunesASabado = dias.length === DIAS_LUNES_A_SABADO.length
    && DIAS_LUNES_A_SABADO.every((d) => dias.includes(d));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SelectorDias
        seleccionados={dias}
        onAlternar={(dia) => actualizar((d) => alternarDia(d, dia))}
        etiqueta="Días que abre el local"
        errorId={error ? errorId : undefined}
        refPrimero={primerDiaRef}
      />

      {error && (
        <TextoError id={errorId}>{error}</TextoError>
      )}

      {/* El atajo deja exactamente lunes a sábado (apaga el domingo si estaba). */}
      <div>
        <Atajo
          activo={esLunesASabado}
          onClick={() => actualizar((d) => elegirDias(d, DIAS_LUNES_A_SABADO))}
        />
      </div>
    </div>
  );
}

export default PantallaDias;
