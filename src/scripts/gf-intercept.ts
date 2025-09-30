// src/scripts/gf-intercept.ts
type InitOptions = {
  root: Element | Document | null | undefined;
  wpBase: string; // e.g., https://yoursite.com
};

export default function initGFIntercept(opts: InitOptions) {
  const { root, wpBase } = opts || {};
  if (!root || !wpBase) return;

  // Allow multiple forms per page
  // CHANGED: also match forms not strictly inside .gf-wrap (theme variance)
  const forms = Array.from(root.querySelectorAll<HTMLFormElement>('.gf-wrap form[id^="gform_"], form[id^="gform_"]'));
  if (!forms.length) return;

  for (const form of forms) {
    // Avoid double binding
    if ((form as any).__gfInterceptBound) continue;
    (form as any).__gfInterceptBound = true;

    // Derive formId
    let formId = form.getAttribute('data-formid') || "";
    if (!formId) {
      const m = form.id && form.id.match(/^gform_(\d+)$/);
      formId = m ? m[1] : "";
    }
    if (!formId) continue;

    // Remove GF default AJAX/iframe behavior
    form.removeAttribute('target');
    form.removeAttribute('data-ajax');
    form.setAttribute('novalidate', 'novalidate');

    // ----- helpers -----
    function clearValidation() {
      const old = form.querySelector('.gform_validation_errors, .gform_confirmation_message');
      if (old) old.parentNode?.removeChild(old);

      form.querySelectorAll('.gfield_error').forEach(el => el.classList.remove('gfield_error'));
      form.querySelectorAll('.gfield_validation_message').forEach(el => el.remove());
      form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.setAttribute('aria-invalid', 'false'));
    }

    function ensureFieldMessageEl(fieldWrap: Element) {
      let msg = fieldWrap.querySelector('.gfield_validation_message') as HTMLElement | null;
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'gfield_validation_message';
        fieldWrap.appendChild(msg);
      }
      return msg;
    }

    function setFieldError(inputId: string, message: string) {
      const baseId = String(inputId).split('.')[0]; // "5.2" -> "5"
      const field = form.querySelector(`#field_${formId}_${baseId}`);
      if (!field) return;
      field.classList.add('gfield_error');
      const msgEl = ensureFieldMessageEl(field);
      msgEl.textContent = message || 'This field is required.';
      const input = field.querySelector(`[name="input_${inputId}"], [name="input_${baseId}"]`) as HTMLElement | null;
      if (input) input.setAttribute('aria-invalid', 'true');
    }

    function showGlobalError(text: string) {
      const wrap = document.createElement('div');
      wrap.className = 'gform_validation_errors';
      wrap.innerHTML = `<h2 class="gform_submission_error hide_summary">There was a problem with your submission.</h2><p>${text}</p>`;
      form.prepend(wrap);
    }

    function showConfirmation(html: string) {
      const conf = document.createElement('div');
      conf.className = 'gform_confirmation_message';
      conf.innerHTML = html || 'Thank you! Your submission has been received.';
      form.replaceWith(conf);
    }

    async function handleSubmit(e: Event) {
      e.preventDefault();
      clearValidation();

      const fd = new FormData(form);
      const payload: Record<string, any> = {};

      fd.forEach((v, k) => {
        // Only map GF-like names: input_1, input_5.2, etc.
        const m = /^input_(\d+(?:\.\d+)*)$/.exec(k);
        if (!m) return;
        const key = m[1];

        if (payload[key] !== undefined) {
          if (Array.isArray(payload[key])) payload[key].push(v);
          else payload[key] = [payload[key], v];
        } else {
          payload[key] = v;
        }
      });

      try {
        const res = await fetch(`${wpBase}/wp-json/astro/v1/gf/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ formId: Number(formId), payload })
        });

        if (!res.ok) {
          let msg = 'Submission failed.';
          try { const j = await res.json(); msg = j?.message || msg; } catch {}
          showGlobalError(msg);
          return;
        }

        const data = await res.json();
        if (data?.ok) {
          if (data.redirectUrl) {
            window.location.assign(data.redirectUrl);
            return;
          }
          showConfirmation(data.message || 'Thank you! Your submission has been received.');
        } else {
          const errs = (data && data.errors) || {};
          const keys = Object.keys(errs);
          if (!keys.length) showGlobalError('Please correct the highlighted fields.');
          keys.forEach(k => setFieldError(k, errs[k]));
        }
      } catch (err: any) {
        showGlobalError(err?.message || 'Something went wrong. Please try again.');
      }
    }

    form.addEventListener('submit', handleSubmit as any, { passive: false });
  }
}
