// progress-var.js

export function scrubProgressVarAll(
  selector,
  { varName = "--progress", startOffsetPx = 100 } = {}
) {
  const els = document.querySelectorAll(selector);
  const cleanups = [];

  els.forEach((el) => {
    const cleanup = scrubProgressVar(el, { varName, startOffsetPx });
    if (cleanup) cleanups.push(cleanup);
  });

  // return a single cleanup that clears them all
  return () => cleanups.forEach((fn) => fn());
}

// single-element version (your original)
export function scrubProgressVar(el, { varName = "--progress", startOffsetPx = 100 } = {}) {
  if (!el) return;

  let ticking = false;
  const ro = new ResizeObserver(recalc);
  ro.observe(el);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", recalc, { passive: true });
  window.addEventListener("orientationchange", recalc, { passive: true });

  let startY = 0; // when progress should be 0
  let endY = 0;   // when progress should be 1

  function pageY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function recalc() {
    const rect = el.getBoundingClientRect();
    const yTop = pageY() + rect.top;
    const height = rect.height;

    startY = yTop - startOffsetPx;
    endY = yTop + height;

    onScroll(); // update immediately
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = pageY();
      const raw = (y - startY) / (endY - startY);
      const p = Math.max(0, Math.min(1, raw));
      el.style.setProperty(varName, p.toFixed(4));
      ticking = false;
    });
  }

  recalc();

  return () => {
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", recalc);
    window.removeEventListener("orientationchange", recalc);
  };
}
