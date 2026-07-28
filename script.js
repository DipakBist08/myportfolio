/* =====================================================
   QA PORTFOLIO - JavaScript
   ===================================================== */

// Apply theme immediately before DOM renders to prevent flash
(function() {
    const html = document.documentElement;
    const THEME_KEY = 'portfolio-theme';
    
    function getInitialTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored) return stored;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }
    
    const initialTheme = getInitialTheme();
    html.setAttribute('data-theme', initialTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
    // Detect and optimize for Edge browser
    const isEdge = /Edg/.test(navigator.userAgent);
    if (isEdge) {
        document.documentElement.classList.add('is-edge');
        document.documentElement.setAttribute('data-browser', 'edge');
    }

    // backdrop-filter on the cards is the most expensive thing left during a
    // scroll. On a machine with few cores or little memory it is the difference
    // between smooth and not, so those devices get the same reduced-blur
    // treatment Edge already had. Capable machines are untouched.
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (cores <= 4 || memory <= 4) {
        document.documentElement.classList.add('is-low-power');
    }
    
    // Initialize all features
    initMobileNav();
    initHeroVisibility();
    initCounters();
    initLiveMetrics();
    initScrollAnimations();
    initTypingEffect();
    initSmoothScroll();
    initCurrentYear();
    initBackToTop();
    initMagneticButtons();
    initThemeToggle();
    // Lazy-init heavy visual effects (galaxy canvas, mouse follower, parallax orbs)
    lazyInitHeavyEffects();
    initPerfToggle();
});

/* =====================================================
   PERFORMANCE MODE TOGGLE
   ===================================================== */
function initPerfToggle() {
    const perfToggle = document.getElementById('perf-toggle');
    if (!perfToggle) return;

    const PERF_KEY = 'portfolio-disable-effects';
    const areEffectsDisabled = localStorage.getItem(PERF_KEY) === 'true';

    perfToggle.classList.toggle('disabled', areEffectsDisabled);
    perfToggle.addEventListener('click', () => {
        const currentState = localStorage.getItem(PERF_KEY) === 'true';
        const newState = !currentState;
        localStorage.setItem(PERF_KEY, newState);
        perfToggle.classList.toggle('disabled', newState);
        // Refresh to apply change
        location.reload();
    });
}

function lazyInitHeavyEffects() {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hwConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4;

    const isEdge = /Edg/.test(navigator.userAgent);

    // The starfield used to be switched off for Edge entirely, which is why the
    // animated background was missing there while working in Chrome and Firefox.
    // Edge has been Chromium/Blink since v79 — the same engine and the same
    // canvas performance as Chrome — so a brand check is the wrong gate. The
    // remaining guards are all capability-based: core count, the user's
    // reduced-motion preference, and the explicit opt-out.
    const enableGalaxyDefault = localStorage.getItem('portfolio-disable-effects') !== 'true'
        && hwConcurrency > 4
        && !prefersReduced;

    function runHeavyInits() {
        if (prefersReduced) return; // user prefers reduced motion: skip heavy effects

        // For very low-end devices, reduce work: only init lightweight parallax
        if (hwConcurrency <= 2 || deviceMemory <= 1) {
            try { initParallaxOrbs(); } catch (e) {}
            return;
        }

        // Galaxy background disabled by default; only init if device is capable and user hasn't opted out
        if (enableGalaxyDefault) {
            try { initGalaxyBackground(); } catch (e) {}
        }
        try { initMouseFollower(); } catch (e) {}
        try { initParallaxOrbs(); } catch (e) {}
    }

    let triggered = false;
    function trigger() {
        if (triggered) return;
        triggered = true;
        runHeavyInits();
    }

    // Run when browser is idle or on first user interaction
    // Edge needs longer timeout due to slower event loop
    const idleTimeout = isEdge ? 4000 : 3000;
    const fallbackTimeout = isEdge ? 3500 : 2500;
    
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => { if (!triggered) trigger(); }, { timeout: idleTimeout });
    } else {
        setTimeout(() => { if (!triggered) trigger(); }, fallbackTimeout);
    }

    ['mousemove','touchstart','scroll','keydown'].forEach(ev => {
        document.addEventListener(ev, trigger, { passive: true, once: true });
    });
}

/* ----- Mobile Navigation ----- */
function initMobileNav() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    if (!navToggle || !navMenu) return;

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

