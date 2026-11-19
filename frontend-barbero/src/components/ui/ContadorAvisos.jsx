// /frontend-barbero/src/components/ui/ContadorAvisos.jsx
// Número chico sobre un ícono (la campanita de "Hoy" y su ítem de la barra de
// abajo) con la cantidad de avisos sin atender. Solo dibuja: el número para el
// lector de pantalla lo pone el botón que lo lleva, en su aria-label.

import { theme } from '../../theme/tokens.js';

// Desde acá se muestra "9+": el número tiene que entrar en el círculo.
const TOPE = 9;

/**
 * ContadorAvisos
 * Círculo en el acento con el número, pegado arriba a la derecha del ícono que
 * lo contiene (el padre tiene que ser `position: relative`). Con 0 no dibuja nada.
 * @param {number} props.cantidad
 * @returns {JSX.Element|null}
 */
function ContadorAvisos({ cantidad }) {
  if (!cantidad) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -6,
        right: -8,
        // Con un dígito es un círculo de 18; con "9+" se estira de costado. El
        // borde blanco lo despega del ícono.
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        borderRadius: 999,
        background: theme.accent,
        color: theme.accentInk,
        border: `2px solid ${theme.surface}`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.body,
        fontSize: theme.sizeMicro,
        fontWeight: theme.weightHeading,
        lineHeight: 1,
      }}
    >
      {cantidad > TOPE ? `${TOPE}+` : cantidad}
    </span>
  );
}

export default ContadorAvisos;
