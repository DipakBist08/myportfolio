/* Opening film on the first visit of a browser session.

   The head script decides before first paint whether it plays: never with
   reduced motion or Save-Data, and only once per session (html.has-intro).
   This module plays the whole 30 s film over the page: the hero's
   test_login.py run to PASSED, the ten-step workflow ring, and the ring
   folding into the <DipakBist/> end card. It then closes a circle on the end
   card's Contact underline, uncovering the page underneath. "Skip intro" or
   Esc ends it at once. If the film cannot start within 2.5 s, or stalls for
   4 s, the page is shown instead of a dark or frozen screen.

   The film has two cuts on the same beats. A screen taller than it is wide (a
   phone held upright) gets the 1080x1920 phone cut, laid out the way the page
   lays itself out on a phone; every other screen gets the 1920x1080 one.

   main.js waits for window.__introDone before the hero's entrance, which
   resolves as the circle starts to close, so the entrance plays in view. */

const html = document.documentElement;
// For each cut: the <template> that holds its video, its size, where Contact's
// underline sits in its last frame (the closing circle lands there), and the
// centred area that holds every word. The film may be enlarged until that area
// fits the screen: only bare scenery at the edges is lost. The phone cut uses
// its full width, so it is never cropped at the sides.
const FILMS = {
    landscape: { template: 'intro-film-video', w: 1920, h: 1080, iris: { x: 959.7, y: 754.2 }, safe: { w: 1840, h: 990 } },
    portrait: { template: 'intro-film-video-portrait', w: 1080, h: 1920, iris: { x: 539.9, y: 1123.7 }, safe: { w: 1080, h: 1780 } },
};
const START_WITHIN_MS = 2500;
const STALL_MS = 4000;
const CLOSE_MS = 900;

let resolveDone;
window.__introDone = new Promise((resolve) => { resolveDone = resolve; });

function run(el) {
    // The cut is chosen once, as the film starts; a turned phone keeps its cut, fitted to the new shape.
    const upright = (el.clientHeight || innerHeight) > (el.clientWidth || innerWidth);
    const FILM = upright && document.getElementById(FILMS.portrait.template) ? FILMS.portrait : FILMS.landscape;
    const { iris: IRIS, safe: SAFE } = FILM;
    const video = document.getElementById(FILM.template).content.firstElementChild.cloneNode(true);
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
