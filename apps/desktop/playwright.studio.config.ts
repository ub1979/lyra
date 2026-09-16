import { defineConfig, devices, type ReporterDescription } from '@playwright/test'

/**
 * Studio browser smoke: the real dashboard served to headless Chromium.
 *
 * Kept apart from playwright.config.ts because that config's specs launch
 * Electron themselves and `test:e2e` runs everything under e2e/; a browser
 * project there would double-run every Electron spec.
 */
const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report-studio' }],
]

if (process.env.CI) {
  reporters.push(['json', { outputFile: 'playwright-report-studio/results.json' }])
}

export default defineConfig({
  testDir: './e2e-studio',
  outputDir: 'test-results-studio',
  /* Dashboard boot + node terminal child + first model turn on a cold runner. */
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: reporters,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        /* ≥ 1024 px wide so the desktop runtime panel (`lg:` aside) renders. */
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  use: {
    screenshot: 'on',
    trace: { mode: 'on', screenshots: true, snapshots: true, sources: true },
    contextOptions: { reducedMotion: 'reduce' },
  },
})
