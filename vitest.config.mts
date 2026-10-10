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
    // Only the suite: not stray local files such as gitignored tmp-preview/
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The app's own code. Not build output (.next*, demo-out), scratch
      // scripts (data/, tmp-preview/) or config files
      include: ['src/**/*.{ts,tsx}'],
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
      ],
    },
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
