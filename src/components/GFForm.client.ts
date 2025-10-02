// src/components/GFForm.client.ts
import { submitJSON } from "@/lib/gf/api";

/** Some WP setups return the rendered HTML as a JSON-encoded string. */
function unwrapMaybeJSONString(raw: string): string {
  const s = raw?.trim();
  if (!s) return s;
  const looksJSONWrapped = s.startsWith('"') && s.endsWith('"') && /\\[nrt"\\/]/.test(s);
  if (!looksJSONWrapped) return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function findClosestForm(el: Element | null): HTMLFormElement | null {
  while (el) {
    if (el instanceof HTMLFormElement) return el;
    el = el.parentElement!;
  }
  return null;
}

function serializeForm(form: HTMLFormElement) {
  const fd = new FormData(form);
  const payload: Record<string, any> = {};
  for (const [k, v] of fd.entries()) {
    if (payload[k] !== undefined) {
      const prev = payload[k];
      payload[k] = Array.isArray(prev) ? [...(Array.isArray(prev) ? prev : [prev]), v] : [prev, v];
    } else {
      payload[k] = v;
    }
  }
  return payload;
}

function clearErrors(root: HTMLElement) {
  root.querySelectorAll(".gf-inline-error").forEach((n) => n.remove());
  root
    .querySelectorAll(".gfield_error, .gfield--error")
    .forEach((el) => el.classList.remove("gfield_error", "gfield--error"));
}

function showErrors(root: HTMLElement, errors: Record<string, string>) {
  Object.entries(errors).forEach(([name, msg]) => {
    const input = root.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    const field = (input?.closest?.(".gfield") as HTMLElement) || null;
    const target = field || input || root;
    if (field) field.classList.add("gfield_error", "gfield--error");
    const div = document.createElement("div");
    div.className = "gf-inline-error";
    div.setAttribute("role", "alert");
    div.textContent = msg;
    target?.appendChild(div);
  });
}

/* -------------------- Label Swap helpers (incl. autofill) -------------------- */

// Lift labels for pre-filled / autofilled fields
function ensureActiveForFilled(root: ParentNode) {
  const bump = (el: HTMLElement) => {
    const complex = el.closest(".ginput_complex");
    if (complex) el.parentElement?.classList.add("active");
    else el.closest(".gfield")?.classList.add("active");
  };

  root.querySelectorAll<HTMLInputElement>(".gfield input:not(.datepicker)").forEach((input) => {
    const hasVal =
      (input.value ?? "").length > 0 ||
      (input.getAttribute("value") ?? "").length > 0;
    if (hasVal) bump(input);
    else {
      try {
        // @ts-ignore – pseudo selector may not be typed
        if (input.matches(":-webkit-autofill")) bump(input);
      } catch {}
    }
  });

  root.querySelectorAll<HTMLTextAreaElement>(".gfield textarea").forEach((ta) => {
    if ((ta.value ?? "").length > 0) ta.closest(".gfield")?.classList.add("active");
  });
}

// Short polling burst to catch Chrome profile autofill after user picks from dropdown
function startAutofillBurst(host: HTMLElement) {
  const KEY = "_gf_autofillBurst";
  if ((host as any)[KEY]) return; // already running
  (host as any)[KEY] = true;

  const started = Date.now();
  const poll = () => {
    ensureActiveForFilled(host);
    if (Date.now() - started < 2000) {
      (host as any)[KEY + "_t"] = setTimeout(poll, 120);
    } else {
      clearTimeout((host as any)[KEY + "_t"]);
      (host as any)[KEY] = false;
    }
  };
  poll();
}

/* -------------------- Label Swap: decoration + delegation -------------------- */

// Add structural classes and initial "active" state on a detached tree (or live DOM).
function decorateLabelSwap(root: ParentNode) {
  // Structural classes
  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '.gfield input[type="tel"], .gfield input[type="text"], .gfield textarea, .gfield input[type="email"]'
    )
    .forEach((el) => el.closest(".gfield")?.classList.add("gform-label-slide"));

  root
    .querySelectorAll<HTMLInputElement>('.gfield input[type="tel"]')
    .forEach((el) => el.closest(".gfield")?.classList.add("gfield_phone"));

  root
    .querySelectorAll<HTMLTextAreaElement>(".gfield textarea")
    .forEach((ta) => ta.closest(".gfield")?.classList.add("gfield_textarea"));

  // Initial "active" for inputs/textareas + possible autofill values
  ensureActiveForFilled(root);
}

// Attach once per host; use event delegation for focus/blur + autofill hooks.
function setupLabelSwapDelegation(host: HTMLElement) {
  if ((host as any)._labelSwapBound) return;

  host.addEventListener("focusin", (ev) => {
    const t = ev.target as HTMLElement | null;
    if (!t) return;
    if (t.matches('.gfield input:not(.datepicker)')) {
      const isComplex = !!t.closest(".ginput_complex");
      if (isComplex) t.parentElement?.classList.add("active");
      else t.closest(".gfield")?.classList.add("active");
      setTimeout(() => { ensureActiveForFilled(host); startAutofillBurst(host); }, 50);
    } else if (t.matches(".gfield textarea")) {
      t.closest(".gfield")?.classList.add("active");
      setTimeout(() => { ensureActiveForFilled(host); startAutofillBurst(host); }, 50);
    }
  });

  host.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === "Tab" || ev.key === "ArrowDown") {
      startAutofillBurst(host);
    }
  });

  host.addEventListener("pointerdown", () => {
    startAutofillBurst(host);
  });

  host.addEventListener("focusout", (ev) => {
    const t = ev.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!t) return;
    if (t.matches('.gfield input:not(.datepicker)')) {
      if ((t.value ?? "").length === 0) {
        const isComplex = !!t.closest(".ginput_complex");
        if (isComplex) t.parentElement?.classList.remove("active");
        else t.closest(".gfield")?.classList.remove("active");
      }
    } else if (t.matches(".gfield textarea")) {
      if ((t.value ?? "").length === 0) {
        t.closest(".gfield")?.classList.remove("active");
      }
    }
  });

  (host as any)._labelSwapBound = true;
}

