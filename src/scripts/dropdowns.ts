// Defensive guards for SSR and re-initialization
export default function initDropdowns(root: HTMLElement | Document = document) {
  if (typeof window === "undefined") return;

  // Avoid double-binding (HMR or multiple component mounts)
  const FLAG = "data-dropdowns-init";
  const container = (root instanceof Document ? root.documentElement : root);
  if ((container as HTMLElement).hasAttribute(FLAG)) return;
  (container as HTMLElement).setAttribute(FLAG, "true");

  // Helper fallbacks if your project doesn't define $$ / debounce / HW.*
  const $$ = (sel: string, ctx: ParentNode | Document = document) =>
    Array.from(ctx.querySelectorAll<HTMLElement>(sel));

  const debounce = (fn: (...args: any[]) => void, ms = 50) => {
    let t: number | undefined;
    return (...args: any[]) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), ms);
    };
  };

  const requestTimeout = (cb: () => void, ms: number) => window.setTimeout(cb, ms);

  const htmlEl = document.documentElement;
  const siteHeader = document.querySelector<HTMLElement>('#header');

  const items = $$('.main-menu-item.menu-item-has-children', root as ParentNode);
  const isHoverCapable = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  items.forEach((el) => {
    const sub = el.querySelector<HTMLElement>(':scope > .sub-menu-wrap');
    const trigger = el.querySelector<HTMLAnchorElement>(':scope > a');
    if (!trigger) return;

    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const open = () => {
      el.classList.add('hovered');
      htmlEl.classList.add('dropdown-hovered');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      if (!el.classList.contains('hovered')) return;
      el.classList.add('hiding');
      htmlEl.classList.remove('dropdown-hovered');
      requestTimeout(() => {
        el.classList.remove('hovered', 'hiding');
        trigger.setAttribute('aria-expanded', 'false');
      }, 170);
    };

    const closeSiblings = () => {
      items.forEach((other) => {
        if (other !== el) {
          other.classList.remove('hovered', 'hiding');
          const otherTrigger = other.querySelector<HTMLAnchorElement>(':scope > a');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    };

    if (isHoverCapable) {
      el.addEventListener(
        'pointerenter',
        debounce((e: PointerEvent) => {
          if (window.innerWidth < 1025) return;
          if ((e.relatedTarget as Node) && el.contains(e.relatedTarget as Node)) return;
          if (sub && sub.contains(e.target as Node)) return;
          open();
        }, 40)
      );

      el.addEventListener(
        'pointerleave',
        debounce(() => {
          if (window.innerWidth < 1025) return;
          close();
        }, 40)
      );
    }

    trigger.addEventListener('pointerup', (e) => {
      const isCoarse = (e as PointerEvent).pointerType === 'touch' || (e as PointerEvent).pointerType === 'pen';
      if (window.innerWidth < 1025 || isCoarse || !isHoverCapable) {
        if (!el.classList.contains('hovered')) {
          e.preventDefault();
          closeSiblings();
          open();
        } else {
          const href = trigger.getAttribute('href');
          if (!href || href === '#') {
            e.preventDefault();
            close();
          }
        }
      }
    });

    if (sub) {
      sub.addEventListener('pointerup', (e) => {
        e.stopPropagation();
      });
    }

    document.addEventListener('pointerdown', (e) => {
      if (!el.contains(e.target as Node)) close();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
      }
      if ((e.key === 'Enter' || e.key === ' ') && window.innerWidth < 1025) {
        e.preventDefault();
        if (el.classList.contains('hovered')) {
          close();
        } else {
          closeSiblings();
          open();
        }
      }
    });
  });
}
