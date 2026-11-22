/* Google Analytics 4, only with the visitor's consent.

   Off until a measurement ID is set in index.html:
   <meta name="ga-measurement-id" content="G-XXXXXXXXXX">. Empty means no
   banner and nothing from Google. With an ID:

   - Nothing from Google loads until the visitor chooses "Allow". "Decline"
     is one click too, and both buttons look the same.
   - The choice is kept for 180 days in one first-party cookie,
     dipak_analytics_consent, set for dipakbist.com.np so the blog
     (blog.dipakbist.com.np) shares it: one answer covers both sites.
   - "Cookie settings" in the footer reopens the choice. Declining after
     allowing stops Google Analytics on the page and deletes its _ga cookies.
   - A browser that sends Global Privacy Control or Do Not Track is never
     asked and never tracked.
   - Google signals and ad personalisation are switched off.
   - A local preview shows the banner but never loads Google, so it can't
     skew the real numbers (tests set window.__analyticsAllowLocal).

   The blog does the same in blog/lib/analytics.ts and
   blog/components/analytics/. */

const CONSENT_COOKIE = 'dipak_analytics_consent';
const MAX_AGE = 60 * 60 * 24 * 180;
const SHARED_DOMAIN = 'dipakbist.com.np';
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '']);
const ID_PATTERN = /^G-[A-Z0-9]{4,}$/;
const PRIVACY_URL = 'https://blog.dipakbist.com.np/privacy-policy#analytics';

let banner = null;
let loaded = false;

function measurementId() {
    const id = (document.querySelector('meta[name="ga-measurement-id"]')?.content || '').trim();
    return ID_PATTERN.test(id) ? id : '';
}

function onSharedDomain() {
    const host = location.hostname;
    return host === SHARED_DOMAIN || host.endsWith(`.${SHARED_DOMAIN}`);
}

function readConsent() {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)`));
    return match ? match[1] : '';
}

function writeConsent(value) {
    const domain = onSharedDomain() ? `; domain=${SHARED_DOMAIN}` : '';
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${MAX_AGE}; path=/; SameSite=Lax${domain}${secure}`;
}

/* Google Analytics keeps _ga and _ga_<stream> on the widest domain it can. */
function deleteGaCookies() {
    const domains = ['', `; domain=${location.hostname}`];
    if (onSharedDomain()) domains.push(`; domain=${SHARED_DOMAIN}`);
    for (const part of document.cookie.split(';')) {
        const name = part.split('=')[0].trim();
        if (name !== '_ga' && !name.startsWith('_ga_')) continue;
        for (const domain of domains) document.cookie = `${name}=; max-age=0; path=/${domain}`;
    }
}

function signalsOptOut() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

function load(id) {
    window[`ga-disable-${id}`] = false;
    if (loaded) {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
        return;
    }
    if ((LOCAL.has(location.hostname) || location.protocol === 'file:') && window.__analyticsAllowLocal !== true) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        // gtag.js reads the arguments object itself, not an array.
        window.dataLayer.push(arguments);
    };
    window.gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(script);
}

function stop(id) {
    window[`ga-disable-${id}`] = true;
    if (loaded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    deleteGaCookies();
}

function choose(id, value) {
    writeConsent(value);
    if (value === 'granted') load(id);
    else stop(id);
    const hadFocus = banner && banner.contains(document.activeElement);
    hide();
    if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true });
}

function build(id) {
    const el = document.createElement('section');
    el.className = 'consent';
    el.setAttribute('aria-labelledby', 'consent-title');
    el.hidden = true;
    el.innerHTML = `
        <p class="consent__text"><strong id="consent-title">Analytics cookies.</strong>
        May I use Google Analytics to see which pages are read? It sets cookies and sends usage data to Google.
        Advertising features are off. <a href="${PRIVACY_URL}">Privacy policy</a></p>
        <div class="consent__actions">
            <button type="button" class="btn btn--secondary" data-consent="denied">Decline</button>
            <button type="button" class="btn btn--secondary" data-consent="granted">Allow</button>
        </div>`;
    el.addEventListener('click', (event) => {
        const button = event.target.closest('[data-consent]');
        if (button) choose(id, button.dataset.consent);
    });
    document.body.append(el);
    return el;
}

function show({ focus = false } = {}) {
    banner.hidden = false;
    if (focus) banner.querySelector('[data-consent]')?.focus();
}

function hide() {
    banner.hidden = true;
}

function addSettingsLink() {
    const meta = document.querySelector('.footer__meta');
    if (!meta) return;
    const line = document.createElement('p');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer__cookies';
    button.textContent = 'Cookie settings';
    button.addEventListener('click', () => show({ focus: true }));
    line.append(button);
    meta.append(line);
}

export function initAnalytics() {
    const id = measurementId();
    if (!id || signalsOptOut()) return;
    banner = build(id);
    addSettingsLink();
    const consent = readConsent();
    if (consent === 'granted') load(id);
    else if (consent !== 'denied') show();
}
