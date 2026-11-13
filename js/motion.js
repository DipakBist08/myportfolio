/* Motion choreography, built on the vanilla framer-motion DOM API
   (assets/vendor/framer-motion-dom.js → window.Motion).

   Motion thesis
   - Focal moment: the hero lines rise in sequence and the spec panel lands
     last; then the first assertions resolve for real.
   - Continuity: a ticket travels the workflow loop once, stopping at each
     step, then rides the return arc back into 01; the reading progress bar
     is scroll-linked.
   - Feedback: springs on check marks, press feedback on buttons, a lift on
     project cards.
   - Budget: no ambient loops. Nothing animates unless it is on screen.
   Reduced motion: this module exits early and every element is visible in
   its final state. */

const EASE_OUT = [0.16, 1, 0.3, 1];
const RISE = (px) => ({ opacity: [0, 1], transform: [`translateY(${px}px)`, 'translateY(0px)'] });

function settle(el) {
    el.classList.add('is-in');
    el.style.opacity = '';
    el.style.transform = '';
}

function finished(controls) {
    if (!controls) return Promise.resolve();
    if (controls.finished) return controls.finished;
    if (typeof controls.then === 'function') return controls;
    return Promise.resolve();
}

export function revealAllImmediately() {
    document.documentElement.classList.remove('motion');
    document.querySelectorAll('[data-reveal]').forEach(settle);
    document.querySelectorAll('.step').forEach((s) => s.classList.add('is-done'));
    document.querySelectorAll('.workflow__loop').forEach((l) => l.classList.add('is-drawn'));
    const counter = document.getElementById('steps-done');
    if (counter) counter.textContent = String(document.querySelectorAll('.step').length);
}

function heroIntro(M) {
    const lines = [...document.querySelectorAll('.hero__line')];
    const support = [...document.querySelectorAll('.hero__lede, .hero__actions')];
    const spec = document.querySelector('.hero__spec');
    const all = [...lines, ...support, spec].filter(Boolean);
    if (!all.length) return Promise.resolve();

    let controls;
    try {
        controls = M.animate([
            [lines, RISE(28), { duration: 0.8, ease: EASE_OUT, delay: M.stagger(0.09) }],
            [support, RISE(14), { duration: 0.55, ease: EASE_OUT, delay: M.stagger(0.07), at: '-0.45' }],
            ...(spec ? [[spec, RISE(18), { duration: 0.65, ease: EASE_OUT, at: '-0.35' }]] : []),
        ]);
    } catch {
        // Sequence API unavailable: fall back to a plain stagger.
        controls = M.animate(all, RISE(16), { duration: 0.6, ease: EASE_OUT, delay: M.stagger(0.06) });
    }
    return finished(controls).then(() => all.forEach(settle));
}

function revealOnScroll(M) {
    const targets = [...document.querySelectorAll('[data-reveal]')].filter((el) => !el.closest('.hero'));
    targets.forEach((el) => {
        const children = el.hasAttribute('data-reveal-group') ? [...el.children] : null;
        if (children) children.forEach((c) => { c.style.opacity = '0'; });
        const heading = el.classList.contains('section__head') ? el.querySelector('h2') : null;
        const stop = M.inView(el, () => {
            stop?.();
            if (heading) {
                // Section titles wipe up from their baseline; the assertion line follows.
                settle(el);
                const rest = [...el.children].filter((c) => c !== heading);
                rest.forEach((c) => { c.style.opacity = '0'; });
                M.animate(heading, { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], transform: ['translateY(18px)', 'translateY(0px)'] }, { duration: 0.7, ease: EASE_OUT });
                finished(M.animate(rest, RISE(10), { duration: 0.45, ease: EASE_OUT, delay: M.stagger(0.08, { startDelay: 0.25 }) }))
                    .then(() => rest.forEach((c) => { c.style.opacity = ''; c.style.transform = ''; }));
                return;
            }
            if (children) {
                settle(el);
                finished(M.animate(children, RISE(12), { duration: 0.45, ease: EASE_OUT, delay: M.stagger(0.05) }))
                    .then(() => children.forEach((c) => { c.style.opacity = ''; c.style.transform = ''; }));
            } else {
                finished(M.animate(el, RISE(12), { duration: 0.45, ease: EASE_OUT })).then(() => settle(el));
            }
        }, { amount: 0.15, margin: '0px 0px -8% 0px' });
    });
}

