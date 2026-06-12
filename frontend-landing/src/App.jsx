// /frontend-landing/src/App.jsx
// Ensamblado final de la landing: Nav + las 12 secciones en orden + Footer +
// barra CTA fija de mobile. Testimonios se renderiza solo si su flag está en true.

import LandingNav from './components/landing/LandingNav.jsx';
import LandingFooter from './components/landing/LandingFooter.jsx';
import MobileCtaBar from './components/landing/MobileCtaBar.jsx';
import { FLAGS } from './config/landing.js';
import Hero from './components/sections/Hero.jsx';
import Problema from './components/sections/Problema.jsx';
import ComoFunciona from './components/sections/ComoFunciona.jsx';
import Turnero from './components/sections/Turnero.jsx';
import AppBarberos from './components/sections/AppBarberos.jsx';
import SistemaGestion from './components/sections/SistemaGestion.jsx';
import Metricas from './components/sections/Metricas.jsx';
import Beneficios from './components/sections/Beneficios.jsx';
import Comparacion from './components/sections/Comparacion.jsx';
import Testimonios from './components/sections/Testimonios.jsx';
import Plan from './components/sections/Plan.jsx';
import FAQ from './components/sections/FAQ.jsx';
import CtaFinal from './components/sections/CtaFinal.jsx';

/**
 * App
 * Raíz de la landing. Sin props.
 * @returns {JSX.Element}
 */
function App() {
  return (
    <>
      <LandingNav />

      <main>
        <Hero />
        <Problema />
        <ComoFunciona />
        <Turnero />
        <AppBarberos />
        <SistemaGestion />
        <Metricas />
        <Beneficios />
        <Comparacion />
        {/* Testimonios: oculta hasta tener reales (FLAGS.mostrarTestimonios) */}
        {FLAGS.mostrarTestimonios && <Testimonios />}
        <Plan />
        <FAQ />
        <CtaFinal />
      </main>

      <LandingFooter />
      <MobileCtaBar />
    </>
  );
}

export default App;
