// /frontend-alta/src/screens/Formulario.jsx
// El formulario mientras la solicitud está en borrador: una pantalla por paso,
// con el encabezado (volver, capítulo y guardado), la tarjeta "Tu barbería" y
// el "Seguir" fijo abajo (plan §5.2). Solo el contenido de cada pantalla entra
// con la transición (al-pantalla); lo demás queda quieto.
//
// La pantalla actual vive en el historial (useNavegacion) y se guarda en
// `datos.progreso.pantalla`, para retomar ahí al recargar o desde otro
// dispositivo.

import { useEffect, useState } from 'react';
import { theme } from '../theme/tokens.js';
import { TOKEN } from '../services/api.js';
import {
  PANTALLAS, PANTALLA, ULTIMA_PANTALLA_GUARDABLE, caminoHasta,
} from '../config/pantallas.js';
import { useNavegacion } from '../hooks/useNavegacion.js';
import { PageContainer, StickyFooter, Button } from '../components/ui';
import EncabezadoFormulario from '../components/formulario/EncabezadoFormulario.jsx';
import TarjetaBarberia from '../components/TarjetaBarberia.jsx';
import PantallaPlaceholder from './PantallaPlaceholder.jsx';

/**
 * Formulario
 * @param {Object} props.solicitud - Lo que devuelve useSolicitud (estado BORRADOR)
 * @returns {JSX.Element}
 */
function Formulario({ solicitud }) {
  const { datos, actualizar, guardado, reintentarGuardado } = solicitud;

  // Camino hasta donde quedó, leído una sola vez: después manda el historial.
  const [pilaInicial] = useState(() => caminoHasta(datos.progreso?.pantalla));
  const nav = useNavegacion({ token: TOKEN, pilaInicial });
  const pantalla = PANTALLAS[nav.pantalla];

  // Guarda dónde quedó cada vez que cambia la pantalla ("Seguir" o "atrás").
  // "Listo" no se guarda: existe solo después de enviar.
  const pantallaGuardada = datos.progreso?.pantalla;
  useEffect(() => {
    if (nav.pantalla > ULTIMA_PANTALLA_GUARDABLE || nav.pantalla === pantallaGuardada) return;
    actualizar((d) => ({ ...d, progreso: { ...d.progreso, pantalla: nav.pantalla } }));
  }, [nav.pantalla, pantallaGuardada, actualizar]);

  /**
   * seguir
   * Avanza a la pantalla siguiente. En el esqueleto no valida: cada fase suma
   * erroresDePantalla (utils/validaciones.js) al armar su pantalla.
   */
  const seguir = () => {
    if (nav.pantalla < PANTALLA.LISTO) nav.irA(nav.pantalla + 1);
  };

  return (
    <PageContainer>
      {/* data-al-direccion: index.css elige con él la entrada del contenido. */}
      <div
        data-al-direccion={nav.direccion ?? undefined}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <EncabezadoFormulario
          pantalla={nav.pantalla}
          onVolver={nav.profundidad > 1 ? nav.volver : null}
          guardado={guardado}
          onReintentar={reintentarGuardado}
        />

        {pantalla.capitulo && (
          <div style={{ padding: '16px 16px 0' }}>
            <TarjetaBarberia datos={datos} />
          </div>
        )}

        {/* La key nueva en cada paso remonta el contenido y dispara su entrada. */}
        <main
          key={`${nav.profundidad}-${nav.pantalla}`}
          className="al-pantalla"
          style={{ flex: 1, padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{
              fontFamily: theme.body,
              fontSize: theme.sizeTitle,
              fontWeight: theme.weightHeading,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: theme.ink,
              textWrap: 'balance',
            }}>
              {pantalla.titulo}
            </h1>
            {pantalla.subtitulo && (
              <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
                {pantalla.subtitulo}
              </p>
            )}
          </div>

          <PantallaPlaceholder pantalla={pantalla} datos={datos} actualizar={actualizar} />
        </main>

        {pantalla.textoSeguir && (
          <StickyFooter>
            <Button onClick={seguir}>{pantalla.textoSeguir}</Button>
          </StickyFooter>
        )}
      </div>
    </PageContainer>
  );
}

export default Formulario;
