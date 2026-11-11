// /frontend-alta/src/screens/PantallaListo.jsx
// Pantalla 14: "Listo", recién enviada la solicitud (plan §5.2). La tilde
// animada (la única animación con algo de protagonismo, D7) y qué pasa ahora:
// Facundo revisa los datos, arma la barbería y le manda los accesos por
// WhatsApp (D3: el formulario no pide PINs ni contraseñas). Sin plazos.
//
// La muestra App con el estado LISTO (useSolicitud), sin releer la solicitud
// (plan §7.1). Al recargar, la solicitud ya está 'enviada' y App muestra "Ya
// enviada" con el resumen.
//
// El historial: el formulario dejó una entrada por pantalla. Desde acá el
// "atrás" no tiene que volver a un formulario editable (ya no lo es), y apretar
// "atrás" diez veces sin que pase nada parece roto. Al montarse, vuelve a la
// primera entrada del formulario y la reemplaza por esta pantalla: un solo
// "atrás" sale del link (de vuelta a WhatsApp).

import { useEffect, useRef } from 'react';
import { theme } from '../theme/tokens.js';
import { PANTALLAS, PANTALLA } from '../config/pantallas.js';
import { TOKEN } from '../services/api.js';
import { linkWhatsAppContacto } from '../config/contacto.js';
import { Button, IconoWhatsApp, PageContainer } from '../components/ui';

// Mensaje precargado del chat con Facundo.
const MENSAJE_CAMBIO = 'Hola Facundo, recién mandé los datos de mi barbería y quiero cambiar algo.';

// Qué pasa ahora, en orden (es una secuencia: la numeración dice el orden).
const PASOS = [
  'Facundo revisa los datos que cargaste.',
  'Arma tu barbería en el sistema.',
  'Te manda por WhatsApp los accesos: la contraseña del local y los PIN de cada uno.',
];

/**
 * Tilde
 * El círculo con la tilde que se dibuja: el círculo entra con om-pop y el
 * trazo se dibuja con om-stroke (index.css). Con "reducir movimiento", los
 * dos keyframes no animan: el círculo aparece en su lugar con la tilde ya dibujada.
 * @returns {JSX.Element}
 */
function Tilde() {
  return (
    <div aria-hidden="true" style={{
      width: 64,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      background: theme.successSoft,
      color: theme.success,
      animation: 'om-pop 240ms cubic-bezier(0.25, 1, 0.5, 1) backwards',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 22,
            strokeDashoffset: 22,
            animation: 'om-stroke 420ms cubic-bezier(0.25, 1, 0.5, 1) 160ms both',
          }}
        />
      </svg>
    </div>
  );
}

/**
 * PantallaListo
 * @param {Object} props.datos - Lo que se envió
 * @returns {JSX.Element}
 */
function PantallaListo({ datos }) {
  const nombre = datos?.local?.nombre?.trim() ?? '';
  const tituloRef = useRef(null);

  // El historial (ver el encabezado) y el foco en el título, para que el lector
  // anuncie que se envió. Una sola vez por montaje.
  const historialListoRef = useRef(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    tituloRef.current?.focus();
    if (historialListoRef.current) return;
    historialListoRef.current = true;
    const marcarListo = () => history.replaceState({ al: { token: TOKEN, listo: true } }, '');
    const pasos = (history.state?.al?.pila?.length ?? 1) - 1;
    if (pasos <= 0) {
      marcarListo();
      return;
    }
    /** alVolver — llegó a la primera entrada: queda como "Listo". */
    const alVolver = () => {
      window.removeEventListener('popstate', alVolver);
      marcarListo();
    };
    window.addEventListener('popstate', alVolver);
    history.go(-pasos);
  }, []);

  return (
    <PageContainer>
      <main className="al-aparecer" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        padding: '48px 16px calc(32px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
          <Tilde />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 ref={tituloRef} tabIndex={-1} style={{
              fontFamily: theme.body,
              fontSize: theme.sizeTitle,
              fontWeight: theme.weightHeading,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: theme.ink,
              outline: 'none',
            }}>
              {PANTALLAS[PANTALLA.LISTO].titulo}
            </h1>
            <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.5, color: theme.inkSoft, textWrap: 'pretty' }}>
              {nombre ? `Recibimos los datos de ${nombre}.` : 'Recibimos los datos de tu barbería.'}
            </p>
          </div>
        </div>

        <section aria-labelledby="listo-ahora" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 id="listo-ahora" style={{
            fontFamily: theme.body, fontSize: theme.sizeHeading, fontWeight: theme.weightHeading, color: theme.ink,
          }}>
            Qué pasa ahora
          </h2>
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PASOS.map((paso, i) => (
              <li key={paso} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
                <span style={{
                  paddingTop: 3, fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.5, color: theme.ink, textWrap: 'pretty',
                }}>
                  {paso}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.5, color: theme.muted, textWrap: 'pretty' }}>
            Ya podés cerrar esta página. Si te olvidaste de algo, escribile.
          </p>
          <Button variant="secondary" href={linkWhatsAppContacto(MENSAJE_CAMBIO)} externo>
            <IconoWhatsApp />
            Escribirle a Facundo
          </Button>
        </div>
      </main>
    </PageContainer>
  );
}

export default PantallaListo;
