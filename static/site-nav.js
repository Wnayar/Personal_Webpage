/**
 * Collapse the mobile nav menu when the user scrolls so it doesn't stay open.
 * Opening the menu changes layout (sticky bar grows), which can fire scroll events;
 * we ignore those via the collapsing state + a short grace period after open.
 */
(function () {
  function init() {
    var el = document.getElementById("navbarSupportedContent");
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Collapse) return;

    var collapse = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
    var lastY = window.scrollY;
    /** Ignore programmatic / layout scroll until this time (ms since epoch). */
    var ignoreCloseUntil = 0;

    el.addEventListener("show.bs.collapse", function () {
      lastY = window.scrollY;
      /* Match CSS collapse duration (~500ms) + buffer for layout scroll */
      ignoreCloseUntil = Date.now() + 560;
    });

    el.addEventListener("shown.bs.collapse", function () {
      lastY = window.scrollY;
      ignoreCloseUntil = Date.now() + 400;
    });

    window.addEventListener(
      "scroll",
      function () {
        if (!el.classList.contains("show")) {
          lastY = window.scrollY;
          return;
        }
        if (el.classList.contains("collapsing")) {
          lastY = window.scrollY;
          return;
        }
        if (Date.now() < ignoreCloseUntil) {
          lastY = window.scrollY;
          return;
        }

        var y = window.scrollY;
        if (Math.abs(y - lastY) > 10) {
          collapse.hide();
        }
        lastY = y;
      },
      { passive: true },
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
