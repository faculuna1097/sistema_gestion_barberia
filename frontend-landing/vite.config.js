import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// La landing se sirve en la raíz del dominio (barbermanager.app), por eso
// base '/' (a diferencia del turnero, que va bajo '/turnos/').
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { host: true, port: 5176 },
  // Constantes reemplazadas en tiempo de build, iguales en el bundle del
  // cliente y en el SSR del pre-render. __ANIO_BUILD__: año del copyright del
  // footer. Con new Date() en el render, desde el 1 de enero el HTML
  // pre-renderizado y el cliente no coincidirían (error de hidratación).
  define: {
    __ANIO_BUILD__: JSON.stringify(new Date().getFullYear()),
  },
})
