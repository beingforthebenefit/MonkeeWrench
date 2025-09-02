// Flat ESLint config for ESLint v9
// Uses FlatCompat to reuse existing shareable configs (next/core-web-vitals, prettier)
import {FlatCompat} from '@eslint/eslintrc'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

// Adapter to load legacy "extends" configs in flat config
const compat = new FlatCompat({
  baseDirectory: process.cwd(),
})

const config = [
  // Reuse existing shareable configs via compat (JS/React/Next + Prettier)
  ...compat.extends('next/core-web-vitals', 'prettier'),

  // TypeScript recommended rules scoped to TS files (flat config)
  ...tsPlugin.configs['flat/recommended'],

  // Project-wide settings for TS/TSX
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Turn on the TS Project Service if needed later:
        // projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },

  // Test overrides
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off',
    },
  },

  // Allow require() in Node script files
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Ignores
  {
    ignores: ['node_modules', '.next', 'dist', 'build'],
  },
]

export default config
