// Depends on /src/scripts/plugins/nativebootstrap.js being loaded first.
// Replaces: loadjs.ready('nativebootstrap', fn)

(() => {
  const w = window;
  HW.$html = HW.$html || document.documentElement;

  HW.triggerEvent =
    HW.triggerEvent ||
    function (el, name) {
      if (!el) return;
      el.dispatchEvent(new Event(name, { bubbles: true }));
    };

  function init() {
    HW.headerAnim = false;

    HW.$mainnav = document.getElementById("main-nav");

    if (HW.$mainnav !== null) {
      // ! Toggle Menu Item Class
      const toggles = $$(".nav-toggle");
      if (toggles.length > 0) {
        toggles[0].addEventListener("click", function () {
          if (HW.headerAnim === true) return false;

          HW.headerAnim = true;

          const $me = this;

          HW.$mainnav.classList.toggle("showing");
          $me.classList.toggle("active");

          if (HW.$html.classList.contains("hw-slide-msg-show")) {
            const $slidemsgclose = document.getElementById("hw-slide-msg-close");

            if (typeof HW.setHeaderVar === "function") {
              HW.setHeaderVar();
            }

            document.documentElement.style.setProperty("--slideMsgHeight", "0px");

            HW.triggerEvent($slidemsgclose, "click");
          }
        });
      }

      // Bootstrap collapse lifecycle hooks (from Native Bootstrap)
      HW.$mainnav.addEventListener("hidden.bs.collapse", function () {
        HW.isClosing = false;
        HW.headerAnim = false;
      });

      HW.$mainnav.addEventListener("shown.bs.collapse", function () {
        HW.headerAnim = false;
      });

      HW.$mainnav.addEventListener("show.bs.collapse", function () {
        document.documentElement.classList.add("mob-menu-open");
      });

      HW.$mainnav.addEventListener("hide.bs.collapse", function () {
        document.documentElement.classList.remove("mob-menu-open");
      });
    }
  }

  // Ensure DOM is ready before running
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    queueMicrotask(init);
  }
})();
