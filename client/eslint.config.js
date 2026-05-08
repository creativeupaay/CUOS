import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  {
    files: ['**/*.{ts,tsx}'],

    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
      // Enforce barrel-file (index.ts) imports for feature folders.
      // Prevents deep coupling like: import X from '@/features/auth/components/AuthForm'
      // Requires clean public API imports like: import X from '@/features/auth'
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/features/*/*/**', '../features/*/*/**', './features/*/*/**'],
              message:
                '🚫 Do not import from internal feature folders. Use the feature root index.ts instead.',
            },
          ],
        },
      ],
    },
  },
])
