/* Opening film on the first visit of a browser session.

   The head script decides before first paint whether it plays: never with
   reduced motion or Save-Data, and only once per session (html.has-intro).
   This module plays the whole 30 s film over the page, built to the
   "Quality is built. Not assumed." brief: the test_login.py run to PASSED,
   the name, beyond the happy path, the four skill panels, plan to verify,
   the three projects and the closing signature. It then closes a circle on
   the light line under the name, uncovering the page underneath. "Skip intro" or Esc ends it at
   once. If the film cannot start within 2.5 s, or stalls for 4 s, the page
   is shown instead of a dark or frozen screen.

   main.js waits for window.__introDone before the hero's entrance, which
   resolves as the circle starts to close, so the entrance plays in view. */

const html = document.documentElement;
const FILM = { w: 1920, h: 1080 };
// The centre of the cyan line under the name in the film's last frame,
// where every scene converged into a point just before.
const IRIS = { x: 959.5, y: 493 };
// Every word in the film stays inside this centred area, so the film may be
// enlarged until this fits the screen: only bare scenery at the edges is lost.
const SAFE = { w: 1840, h: 990 };
const START_WITHIN_MS = 2500;
const STALL_MS = 4000;
const CLOSE_MS = 900;

let resolveDone;
window.__introDone = new Promise((resolve) => { resolveDone = resolve; });

function run(el) {
    const video = document.getElementById('intro-film-video').content.firstElementChild.cloneNode(true);
    el.prepend(video);
    const skip = el.querySelector('.intro-film__skip');
    const progress = document.createElement('div');
    progress.className = 'intro-film__progress';
    progress.setAttribute('aria-hidden', 'true');
    el.append(progress);
    let ended = false;
    let startTimer = 0;
    let stallTimer = 0;
    let frame = 0;
    let box = { left: 0, top: 0, scale: 1 };

    // As large as the screen allows without cutting into SAFE, and never smaller
    // than the whole film fitted inside the screen.
    const fit = () => {
        const vw = el.clientWidth || innerWidth;
        const vh = el.clientHeight || innerHeight;
        const contain = Math.min(vw / FILM.w, vh / FILM.h);
        const cover = Math.max(vw / FILM.w, vh / FILM.h);
        const scale = Math.min(cover, Math.max(contain, Math.min(vw / SAFE.w, vh / SAFE.h)));
        const w = FILM.w * scale;
        const h = FILM.h * scale;
        box = { left: (vw - w) / 2, top: (vh - h) / 2, scale };
        video.style.left = `${box.left}px`;
        video.style.top = `${box.top}px`;
        video.style.width = `${w}px`;
        video.style.height = `${h}px`;
        // Soften the film's own edges where the dark surround shows beside them.
        el.style.setProperty('--fade-x', w < vw - 1 ? '4%' : '0%');
        el.style.setProperty('--fade-y', h < vh - 1 ? '6%' : '0%');
    };

    const placeIris = () => {
        el.style.setProperty('--iris-x', `${box.left + IRIS.x * box.scale}px`);
        el.style.setProperty('--iris-y', `${box.top + IRIS.y * box.scale}px`);
    };

    const tick = () => {
        if (video.duration) progress.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration)})`;
        frame = requestAnimationFrame(tick);
    };

    const onKey = (e) => { if (e.key === 'Escape') end(); };

    function end() {
        if (ended) return;
        ended = true;
        clearTimeout(startTimer);
        clearTimeout(stallTimer);
        cancelAnimationFrame(frame);
        removeEventListener('resize', fit);
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
        el.addEventListener('transitionend', (e) => { if (e.target === el) finish(); });
        setTimeout(finish, CLOSE_MS + 150);
    }

    const start = () => {
        startTimer = setTimeout(end, START_WITHIN_MS);
        video.addEventListener('playing', () => {
            clearTimeout(startTimer);
            clearTimeout(stallTimer);
        });
        // Waiting on the network mid-film: give it a moment, then show the page.
        video.addEventListener('waiting', () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(end, STALL_MS);
        });
        video.addEventListener('ended', end);
        // The browser falls through the sources in order; give up only when the last one fails.
        video.querySelector('source:last-of-type')?.addEventListener('error', end);
        video.addEventListener('error', end);
        skip.addEventListener('click', end);
        document.addEventListener('keydown', onKey);
        if (!document.activeElement || document.activeElement === document.body) skip.focus({ preventScroll: true });
        frame = requestAnimationFrame(tick);
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(end);
    };

    fit();
    addEventListener('resize', fit);

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
