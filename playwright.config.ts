import { defineConfig, devices } from '@playwright/test';

/* End-to-end checks for the portfolio, run from a visitor's point of view.
   `npm test` starts a static server on :4173, runs every project, and
   writes an HTML report to playwright-report/. */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    timeout: 45_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173/',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: process.env.BASE_URL ? undefined : {
        command: 'python3 -m http.server 4173 --bind 127.0.0.1',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: true,
        timeout: 15_000,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /reduced-motion/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /reduced-motion/ },
        { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, testMatch: /reduced-motion/ },
    ],
});
