// src/components/ui/ResponsiveFlickity.tsx
import React, { useEffect, useLayoutEffect, useRef, useState, PropsWithChildren } from "react";

// Type is minimal to avoid importing Flickity types on the server
type FlickityInstance = {
  resize: () => void;
  destroy: () => void;
  on: (evt: string, cb: (...args: any[]) => void) => void;
  off: (evt?: string, cb?: (...args: any[]) => void) => void;
};

type Props = {
  /** Layout number used for responsive enabling logic */
  layout: number;
  /** Outer classes – the Flickity root will be this element */
  className?: string;
  /** Unused here but kept for parity with your template */
  moduleClass?: string;
  /** Extra Flickity options (merged over base) */
  options?: Record<string, any>;
};

export default function ResponsiveFlickity({
  layout,
  className = "",
  options = {},
  children,
}: PropsWithChildren<Props>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const flktyRef = useRef<FlickityInstance | null>(null);
  const [shouldEnable, setShouldEnable] = useState(false);

  // ---- decide whether to enable Flickity based on layout + window width
  useEffect(() => {
    if (typeof window === "undefined") return;
    const decide = () => {
      const w = window.innerWidth;
      if (layout === 4) return setShouldEnable(w < 1520);
      if (layout === 2) return setShouldEnable(w < 700);
      // other layouts: always enable
      setShouldEnable(true);
    };
    decide();
    window.addEventListener("resize", decide, { passive: true });
    return () => window.removeEventListener("resize", decide);
  }, [layout]);

  // ---- equalize/measure helpers
  function equalizeHeights(root: HTMLElement) {
    // Equalize per-card height and set viewport height
    const cells = Array.from(root.querySelectorAll<HTMLElement>(".img-card-item"));
    if (!cells.length) return;

    // clear inline height first
    cells.forEach((c) => (c.style.height = ""));

    const tallest = cells.reduce((m, c) => Math.max(m, c.offsetHeight || 0), 0);

    // apply equal height
    cells.forEach((c) => (c.style.height = `${tallest}px`));

    // set Flickity viewport height if present
    const viewport = root.querySelector<HTMLElement>(".flickity-viewport");
    if (viewport) {
      // some padding from your CSS variable may exist; fallback safely
      viewport.style.height = `${tallest}px`;
    }
  }

  // ---- scheduled measurement to avoid re-entrancy
  let measuring = false;
  const scheduleMeasure = (doResize: boolean) => {
    if (measuring) return;
    measuring = true;
    requestAnimationFrame(() => {
      const root = rootRef.current;
      const flkty = flktyRef.current;
      if (!root) {
        measuring = false;
        return;
      }
      if (doResize && flkty) {
        try {
          flkty.resize();
        } catch {}
      }
      equalizeHeights(root);
      measuring = false;
    });
  };

  // ---- Initialize/Destroy Flickity
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    if (!root) return;

    // If we should NOT enable, just make sure Flickity is destroyed and exit
    if (!shouldEnable) {
      if (flktyRef.current) {
        try {
          flktyRef.current.off?.();
          flktyRef.current.destroy();
        } catch {}
        flktyRef.current = null;
      }
      // When not enabled, still equalize so the layout is stable
      scheduleMeasure(false);
      return;
    }

    // Already initialized? just re-measure
    if (flktyRef.current) {
      scheduleMeasure(true);
      return;
    }

    let FlickityCtor: any = null;

    let cancelled = false;
    (async () => {
      // dynamic import to avoid SSR "window is not defined"
      const mod = await import("flickity");
      if (cancelled) return;
      FlickityCtor = mod.default || mod;

      // base options (merge with user options)
      const baseOptions = {
        wrapAround: true,
        pageDots: true,
        contain: true,
        prevNextButtons: false,
        autoPlay: false,
        cellAlign: "left",
        selectedAttraction: 0.055,
        friction: 0.35,
        // Important: do NOT set 'draggable: false' unless you want to disable drag.
        ...options,
      };

      // Init Flickity on the SAME element that has your classes
      const instance: FlickityInstance = new (FlickityCtor as any)(root, baseOptions);
      flktyRef.current = instance;

      // Safe event handlers: never call instance.resize() from select/settle directly
      instance.on("ready", () => scheduleMeasure(true));
      instance.on("select", () => scheduleMeasure(false));
      instance.on("settle", () => scheduleMeasure(false));

      // Re-measure on image load (heights will change)
      const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
      imgs.forEach((img) => {
        if (img.complete) return;
        const onImg = () => scheduleMeasure(true);
        img.addEventListener("load", onImg, { once: true });
        img.addEventListener("error", onImg, { once: true });
      });

      // First paint fallback
      requestAnimationFrame(() => scheduleMeasure(true));
    })();

    // window resize → OK to resize
    const onWinResize = () => scheduleMeasure(true);
    window.addEventListener("resize", onWinResize, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onWinResize);
      if (flktyRef.current) {
        try {
          flktyRef.current.off?.();
          flktyRef.current.destroy();
        } catch {}
        flktyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldEnable, options]);

  // Render ONE element that is both the Flickity root and has your classes + "hw-slides"
  return (
    <div ref={rootRef} className={`${className} hw-slides`}>
      {children}
    </div>
  );
}
