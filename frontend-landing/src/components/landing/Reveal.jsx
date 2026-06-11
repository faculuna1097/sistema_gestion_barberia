// /frontend-landing/src/components/landing/Reveal.jsx
// Anima la aparición de un bloque cuando entra al viewport (fade + subida
// sutil). Animación FUNCIONAL: guía la lectura al hacer scroll, no es
// decorativa. Respeta prefers-reduced-motion (muestra sin animar).

import { useRef, useState, useEffect } from 'react';

/**
 * Reveal
 * Envuelve contenido y lo revela al entrar en pantalla (una sola vez).
 * @param {ReactNode} props.children
 * @param {number} [props.delay=0] - Retardo de la animación en ms (para escalonar)
 * @param {string} [props.as='div'] - Tag HTML del wrapper
 * @param {Object} [props.style] - Override puntual
 */
function Reveal({ children, delay = 0, as = 'div', style }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si el usuario pidió menos movimiento, mostrar directo sin observar.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

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
      style={{
        opacity: visible ? 1 : 0,
        animation: visible ? `om-reveal 0.5s ease-out ${delay}ms both` : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
