import { animate } from "motion";

type ElState = {
  el: HTMLElement;
  last: number;
  anim?: ReturnType<typeof animate>;
};

type InitOptions = {
  varName?: string;          // CSS var to write
  smooth?: boolean;          // animate changes instead of snapping
  smoothDuration?: number;   // seconds for smoothing
};

declare global { interface Window { __cssScrollVarInit?: boolean } }

export default function initCssScrollVar(opts: InitOptions = {}) {
  const VAR = opts.varName ?? "--scroll-progress";
  const SMOOTH = opts.smooth ?? true;
  const DURATION = opts.smoothDuration ?? 0.15;

  const states: ElState[] = [];
  let ticking = false;

  function collect(root: ParentNode = document) {
    states.length = 0;
    root.querySelectorAll<HTMLElement>("[data-motion-css-scroll]").forEach((el) => {
      // reset any previous value so styles have a sane baseline
      el.style.setProperty(VAR, "0");
      states.push({ el, last: 0 });
    });
    // run once to paint initial values
    requestAnimationFrame(updateAll);
  }

  function progressFor(el: HTMLElement) {
    // 0 when the element is fully below the viewport,
    // 1 when the element has fully scrolled past the top.
    // This maps the whole journey (enter → exit) to [0..1].
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Start when bottom hits bottom of viewport; end when top hits top
    const start = vh;            // element just enters (bottom aligned with bottom)
    const end = -rect.height;    // element just leaves (top past top)
    const current = rect.top;

    // normalize & clamp
    const t = (start - current) / (start - end);
    return Math.max(0, Math.min(1, t));
  }

  function setVar(s: ElState, value: number) {
    if (!SMOOTH) {
      s.el.style.setProperty(VAR, value.toFixed(4));
      s.last = value;
      return;
    }
    if (Math.abs(value - s.last) < 0.001) return;
    s.anim?.cancel?.();
    s.anim = animate(
      s.el,
      { [VAR]: [s.last, value] } as any, // Motion can animate CSS vars
      { duration: DURATION, easing: "linear" }
    );
    s.last = value;
  }

  function updateAll() {
    ticking = false;
    for (const s of states) {
      setVar(s, progressFor(s.el));
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateAll);
  }

  // Bind
  collect();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });

  // Recollect after Astro navigations and BFCache restores
  addEventListener("astro:after-swap", () => collect());
  addEventListener("astro:page-load", () => collect());
  addEventListener("pageshow", (e) => {
    // When restored from BFCache, re-measure immediately
    if ((e as PageTransitionEvent).persisted) collect();
  });
}
