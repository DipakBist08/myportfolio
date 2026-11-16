/* Opening film on the first visit of a browser session.

   The head script decides before first paint whether it plays: never with
   reduced motion or Save-Data, and only once per session (html.has-intro).
   This module plays the 7.5 s film over the page, then closes a circle on the
   spot where the film's own iris closes, uncovering the page underneath.
   "Skip intro" or Esc ends it at once. If the film cannot start within
   2.5 s, the page is shown instead of a dark screen.

   main.js waits for window.__introDone before the hero's entrance, which
   resolves as the circle starts to close, so the entrance plays in view. */

const html = document.documentElement;
// Where the iris sits in the film's last frame, as a fraction of the 1920x1080 frame.
const IRIS = { x: 959.8 / 1920, y: 581.1 / 1080 };
const START_WITHIN_MS = 2500;
const CLOSE_MS = 900;

let resolveDone;
window.__introDone = new Promise((resolve) => { resolveDone = resolve; });

function run(el) {
    const video = document.getElementById('intro-film-video').content.firstElementChild.cloneNode(true);
    el.prepend(video);
    const skip = el.querySelector('.intro-film__skip');
    let ended = false;
    let startTimer = 0;

    // The iris point inside the letterboxed video, in viewport pixels.
    const placeIris = () => {
        const r = video.getBoundingClientRect();
        const s = Math.min(r.width / 1920, r.height / 1080);
        el.style.setProperty('--iris-x', `${r.left + (r.width - 1920 * s) / 2 + IRIS.x * 1920 * s}px`);
        el.style.setProperty('--iris-y', `${r.top + (r.height - 1080 * s) / 2 + IRIS.y * 1080 * s}px`);
    };

    const onKey = (e) => { if (e.key === 'Escape') end(); };

    function end() {
        if (ended) return;
        ended = true;
        clearTimeout(startTimer);
        document.removeEventListener('keydown', onKey);
        try { sessionStorage.setItem('intro-seen', '1'); } catch { /* storage blocked: it may play again */ }
        // The hero's entrance starts now; restart the head script's fallback from here.
        clearTimeout(window.__revealTimer);
        window.__revealTimer = setTimeout(() => html.classList.remove('motion'), 3000);
        const focused = el.contains(document.activeElement);
        const finish = () => {
            if (!el.isConnected) return;
            video.pause();
            html.classList.remove('has-intro');
            el.remove();
            if (focused) document.getElementById('main')?.focus({ preventScroll: true });
        };
        placeIris();
        el.classList.add('is-closing');
        resolveDone();
        el.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, CLOSE_MS + 150);
    }

    const start = () => {
        startTimer = setTimeout(end, START_WITHIN_MS);
        video.addEventListener('playing', () => clearTimeout(startTimer), { once: true });
        video.addEventListener('ended', end);
        // The browser falls through the sources in order; give up only when the last one fails.
        video.querySelector('source:last-of-type')?.addEventListener('error', end);
        video.addEventListener('error', end);
        skip.addEventListener('click', end);
        document.addEventListener('keydown', onKey);
        if (!document.activeElement || document.activeElement === document.body) skip.focus({ preventScroll: true });
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(end);
    };

    // A tab opened in the background waits until it is looked at.
    if (document.hidden) {
        const onVisible = () => {
            if (document.hidden) return;
            document.removeEventListener('visibilitychange', onVisible);
            start();
        };
        document.addEventListener('visibilitychange', onVisible);
    } else {
        start();
    }
}

const el = document.getElementById('intro-film');
if (el && html.classList.contains('has-intro')) {
    try {
        run(el);
    } catch {
        html.classList.remove('has-intro');
        el.remove();
        resolveDone();
    }
} else {
    el?.remove();
    resolveDone();
}
