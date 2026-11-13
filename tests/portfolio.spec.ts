import { test, expect, type Page } from '@playwright/test';

/* These tests take the visitor's side: can they understand, navigate, act
   on and trust the page? (The Python suite in tests/*.py covers the same
   ground and more; this TypeScript twin is kept for @playwright/test.) */

async function scrollThrough(page: Page) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 480) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe('first impression', () => {
    test('the first viewport says who, what, and what to do next', async ({ page, isMobile }) => {
        await page.goto('/');
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toContainText('Dipak Bist');
        await expect(h1).toContainText('Software QA Engineer');
        await expect(page.getByRole('link', { name: /view my work/i })).toBeInViewport();
        if (!isMobile) await expect(page.getByRole('heading', { name: 'test_login.py' })).toBeInViewport();
    });

    test('loads with no console errors and no failed requests', async ({ page }) => {
        const errors: string[] = [];
        const failed: string[] = [];
        // The unauthenticated GitHub API rate limit (60/h per IP) can answer 403; the page
        // tolerates that by design, so it is not a defect here.
        const isOptionalMetric = (url: string) => url.includes('api.github.com') || url.includes('blog.dipakbist.com.np/rss.xml');
        const isGitHubRateLimit = isOptionalMetric;
        page.on('console', (m) => {
            if (m.type() !== 'error') return;
            if (isOptionalMetric(m.location().url || '') || /blog\.dipakbist\.com\.np\/rss\.xml|api\.github\.com/.test(m.text())) return;
            errors.push(m.text());
        });
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('response', (r) => { if (r.status() >= 400 && !isGitHubRateLimit(r.url())) failed.push(`${r.status()} ${r.url()}`); });
        await page.goto('/');
        await scrollThrough(page);
        await page.waitForTimeout(500);
        expect(errors).toEqual([]);
        expect(failed).toEqual([]);
    });

    test('no horizontal scrolling on narrow screens', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 700 });
        await page.goto('/');
        await scrollThrough(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('the hero login flow plays again from its first step on Re-run', async ({ page }) => {
        await page.goto('/');
        const flow = page.getByRole('region', { name: 'test_login.py' });
        const announced = flow.locator('#flow-live');
        await flow.scrollIntoViewIfNeeded(); // the run waits until the panel can be seen
        await expect(flow.locator('#flow-status')).toHaveText('passed', { timeout: 15_000 });
        await expect(announced).toBeEmpty(); // the run that starts by itself is not announced

        await flow.getByRole('button', { name: 'Re-run' }).click(); // as a visitor would
        await expect(announced).toHaveText('test_login.py passed');

        // Read in the task that handles the click: back at the first step, PASSED withdrawn.
        const started = await page.evaluate(() => {
            const el = document.getElementById('flow')!;
            el.querySelector<HTMLButtonElement>('[data-flow-rerun]')!.click();
            return {
                status: document.getElementById('flow-status')!.textContent,
                done: el.querySelectorAll('[data-step].is-done').length,
                running: el.querySelectorAll('[data-step].is-running').length,
                complete: el.classList.contains('is-complete'),
            };
        });
        expect(started).toEqual({ status: 'running', done: 0, running: 1, complete: false });
        await expect(announced).toHaveText('test_login.py passed');
        await expect(flow.locator('[data-step].is-done')).toHaveCount(5);
        await expect(flow.locator('#flow-result')).toBeVisible();
    });
});

test.describe('the page', () => {
    test('sections show content, not test scaffolding', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.assert, [data-check], #runchip, #runpanel')).toHaveCount(0);
        for (const section of ['about', 'workflow', 'experience', 'skills', 'projects', 'blog', 'contact']) {
            await expect(page.locator(`#${section}`)).not.toContainText(/test_\w+\.py|::test_|\bPASSED\b|\bFAILED\b|test\.skip\(/);
        }
        await expect(page.locator('#projects .project__skip')).toHaveText(['Repository not public yet', 'Internal work, no public link']);
    });

    test('title, alt text, in-page links and date order all hold', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Dipak Bist/);
        const imagesWithoutAlt = await page.locator('img:not([alt])').count();
        expect(imagesWithoutAlt).toBe(0);
        const deadAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
            .map((a) => a.getAttribute('href')!)
            .filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
        expect(deadAnchors).toEqual([]);
        const dates = await page.locator('#blog time').evaluateAll((els) => els.map((t) => Date.parse(t.getAttribute('datetime')!)));
        expect(dates).toEqual([...dates].sort((a, b) => b - a));
        const roleStarts = await page.locator('#experience .role').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.start));
        expect(roleStarts).toEqual([...roleStarts].sort().reverse());
    });
});