/* ----- Pause hero-only decoration once the hero is scrolled away -----
   blink, bounce, glowPulse, floatCode, gridPulse and shimmer all live inside the
   hero but kept animating the entire way down the page, repainting off-screen
   content while the user scrolls the sections they actually want to read.
   A class on <html> lets CSS park them; the typing loop checks the same flag. */
/* The reference is deliberately kept on window. Created as an anonymous
   `new IntersectionObserver(...).observe(el)` it had no strong reference, and
   once the galaxy canvas started allocating particles the resulting GC pass
   could collect it — after which the hero animations never paused again. */
let heroObserver = null;

function initHeroVisibility() {
    const hero = document.querySelector('.hero');
    if (!hero || !('IntersectionObserver' in window)) return;

    heroObserver = new IntersectionObserver((entries) => {
        document.documentElement.classList.toggle('hero-away', !entries[0].isIntersecting);
    }, { threshold: 0 });
    heroObserver.observe(hero);
    window.__heroObserver = heroObserver;
}

function heroIsAway() {
    return document.documentElement.classList.contains('hero-away');
}

/* ----- Metric count-up -----
   Counts each metric from 0 to its data-count-to once, when it first scrolls
   into view. Honours prefers-reduced-motion by printing the final value
   immediately, and the numbers are small enough that a short duration is
   plenty — a long count-up reads as a loading spinner, not a stat. */
function initCounters() {
    const values = document.querySelectorAll('[data-count-to]');
    if (!values.length) return;

    const reduced = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const run = (el) => {
        const target = parseInt(el.dataset.countTo, 10);
        const out = el.querySelector('.metric__number') || el;
        if (!Number.isFinite(target)) return;
        // Lets initLiveMetrics() know it may correct this number in place if a
        // live value arrives after the animation has already run.
        el.dataset.counted = 'true';
        if (reduced || target <= 1) { out.textContent = String(target); return; }

        const DURATION = 900;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / DURATION);
            // ease-out so it decelerates into the final number
            out.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
            if (t < 1) requestAnimationFrame(tick);
            else out.textContent = String(target);
        };
        requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
        values.forEach(run);
        return;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            run(entry.target);
            io.unobserve(entry.target);
        });
    }, { threshold: 0.4 });

    values.forEach(el => io.observe(el));
    window.__counterObserver = io;   // hold a reference so it cannot be collected
}

/* ----- Live metric values -----
   The numbers in the HTML are the last-known-good values, so the strip is
   correct with JavaScript disabled or if a source is unreachable. This only ever
   overwrites them on a successful fetch, and never with 0 or NaN — a metric that
   silently drops to zero is worse than one that is a week stale.

   Sources, and why:
     published-articles  blog.dipakbist.com.np/rss.xml — generated by the blog
                         app from the MDX files. Note the CMS API is NOT usable
                         here: /api/public/posts reports total 0 because the posts
                         are files in the Next.js app, not rows in the CMS.
     public-repos        GitHub REST API. Unauthenticated, 60 requests/hour per
                         IP, so a failure is expected occasionally and tolerated.
     experience-years    deliberately NOT derived. See the note in the report.
     companies           no sensible live source; changes only on a job move. */
function initLiveMetrics() {
    const apply = (metric, value) => {
        const el = document.querySelector(`[data-metric="${metric}"]`);
        if (!el) return;
        if (!Number.isFinite(value) || value <= 0) return;   // keep the fallback
        el.dataset.countTo = String(value);
        // If the count-up already finished, correct the number in place.
        if (el.dataset.counted === 'true') {
            const out = el.querySelector('.metric__number') || el;
            out.textContent = String(value);
        }
    };

    const timeout = (ms) => AbortSignal ? AbortSignal.timeout(ms) : undefined;

    // Published articles — count <item> elements in the RSS feed.
    fetch('https://blog.dipakbist.com.np/rss.xml', { signal: timeout(6000) })
        .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then(xml => {
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            if (doc.querySelector('parsererror')) throw new Error('bad xml');
            apply('published-articles', doc.querySelectorAll('item').length);
        })
        .catch(() => { /* keep the value already in the HTML */ });

    // Public repositories.
    fetch('https://api.github.com/users/DipakBist08', {
        signal: timeout(6000),
        headers: { Accept: 'application/vnd.github+json' },
    })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => apply('public-repos', d.public_repos))
        .catch(() => { /* keep the value already in the HTML */ });
}

