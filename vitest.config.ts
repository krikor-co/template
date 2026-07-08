import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests only. We use the `.test.ts` suffix for vitest and reserve
 * `.spec.ts` for Playwright (e2e), so vitest never tries to collect the
 * Playwright suites. Worktrees / build output / node_modules are excluded.
 */
export default defineConfig({
  resolve: {
    // Mirror tsconfig.json's `"@/*": ["./*"]` so test files (and the modules
    // they import) can use the same `@/` alias as the rest of the app.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.worktrees/**', 'e2e/**', '**/*.spec.ts'],
  },
})
