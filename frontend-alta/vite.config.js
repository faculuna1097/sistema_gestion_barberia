import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Formulario de alta (alta.barbermanager.app/<token>): se sirve en la raíz.
// Puerto 5177 fijo (strictPort), en dev y en preview: los demás fronts usan
// 5173–5176, y si el puerto está ocupado conviene que falle y no que salte a otro.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { host: true, port: 5177, strictPort: true },
  preview: { port: 5177, strictPort: true },
})
