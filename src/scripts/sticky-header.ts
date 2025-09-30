// /src/scripts/sticky-header.ts
import { animate } from "motion";

type StickyState = {
  installed: boolean;
  header: HTMLElement | null;
  hidden: boolean;
  lastY: number;
  ticking: boolean;
  currentAnim?: ReturnType<typeof animate>;
  observer?: MutationObserver;
};

declare global { interface Window { __stickyHeaderState?: StickyState } }

export default function initStickyHeader() {
  // Respect reduced motion: keep header visible, skip animations/listeners.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Singleton guard
  const S = (window.__stickyHeaderState ??=
    { installed: false, header: null, hidden: false, lastY: 0, ticking: false });

  if (S.installed) return;
  S.installed = true;

  // Tunables
  const HIDE_Y = "-100%";
  const SHOW_Y = "0%";
  const HIDE_AFTER = 64;
  const DOWN_THRESHOLD = 12;
  const UP_THRESHOLD = 6;

  const scroller = document.scrollingElement || document.documentElement;

  const getY = () => (scroller?.scrollTop ?? window.scrollY) || 0;

  function setHidden(nextHidden: boolean) {
    if (S.hidden === nextHidden) return;
    S.hidden = nextHidden;
    S.currentAnim?.cancel?.();
    if (!S.header) return;
    S.currentAnim = animate(
      S.header,
      { transform: `translateY(${S.hidden ? HIDE_Y : SHOW_Y})` },
      { duration: 0.22 }
    );
  }

  function onScrollRaf() {
    const y = getY();
    const dy = y - S.lastY;

    // --- existing hide/show logic ---
    if (dy > DOWN_THRESHOLD && y > HIDE_AFTER) setHidden(true);
    else if (dy < -UP_THRESHOLD) setHidden(false);
    else if (y <= 0) setHidden(false);

    // --- new CSS variable logic ---
    if (S.header) {
      // clamp between 0 and 1
      const progress = Math.min(1, Math.max(0, y / 100));
      S.header.style.setProperty("--bannerScroll", String(progress));
    }

    S.lastY = y;
    S.ticking = false;
  }

  function onScroll() {
    if (S.ticking) return;
    S.ticking = true;
    requestAnimationFrame(onScrollRaf);
  }

  function bindHeader(el: HTMLElement) {
    // If same node, just recompute
    if (S.header === el) {
      // wait for layout / restored scroll position
      requestAnimationFrame(() => requestAnimationFrame(onScrollRaf));
      return;
    }

    // Cancel anim on old node
    S.currentAnim?.cancel?.();

    // Swap to new node
    S.header = el;
    S.hidden = false;
    S.lastY = getY();

    // Clear any old transform
    S.header.style.transform = "";

    // Initial compute after layout & scroll restore
    requestAnimationFrame(() => requestAnimationFrame(onScrollRaf));
  }

  function findHeader(): HTMLElement | null {
    return document.getElementById("header");
  }

  function watchForHeader() {
    // set immediately if present
    const now = findHeader();
    if (now) bindHeader(now);

    // (re)create observer
    S.observer?.disconnect?.();
    S.observer = new MutationObserver(() => {
      // If we lost the node or a new one appeared (e.g., after swap)
      if (!S.header || !document.body.contains(S.header)) {
        const el = findHeader();
        if (el) bindHeader(el);
      }
    });

    S.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Initial bind & listeners
  watchForHeader();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });

  // Astro view transitions / navigations
  addEventListener("astro:before-swap", () => {
    S.currentAnim?.cancel?.();
    if (S.header) S.header.style.transform = "";
  });
  addEventListener("astro:after-swap", watchForHeader as EventListener);
  addEventListener("astro:page-load", watchForHeader as EventListener);

  // History navigation + BFCache
  addEventListener("popstate", watchForHeader as EventListener);
  addEventListener("pageshow", (e: PageTransitionEvent) => {
    if (e.persisted) watchForHeader();
    else requestAnimationFrame(onScrollRaf);
  });

  // If tab becomes visible again, ensure bound & recomputed
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") watchForHeader();
  });
}
