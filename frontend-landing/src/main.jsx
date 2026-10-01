// /frontend-landing/src/main.jsx
// Entrada del cliente. El HTML de la página ya viene pre-renderizado en
// index.html (ver scripts/prerender.js), así que React no lo crea de cero:
// lo hidrata (le engancha los eventos y el estado). El árbol tiene que ser el
// mismo que en src/entry-server.jsx.

import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

hydrateRoot(
  document.getElementById('root'),
  <StrictMode>
    <App />
  </StrictMode>,
)

// Avisa al script del <head> de index.html que el bundle cargó y la app
// hidrató: así no saca la clase `js` (red de seguridad de las animaciones).
window.__omHidratado = true
