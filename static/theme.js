/**
 * Site theme: dark (default) / light. Stored in sessionStorage so each new
 * browser session starts in dark mode; the toggle still lasts for the tab.
 */
(function () {
  const STORAGE_KEY = "wn-site-theme";
  const root = document.documentElement;

  function setTheme(mode) {
    const t = mode === "light" ? "light" : "dark";
    root.setAttribute("data-theme", t);
    try {
      sessionStorage.setItem(STORAGE_KEY, t);
    } catch (e) {
      /* ignore */
    }
    const nav = document.querySelector("nav.site-navbar");
    if (nav) {
      nav.classList.remove("navbar-dark", "navbar-light");
      nav.classList.add(t === "light" ? "navbar-light" : "navbar-dark");
    }
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute(
        "aria-label",
        t === "light" ? "Switch to dark mode" : "Switch to light mode",
      );
      btn.setAttribute("title", t === "light" ? "Dark mode" : "Light mode");
      const moon = btn.querySelector('[data-theme-icon="dark"]');
      const sun = btn.querySelector('[data-theme-icon="light"]');
      const isDark = t === "dark";
      if (moon && sun) {
        moon.hidden = isDark;
        sun.hidden = !isDark;
      }
    }

    syncGithubStatsImage(t);
    document.dispatchEvent(new CustomEvent("sitethemechange", { detail: { theme: t } }));
  }

  function syncGithubStatsImage(theme) {
    var el = document.querySelector('img[data-github-stats="top-langs"]');
    if (!el || !el.src) return;
    try {
      var u = new URL(el.src, window.location.origin);
      if (theme === "light") {
        u.searchParams.set("bg_color", "f8fafc");
        u.searchParams.set("border_color", "cbd5e1");
        u.searchParams.set("text_color", "1e293b");
        u.searchParams.set("title_color", "0f766e");
        u.searchParams.delete("theme");
      } else {
        u.searchParams.set("bg_color", "0f0f0f");
        u.searchParams.set("border_color", "1a1a1a");
        u.searchParams.set("text_color", "e6e6e6");
        u.searchParams.set("title_color", "14b8a6");
        u.searchParams.set("theme", "dark");
      }
      el.src = u.toString();
    } catch (e) {
      /* ignore */
    }
  }

  function storedOrDefault() {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s === "light" || s === "dark") return s;
    } catch (e) {
      /* ignore */
    }
    return "dark";
  }

  var initial = storedOrDefault();
  setTheme(initial);

  document.getElementById("theme-toggle")?.addEventListener("click", function () {
    const cur = root.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  });
})();