/* -------------------- Vanilla customSelect (inlined) -------------------- */

declare global {
  interface Window {
    customSelect?: (targets: string | Element[] | NodeListOf<Element>, opts?: any) => {
      instances: Array<{ render: () => void; destroy: () => void }>;
      renderAll: () => void;
      destroyAll: () => void;
    };
  }
}

(function () {
  if (typeof window !== "undefined" && typeof window.customSelect === "function") return;

  const DEFAULTS = { customClass: "customSelect", mapClass: true, mapStyle: true };
  const isFirefox = typeof (window as any).InstallTrigger !== "undefined";

  function classWith(base: string, suffix: string) { return base + suffix; }
  function getOuterDims(el: HTMLElement) { const r = el.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; }
  function getInlineStyle(el: HTMLElement) { return el.getAttribute("style") || ""; }
  function copyClasses(from: Element, to: Element) { from.classList.forEach((c) => to.classList.add(c)); }
  function on(el: Element | Document, type: string, handler: any, opts: AddEventListenerOptions | boolean | undefined, bag: Array<() => void>) {
    el.addEventListener(type, handler as any, opts as any); bag.push(() => el.removeEventListener(type, handler as any, opts as any));
  }

  function renderOne(select: HTMLSelectElement, wrapper: HTMLElement, inner: HTMLElement, base: string) {
    const selOpt = select.options[select.selectedIndex];
    inner.innerHTML = selOpt && selOpt.innerHTML ? selOpt.innerHTML : "&nbsp;";
    if (selOpt && selOpt.disabled) wrapper.classList.add(classWith(base, "DisabledOption"));
    else wrapper.classList.remove(classWith(base, "DisabledOption"));
    setTimeout(() => wrapper.classList.remove(classWith(base, "Open")), 60);

    select.style.width = "";
    wrapper.style.display = "inline-block";

    const selectOW = getOuterDims(select).width || select.offsetWidth;
    const wrapperOW = wrapper.offsetWidth; const wrapperIW = wrapper.clientWidth;
    const chromeBorder = wrapperOW - wrapperIW; const k = Math.max(0, selectOW - chromeBorder);

    inner.style.display = "inline-block"; inner.style.width = k + "px";

    if (select.disabled) wrapper.classList.add(classWith(base, "Disabled"));
    else wrapper.classList.remove(classWith(base, "Disabled"));

    const h = wrapper.offsetHeight;
    (select.style as any).webkitAppearance = "menulist-button";
    (select.style as any).appearance = "menulist-button";
    select.style.width = wrapper.offsetWidth + "px";
    select.style.position = "absolute";
    select.style.opacity = "0";
    select.style.height = h + "px";
    select.style.fontSize = getComputedStyle(wrapper).fontSize;
    select.style.top = "0";
    select.style.left = "0";
    select.style.margin = "0";
    select.style.padding = "0";
    select.style.border = "0";
    select.style.boxSizing = "border-box";
  }

  function setupOne(select: HTMLSelectElement, options: any) {
    const base = options.customClass;
    if (select.classList.contains("hasCustomSelect")) return null;

    const teardownFns: Array<() => void> = [];
    const inner = document.createElement("span"); inner.className = classWith(base, "Inner");
    const wrapper = document.createElement("span"); wrapper.className = base; wrapper.appendChild(inner);

    if (options.mapClass) copyClasses(select, wrapper);
    if (options.mapStyle) { const inline = getInlineStyle(select); if (inline) wrapper.setAttribute("style", inline); }

    const cover = document.createElement("span");
    cover.style.position = "relative"; cover.style.display = "inline-block"; cover.style.verticalAlign = "top"; cover.style.width = "100%";

    select.insertAdjacentElement("afterend", cover);
    cover.appendChild(wrapper); cover.appendChild(select);
    select.classList.add("hasCustomSelect");

    on(select, "change", () => { wrapper.classList.add(classWith(base, "Changed")); renderOne(select, wrapper, inner, base); }, false, teardownFns);
    on(select, "keyup", (ev: KeyboardEvent) => {
      if (!wrapper.classList.contains(classWith(base, "Open"))) {
        select.dispatchEvent(new Event("blur", { bubbles: false }));
        select.dispatchEvent(new Event("focus", { bubbles: false }));
      } else if (ev.which === 13 || ev.which === 27) {
        renderOne(select, wrapper, inner, base);
      }
    }, false, teardownFns);
    on(select, "mousedown", () => { wrapper.classList.remove(classWith(base, "Changed")); }, false, teardownFns);
    on(select, "mouseup", (ev: MouseEvent) => {
      if (!wrapper.classList.contains(classWith(base, "Open"))) {
        const anyOpen = document.querySelector("." + classWith(base, "Open"));
        if (anyOpen && isFirefox) {
          select.dispatchEvent(new Event("focus", { bubbles: false }));
        } else {
          wrapper.classList.add(classWith(base, "Open"));
          ev.stopPropagation();
          const onDocUp = (k: MouseEvent) => {
            const target = k.target as Node;
            if (target !== select && !select.contains(target)) {
              select.dispatchEvent(new Event("blur", { bubbles: false }));
            } else {
              renderOne(select, wrapper, inner, base);
            }
            document.removeEventListener("mouseup", onDocUp, true);
          };
          document.addEventListener("mouseup", onDocUp, true);
        }
      }
    }, false, teardownFns);
    on(select, "focus", () => { wrapper.classList.remove(classWith(base, "Changed")); wrapper.classList.add(classWith(base, "Focus")); }, false, teardownFns);
    on(select, "blur", () => { wrapper.classList.remove(classWith(base, "Focus")); wrapper.classList.remove(classWith(base, "Open")); }, false, teardownFns);
    on(select, "mouseenter", () => { wrapper.classList.add(classWith(base, "Hover")); }, false, teardownFns);
    on(select, "mouseleave", () => { wrapper.classList.remove(classWith(base, "Hover")); }, false, teardownFns);

    renderOne(select, wrapper, inner, base);

    function render() { renderOne(select, wrapper, inner, base); }
    function destroy() {
      teardownFns.forEach((fn) => { try { fn(); } catch {} });
      if (cover.parentNode) { cover.parentNode.insertBefore(select, cover); cover.remove(); }
      select.classList.remove("hasCustomSelect");
      ([
        "appearance","webkitAppearance","width","position","opacity","height","fontSize","top","left","margin","padding","border","boxSizing",
      ] as Array<keyof CSSStyleDeclaration>).forEach((prop) => {
        try { /* @ts-ignore */ select.style[prop] = ""; } catch {}
      });
    }

    return { select, render, destroy };
  }

  function normalizeTargets(targets: any): Element[] {
    if (typeof targets === "string") return Array.from(document.querySelectorAll(targets));
    if (targets instanceof Element) return [targets];
    if ((NodeList.prototype as any).isPrototypeOf(targets) || Array.isArray(targets)) return Array.from(targets);
    return [];
  }

  (window as any).customSelect = function (targets: string | Element[] | NodeListOf<Element>, opts: any = {}) {
    const options = Object.assign({}, DEFAULTS, opts);
    const nodes = normalizeTargets(targets);
    const instances: Array<{ render: () => void; destroy: () => void }> = [];
    nodes.forEach((node) => {
      if (node && (node as Element).tagName?.toLowerCase() === "select") {
        const inst = setupOne(node as HTMLSelectElement, options);
        if (inst) instances.push(inst);
      } else if (node) {
        const selects = node.querySelectorAll("select");
        selects.forEach((sel) => {
          const inst = setupOne(sel as HTMLSelectElement, options);
          if (inst) instances.push(inst);
        });
      }
    });
    return {
      instances,
      renderAll() { instances.forEach((i) => i.render()); },
      destroyAll() { instances.forEach((i) => i.destroy()); },
    };
  };
})();

