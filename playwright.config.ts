import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:         './e2e',
  fullyParallel:   false,
  forbidOnly:      !!process.env.CI,
  retries:         process.env.CI ? 2 : 0,
  workers:         1,
  reporter:        'list',
  globalSetup:     './e2e/setup/global-setup.ts',
  globalTeardown:  './e2e/setup/global-teardown.ts',
  use: {
    baseURL:         'http://localhost:3001',
    trace:           'on-first-retry',
    actionTimeout:   10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Kill any running dev server (Next.js lock file) before starting the test
    // server on port 3001 with the test env vars. Restores nothing — re-run
    // `npm run dev` if you need the dev server back after running tests.
    command: [
      `node -e "try{const fs=require('fs'),l=JSON.parse(fs.readFileSync('.next/dev/lock'));process.kill(l.pid,'SIGTERM')}catch(e){}"`,
      'sleep 2',
      'next dev --turbopack --port 3001',
    ].join(' && '),
    port:               3001,
    reuseExistingServer: false,
    timeout:            120_000,
  },
})
