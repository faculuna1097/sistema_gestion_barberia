// /frontend-alta/src/screens/Formulario.jsx
// El formulario mientras la solicitud está en borrador: una pantalla por paso,
// con el encabezado (volver, capítulo y guardado), la tarjeta "Tu barbería" y
// el "Seguir" fijo abajo (plan §5.2). Solo el contenido de cada pantalla entra
// con la transición (al-pantalla); lo demás queda quieto.
//
// La pantalla actual vive en el historial (useNavegacion) y se guarda en
// `datos.progreso.pantalla`, para retomar ahí al recargar o desde otro
// dispositivo.
//
// Contrato de cada pantalla (CONTENIDO_POR_PANTALLA): recibe `datos`,
// `actualizar`, `onSeguir` (el mismo "Seguir" del pie, para el Enter de los
// campos de texto) y un `ref` donde expone `intentarSeguir()`. Esa función
// valida la pantalla (erroresDePantalla), y si hay errores los muestra, lleva
// el foco al primero y devuelve false. Una pantalla sin ref (ej. la
// bienvenida) siempre deja seguir.

import { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from '../theme/tokens.js';
import { TOKEN } from '../services/api.js';
import {
  PANTALLAS, PANTALLA, ULTIMA_PANTALLA_GUARDABLE, caminoHasta, textoDe,
} from '../config/pantallas.js';
import { useNavegacion } from '../hooks/useNavegacion.js';
import { PageContainer, StickyFooter, Button } from '../components/ui';
import EncabezadoFormulario from '../components/formulario/EncabezadoFormulario.jsx';
import TarjetaBarberia from '../components/TarjetaBarberia.jsx';
import PantallaPlaceholder from './PantallaPlaceholder.jsx';
import PantallaBienvenida from './pantallas/PantallaBienvenida.jsx';
import PantallaNombre from './pantallas/PantallaNombre.jsx';
import PantallaDireccion from './pantallas/PantallaDireccion.jsx';
import PantallaDias from './pantallas/PantallaDias.jsx';
import PantallaHorario from './pantallas/PantallaHorario.jsx';
import PantallaBarberos from './pantallas/PantallaBarberos.jsx';
import PantallaDuenios from './pantallas/PantallaDuenios.jsx';
import PantallaHorariosEquipo from './pantallas/PantallaHorariosEquipo.jsx';

/**
 * CONTENIDO_POR_PANTALLA
 * El componente de cada pantalla ya armada. Las que no están (8 a 14) muestran
 * PantallaPlaceholder hasta que las arme su fase.
 */
const CONTENIDO_POR_PANTALLA = {
  [PANTALLA.BIENVENIDA]: PantallaBienvenida,
  [PANTALLA.NOMBRE]: PantallaNombre,
  [PANTALLA.DIRECCION]: PantallaDireccion,
  [PANTALLA.DIAS]: PantallaDias,
  [PANTALLA.HORARIO]: PantallaHorario,
  [PANTALLA.BARBEROS]: PantallaBarberos,
  [PANTALLA.DUENIOS]: PantallaDuenios,
  [PANTALLA.HORARIOS_EQUIPO]: PantallaHorariosEquipo,
};

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

  // La pantalla montada expone acá su intentarSeguir().
  const contenidoRef = useRef(null);

  // nav cambia en cada render: el "Seguir" lo lee de un ref para ser estable
  // (las pantallas lo usan en efectos, ej. el nombre cuando espera la consulta del link).
  const navRef = useRef(nav);
  useEffect(() => { navRef.current = nav; });

  /**
   * seguir
   * El "Seguir" del pie (y el Enter de los campos): le pregunta a la pantalla
   * si se puede avanzar y, si sí, apila la siguiente.
   */
  const seguir = useCallback(() => {
    const puede = contenidoRef.current?.intentarSeguir?.() ?? true;
    const { pantalla: actual, irA } = navRef.current;
    if (puede && actual < PANTALLA.LISTO) irA(actual + 1);
  }, []);

  const Contenido = CONTENIDO_POR_PANTALLA[nav.pantalla];
  const titulo = textoDe(pantalla.titulo, datos);
  const subtitulo = textoDe(pantalla.subtitulo, datos);

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
            <TarjetaBarberia datos={datos} pantalla={nav.pantalla} />
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
              {titulo}
            </h1>
            {subtitulo && (
              <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
                {subtitulo}
              </p>
            )}
          </div>

          {Contenido ? (
            <Contenido ref={contenidoRef} datos={datos} actualizar={actualizar} onSeguir={seguir} />
          ) : (
            <PantallaPlaceholder pantalla={pantalla} />
          )}
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
