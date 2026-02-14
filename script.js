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
    
    // Initialize all features
    initMobileNav();
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

    // Detect Edge browser (has slower canvas rendering)
    const isEdge = /Edg/.test(navigator.userAgent);
    
    // Galaxy canvas disabled by default for performance; user can enable via localStorage
    // For Edge, always disable canvas by default due to Chromium rendering quirks
    const enableGalaxyDefault = localStorage.getItem('portfolio-disable-effects') !== 'true' && hwConcurrency > 4 && !prefersReduced && !isEdge;

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

/* ----- Scroll Animations ----- */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');

    if (!animatedElements.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
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

    // Add staggered delays to skill and tool cards
    const skillCards = document.querySelectorAll('.skill-card[data-animate]');
    const toolCards = document.querySelectorAll('.tool-card[data-animate]');
    const projectCards = document.querySelectorAll('.project-card[data-animate]');

    [skillCards, toolCards, projectCards].forEach(cards => {
        cards.forEach((card, index) => {
            card.dataset.delay = index * 100;
        });
    });

    animatedElements.forEach(el => observer.observe(el));
}

/* ----- Typing Effect ----- */
function initTypingEffect() {
    const typingElement = document.getElementById('typing-text');
    if (!typingElement) return;

    const phrases = [
        'Python Automation Expert',
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

/* ----- Floating Particles ----- */
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    // Random properties
    const size = Math.random() * 4 + 2;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;
    const opacity = Math.random() * 0.3 + 0.1;

    particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: rgba(99, 102, 241, ${opacity});
        border-radius: 50%;
        left: ${posX}%;
        top: ${posY}%;
        animation: float ${duration}s ease-in-out ${delay}s infinite;
        pointer-events: none;
    `;

    container.appendChild(particle);
}

// Add float animation to stylesheet
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
        }
        25% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.6;
        }
        50% {
            transform: translateY(-10px) translateX(-10px);
            opacity: 0.4;
        }
        75% {
            transform: translateY(-30px) translateX(5px);
            opacity: 0.5;
        }
    }
`;
document.head.appendChild(style);

/* ----- Header Scroll Effect (Debounced) ----- */
let lastScroll = 0;
const header = document.querySelector('.header');

// Batch scroll updates using rAF to avoid jank
let scrollTicking = false;
function handleScrollBatch() {
    const currentScroll = window.scrollY;

    if (header) {
        header.style.background = currentScroll > 100 ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    }

    // update active nav link (previously on its own listener)
    highlightNavLink();

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

function highlightNavLink() {
    const scrollY = window.scrollY;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

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

    // Smooth animation loop
    function animateFollower() {
        // Lerp for smooth following
        followerX += (mouseX - followerX) * 0.08;
        followerY += (mouseY - followerY) * 0.08;

        follower.style.left = `${followerX}px`;
        follower.style.top = `${followerY}px`;

        requestAnimationFrame(animateFollower);
    }

    animateFollower();
}

/* ----- Parallax Orbs on Scroll ----- */
function initParallaxOrbs() {
    const orbs = document.querySelectorAll('.orb');
    if (!orbs.length) return;

    // Throttle mouse move updates via rAF for smoother performance
    let orbMouseX = 0, orbMouseY = 0;
    let orbTick = false;

    document.addEventListener('mousemove', (e) => {
        orbMouseX = e.clientX;
        orbMouseY = e.clientY;
        if (!orbTick) {
            requestAnimationFrame(() => {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                orbs.forEach((orb, index) => {
                    const speed = (index + 1) * 0.01; // reduced speed for perf
                    const x = (orbMouseX - centerX) * speed;
                    const y = (orbMouseY - centerY) * speed;
                    orb.style.transform = `translate(${x}px, ${y}px)`;
                });
                orbTick = false;
            });
            orbTick = true;
        }
    }, { passive: true });
}

/* ----- Magnetic Buttons ----- */
function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');

    buttons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Subtle magnetic effect
            button.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translate(0, 0)';
        });
    });
}

/* ----- Enhanced Card Tilt Effect ----- */
document.querySelectorAll('.skill-card, .tool-card, .project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

/* ----- Scroll Progress Indicator ----- */
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

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = `${scrollPercent}%`;
    });
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
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    // Config (adaptive)
    const CELL_SIZE = 80;
    const CONNECT_DIST = 70;
    const MAX_CONNECTIONS = 2;
    const PREF_MIN_PARTICLES = 150; // tuned lower for responsiveness
    // For Edge, further reduce particles to avoid canvas bottleneck
    const isEdgeBrowser = /Edg/.test(navigator.userAgent);
    const PREF_MAX_PARTICLES = isEdgeBrowser ? 300 : 800; // reduce even more for Edge

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
            particles.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, r: Math.random() * 1.2 + 0.6, hue: 200 + Math.random() * 120 });
        }
    }

    // Try to gradually increase particles when idle
    function rampParticles() {
        if (particles.length >= targetParticleCount) return;
        const add = Math.min(50, targetParticleCount - particles.length);
        for (let i = 0; i < add; i++) {
            particles.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, r: Math.random() * 1.2 + 0.6, hue: 200 + Math.random() * 120 });
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

        // draw particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.beginPath();
            ctx.fillStyle = `rgba(${Math.floor(60 + (p.hue - 200) * 0.6)}, ${Math.floor(140 + (p.hue - 200) * 0.5)}, ${220}, 0.85)`;
            ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, 0.12)`;
            // reduce blur while user is scrolling to avoid expensive compositing
            // Edge needs even lower blur to prevent freezing
            const edgeBlurReduction = isEdgeBrowser ? 0.4 : 1;
            ctx.shadowBlur = (isUserScrolling ? (hwConcurrency <= 2 ? 1 : 2) : (hwConcurrency <= 2 ? 2 : 8)) * edgeBlurReduction;
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
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
                                const alpha = 1 - d2 / maxConn2;
                                ctx.beginPath();
                                ctx.strokeStyle = `rgba(150,160,255,${alpha * 0.12})`;
                                ctx.moveTo(p.x, p.y);
                                ctx.lineTo(q.x, q.y);
                                ctx.stroke();
                                connections++;
                            }
                        }
                    }
                }
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    let last = performance.now();
    function loop(now) {
        if (document.hidden) {
            last = now;
            requestAnimationFrame(loop);
            return;
        }
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
