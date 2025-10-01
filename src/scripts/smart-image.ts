// Native lazy loader for <img.hw-lazy-img>
// - Critical images:
//     * If rendered with real src/srcset -> browser loads immediately (best).
//     * If (for whatever reason) rendered with data-src* AND .critical -> we upgrade them immediately here.
// - Non-critical images: lazy via IntersectionObserver.
// - On load: add .lazy-loaded to the <img>, mark closest .img-load-par with
//            .child-lazy-loaded, and additionally .crit-child-lazy-loaded if fetchpriority="high".

(() => {
  if (typeof window === "undefined") return;

  const SELECTOR_IMG = "img.hw-lazy-img",
        SELECTOR_LAZY = `${SELECTOR_IMG}[data-src]:not(.critical)`,
        SELECTOR_CRIT_DEFERRED = `${SELECTOR_IMG}.critical[data-src]`, // promote immediately
        SELECTOR_CRIT_FETCH = `${SELECTOR_IMG}[fetchpriority="high"]`,
        PARENT_CLASS_ON_LOAD = "child-lazy-loaded",
        PARENT_CLASS_ON_CRIT = "crit-child-lazy-loaded",
        IO_ROOT_MARGIN = "200px";

  const qsa = (root: ParentNode, sel: string) =>
          Array.from(root.querySelectorAll<HTMLImageElement>(sel)),
        isCritFetch = (img: HTMLImageElement) =>
          (img.getAttribute("fetchpriority") || "").toLowerCase() === "high";

  function upgrade(img: HTMLImageElement) {
    const { src: ds, srcset: dss, sizes: dsz } = img.dataset as {
      src?: string; srcset?: string; sizes?: string;
    };
    if (ds)  img.src = ds;
    if (dss) img.srcset = dss;
    if (dsz) img.sizes = dsz;
    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
    img.removeAttribute("data-sizes");

    // If the image is already complete right after upgrade (cache hit), mark it now.
    if (img.complete && img.naturalWidth > 0) markLoaded(img);
  }

  function tagParent(img: HTMLImageElement) {
    const parent = img.closest<HTMLElement>(".img-load-par");
    if (!parent) return;
    parent.classList.add(PARENT_CLASS_ON_LOAD);
    if (isCritFetch(img)) parent.classList.add(PARENT_CLASS_ON_CRIT);
  }

  function markLoaded(img: HTMLImageElement) {
    // Add class to the image itself
    img.classList.add("lazy-loaded");
    // Fire a custom event for any listeners
    img.dispatchEvent(new CustomEvent("smartimage:loaded", { bubbles: true }));
    // Tag the parent container
    tagParent(img);
  }

  // ---- Load/error listener (capture) ----
  function onLoadedOrError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (!img?.matches?.(SELECTOR_IMG)) return;

    if (e.type === "load") {
      markLoaded(img);
    } else {
      img.dispatchEvent(new CustomEvent("smartimage:error", { bubbles: true }));
    }
  }
  document.addEventListener("load", onLoadedOrError, true);
  document.addEventListener("error", onLoadedOrError, true);

  // ---- IO lazy-load for non-critical images ----
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const img = ent.target as HTMLImageElement;
          upgrade(img);
          io!.unobserve(img);
        }
      }, { rootMargin: IO_ROOT_MARGIN })
    : null;

  const observeLazy = (img: HTMLImageElement) => {
    if (!img.matches(SELECTOR_LAZY)) return;
    if (io) io.observe(img);
    else upgrade(img); // fallback: load now
  };

  // ---- Initial pass ----
  qsa(document, SELECTOR_CRIT_DEFERRED).forEach(upgrade); // immediate promotion
  qsa(document, SELECTOR_LAZY).forEach(observeLazy);

  // Handle already-complete criticals (e.g., cache hits or above-the-fold)
  qsa(document, SELECTOR_CRIT_FETCH).forEach((img) => {
    if (img.complete && img.naturalWidth > 0) markLoaded(img);
  });

  // ---- Handle images added later (carousels, hydrated islands, etc.) ----
  function handleElement(el: Element) {
    // Query within the element to avoid scanning the whole DOM repeatedly
    qsa(el, SELECTOR_CRIT_DEFERRED).forEach(upgrade);
    qsa(el, SELECTOR_LAZY).forEach(observeLazy);

    qsa(el, SELECTOR_CRIT_FETCH).forEach((img) => {
      if (img.complete && img.naturalWidth > 0) markLoaded(img);
    });

    // If the added node itself is an <img>, handle it directly
    if (el.matches?.(SELECTOR_IMG)) {
      const img = el as HTMLImageElement;
      if (img.matches(SELECTOR_CRIT_DEFERRED)) upgrade(img);
      else if (img.matches(SELECTOR_LAZY)) observeLazy(img);

      if (img.matches(SELECTOR_CRIT_FETCH) && img.complete && img.naturalWidth > 0) {
        markLoaded(img);
      }
    }
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) handleElement(n);
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
