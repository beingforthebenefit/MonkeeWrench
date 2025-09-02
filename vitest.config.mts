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
      reporter: ['text', 'html'],
    },
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