/* ----- Scroll Animations ----- */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');

    if (!animatedElements.length) return;

    const observerOptions = {
        root: null,
        // Positive bottom margin extends the detection box *below* the viewport,
        // so a section starts revealing just before it scrolls into view and is
        // already readable by the time it arrives. The old -50px did the
        // opposite: it delayed detection until the element was 50px inside.
        rootMargin: '0px 0px 200px 0px',
        // Was 0.1 — on a tall card that meant waiting for 10% of a ~600px card
        // to be visible. Fire on the first sliver instead.
        threshold: 0.01
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add staggered delay for cards in a grid
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => {
                    entry.target.classList.add('animated');
                    // Resume CSS animations when element comes into view
                    entry.target.style.animationPlayState = 'running';
                }, delay);

                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Stagger *within each container*, capped. The old version indexed across
    // one flat NodeList of every .skill-card on the page, so the timeline cards
    // pushed the skills grid to 300–800ms before it even began animating.
    // Restarting the count per section and capping the total keeps the sense of
    // sequence without making the last card wait.
    const STAGGER_MS = 45;
    const MAX_STEPS = 4;   // caps the delay at 180ms
    ['.metrics__grid', '.workflow__list', '.timeline', '.skills__grid',
     '.projects__grid', '.blog__grid'].forEach(sel => {
        const container = document.querySelector(sel);
        if (!container) return;
        container.querySelectorAll('[data-animate]').forEach((el, index) => {
            el.dataset.delay = Math.min(index, MAX_STEPS) * STAGGER_MS;
        });
    });

    animatedElements.forEach(el => observer.observe(el));
}

/* ----- Typing Effect ----- */
function initTypingEffect() {
    const typingElement = document.getElementById('typing-text');
    if (!typingElement) return;

    const phrases = [
        'Python Test Automation',
        'Selenium & Playwright Specialist',
        'API Testing Professional',
        'Quality Assurance Engineer',
        'Bug Hunter & Problem Solver'
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function type() {
        // No point rewriting text nobody can see — and each write dirtied layout
        // inside the hero on every tick, all the way down the page.
        if (heroIsAway()) {
            setTimeout(type, 400);
            return;
        }

        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            typingElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 50;
        } else {
            typingElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 100;
        }

        // Finished typing the phrase
        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            typingSpeed = 2000; // Pause before deleting
        }

        // Finished deleting the phrase
        if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typingSpeed = 500; // Pause before typing next
        }

        setTimeout(type, typingSpeed);
    }

    // Start typing after initial delay
    setTimeout(type, 1000);
}

/* ----- Smooth Scroll ----- */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();

            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });
}

/* ----- Current Year ----- */
function initCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}


/* ----- Header Scroll Effect (Debounced) ----- */
let lastScroll = 0;
const header = document.querySelector('.header');

// Batch scroll updates using rAF to avoid jank
let scrollTicking = false;
let headerScrolled = null;
function handleScrollBatch() {
    const currentScroll = window.scrollY;

    // Only touch the DOM when the state actually flips. This used to assign an
    // inline style on every single frame, which invalidated style + paint even
    // when the value was identical.
    if (header) {
        const scrolled = currentScroll > 100;
        if (scrolled !== headerScrolled) {
            headerScrolled = scrolled;
            header.style.background = scrolled
                ? 'rgba(15, 23, 42, 0.95)'
                : 'rgba(15, 23, 42, 0.85)';
        }
    }

    // update active nav link (previously on its own listener)
    highlightNavLink();
    syncHeroAway(currentScroll);

    // Parallax orbs disabled in scroll handler to reduce load; enable via animation-play-state when desired
    
    lastScroll = currentScroll;
    scrollTicking = false;
}

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        requestAnimationFrame(handleScrollBatch);
        scrollTicking = true;
    }
}, { passive: true });

/* ----- Active Nav Link Highlight ----- */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__link');

/* Section offsets are cached because reading offsetTop/offsetHeight forces the
   browser to flush layout. Doing that for every section on every scroll frame —
   right after writing an inline style on the header — was the single biggest
   source of scroll jank on this page. Offsets only change on resize or when
   late-loading content reflows the page, so that is when we recompute. */
let sectionOffsets = [];

let heroBottom = 0;

