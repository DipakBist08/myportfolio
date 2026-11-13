import { test, expect } from '@playwright/test';

/* Runs only in the "reduced-motion" project (see playwright.config.ts),
   where the browser reports prefers-reduced-motion: reduce. */

test.use({ reducedMotion: 'reduce' });

test('everything is visible immediately, in its finished state', async ({ page }) => {
    // Emulated at the page level too, so the inline <head> script sees it on first paint
    // regardless of how the project options were merged.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/anim/);
    const hidden = await page.locator('[data-reveal]').evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity === '0').length);
    expect(hidden).toBe(0);
    await expect(page.locator('#steps-done')).toHaveText('10');

    // The hero's login flow shows its finished run at once, with no stepping.
    await expect(page.locator('#flow')).toHaveClass(/is-complete/);
    await expect(page.locator('#flow-status')).toHaveText('passed');
    await expect(page.locator('#flow [data-step].is-done')).toHaveCount(5);
    await expect(page.locator('#flow [data-step].is-running')).toHaveCount(0);
});
