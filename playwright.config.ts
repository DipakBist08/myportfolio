import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

/* End-to-end checks for the portfolio, run from a visitor's point of view.
   `npm run test:ts` starts its own static server for this checkout on a free
   port, runs every project, and writes an HTML report to playwright-report/.

   It never reuses a server that is already running. A preview left on a
   fixed port may be serving another checkout or branch, and the suite would
   then pass or fail on that site instead of this one. To test a site that
   is already being served (a built site/ folder, a deploy), set BASE_URL. */

/* A free port for this run. The config file is loaded again in every worker
   process, so the port is picked once and handed down through the
   environment. */
function testPort(): string {
    if (!process.env.PORTFOLIO_TEST_PORT) {
        process.env.PORTFOLIO_TEST_PORT = execFileSync(process.execPath, ['-e',
            "const s = require('net').createServer();"
            + "s.listen(0, '127.0.0.1', () => { process.stdout.write(String(s.address().port)); s.close(); });",
        ], { encoding: 'utf8' }).trim();
    }
    return process.env.PORTFOLIO_TEST_PORT;
}

const ownServer = !process.env.BASE_URL;
const local = ownServer ? `http://127.0.0.1:${testPort()}/` : '';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    timeout: 45_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: process.env.BASE_URL || local,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: ownServer ? {
        command: `python3 tools/serve.py ${testPort()}`,  // sends vercel.json's headers, CSP included
        url: local,
        reuseExistingServer: false,
        timeout: 15_000,
    } : undefined,
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /reduced-motion/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /reduced-motion/ },
        { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, testMatch: /reduced-motion/ },
    ],
});