test.describe('navigation and actions', () => {
    test('each nav link reaches its section', async ({ page, isMobile }) => {
        await page.goto('/');
        for (const id of ['about', 'workflow', 'experience', 'skills', 'projects', 'blog', 'contact']) {
            if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
            await page.locator(`#nav-menu a[href="#${id}"]`).click();
            await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 0.05 });
        }
    });

    test('"View my work" lands on the projects, and project links are real and safe', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: /view my work/i }).click();
        await expect(page.locator('#projects')).toBeInViewport({ ratio: 0.05 });
        const links = page.locator('#projects a.project__link');
        await expect(links).toHaveCount(3);
        for (const link of await links.all()) {
            await expect(link).toHaveAttribute('href', /^https:\/\//);
            await expect(link).toHaveAttribute('rel', /noopener/);
            await expect(link).toHaveAttribute('target', '_blank');
        }
        // Projects without a public link are declared as skipped, not faked.
        await expect(page.locator('#projects .project__skip')).toHaveCount(2);
    });

    test('contact: email action and copy button', async ({ page, context, browserName }) => {
        await page.goto('/#contact');
        await expect(page.getByRole('link', { name: 'Send email' })).toHaveAttribute('href', 'mailto:dipakbeest@gmail.com');
        test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in automation');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Copy' }).click();
        await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('dipakbeest@gmail.com');
    });

    test('subscribe form explains what is wrong before it sends anything', async ({ page }) => {
        let requests = 0;
        await page.route('**/api/v1/subscribers/subscribe', async (route) => {
            requests += 1;
            await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ detail: 'Check your inbox to confirm.' }) });
        });
        await page.goto('/');
        await page.locator('#subscribe-form').scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'Subscribe' }).click();
        await expect(page.locator('#subscribe-hint')).toHaveText('Enter your email address.');
        await page.getByLabel('Email address').fill('nope');
        await page.getByRole('button', { name: 'Subscribe' }).click();
        await expect(page.locator('#subscribe-hint')).toContainText('like name@example.com');
        expect(requests).toBe(0);
        await page.getByLabel('Email address').fill('reader@example.com');
        await page.getByRole('button', { name: 'Subscribe' }).click();
        await expect(page.locator('#subscribe-feedback')).toHaveText('Check your inbox to confirm.');
        expect(requests).toBe(1);
    });
});

test.describe('themes and keyboard', () => {
    test('theme follows the system until chosen, then persists across reloads', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBeNull();
        await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('text keeps AA contrast in both themes', async ({ page }) => {
        for (const scheme of ['dark', 'light'] as const) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto('/');
            await scrollThrough(page);
            const failures = await page.evaluate(() => {
                const lum = (c: string) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); if (a < 0.99) return null; return [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
                const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const L = lum(getComputedStyle(e).backgroundColor); if (L !== null) return L; } return lum(getComputedStyle(document.body).backgroundColor); };
                const out: string[] = [];
                document.querySelectorAll('body *').forEach((el) => {
                    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) return;
                    const s = getComputedStyle(el);
                    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0 || el.closest('[aria-hidden="true"], [hidden], .visually-hidden')) return;
                    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
                    const fg = lum(s.color); const bg = bgOf(el);
                    if (fg === null || bg === null) return;
                    const cr = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
                    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
                    if (cr < (large ? 3 : 4.5)) out.push(`${cr.toFixed(2)} ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
                });
                return [...new Set(out)];
            });
            expect(failures, `${scheme} theme`).toEqual([]);
        }
    });

    test('keyboard-only: skip link, visible focus, and the mobile menu', async ({ page, isMobile }) => {
        await page.goto('/');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('#main')).toBeFocused();

        // Every focusable element in the header shows a focus ring.
        await page.goto('/');
        for (let i = 0; i < 6; i += 1) {
            await page.keyboard.press('Tab');
            const ring = await page.evaluate(() => getComputedStyle(document.activeElement!).boxShadow !== 'none');
            expect(ring).toBe(true);
        }

        if (isMobile) {
            const toggle = page.getByRole('button', { name: 'Open menu' });
            await toggle.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
            await expect(page.locator('#nav-menu a').first()).toBeFocused();
            expect(await page.evaluate(() => (document.getElementById('main') as HTMLElement).inert)).toBe(true);
            await page.keyboard.press('Escape');
            await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
        }
    });
});

test('a wrong address gets the custom 404 page', async ({ page }) => {
    await page.goto('/404.html');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404');
    await expect(page.getByRole('link', { name: /home page/i })).toHaveAttribute('href', '/');
});
