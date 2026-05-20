import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Desactivada: el patrón "fetch en useEffect con setCargando(true)" es la
      // convención de fetching de los 3 fronts del proyecto. La regla llegó por
      // el scaffolding reciente de Vite (react-hooks v7) y no la tienen los otros
      // fronts. En este código son falsos positivos: en el montaje, cargando ya
      // es true (estado inicial) → React descarta el render.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
