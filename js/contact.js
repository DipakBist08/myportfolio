/* Contact form. Messages are delivered to the owner's inbox by FormSubmit
   (https://formsubmit.co), a free form-to-email service with no account or
   API key. The form posts to its AJAX endpoint and reports the result in a
   live region; without JavaScript the plain HTML form still posts to
   FormSubmit and the visitor lands on its thank-you page.

   One-off setup: the very first submission makes FormSubmit email an
   "Activate Form" link to the address below. Messages are delivered only
   after that link is clicked. */

const ENDPOINT = 'https://formsubmit.co/ajax/dipakbeest@gmail.com';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function withTimeout(ms) {
    if ('AbortSignal' in window && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    if (ctrl) setTimeout(() => ctrl.abort(), ms);
    return ctrl ? ctrl.signal : undefined;
}

export function initContact() {
    const form = document.getElementById('contact-form');
    const btn = document.getElementById('contact-submit');
    const feedback = document.getElementById('contact-feedback');
    if (!form || !btn || !feedback) return;

    const fields = {
        name: {
            input: form.elements.namedItem('name'),
            check: (v) => (v ? '' : 'Enter your name.'),
        },
        email: {
            input: form.elements.namedItem('email'),
            check: (v) => (!v ? 'Enter your email address so I can reply.'
                : EMAIL.test(v) ? '' : 'Enter an email address like name@example.com.'),
        },
        message: {
            input: form.elements.namedItem('message'),
            check: (v) => (v.length >= 10 ? '' : v ? 'Write a little more (at least 10 characters).' : 'Enter a message.'),
        },
    };

    const validateOne = (f) => {
        const msg = f.check(f.input.value.trim());
        const hint = document.getElementById(`${f.input.id}-error`);
        f.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (hint) hint.textContent = msg;
        return !msg;
    };

    Object.values(fields).forEach((f) => {
        f.input.addEventListener('blur', () => { if (f.input.value.trim()) validateOne(f); });
        f.input.addEventListener('input', () => { if (f.input.getAttribute('aria-invalid') === 'true') validateOne(f); });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.textContent = '';
        feedback.classList.remove('is-success', 'is-error');

        const invalid = Object.values(fields).filter((f) => !validateOne(f));
        if (invalid.length) { invalid[0].input.focus(); return; }

        const data = Object.fromEntries(new FormData(form).entries());
        if (data._honey) return; // a bot filled the hidden field; drop silently
        data.name = data.name.trim();
        data.email = data.email.trim();
        data.message = data.message.trim();
        data._replyto = data.email;

        const label = btn.textContent;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.textContent = 'Sending…';
        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(data),
                signal: withTimeout(15000),
            });
            const body = await res.json().catch(() => ({}));
            // FormSubmit returns success as the string "true" or "false".
            if (!res.ok || String(body.success) !== 'true') {
                throw new Error(body.message || 'The message could not be sent.');
            }
            feedback.classList.add('is-success');
            feedback.textContent = 'Thanks, your message has been sent. I will reply by email.';
            form.reset();
        } catch (err) {
            feedback.classList.add('is-error');
            const network = err instanceof TypeError || (err && (err.name === 'TimeoutError' || err.name === 'AbortError'));
            feedback.textContent = network
                ? "Couldn't reach the mail service. Check your connection, or use the email address above."
                : `${(err && err.message) || 'Something went wrong.'} You can also email me directly.`;
        } finally {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.textContent = label;
        }
    });
}
