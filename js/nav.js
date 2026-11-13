/* Navigation: mobile menu (accessible), active-section highlighting,
   header scrolled state, back-to-top. No scroll listeners: everything is
   driven by IntersectionObserver. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function initMenu() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    const main = document.getElementById('main');
    if (!toggle || !menu) return;

    const links = [...menu.querySelectorAll('.nav__link')];
    let open = false;

    const setOpen = (next, { returnFocus = true } = {}) => {
        open = next;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menu.classList.toggle('is-open', open);
        document.body.style.overflow = open ? 'hidden' : '';
        if (main) main.inert = open;
        if (open) {
            links[0]?.focus({ preventScroll: true });
            if (window.Motion && !reduced()) {
                window.Motion.animate(links, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] }, {
                    duration: 0.3, delay: window.Motion.stagger(0.035), ease: [0.16, 1, 0.3, 1],
                });
            }
        } else if (returnFocus) {
            toggle.focus({ preventScroll: true });
        }
    };

    toggle.addEventListener('click', () => setOpen(!open));
    links.forEach((a) => a.addEventListener('click', () => { if (open) setOpen(false, { returnFocus: false }); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
    document.addEventListener('click', (e) => {
        if (open && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false, { returnFocus: false });
    });
    // Leaving the mobile breakpoint while open: reset state.
    matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches && open) setOpen(false, { returnFocus: false }); });
}

function initActiveSection() {
    const links = new Map();
    document.querySelectorAll('.nav__link[href^="#"]').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
    const sections = [...document.querySelectorAll('main section[id]')].filter((s) => links.has(s.id) || s.id === 'ai');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    // Sections without their own nav entry inherit the previous linked section.
    const ownerOf = (id) => {
        if (links.has(id)) return id;
        const idx = sections.findIndex((s) => s.id === id);
        for (let i = idx - 1; i >= 0; i -= 1) if (links.has(sections[i].id)) return sections[i].id;
        return null;
    };

    const visible = new Map();
    let activeId = null;
    const indicator = document.querySelector('.nav__indicator');
    const menu = document.getElementById('nav-menu');
    const desktop = matchMedia('(min-width: 1024px)');
    // A single pill slides between links instead of each link lighting up.
    const moveIndicator = () => {
        if (!indicator || !menu || !activeId || !desktop.matches) { indicator?.classList.remove('is-on'); return; }
        const link = links.get(activeId);
        if (!link) return;
        const m = menu.getBoundingClientRect();
        const r = link.getBoundingClientRect();
        indicator.style.width = `${r.width}px`;
        indicator.style.transform = `translateX(${r.left - m.left}px)`;
        indicator.classList.add('is-on');
    };
    const setActive = (id) => {
        if (id === activeId) return;
        activeId = id;
        links.forEach((a, key) => {
            if (key === id) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
        moveIndicator();
    };
    addEventListener('resize', moveIndicator, { passive: true });
    desktop.addEventListener('change', moveIndicator);
    if (document.fonts?.ready) document.fonts.ready.then(moveIndicator);

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let best = null;
        let bestRatio = 0;
        sections.forEach((s) => {
            const r = visible.get(s.id) || 0;
            if (r > bestRatio) { bestRatio = r; best = s.id; }
        });
        if (best) setActive(ownerOf(best));
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    sections.forEach((s) => io.observe(s));
    setActive('home');
}

function initHeaderState() {
    const header = document.getElementById('site-header');
    const sentinel = document.getElementById('top-sentinel');
    if (!header || !sentinel || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
}

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    const hero = document.getElementById('home');
    if (!btn || !hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => btn.classList.toggle('is-visible', !e.isIntersecting), { threshold: 0.1 }).observe(hero);
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        document.getElementById('main')?.focus({ preventScroll: true });
    });
}

function initSkipLink() {
    const main = document.getElementById('main');
    document.querySelector('.skip-link')?.addEventListener('click', () => main?.focus({ preventScroll: true }));
}

export function initNav() {
    initMenu();
    initActiveSection();
    initHeaderState();
    initBackToTop();
    initSkipLink();
}
