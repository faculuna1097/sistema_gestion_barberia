import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Aísla el core de React (react/react-dom/scheduler/react-is) en su
        // propio chunk `react-vendor`. NO baja la 1ª carga (el total de bytes
        // del arranque es el mismo: React solo se muda de archivo), pero mejora
        // el cache entre deploys: un cambio en MI código re-genera index.js con
        // hash nuevo mientras react-vendor mantiene el suyo → el browser no
        // re-descarga React. (#8 de docs/performance_frontends.md)
        // Las barras finales en los paths evitan falsos positivos (p. ej.
        // node_modules/react/ NO matchea lucide-react).
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/react-is/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
