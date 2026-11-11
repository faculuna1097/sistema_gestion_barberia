// /frontend-alta/src/screens/pantallas/PantallaBienvenida.jsx
// Pantalla 0: la bienvenida (plan §5.2). El título y el "Empezar" los pone
// Formulario (config/pantallas.js); acá va el vistazo de los cuatro capítulos
// y la tranquilidad de que se guarda solo.

import { theme } from '../../theme/tokens.js';
import { CAPITULOS } from '../../config/pantallas.js';

/**
 * PantallaBienvenida
 * Lista numerada de los capítulos (es una secuencia: el número dice el orden)
 * con lo que se pregunta en cada uno. No tiene campos: el "Empezar" siempre avanza.
 * @returns {JSX.Element}
 */
function PantallaBienvenida() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CAPITULOS.map((capitulo, i) => (
          <li key={capitulo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span aria-hidden="true" style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              background: theme.accentSoft,
              color: theme.accent,
              fontFamily: theme.mono,
              fontSize: theme.sizeBody,
              fontWeight: theme.weightMedium,
            }}>
              {i + 1}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 3 }}>
              <span style={{
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: theme.weightHeading,
                color: theme.ink,
              }}>
                {capitulo.nombre}
              </span>
              <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
                {capitulo.resumen}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p style={{
        padding: '12px 16px',
        background: theme.surfaceAlt,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: 1.5,
        color: theme.inkSoft,
        textWrap: 'pretty',
      }}>
        Podés dejarlo cuando quieras y seguir después desde este mismo link, también en otro celular.
      </p>
    </div>
  );
}

export default PantallaBienvenida;
