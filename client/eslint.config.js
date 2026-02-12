import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'

export default defineConfig([
  globalIgnores(['dist']),

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },

    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],

    settings: {
      // Tell ESLint where the "features" folder lives
      'boundaries/include': ['src/features'],
    },

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          message:
            '🚫 Do not import from internal feature folders. Use the feature root index.ts instead.',

          rules: [
            {
              target: ['src/features/*/**'],
              except: ['src/features/*/index.ts'],
            },
          ],
        },
      ],
    },
  },
])