function measureSections() {
    sectionOffsets = Array.from(sections, section => ({
        id: section.getAttribute('id'),
        top: section.offsetTop - 100,
        height: section.offsetHeight,
    }));
    const hero = document.querySelector('.hero');
    heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
}

/* The IntersectionObserver in initHeroVisibility() is the primary signal, but
   its callbacks get starved while the galaxy loop is saturating the main thread
   — measured: the pause applied on only 1 of 3 runs. This runs off the existing
   rAF-batched scroll handler using an already-cached offset, so it costs nothing
   extra and is deterministic. Whichever fires first wins; both agree. */
function syncHeroAway(scrollY) {
    if (!heroBottom) return;
    const away = scrollY > heroBottom;
    const root = document.documentElement;
    if (away !== root.classList.contains('hero-away')) {
        root.classList.toggle('hero-away', away);
    }
}

let activeNavHref = null;
function highlightNavLink() {
    if (!sectionOffsets.length) measureSections();
    const scrollY = window.scrollY;

    let currentId = null;
    for (const s of sectionOffsets) {
        if (scrollY > s.top && scrollY <= s.top + s.height) currentId = s.id;
    }
    if (!currentId) return;

    const href = `#${currentId}`;
    // Skip the DOM writes entirely when the active section has not changed.
    if (href === activeNavHref) return;
    activeNavHref = href;

    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === href);
    });
}

let measureTimer;
window.addEventListener('resize', () => {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(measureSections, 150);
});
window.addEventListener('load', measureSections);

/* ----- Skill Level Animation on Scroll ----- */
function initSkillLevels() {
    const skillLevels = document.querySelectorAll('.skill-level');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fillLevel 1.5s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    skillLevels.forEach(level => {
        level.style.transform = 'scaleX(0)';
        observer.observe(level);
    });
}

// Initialize skill levels after DOM is ready
document.addEventListener('DOMContentLoaded', initSkillLevels);

/* =====================================================
   ANTIGRAVITY-STYLE EFFECTS
   ===================================================== */

/* ----- Mouse Follower ----- */
function initMouseFollower() {
    const follower = document.getElementById('mouse-follower');
    if (!follower) return;

    let mouseX = 0;
    let mouseY = 0;
    let followerX = 0;
    let followerY = 0;

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        follower.classList.add('active');
    });

    // Hide when mouse leaves window
    document.addEventListener('mouseleave', () => {
        follower.classList.remove('active');
    });

    // Smooth animation loop.
    // This used to run forever, writing style.left/top every frame even when the
    // pointer had not moved — a guaranteed layout + paint on every single frame
    // for the life of the page. It now parks itself once it has caught up, and
    // any pointer movement wakes it again.
    let followerRunning = false;

    function animateFollower() {
        const dx = mouseX - followerX;
        const dy = mouseY - followerY;

        // Converged: stop the loop until the pointer moves again.
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            followerRunning = false;
            return;
        }

        followerX += dx * 0.08;
        followerY += dy * 0.08;
        // Kept as left/top: .mouse-follower relies on transform:translate(-50%,-50%)
        // for centring and transitions transform, so writing transform here would
        // both off-centre it and fight that transition.
        follower.style.left = `${followerX}px`;
        follower.style.top = `${followerY}px`;

        requestAnimationFrame(animateFollower);
    }

    function wakeFollower() {
        if (followerRunning) return;
        followerRunning = true;
        requestAnimationFrame(animateFollower);
    }

    document.addEventListener('mousemove', wakeFollower, { passive: true });
    wakeFollower();
}

/* ----- Parallax Orbs -----
   This used to write an inline `transform` onto each .orb. A CSS animation beats
   an inline style for the property it animates, so as long as orbFloat was
   running the parallax did nothing — which is why .orb shipped with
   `animation-play-state: paused` and the background never actually drifted.

   The parallax now moves the .floating-orbs *container* instead. The container
   is not animated, so nothing competes: each orb keeps its own orbFloat drift
   (already staggered 18-28s with different delays) and the whole group shifts
   gently with the pointer. */
function initParallaxOrbs() {
    const group = document.getElementById('floating-orbs');
    if (!group || !group.querySelector('.orb')) return;

    let orbMouseX = 0, orbMouseY = 0;
    let orbTick = false;

    document.addEventListener('mousemove', (e) => {
        orbMouseX = e.clientX;
        orbMouseY = e.clientY;
        if (orbTick) return;
        orbTick = true;
        requestAnimationFrame(() => {
            // Skip the write entirely when the hero is not on screen.
            if (!heroIsAway()) {
                const x = (orbMouseX - window.innerWidth / 2) * 0.02;
                const y = (orbMouseY - window.innerHeight / 2) * 0.02;
                group.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            }
            orbTick = false;
        });
    }, { passive: true });
}

