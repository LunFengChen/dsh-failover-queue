import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))
const dsh = resolve(here, '../deepseek-harness')

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/cordis': resolve(dsh, 'vendor/cordis/src/index.ts'),
      '@deepseek-ai/cosmokit': resolve(dsh, 'vendor/cosmokit/src/index.ts'),
      '@deepseek-ai/schemastery': resolve(dsh, 'vendor/schemastery/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
})
