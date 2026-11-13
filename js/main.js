/* Entry point. Each init is isolated: a failure in one never takes the
   others down, and a failure in the motion layer reveals the page. */

import { initTheme } from './theme.js?v=20261113h';
import { initNav } from './nav.js?v=20261113h';
import { initFlow } from './flow.js?v=20261113h';
import { initMotion, revealAllImmediately } from './motion.js?v=20261113h';
import { initSubscribe } from './subscribe.js?v=20261113h';
import { initContact } from './contact.js?v=20261113h';
import { initVisit } from './visit.js?v=20261113h';

function safe(name, fn) {
    try {
        fn();
    } catch (err) {
        (window.__pageErrors = window.__pageErrors || []).push(`${name}: ${err && err.message ? err.message : err}`);
        if (name === 'motion') revealAllImmediately();
    }
}

function initCopyEmail() {
    const btn = document.getElementById('copy-email');
    const status = document.getElementById('copy-status');
    if (!btn) return;
    const email = btn.dataset.copy || '';
    btn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(email);
            btn.textContent = 'Copied';
            if (status) status.textContent = 'Email address copied to the clipboard.';
        } catch {
            btn.textContent = 'Select to copy';
            if (status) status.textContent = 'Copying is blocked here. Select the address and copy it manually.';
        }
        setTimeout(() => { btn.textContent = 'Copy'; }, 2200);
    });
}

function initYear() {
    const el = document.getElementById('current-year');
    if (el) el.textContent = String(new Date().getFullYear());
}

safe('theme', initTheme);
safe('nav', initNav);
safe('motion', initMotion);
safe('flow', initFlow);
safe('subscribe', initSubscribe);
safe('contact', initContact);
safe('copy', initCopyEmail);
safe('year', initYear);
safe('visit', initVisit);