/* Helper to (re)apply customSelect under a host; also stores/destroys per host */
type CSHandle = ReturnType<NonNullable<typeof window.customSelect>>;
function applyCustomSelect(host: HTMLElement): CSHandle | null {
  try {
    const handle = (window as any).customSelect?.(host, {
      customClass: "customSelect",
      mapClass: true,
      mapStyle: true,
    });
    return handle || null;
  } catch (e) {
    console.warn("[GFForm] customSelect init failed", e);
    return null;
  }
}

/* -------------------- Fetch & render -------------------- */

async function fetchRenderInto(host: HTMLElement, formId: number) {
  const base = (host.dataset.wpBase || "").replace(/\/+$/, "");
  if (!base) {
    console.error(
      "[GFForm] Missing data-wp-base. Pass wpBase prop to <GFForm /> or define PUBLIC_WP_BASE_URL. " +
        "Client cannot fetch /wp-json/astro/v1/gf/render from WordPress on a different origin."
    );
    host.innerHTML = '<div class="gf-error">Form base URL not configured.</div>';
    return;
  }
  const url = `${base}/wp-json/astro/v1/gf/render/${formId}`;

  // Tear down any previous customSelect on this host before replacing HTML
  const prevCs: CSHandle | null = (host as any)._customSelectHandle || null;
  if (prevCs) {
    try { prevCs.destroyAll(); } catch {}
    (host as any)._customSelectHandle = null;
  }

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Render fetch failed (${res.status})`);
  const raw = await res.text();
  const html = unwrapMaybeJSONString(raw);

  // Parse off-DOM, decorate, then inject for first-paint correctness.
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  decorateLabelSwap(tpl.content);
  host.innerHTML = "";
  host.appendChild(tpl.content.cloneNode(true));

  // Ensure delegation for runtime focus/blur and autofill polling
  setupLabelSwapDelegation(host);
  ensureActiveForFilled(host);
  setTimeout(() => ensureActiveForFilled(host), 150);
  setTimeout(() => ensureActiveForFilled(host), 600);

  // Apply customSelect to selects under this host
  const cs = applyCustomSelect(host);
  (host as any)._customSelectHandle = cs;
}

/* -------------------- Submit wiring -------------------- */

function renderConfirmation(host: HTMLElement, html: string, ok: boolean) {
  let box = host.querySelector<HTMLElement>(".gf-confirmation");
  if (!box) {
    box = document.createElement("div");
    box.className = "gf-confirmation";
    host.appendChild(box);
  }

  box.innerHTML = html;
  box.setAttribute("data-ok", ok ? "1" : "0");

  if (ok) {
    box.classList.remove("gf-confirmation--in");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (box as HTMLElement).offsetHeight;
    box.classList.add("gf-confirmation--in");
  } else {
    box.classList.remove("gf-confirmation--in");
  }
}

// Wrapper + submitting UI helpers
function getWrapper(form: HTMLFormElement): HTMLElement {
  return (
    form.closest<HTMLElement>(".banner-form-wrap") ||
    form.closest<HTMLElement>(".gf-host") ||
    form
  );
}

function setSubmitting(wrapper: HTMLElement, on: boolean) {
  wrapper.classList.toggle("is-submitting", on);
  wrapper.setAttribute("aria-busy", on ? "true" : "false");

  let spinner = wrapper.querySelector<HTMLElement>(".spinner");

  console.log(wrapper);
  
  if (on) {
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.className = "spinner";
      spinner.innerHTML = `
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
      `;
      wrapper.appendChild(spinner);
    }
  } else {
    spinner?.remove();
  }
}

function wireSubmit(host: HTMLElement) {
  host.addEventListener(
    "submit",
    async (ev) => {
      const form = findClosestForm(ev.target as Element);
      if (!form) return;
      ev.preventDefault();

      // Double-submit guard
      if ((form as any)._gfSubmitting) return;
      (form as any)._gfSubmitting = true;

      const formId = Number(host.dataset.gfFormId || "0");
      const viaProxy = host.dataset.gfProxy === "1";
      const base = (host.dataset.wpBase || "").replace(/\/+$/, "");

      const submitBtn =
        form.querySelector<HTMLButtonElement>("button[type=submit], input[type=submit]");
      submitBtn?.setAttribute("disabled", "true");

      const wrapper = getWrapper(form);
      console.log(wrapper);
      setSubmitting(wrapper, true);
      clearErrors(host);

      try {
        const payload = serializeForm(form);
        const res = await submitJSON(formId, payload, { viaProxy, base });

        if (!res.ok) {
          if (res.errors && Object.keys(res.errors).length) {
            const normErrors: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.errors as Record<string, string>)) {
              const domKey = k.startsWith("input_") ? k : `input_${k}`;
              normErrors[domKey] = v || "This field has an error.";
            }
            showErrors(host, normErrors);
          }
          const msg = res.message || "There were errors with your submission.";
          renderConfirmation(host, msg, false);
          return;
        }

        if (res.redirectUrl) {
          window.location.assign(res.redirectUrl);
          return;
        }

        const msg = res.message || "Thanks! Your form has been submitted.";
        renderConfirmation(host, msg, true);

        // Success styling on the same wrapper
        wrapper.classList.add("submitted");

        // Reset + refresh visuals
        form.reset();
        decorateLabelSwap(host);
        ensureActiveForFilled(host);
        const cs: CSHandle | null = (host as any)._customSelectHandle || null;
        cs?.renderAll?.();
      } catch (err) {
        console.error("[GFForm] submit error", err);
        renderConfirmation(host, "Sorry, we couldn’t submit the form right now.", false);
      } finally {
        submitBtn?.removeAttribute("disabled");
        setSubmitting(wrapper, false);
        (form as any)._gfSubmitting = false;
      }
    },
    { capture: true }
  );
}

/* -------------------- Entry -------------------- */

export default function initGFClient() {
  const run = () => {
    const hosts = Array.from(document.querySelectorAll<HTMLElement>(".gf-host[data-gf-form-id]"));
    if (!hosts.length) {
      console.debug("[GFForm] no .gf-host found");
      return;
    }
    console.debug("[GFForm] init on", hosts.length, "host(s)");

    hosts.forEach(async (host) => {
      const formId = Number(host.dataset.gfFormId || "0");
      const hasForm = !!host.querySelector("form");

      if (!hasForm && formId > 0) {
        try {
          await fetchRenderInto(host, formId);
        } catch (e) {
          console.error("[GFForm] client render failed", e);
          host.innerHTML =
            '<div class="gf-error">Form temporarily unavailable. Please try again later.</div>';
        }
      } else {
        // SSR: decorate existing DOM and bind delegation
        decorateLabelSwap(host);
        setupLabelSwapDelegation(host);
        ensureActiveForFilled(host);
        setTimeout(() => ensureActiveForFilled(host), 150);
        setTimeout(() => ensureActiveForFilled(host), 600);

        // Apply customSelect to SSR DOM
        const prev: CSHandle | null = (host as any)._customSelectHandle || null;
        if (prev) { try { prev.destroyAll(); } catch {} }
        const cs = applyCustomSelect(host);
        (host as any)._customSelectHandle = cs;
      }

      wireSubmit(host);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}