/* Workflow, as a loop (wide screens): a ticket travels it. Once the ring is
   well in view a point leaves 01 and moves clockwise, stopping at each step:
   the line fills behind it, the step ticks and its text comes into focus.
   After 10 it rides the dashed return arc back into 01, which pulses: the
   loop starts again. A run takes about 3.6s on one clock, so the line, the
   point and the ticks cannot drift apart.
   As a timeline (narrow screens) each step ticks as it scrolls into view and
   the line to it fills.
   Replay: once the section has fully left the screen, or the tab is hidden,
   it resets out of sight (nothing ticked, counter 0, line undrawn) and plays
   again the next time it is well in view. A reset cancels the running clock,
   so an old run never steps alongside a new one. */
const RING_R = 270;
const RETURN_TO_DEG = 354; // where the dashed return arc meets 01's arrowhead
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function runLoop(loop, ring, steps, tick, stepMs) {
    const progress = ring.querySelector('.workflow__progress');
    const back = ring.querySelector('.workflow__feedback');
    const reveal = ring.querySelector('.workflow__reveal');
    const head = ring.querySelector('.workflow__head');
    const gaps = steps.length - 1;
    const stepDeg = 360 / steps.length;
    const move = stepMs * 0.72; // the rest of each step is a short stop at the mark
    const outMs = gaps * stepMs;
    const backMs = stepMs * 2;
    const lastDeg = gaps * stepDeg;

    let cancelled = false;
    let raf = 0;
    const control = { cancel() { cancelled = true; cancelAnimationFrame(raf); } };

    const place = (deg) => {
        const a = (deg * Math.PI) / 180;
        head.setAttribute('cx', (RING_R * Math.sin(a)).toFixed(2));
        head.setAttribute('cy', (-RING_R * Math.cos(a)).toFixed(2));
    };
    const finish = () => {
        steps.forEach(tick);
        loop.classList.add('is-drawn');
        [progress, back, reveal, head].forEach((el) => el && el.removeAttribute('style'));
        steps[0].classList.add('is-again');
    };
    if (!progress || !back || !reveal || !head) { finish(); return control; }

    let start = 0;
    tick(steps[0]);
    place(0);
    head.style.opacity = '1';
    reveal.style.strokeDashoffset = '1';

    const frame = (now) => {
        if (cancelled) return;
        try {
            if (!start) start = now;
            const t = now - start;
            if (t < outMs) {
                const lap = Math.floor(t / stepMs);
                const p = Math.min((t - lap * stepMs) / move, 1);
                const at = lap + easeInOut(p);
                steps.slice(0, (p >= 1 ? lap + 1 : lap) + 1).forEach(tick);
                progress.style.strokeDashoffset = String(1 - at / gaps);
                place(at * stepDeg);
            } else if (t < outMs + backMs) {
                steps.forEach(tick);
                const g = easeOutCubic((t - outMs) / backMs);
                progress.style.strokeDashoffset = '0';
                back.style.opacity = '1';
                back.style.strokeDashoffset = String((1 - g) * 26);
                reveal.style.strokeDashoffset = String(1 - g);
                place(lastDeg + g * (RETURN_TO_DEG - lastDeg));
                head.style.opacity = String(g < 0.7 ? 1 : (1 - g) / 0.3);
            } else {
                finish();
                return;
            }
            raf = requestAnimationFrame(frame);
        } catch {
            finish();
        }
    };
    raf = requestAnimationFrame(frame);
    return control;
}

