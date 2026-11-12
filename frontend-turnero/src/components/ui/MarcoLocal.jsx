// /frontend-turnero/src/components/ui/MarcoLocal.jsx
// Marco de todo el turnero en pantalla ancha (usePantallaAncha: iPad, compu,
// celular acostado): a la izquierda, un panel fijo con el local (HeroLocal a
// todo el alto); a la derecha, la pantalla de turno en su columna
// (PageContainer). En el celular no dibuja nada propio.
//
// Lo monta App una sola vez, por fuera de las pantallas: al navegar, el panel
// queda quieto (no se vuelve a montar ni entra con la transición) y solo la
// columna se desliza.

import { theme } from '../../theme/tokens.js';
import { usePantallaAncha } from '../../hooks/usePantallaAncha.js';
import HeroLocal from './HeroLocal.jsx';

/**
 * MarcoLocal
 * En pantalla ancha: fila con el panel del local (pegado arriba, alto de la
 * ventana) y el contenido. En el celular: solo el contenido.
 * El árbol es el mismo en los dos casos (el contenido siempre es el segundo
 * hijo): al rotar el celular, la pantalla no se vuelve a montar ni pierde lo
 * que se eligió.
 * El panel es solo identidad del local (foto, logo, nombre, abierto/cerrado):
 * no tiene nada enfocable, así que el orden de Tab no cambia.
 * @param {Object|null} props.tenant - Datos del local; null mientras carga (panel oscuro liso)
 * @param {Array<Object>} [props.imagenes] - Imágenes del local (logo, foto)
 * @param {ReactNode} props.children - La pantalla (con su PageContainer)
 */
function MarcoLocal({ tenant, imagenes = [], children }) {
  const ancha = usePantallaAncha();

  return (
    <div style={ancha ? { display: 'flex', minHeight: '100dvh', background: theme.bg } : undefined}>
      {ancha && (
        <div style={{
          position: 'sticky',
          top: 0,
          height: '100dvh',
          width: theme.anchoPanelLocal,
          flexShrink: 0,
          // Lo que se ve mientras carga el local, o si no tiene foto.
          background: theme.accent,
          overflow: 'hidden',
        }}>
          {tenant && <HeroLocal tenant={tenant} imagenes={imagenes} lleno />}
        </div>
      )}
      <div style={ancha ? { flex: 1, minWidth: 0 } : undefined}>
        {children}
      </div>
    </div>
  );
}

export default MarcoLocal;
