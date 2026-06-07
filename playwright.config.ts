import { defineConfig, devices } from '@playwright/test'

// Smoke tests assume `npm run dev` is already running on :3000. Playwright
// can also start it via `webServer` — we leave that off so the same dev
// session keeps the user's auth cookies between test runs and manual checks.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