function workflowSteps(M) {
    const steps = [...document.querySelectorAll('.step')];
    const counter = document.getElementById('steps-done');
    const loop = document.querySelector('.workflow__loop');
    const ring = loop && loop.querySelector('.workflow__ring');
    if (!steps.length || !loop) return;
    if (!('IntersectionObserver' in window)) { revealAllImmediately(); return; }
    let done = 0;
    let run = null;
    const tick = (step) => {
        if (step.classList.contains('is-done')) return;
        step.classList.add('is-done');
        done += 1;
        if (counter) {
            counter.textContent = String(done);
            M.animate(counter, { opacity: [0.25, 1], transform: ['translateY(0.22em)', 'translateY(0em)'] }, { duration: 0.3, ease: EASE_OUT });
        }
        const mark = step.querySelector('.step__mark');
        if (mark) M.animate(mark, { transform: ['scale(0.4)', 'scale(1)'] }, { type: 'spring', bounce: 0.4, duration: 0.5 });
        if (done === steps.length && loop) loop.classList.add('is-drawn');
    };

    // Back to the start, out of sight: nothing ticked, counter 0, line undrawn, no clock running.
    const reset = () => {
        run?.cancel();
        run = null;
        done = 0;
        steps.forEach((step) => step.classList.remove('is-done', 'is-again'));
        loop.classList.remove('is-drawn');
        if (counter) counter.textContent = '0';
        ring?.querySelectorAll('.workflow__progress, .workflow__feedback, .workflow__reveal, .workflow__head')
            .forEach((el) => el.removeAttribute('style'));
    };
    // Fully off screen (scrolled or jumped away): reset, ready to play again.
    new IntersectionObserver((entries) => {
        if (!entries[entries.length - 1].isIntersecting) reset();
    }, { threshold: 0 }).observe(loop);

    if (ring && getComputedStyle(ring).display !== 'none') {
        const stepMs = parseFloat(getComputedStyle(loop).getPropertyValue('--step-ms')) || 330;
        const PLAY_AT = 0.45;
        let ratio = 0;
        const play = () => {
            if (run || document.hidden || ratio < PLAY_AT) return;
            run = runLoop(loop, ring, steps, tick, stepMs);
        };
        // Steps not yet reached wait out of focus; revealAllImmediately ticks them all, which clears it.
        loop.classList.add('is-armed');
        new IntersectionObserver((entries) => {
            const e = entries[entries.length - 1];
            ratio = e.isIntersecting ? e.intersectionRatio : 0;
            play();
        }, { threshold: [0, PLAY_AT] }).observe(loop);
        document.addEventListener('visibilitychange', () => (document.hidden ? reset() : play()));
        return;
    }

    // Timeline. Reaching a step means the ones before it were passed, even by a jump or a fast fling.
    const seen = new Set();
    const tickSeen = () => {
        if (document.hidden || !seen.size) return;
        steps.slice(0, Math.max(...seen) + 1).forEach(tick);
    };
    const stepsIo = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            const i = steps.indexOf(e.target);
            if (e.isIntersecting && e.intersectionRatio >= 0.6) seen.add(i);
            else seen.delete(i);
        });
        tickSeen();
    }, { threshold: [0, 0.6] });
    steps.forEach((step) => stepsIo.observe(step));
    document.addEventListener('visibilitychange', () => (document.hidden ? reset() : tickSeen()));
}

function progressBar(M) {
    const bar = document.querySelector('.progress__bar');
    if (!bar) return;
    M.scroll((progress) => { bar.style.transform = `scaleX(${progress})`; });
}

function feedback(M) {
    const canHover = matchMedia('(hover: hover)').matches;
    if (canHover) {
        document.querySelectorAll('.project, .skill').forEach((card) => {
            M.hover(card, () => {
                M.animate(card, { transform: 'translateY(-4px)' }, { duration: 0.25, ease: EASE_OUT });
                return () => M.animate(card, { transform: 'translateY(0px)' }, { duration: 0.3, ease: EASE_OUT });
            });
        });
    }
    document.querySelectorAll('.btn, .totop').forEach((btn) => {
        M.press(btn, () => {
            M.animate(btn, { transform: 'scale(0.97)' }, { duration: 0.1 });
            return () => M.animate(btn, { transform: 'scale(1)' }, { type: 'spring', bounce: 0.35, duration: 0.45 });
        });
    });
}

export function initMotion() {
    const root = document.documentElement;
    const M = window.Motion;
    if (!root.classList.contains('anim') || !M || typeof M.animate !== 'function') {
        revealAllImmediately();
        return;
    }
    clearTimeout(window.__revealTimer);
    progressBar(M);
    feedback(M);
    heroIntro(M);
    revealOnScroll(M);
    workflowSteps(M);
}
