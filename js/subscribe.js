/* Newsletter subscribe. Contract unchanged from the previous build:
   POST https://api.dipakbist.com.np/api/v1/subscribers/subscribe with
   { email }, success on 2xx or 202, FastAPI `detail` flattened for the
   visitor. The form is progressively enhanced: it has a visible label,
   validates on blur with a specific message, and announces results in a
   live region. */

const BACKEND_API = 'https://api.dipakbist.com.np';

function detailToText(detail) {
    if (!detail) return '';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d) => (d && d.msg) || String(d)).join('; ');
    if (typeof detail === 'object') return String(detail.msg || '');
    return '';
}

function withTimeout(ms) {
    if ('AbortSignal' in window && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    if (ctrl) setTimeout(() => ctrl.abort(), ms);
    return ctrl ? ctrl.signal : undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initSubscribe() {
    const form = document.getElementById('subscribe-form');
    const input = document.getElementById('subscribe-email');
    const btn = document.getElementById('subscribe-btn');
    const hint = document.getElementById('subscribe-hint');
    const feedback = document.getElementById('subscribe-feedback');
    if (!form || !input || !btn || !feedback) return;

    const defaultHint = hint ? hint.textContent : '';
    const setError = (msg) => {
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (hint) {
            hint.textContent = msg || defaultHint;
            hint.classList.toggle('is-error', Boolean(msg));
        }
    };
    const validate = () => {
        const v = input.value.trim();
        if (!v) { setError('Enter your email address.'); return false; }
        if (!EMAIL.test(v)) { setError('Enter an email address like name@example.com.'); return false; }
        setError('');
        return true;
    };

    input.addEventListener('blur', () => { if (input.value.trim()) validate(); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') validate(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.textContent = '';
        feedback.classList.remove('is-success', 'is-error');
        if (!validate()) { input.focus(); return; }

        const email = input.value.trim();
        const label = btn.textContent;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.textContent = 'Subscribing…';
        try {
            const res = await fetch(`${BACKEND_API}/api/v1/subscribers/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                signal: withTimeout(8000),
            });
            const data = await res.json().catch(() => ({}));
            if (!(res.ok || res.status === 202)) throw new Error(detailToText(data.detail) || 'Subscribe failed');
            feedback.classList.add('is-success');
            feedback.textContent = detailToText(data.detail) || 'Check your email to confirm.';
            input.value = '';
        } catch (err) {
            feedback.classList.add('is-error');
            const network = err instanceof TypeError || (err && err.name === 'TimeoutError') || (err && err.name === 'AbortError')
                || /failed to fetch|load failed|networkerror/i.test(err && err.message ? err.message : '');
            feedback.textContent = network
                ? "We couldn't reach the server. Check your connection and try again."
                : (err && err.message) || 'Something went wrong. Try again.';
        } finally {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.textContent = label;
        }
    });
}
