import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-ssr']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Constante inyectada por `define` en vite.config.js.
        __ANIO_BUILD__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Apagada en los 4 fronts: el patrón de carga de datos del proyecto (fetch
      // en useEffect con setCargando(true)) dispara falsos positivos. Ver
      // convenciones_tecnicas.md §8.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Entrada del build SSR: exporta funciones (render, JSON-LD, llms.txt) y no
  // pasa nunca por el fast refresh del dev server, así que la regla no aplica.
  {
    files: ['src/entry-server.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // Scripts de build (corren en Node, no en el navegador).
  {
    files: ['scripts/**/*.js', 'vite.config.js'],
    languageOptions: { globals: globals.node },
  },
])
