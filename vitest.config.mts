import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        'tests/**',
        '**/*.d.ts',
        '**/vitest.config.*',
        'next.config.mjs',
        'postcss.config.js',
        'tailwind.config.js',
        'prisma/**',
        'scripts/**',
        'src/app/**/layout.tsx',
      ],
    },
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
