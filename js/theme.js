/* Theme: stored choice > system preference > dark.
   Storage is written only when the visitor clicks, so the page keeps
   following the OS preference until they choose. The inline script in
   <head> applies the initial theme before first paint; this module owns
   the toggle and the system-preference listener. */

const KEY = 'portfolio-theme';
const root = document.documentElement;
const lightQuery = matchMedia('(prefers-color-scheme: light)');

function stored() {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'light' || v === 'dark' ? v : null;
    } catch {
        return null;
    }
}

function apply(theme, { persist = false } = {}) {
    root.setAttribute('data-theme', theme);
    if (persist) {
        try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
    }
    syncToggle();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function syncToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isLight = current() === 'light';
    btn.setAttribute('aria-pressed', String(isLight));
    btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    btn.title = btn.getAttribute('aria-label');
}

export function initTheme() {
    const btn = document.getElementById('theme-toggle');
    syncToggle();
    btn?.addEventListener('click', () => {
        apply(current() === 'light' ? 'dark' : 'light', { persist: true });
    });
    lightQuery.addEventListener('change', (e) => {
        if (!stored()) apply(e.matches ? 'light' : 'dark');
    });
}
