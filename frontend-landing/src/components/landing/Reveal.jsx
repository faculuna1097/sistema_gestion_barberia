// /frontend-landing/src/components/landing/Reveal.jsx
// Anima la aparición de un bloque cuando entra al viewport (fade + subida
// sutil). Animación FUNCIONAL: guía la lectura al hacer scroll, no es
// decorativa.
// La página se pre-renderiza: en el HTML el contenido va visible. El ocultar y
// animar lo hace CSS (`.js .om-reveal` en index.css), solo si hay JS activo, y
// prefers-reduced-motion también se resuelve ahí (sin ocultar ni animar). Este
// componente solo agrega `om-reveal-visible` al entrar en pantalla.

import { useRef, useState, useEffect } from 'react';

/**
 * Reveal
 * Envuelve contenido y lo revela al entrar en pantalla (una sola vez).
 * @param {ReactNode} props.children
 * @param {number} [props.delay=0] - Retardo de la animación en ms (para escalonar)
 * @param {string} [props.as='div'] - Tag HTML del wrapper
 * @param {Object} [props.style] - Override puntual (no pasar opacity ni animation:
 *   los maneja la clase CSS y un inline los pisaría)
 * @returns {JSX.Element}
 */
function Reveal({ children, delay = 0, as = 'div', style }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  // Observa el wrapper y lo marca visible la primera vez que entra en pantalla.
  // El setState va en el callback del observer (evento externo), no en el
  // cuerpo del efecto.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={visible ? 'om-reveal om-reveal-visible' : 'om-reveal'}
      style={{
        // El delay viaja como variable CSS: la animación la define index.css.
        ...(delay ? { '--om-reveal-delay': `${delay}ms` } : null),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
