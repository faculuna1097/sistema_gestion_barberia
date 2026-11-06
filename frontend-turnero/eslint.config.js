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
      // Apagada en los 4 fronts: el patrón de carga de datos del proyecto (fetch
      // en useEffect con setCargando(true)) dispara falsos positivos. Ver
      // convenciones_tecnicas.md §8.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
