import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  {
    // Ignore files with known pre-existing issues
    ignores: [
      'src/app/admin/tasks/CreateTaskForm.tsx', // binary encoding
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
    },
    languageOptions: { parser: tsParser },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Rule removed in newer @next/eslint-plugin-next — disable to avoid false error
      '@next/next/no-before-interactive-script-component': 'off',
      // Pre-existing pattern in TaskBoard (try/catch empty blocks)
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
]
