/* Counts a visit to the portfolio for the CMS dashboard (Website traffic).

   One beacon to the site's own API, sent as text/plain so it needs no CORS
   preflight and no response. No cookies or storage: the API counts a visitor
   by a keyed hash of their connection and browser, keeps no IP address, and
   counts a reload within 30 minutes once. Nothing is sent from a local
   preview (it would skew the real numbers) or when the browser asks not to
   be tracked (Do Not Track or Global Privacy Control). */

const TRACK_URL = 'https://api.dipakbist.com.np/api/public/track';
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '']);

export function initVisit() {
    if (LOCAL.has(location.hostname) || location.protocol === 'file:') return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
    const body = JSON.stringify({
        site: 'portfolio',
        path: location.pathname,
        title: document.title,
        referrer: document.referrer,
    });
    try {
        if (navigator.sendBeacon && navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
    } catch {
        // fall through to fetch
    }
    fetch(TRACK_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, keepalive: true, mode: 'no-cors' }).catch(() => {});
}
