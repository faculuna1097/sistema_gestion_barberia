// /frontend/src/components/ui/ErrorBoundary.jsx
// Error boundary del panel de gestión, con manejo específico de errores de
// carga de chunk lazy (React.lazy / import() en el camino de render).
//
// Por qué existe: con el code-split de secciones (#7 de
// docs/performance_frontends.md) cada sección baja en su propio chunk JS
// on-demand. Si ese chunk no se puede bajar — caída de red a mitad de sesión,
// o (lo más común) un hash de archivo viejo en el HTML cacheado tras un
// redeploy — React tira el error durante el render del componente lazy. Sin un
// error boundary, eso es pantalla blanca.
//
// React solo soporta error boundaries como class components
// (getDerivedStateFromError / componentDidCatch); no hay equivalente con hooks.
// Por eso esto es una clase aunque el resto del proyecto sea funcional.
//
// Alcance: cubre el render-path (los componentes lazy). NO cubre el
// `await import('xlsx')` dentro de handlers (#3): esa promesa rechaza fuera del
// ciclo de render, así que ningún error boundary la agarra (deuda aparte, ver
// §7 del doc de performance).

import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import Button from './Button.jsx';

// Ventana (ms) dentro de la cual NO reintentamos un reload automático: si
// recargamos hace menos que esto y el chunk volvió a fallar, asumimos que
// recargar no arregla (el chunk de verdad no existe) y mostramos la UI de error
// en vez de loopear. Pasada la ventana, un nuevo fallo (p. ej. otro redeploy
// más tarde en la sesión) vuelve a habilitar el auto-reload.
const VENTANA_RELOAD = 10000;
const CLAVE_RELOAD = 'eb:ultimoReloadChunk';

/**
 * esErrorDeChunk
 * Heurística para distinguir un fallo de descarga de chunk lazy de un bug
 * cualquiera. Cubre los mensajes/clases que tiran Vite (import() dinámico),
 * webpack y los navegadores cuando un módulo no baja.
 * @param {Error} error - El error capturado por el boundary.
 * @returns {boolean} true si parece un error de carga de chunk.
 */
function esErrorDeChunk(error) {
  if (!error) return false;
  const nombre = error.name || '';
  const msg = error.message || '';
  return (
    nombre === 'ChunkLoadError' ||
    /loading chunk [\d]+ failed/i.test(msg) ||
    /failed to (fetch|import) dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg)
  );
}

/**
 * ErrorBoundary
 * Boundary de render para el panel de gestión. Captura errores de los
 * componentes hijos (en particular fallos de carga de chunks lazy) y, según el
 * tipo, auto-recarga la página (chunk) o muestra un EmptyState de error con
 * reintento (bug real).
 * @param {ReactNode} props.children - Subárbol a proteger.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  // Fase de render: solo deriva estado, sin side effects.
  static getDerivedStateFromError(error) {
    return { error };
  }

  // Fase de commit: side effects permitidos. Si es error de chunk y no
  // recargamos hace poco, recargamos la página una vez (trae el HTML nuevo con
  // los hashes nuevos). El guard de sessionStorage evita el loop infinito.
  componentDidCatch(error) {
    if (!esErrorDeChunk(error)) return;
    let ultimo = 0;
    try { ultimo = Number(sessionStorage.getItem(CLAVE_RELOAD)) || 0; } catch { /* sessionStorage off */ }
    const ahora = Date.now();
    if (ahora - ultimo > VENTANA_RELOAD) {
      try { sessionStorage.setItem(CLAVE_RELOAD, String(ahora)); } catch { /* noop */ }
      window.location.reload();
    }
    // Si recargamos hace < VENTANA_RELOAD, no hacemos nada: el render cae al
    // EmptyState (recargar no arregló → no loopeamos).
  }

  // Limpia el error para reintentar el render del subárbol sin recargar la
  // página. Para errores no-chunk un re-render puede andar si fue transitorio;
  // si no, el boundary vuelve a capturar.
  reintentar = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = esErrorDeChunk(error);
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
        width: '100%',
      }}>
        <EmptyState
          tone="danger"
          glyph={<AlertTriangle size={28} strokeWidth={1.75} aria-hidden="true" />}
          title={chunk ? 'No se pudo cargar la sección' : 'Algo salió mal'}
          body={chunk
            ? 'Puede ser una caída de conexión o una actualización del sistema. Recargá la página para reintentar.'
            : 'Ocurrió un error inesperado en esta sección. Probá de nuevo.'}
          action={
            <Button
              variant="secondary"
              full={false}
              onClick={chunk ? () => window.location.reload() : this.reintentar}
            >
              {chunk ? 'Recargar' : 'Reintentar'}
            </Button>
          }
        />
      </div>
    );
  }
}

export default ErrorBoundary;