/* ----- Magnetic Buttons (Throttled for Chrome) ----- */
function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');

    buttons.forEach(button => {
        let ticking = false;
        
        button.addEventListener('mousemove', (e) => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const rect = button.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;

                    // Subtle magnetic effect
                    button.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translate(0, 0)';
        });
    });
}

/* ----- Enhanced Card Tilt Effect (Throttled for Chrome) ----- */
function initCardTilt() {
    document.querySelectorAll('.skill-card, .tool-card, .project-card').forEach(card => {
        let ticking = false;
        let lastX = 0, lastY = 0, lastRect = null;
        
        card.addEventListener('mousemove', (e) => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;

                    const rotateX = (y - centerY) / 20;
                    const rotateY = (centerX - x) / 20;

                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        });
    });
}

document.addEventListener('DOMContentLoaded', initCardTilt);

/* ----- Scroll Progress Indicator (Throttled) ----- */
function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4);
        z-index: 9999;
        transition: width 0.1s ease;
        width: 0%;
    `;
    document.body.appendChild(progressBar);

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = (scrollTop / docHeight) * 100;
                progressBar.style.width = `${scrollPercent}%`;
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

// Initialize scroll progress
document.addEventListener('DOMContentLoaded', initScrollProgress);

/* ----- Reveal on Scroll (handled by initScrollAnimations) ----- */
// Removed JS-driven opacity hiding to avoid content disappearing during heavy rendering.
// Visual reveal is handled by CSS + `initScrollAnimations()` (which adds `animated` class).

/* ----- Back to Top Button ----- */
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const SHOW_AFTER = 320;
    let ticking = false;

    function onScroll() {
        const show = window.scrollY > SHOW_AFTER;
        btn.classList.toggle('visible', show);
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* =====================================================
   GALAXY PARTICLE BACKGROUND (Optimized Canvas)
   - Thousands of tiny glowing particles
   - Spatial grid for O(n) neighbor search
   - Soft mouse push interaction
   - Additive blending for neon glow
   ===================================================== */

function initGalaxyBackground() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    let width = 0;
    let height = 0;
    // Capped at 1.5: this is an out-of-focus starfield, so rendering it at a
    // 2x or 3x device ratio quadruples the pixels cleared and filled every frame
    // for detail nobody can resolve.
    let dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

    // Config (adaptive)
    const TWO_PI = Math.PI * 2;
    // Reused across frames so the per-frame line collection does not allocate.
    const lineBuckets = [[], [], []];
    const LINE_COLORS = [
        'rgba(150,160,255,0.02)',
        'rgba(150,160,255,0.06)',
        'rgba(150,160,255,0.10)',
    ];
    const CELL_SIZE = 80;
    const CONNECT_DIST = 70;
    const MAX_CONNECTIONS = 2;
    const PREF_MIN_PARTICLES = 150; // tuned lower for responsiveness
    const isEdgeBrowser = /Edg/.test(navigator.userAgent);
    // Was `isEdgeBrowser ? 300 : 800`. Particle count should follow the hardware,
    // not the browser badge — an 8-core Edge machine can draw what an 8-core
    // Chrome machine can. Weaker devices get the smaller ceiling either way.
    const PREF_MAX_PARTICLES =
        (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4 ? 300 : 800;

    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hwConcurrency = navigator.hardwareConcurrency || 4;

    // Tune density based on device capabilities
    let densitySelector = 800; // default
    if (prefersReduced) densitySelector = 5000;
    else if (hwConcurrency <= 2) densitySelector = 2000;
    else if (hwConcurrency <= 4) densitySelector = 1200;
    else densitySelector = 800;

    const MIN_PARTICLES = Math.max(PREF_MIN_PARTICLES, Math.floor((hwConcurrency / 8) * 400));
    const MAX_PARTICLES = PREF_MAX_PARTICLES;

    let frameCount = 0;
    const REBUILD_INTERVAL = hwConcurrency <= 2 ? 6 : 3; // don't rebuild grid every frame on weak devices

    let particles = [];
    let grid = {};

    // Adaptive performance controls
    let movingAvgFrame = 16; // ms
    const FRAME_ALPHA = 0.05;
    let isOverloaded = false;
    let targetParticleCount = 0;

    let isUserScrolling = false;
    let scrollTimeout = null;

    // When user scrolls, minimize canvas work to keep main thread responsive
    window.addEventListener('scroll', () => {
        isUserScrolling = true;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => { isUserScrolling = false; }, 180);
    }, { passive: true });

    const mouse = { x: -9999, y: -9999, active: false };

    function resize() {
        // use viewport size to cover entire page reliably
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        initParticles();
    }

    /* Particle hue is assigned once and never mutated, so the fill string can be
       built at creation instead of being re-templated for every particle on every
       frame. At 800 particles that removed ~800 template literals and ~2400
       Math.floor calls per frame. */
    // Hue is quantised into a handful of buckets so every particle sharing a
    // bucket can be drawn in one batched path. 6 fill() calls per frame instead
    // of one per particle.
    const HUE_BUCKETS = 6;
    const BUCKET_COLORS = Array.from({ length: HUE_BUCKETS }, (_, i) => {
        const hue = 200 + (i + 0.5) * (120 / HUE_BUCKETS);
        return `rgba(${Math.floor(60 + (hue - 200) * 0.6)}, ${Math.floor(140 + (hue - 200) * 0.5)}, 220, 0.85)`;
    });

    function makeParticle() {
        const hue = 200 + Math.random() * 120;
        const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(((hue - 200) / 120) * HUE_BUCKETS));
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.2 + 0.6,
            hue,
            bucket,
        };
    }

    function initParticles() {
        particles.length = 0;
        grid = {};
        const area = Math.max(1, width * height);
        const density = densitySelector; // adaptive density
        // target count tuned per-device; start conservatively to avoid freeze
        const calculated = Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Math.floor(area / density)));
        targetParticleCount = Math.max(MIN_PARTICLES, Math.min(calculated, Math.floor(MAX_PARTICLES * (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 4 ? 1 : 0.6))));

        // Start with a smaller initial set, ramp later if device is healthy
        const initial = Math.max(MIN_PARTICLES, Math.floor(targetParticleCount * 0.35));
        for (let i = 0; i < initial; i++) {
            particles.push(makeParticle());
        }
    }

    // Try to gradually increase particles when idle
    function rampParticles() {
        if (particles.length >= targetParticleCount) return;
        const add = Math.min(50, targetParticleCount - particles.length);
        for (let i = 0; i < add; i++) {
            particles.push(makeParticle());
        }
    }

    function hashCell(x, y) { return x + ',' + y; }

    function rebuildGrid() {
        grid = {};
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const cx = Math.floor(p.x / CELL_SIZE);
            const cy = Math.floor(p.y / CELL_SIZE);
            const key = hashCell(cx, cy);
            if (!grid[key]) grid[key] = [];
            grid[key].push(i);
        }
    }

    function step(dt) {
        // update positions
        for (let i = 0, len = particles.length; i < len; i++) {
            const p = particles[i];

            // mouse repulsion
            if (mouse.active) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                const influence = 120; // px
                if (d2 < influence * influence) {
                    const d = Math.sqrt(d2) || 0.0001;
                    const force = (1 - d / influence) * 0.9;
                    p.vx += (dx / d) * force * 0.6;
                    p.vy += (dy / d) * force * 0.6;
                }
            }

            // velocity damping
            p.vx *= 0.995;
            p.vy *= 0.995;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // wrap
            if (p.x < -10) p.x = width + 10;
            else if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            else if (p.y > height + 10) p.y = -10;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        // additive glow
        ctx.globalCompositeOperation = 'lighter';

        /* This loop used to set ctx.shadowColor and ctx.shadowBlur per particle,
           and recompute two navigator.userAgent regexes per particle. Canvas
           shadowBlur is a software Gaussian blur applied per draw call, so at 800
           particles that was 800 blurred draws every frame. Chrome happened to
           get shadowBlur 0 and skipped it; Edge got 3.2 and paid for all of it —
           which is exactly why the page crawled on Edge and not on Chrome.
           `globalCompositeOperation = 'lighter'` above already produces the glow
           by additive blending, so the shadow bought nothing. Shadow is now off
           once, outside the loop, for every browser. */
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        /* One beginPath/fill per hue bucket rather than per particle. Every arc in
           a bucket goes into a single path, so the browser gets 6 fill calls a
           frame instead of up to 800. */
        for (let bkt = 0; bkt < HUE_BUCKETS; bkt++) {
            let opened = false;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (p.bucket !== bkt) continue;
                if (!opened) { ctx.beginPath(); opened = true; }
                ctx.moveTo(p.x + p.r, p.y);
                ctx.arc(p.x, p.y, p.r, 0, TWO_PI);
            }
            if (opened) {
                ctx.fillStyle = BUCKET_COLORS[bkt];
                ctx.fill();
            }
        }

        // If the user is actively scrolling, skip expensive connection drawing and rebuild
        frameCount++;
        if (isUserScrolling) {
            if (frameCount % REBUILD_INTERVAL === 0) rebuildGrid();
            ctx.globalCompositeOperation = 'source-over';
            return;
        }

        // Adaptive overload handling: if moving average frame > 28ms, mark overloaded
        const overloadThreshold = 28; // ms
        isOverloaded = movingAvgFrame > overloadThreshold;

        // If overloaded, skip connection drawing entirely and reduce rebuild frequency
        const effectiveRebuild = isOverloaded ? Math.max(REBUILD_INTERVAL, 6) : REBUILD_INTERVAL;

        // attempt to ramp particles slowly when not overloaded
        if (!isOverloaded && particles.length < targetParticleCount && frameCount % 30 === 0) {
            rampParticles();
        }

        // rebuild grid only every few frames to save CPU on lower-end devices
        if (frameCount % effectiveRebuild === 0) rebuildGrid();
        const maxConn2 = CONNECT_DIST * CONNECT_DIST;
        ctx.lineWidth = 0.6;
        // Skip connection drawing when overloaded to avoid O(n^2) work
        if (!isOverloaded) {
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const cx = Math.floor(p.x / CELL_SIZE);
                const cy = Math.floor(p.y / CELL_SIZE);
                let connections = 0;

                for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                        const key = hashCell(cx + ox, cy + oy);
                        const cell = grid[key];
                        if (!cell) continue;

                        for (let j = 0; j < cell.length; j++) {
                            const idx = cell[j];
                            if (idx <= i) continue; // avoid double work
                            const q = particles[idx];
                            const dx = p.x - q.x;
                            const dy = p.y - q.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 <= maxConn2 && connections < MAX_CONNECTIONS) {
                                // Collect instead of stroking immediately — see the
                                // batched stroke below.
                                const alpha = 1 - d2 / maxConn2;
                                const lb = alpha > 0.66 ? 2 : (alpha > 0.33 ? 1 : 0);
                                const arr = lineBuckets[lb];
                                arr.push(p.x, p.y, q.x, q.y);
                                connections++;
                            }
                        }
                    }
                }
            }

            /* Previously each line was its own beginPath + strokeStyle template
               string + stroke — up to 1600 draw calls and 1600 string allocations
               per frame. Alpha is quantised to three levels so the whole set
               becomes three batched strokes. */
            for (let lb = 0; lb < 3; lb++) {
                const arr = lineBuckets[lb];
                if (!arr.length) continue;
                ctx.beginPath();
                for (let k = 0; k < arr.length; k += 4) {
                    ctx.moveTo(arr[k], arr[k + 1]);
                    ctx.lineTo(arr[k + 2], arr[k + 3]);
                }
                ctx.strokeStyle = LINE_COLORS[lb];
                ctx.stroke();
                arr.length = 0;
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // The hero is the only place this canvas is visible, but the simulation used
    // to keep running — particle stepping plus the O(n²) connection pass — the
    // whole way down the page. Suspend it whenever the hero is off-screen, which
    // is exactly when the user is scrolling through the content.
    let heroVisible = true;
    const heroEl = document.querySelector('.hero');
    if (heroEl && 'IntersectionObserver' in window) {
        // Same reasoning as heroObserver above: keep a reference so this cannot
        // be garbage collected out from under the render loop.
        const galaxyHeroObserver = new IntersectionObserver((entries) => {
            const wasVisible = heroVisible;
            heroVisible = entries[0].isIntersecting;
            // Resuming: reset the clock so dt does not jump after the pause.
            if (heroVisible && !wasVisible) {
                last = performance.now();
                requestAnimationFrame(loop);
            }
        }, { threshold: 0 });
        galaxyHeroObserver.observe(heroEl);
        window.__galaxyHeroObserver = galaxyHeroObserver;
    }

    let last = performance.now();
    function loop(now) {
        if (document.hidden) {
            last = now;
            requestAnimationFrame(loop);
            return;
        }
        // Park entirely while the hero is scrolled away; the observer above
        // restarts the loop when it comes back.
        if (!heroVisible) return;
        const frameMs = now - last;
        // update moving average
        movingAvgFrame = movingAvgFrame * (1 - FRAME_ALPHA) + frameMs * FRAME_ALPHA;

        const dt = Math.min(40, frameMs) / 16.6667; // normalized to ~60fps steps
        // If single frame is excessively long, do minimal updates to avoid jank
        if (frameMs > 200) {
            // drop some expensive steps
            step(dt * 0.5);
        } else {
            step(dt);
        }

        try { draw(); } catch (e) { /* swallow draw errors to avoid freeze */ }
        last = now;
        requestAnimationFrame(loop);
    }

    // Mouse handlers
    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
    });
    window.addEventListener('pointerdown', (e) => {
        mouse.active = true;
    });
    window.addEventListener('pointerup', () => { mouse.active = false; });
    window.addEventListener('mouseleave', () => { mouse.active = false; });

    // touch support
    window.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (!t) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = t.clientX - rect.left;
        mouse.y = t.clientY - rect.top;
        mouse.active = true;
    }, { passive: true });

    window.addEventListener('resize', () => { resize(); });

    // init
    resize();

    // If user prefers reduced motion, render a subtle static starfield and skip animation loop
    if (prefersReduced) {
        rebuildGrid();
        draw();
        return;
    }

    // Pause heavy animation when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // lower updates; we keep loop but skip heavy work inside
        } else {
            last = performance.now();
        }
    });

    requestAnimationFrame(loop);
}

/* =====================================================
   DARK/LIGHT MODE THEME TOGGLE
   ===================================================== */

function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const THEME_KEY = 'portfolio-theme';

    // Check stored theme preference or system preference
    function getInitialTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored) return stored;

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    // Apply theme
    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    // Toggle theme
    function toggleTheme() {
        const current = html.getAttribute('data-theme') || 'dark';
        const newTheme = current === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    // Initialize with saved or system theme
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);

    // Attach toggle listener
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? 'light' : 'dark');
            }
        });
    }
}


/* =====================================================
   NEWSLETTER SUBSCRIBE — posts to CMS backend
   ===================================================== */

const BACKEND_API = 'https://api.dipakbist.com.np';

async function handleSubscribe(e) {
  e.preventDefault();
  const emailInput = document.getElementById('subscribe-email');
  const btn        = document.getElementById('subscribe-btn');
  const feedback   = document.getElementById('subscribe-feedback');
  const email      = emailInput.value.trim();
  if (!email) return;

  const SUCCESS = 'blog__subscribe-feedback--success';
  const ERROR   = 'blog__subscribe-feedback--error';

  btn.disabled    = true;
  btn.textContent = 'Subscribing…';
  feedback.classList.remove(SUCCESS, ERROR);
  feedback.textContent = '';

  try {
    const res = await fetch(`${BACKEND_API}/api/v1/subscribers/subscribe`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ email }),
      signal : AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok || res.status === 202) {
      feedback.classList.add(SUCCESS);
      feedback.textContent = '✓ ' + (detailToText(data.detail) || 'Check your email to confirm!');
      emailInput.value = '';
    } else {
      throw new Error(detailToText(data.detail) || 'Subscribe failed');
    }
  } catch (err) {
    feedback.classList.add(ERROR);
    // "Failed to fetch" is what the browser reports for a blocked/unreachable
    // request (offline, CORS, or the API being down). Don't show that string to
    // a visitor — it reads like their fault.
    const network = err instanceof TypeError
      || err.name === 'TimeoutError'
      || /failed to fetch|load failed|networkerror/i.test(err.message || '');
    feedback.textContent = network
      ? "✗ Couldn't reach the server. Please check your connection and try again."
      : '✗ ' + (err.message || 'Something went wrong. Try again.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Subscribe';
  }
}

/* FastAPI returns `detail` as a string for our own errors but as an array of
   validation objects on a 422. Flatten both to a readable sentence so the user
   never sees "[object Object]". */
function detailToText(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => (d && d.msg) ? d.msg : String(d)).join('; ');
  }
  return String(detail.msg || '');
}
