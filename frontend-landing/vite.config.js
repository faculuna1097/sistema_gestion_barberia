import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// La landing se sirve en la raíz del dominio (barbermanager.app), por eso
// base '/' (a diferencia del turnero, que va bajo '/turnos/').
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { host: true, port: 5176 },
})
