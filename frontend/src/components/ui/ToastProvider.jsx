// /frontend/src/components/ui/ToastProvider.jsx
// Contenedor de los Toast flotantes (sistema_de_disenio.md §4.8). Se monta una
// sola vez, en main.jsx, y se registra como despachador de `toast.show()`
// (utils/toast.js). Dibuja los avisos centrados arriba, por encima de los
// modales, y los saca solos al vencer su duración.

import { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { registrarDespachador, DURACION_TOAST } from '../../utils/toast.js';
import Toast from './Toast.jsx';

// Como mucho tres a la vista: si llega un cuarto, se va el más viejo.
const MAX_TOASTS = 3;

/**
 * ToastProvider
 * Pila de avisos flotantes. Un aviso igual (mismo tono y texto) a uno que ya se
 * ve no se duplica: reinicia su tiempo. Los errores y avisos llevan una X para
 * cerrarlos antes.
 * @returns {JSX.Element}
 */
function ToastProvider() {
  const [avisos, setAvisos] = useState([]); // [{ id, tone, texto }]
  // Copia de la lista para el despachador, que corre fuera del render. Los
  // efectos (timers) van fuera del updater de setState, que en StrictMode corre
  // dos veces.
  const avisosRef = useRef([]);
  const timers = useRef(new Map());          // id → timeout
  const siguienteId = useRef(1);

  /**
   * publicar — reemplaza la lista de avisos (ref + estado).
   * @param {Array} lista
   */
  const publicar = useCallback((lista) => {
    avisosRef.current = lista;
    setAvisos(lista);
  }, []);

  /**
   * quitar — saca un aviso (al vencer o al tocar la X).
   * @param {number} id
   */
  const quitar = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    publicar(avisosRef.current.filter((a) => a.id !== id));
  }, [publicar]);

  useEffect(() => {
    const mapaTimers = timers.current;

    /**
     * programarSalida — (re)inicia el timer que saca un aviso.
     * @param {number} id
     * @param {string} tone
     */
    const programarSalida = (id, tone) => {
      clearTimeout(mapaTimers.get(id));
      mapaTimers.set(id, setTimeout(() => quitar(id), DURACION_TOAST[tone] ?? DURACION_TOAST.info));
    };

    const desregistrar = registrarDespachador(({ tone, texto }) => {
      const igual = avisosRef.current.find((a) => a.tone === tone && a.texto === texto);
      if (igual) {
        programarSalida(igual.id, tone);
        return;
      }
      const id = siguienteId.current++;
      programarSalida(id, tone);
      const nueva = [...avisosRef.current, { id, tone, texto }];
      while (nueva.length > MAX_TOASTS) {
        const fuera = nueva.shift();
        clearTimeout(mapaTimers.get(fuera.id));
        mapaTimers.delete(fuera.id);
      }
      publicar(nueva);
    });

    return () => {
      desregistrar();
      mapaTimers.forEach((t) => clearTimeout(t));
      mapaTimers.clear();
    };
  }, [quitar, publicar]);

  return (
    <div
      // La región existe siempre: un lector de pantalla anuncia lo que entra.
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(480px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        // Encima de los modales (zIndex 100); sin capturar clics fuera de los avisos.
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          style={{
            pointerEvents: 'auto',
            borderRadius: theme.radius,
            boxShadow: theme.shadowMd,
            animation: 'om-fade .18s ease-out both',
          }}
        >
          <Toast
            tone={a.tone}
            dismissible={a.tone === 'danger' || a.tone === 'warning'}
            onDismiss={() => quitar(a.id)}
          >
            {a.texto}
          </Toast>
        </div>
      ))}
    </div>
  );
}

export default ToastProvider;
