import { animate, stagger } from "motion";
import { splitText } from "motion-plus";

// --- debug flag --------------------------------------------------------------
const debug = false;
const log   = (...a) => debug && console.log(...a);
const warn  = (...a) => debug && console.warn(...a);
const error = (...a) => debug && console.error(...a);

// prevent duplicate listener setup across navigations
if (typeof window !== "undefined" && window.__splitLinesBootstrapped) {
  // already booted, exit early
} else if (typeof window !== "undefined") {
  window.__splitLinesBootstrapped = true;
}

// --- utilities ---------------------------------------------------------------
function waitForSelector(selector, { timeout = 4000 } = {}) {
  log("[SPLIT] waitForSelector:start", selector, "timeout=", timeout);

  return new Promise((resolve, reject) => {
    const found = document.querySelector(selector);
    if (found) {
      log("[SPLIT] waitForSelector:found immediately", selector);
      return resolve(found);
    }

    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        obs.disconnect();
        log("[SPLIT] waitForSelector:found via MutationObserver", selector);
        resolve(true);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // run a few frames too (covers BFCache paint-order quirks)
    let rafId;
    let elapsed = 0;
    const tick = (t0) => {
      if (!t0) t0 = performance.now();
      const now = performance.now();
      elapsed = now - t0;
      if (document.querySelector(selector)) {
        cancelAnimationFrame(rafId);
        obs.disconnect();
        log("[SPLIT] waitForSelector:found via RAF", selector, "elapsed=", elapsed);
        return resolve(true);
      }
      if (elapsed >= timeout) {
        cancelAnimationFrame(rafId);
        obs.disconnect();
        warn("[SPLIT] waitForSelector:timeout", selector);
        return reject(new Error(`Timeout waiting for ${selector}`));
      }
      rafId = requestAnimationFrame(() => tick(t0));
    };
    rafId = requestAnimationFrame(() => tick());
  });
}

function unsplit(el) {
  try {
    if (el.__splitAnim) {
      try { el.__splitAnim.cancel?.(); } catch {}
      el.__splitAnim = null;
    }
    if (el.__splitRevert) {
      log("[SPLIT] unsplit: reverting", el);
      el.__splitRevert();
    }
  } catch (e) {
    error("[SPLIT] unsplit:error", e);
  }
  if (el.dataset.origHtml) {
    el.innerHTML = el.dataset.origHtml;
  }
  el.__splitRevert = null;
}

// --- main work ---------------------------------------------------------------
export async function initExcerptLines(root = document) {
  log("[SPLIT] initExcerptLines:start");

  const TARGETS = ".split-lines, .split-chars";
  await waitForSelector(TARGETS).catch(() => {});

  const elements = root.querySelectorAll(TARGETS);
  log("[SPLIT] initExcerptLines:targets found", elements.length);
  if (!elements.length) return;

  await (document.fonts?.ready || Promise.resolve());
  await new Promise((r) => requestAnimationFrame(r));

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  for (const el of elements) {
    if (!el.textContent || !el.textContent.trim()) {
      log("[SPLIT] skipping empty element");
      continue;
    }

    if (!el.dataset.origHtml) {
      el.dataset.origHtml = el.innerHTML;
      log("[SPLIT] cached origHtml");
    }

    unsplit(el);

    const isChars = el.classList.contains("split-chars");
    const type = isChars ? "chars" : "lines";

    try {
      const result = splitText(el, { type });
      el.__splitRevert = result.revert;

      const segments = isChars ? result.chars : result.lines;
      const segClass = isChars ? "split-char" : "split-line";

      log(`[SPLIT] splitText: ${type} found`, segments?.length ?? 0);

      (segments || []).forEach((node, i) => {
        node.classList.add(segClass);
        if (i < 3) log("[SPLIT] segment sample", i, node.textContent.trim());
      });

      if (isChars && el.classList.contains("animate-chars") && segments?.length) {
        if (prefersReduced) {
          segments.forEach((n) => {
            n.style.opacity = "1";
            n.style.transform = "none";
          });
        } else {
          segments.forEach((n) => {
            n.style.opacity = "0";
            n.style.willChange = "opacity, transform";
          });

          el.__splitAnim = animate(
            segments,
            { opacity: 1 },
            {
              duration: 0.04,
              delay: (i) => 0.35 + i * 0.025,
              easing: "cubic-bezier(.2,.8,.2,1)",
            }
          );

          el.__splitAnim.finished?.then?.(() => {
            segments.forEach((n) => (n.style.willChange = ""));
          }).catch(() => {});
        }
      }
    } catch (e) {
      error("[SPLIT] splitText:error", e);
    }
  }

  log("[SPLIT] initExcerptLines:end");
}

// ---- auto-init + lifecycle hooks ----
if (typeof window !== "undefined" && !window.__splitLinesEventsBound) {
  window.__splitLinesEventsBound = true;

  const run = () => {
    log("[SPLIT] run triggered", location.href);
    initExcerptLines(document).catch((e) => error("[SPLIT] run:error", e));
  };

  if (document.readyState === "loading") {
    log("[SPLIT] boot: waiting for DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    log("[SPLIT] boot: DOM already loaded");
    run();
  }

  document.addEventListener("astro:page-load", () => {
    log("[SPLIT] event: astro:page-load");
    run();
  });
  document.addEventListener("astro:after-swap", () => {
    log("[SPLIT] event: astro:after-swap");
    run();
  });

  window.addEventListener("pageshow", () => {
    log("[SPLIT] event: pageshow");
    requestAnimationFrame(run);
  });
  window.addEventListener("popstate", () => {
    log("[SPLIT] event: popstate");
    requestAnimationFrame(run);
  });

  document.addEventListener("visibilitychange", () => {
    log("[SPLIT] event: visibilitychange", document.visibilityState);
    if (document.visibilityState === "visible") requestAnimationFrame(run);
  });
}
