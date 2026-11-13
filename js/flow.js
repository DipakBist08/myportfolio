/* The hero's login flow: a short pytest + Playwright test. Once the panel
   has landed and is on screen, its steps run in order (open the app, fill
   the email, fill the password, sign in, check the dashboard), then, after
   a short beat, pytest -v's result line prints. With reduced motion the finished state shows at once. The Re-run
   button plays the flow again from its first step; a run the visitor asks
   for also plays with reduced motion, as colour changes only. Only classes
   change, so the run never moves the layout. */

const START_MS = 600; // "ready" holds this long once the panel can be seen
const STEP_MS = 520;
const RESULT_MS = 250; // the beat between the last step and PASSED
const LANDED_FALLBACK_MS = 4000; // if the entrance never reports, assume it has landed

export function initFlow() {
    const flow = document.getElementById('flow');
    if (!flow) return;
    const steps = [...flow.querySelectorAll('[data-step]')]
        .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
    const status = document.getElementById('flow-status');
    const progress = document.getElementById('flow-progress');
    const rerun = flow.querySelector('[data-flow-rerun]');
    const live = document.getElementById('flow-live');

    const setStatus = (text, state) => {
        if (!status) return;
        status.textContent = text;
        status.classList.remove('is-running', 'is-pass');
        if (state) status.classList.add(state);
    };
    const setProgress = (done) => {
        if (progress) progress.style.transform = `scaleX(${steps.length ? done / steps.length : 1})`;
    };
    const finish = () => {
        steps.forEach((step) => {
            step.classList.remove('is-running');
            step.classList.add('is-done');
        });
        setProgress(steps.length);
        setStatus('passed', 'is-pass');
        flow.classList.add('is-complete');
    };

    /* Each run takes the next number. A step that wakes up after a newer run
       has started sees a stale number and stops, so runs never interleave. */
    let runs = 0;
    const run = ({ announce = false } = {}) => {
        runs += 1;
        const mine = runs;
        steps.forEach((step) => step.classList.remove('is-running', 'is-done'));
        flow.classList.remove('is-complete');
        if (live) live.textContent = '';
        setStatus('running', 'is-running');
        let i = 0;
        const next = () => {
            if (mine !== runs) return;
            if (i > 0) {
                steps[i - 1].classList.remove('is-running');
                steps[i - 1].classList.add('is-done');
            }
            setProgress(i);
            if (i === steps.length) {
                setTimeout(() => {
                    if (mine !== runs) return;
                    finish();
                    if (announce && live) live.textContent = 'test_login.py passed';
                }, RESULT_MS);
                return;
            }
            steps[i].classList.add('is-running');
            i += 1;
            setTimeout(next, STEP_MS);
        };
        next();
    };

    if (rerun && steps.length) rerun.addEventListener('click', () => run({ announce: true }));

    if (!document.documentElement.classList.contains('anim') || !steps.length) {
        finish();
        return;
    }

    /* The first run starts by itself once a visitor can watch it: after the
       hero's entrance has landed the panel (.is-in on its wrapper) and while
       at least half of it is on screen. On phones it sits below the fold, so
       it waits there. A run the visitor starts first wins. */
    const wrapper = flow.closest('[data-reveal]');
    let landed = !wrapper || wrapper.classList.contains('is-in');
    let inView = !('IntersectionObserver' in window);
    let queued = false;
    const maybeStart = () => {
        if (queued || runs > 0 || !landed || !inView) return;
        queued = true;
        setTimeout(() => { if (runs === 0) run(); }, START_MS);
    };
    if (!landed) {
        const watch = new MutationObserver(() => {
            if (!wrapper.classList.contains('is-in')) return;
            watch.disconnect();
            landed = true;
            maybeStart();
        });
        watch.observe(wrapper, { attributes: true, attributeFilter: ['class'] });
        const fallback = () => setTimeout(() => { landed = true; maybeStart(); }, LANDED_FALLBACK_MS);
        if (document.readyState === 'complete') fallback();
        else window.addEventListener('load', fallback, { once: true });
    }
    if (!inView) {
        const io = new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            const viewport = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
            inView = entry.isIntersecting
                && (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewport * 0.5);
            maybeStart();
            if (queued) io.disconnect();
        }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
        io.observe(flow);
    }
    maybeStart();
}
