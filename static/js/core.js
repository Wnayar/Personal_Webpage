/* Core site behaviour: theme, nav, scroll reveal, hero + card canvases.
   No dependencies. Every animation respects prefers-reduced-motion. */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Theme -------------------------------------------------------------- */

  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("wn-theme", next);
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    });
  }

  /* --- Mobile nav --------------------------------------------------------- */

  var burger = document.getElementById("nav-burger");
  var links = document.getElementById("nav-links");

  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* --- Sticky nav border -------------------------------------------------- */

  var nav = document.getElementById("site-nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --- Footer year -------------------------------------------------------- */

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* --- Scroll reveal ------------------------------------------------------ */

  var revealables = document.querySelectorAll(".reveal, .tl-item");
  if (revealables.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      revealables.forEach(function (el) {
        el.classList.add("is-in");
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealables.forEach(function (el) {
        io.observe(el);
      });
    }
  }

  /* --- Pointer-tracked card glow ------------------------------------------ */

  document.querySelectorAll(".syscard").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });

  /* --- Role typewriter ---------------------------------------------------- */

  var roleEl = document.querySelector("[data-typewriter]");
  if (roleEl) {
    var phrases = JSON.parse(roleEl.getAttribute("data-typewriter"));
    var out = roleEl.querySelector(".hero__role-text");

    if (reduced) {
      out.textContent = phrases[0];
    } else {
      var pi = 0;
      var ci = 0;
      var deleting = false;

      var tick = function () {
        var full = phrases[pi];
        ci += deleting ? -1 : 1;
        out.textContent = full.slice(0, ci);

        var delay = deleting ? 34 : 62;
        if (!deleting && ci === full.length) {
          delay = 2100;
          deleting = true;
        } else if (deleting && ci === 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
          delay = 420;
        }
        setTimeout(tick, delay);
      };
      setTimeout(tick, 700);
    }
  }

  /* --- Canvas helper ------------------------------------------------------ */

  /* Sizes a canvas to its CSS box at device pixel ratio, and re-runs on resize.
     Returns a context whose coordinate space is CSS pixels. */
  function fitCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    var resize = function () {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.__w = r.width;
      canvas.__h = r.height;
    };
    resize();
    var ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return ctx;
  }

  /* Reads a CSS custom property so canvases follow the active theme. */
  function themeColor(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* Runs a draw loop only while the canvas is on screen. */
  function runWhenVisible(canvas, frame) {
    var visible = false;
    var raf = null;

    var loop = function (t) {
      frame(t);
      raf = requestAnimationFrame(loop);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        /* With reduced motion the visual is a still frame, so draw once and
           never start a loop. */
        if (entry.isIntersecting && reduced) {
          frame(0);
          io.unobserve(canvas);
          return;
        }
        if (entry.isIntersecting && !visible) {
          visible = true;
          raf = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting && visible) {
          visible = false;
          if (raf) cancelAnimationFrame(raf);
        }
      });
    });
    io.observe(canvas);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!document.hidden && visible && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
  }

  /* --- Hero: the three things I've started -------------------------------
     Two founded, one won. Each marker climbs off the baseline and holds
     there, which is the point: things that got started and stayed up. */

  var hero = document.getElementById("hero-canvas");
  if (hero) {
    var ctx = fitCanvas(hero);

    var MONO = 'ui-monospace, "JetBrains Mono", monospace';
    var LAUNCHES = [
      { name: "DeepCS", note: "founded", h: 0.94, won: false },
      { name: "Aqua Vitae", note: "founded", h: 0.56, won: false },
      { name: "Airlock", note: "1st place", h: 0.78, won: true }
    ];

    var CYCLE = 7600;   /* one full climb-and-hold, in ms */
    var STAGGER = 620;  /* so they do not all leave the ground together */

    runWhenVisible(hero, function (time) {
      var w = hero.__w;
      var h = hero.__h;
      if (!w || !h) return;

      var accent = themeColor("--accent", "#4493f8");
      var amber = themeColor("--amber", "#d29922");
      var border = themeColor("--border-strong", "#46617f");
      var text2 = themeColor("--text-2", "#aec9ee");
      var faint = themeColor("--faint", "#7f93aa");

      ctx.clearRect(0, 0, w, h);

      var labels = w > 260;
      var base = h * (labels ? 0.74 : 0.86);
      var span = base - h * 0.13;

      /* The ground everything leaves from. */
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, base);
      ctx.lineTo(w * 0.94, base);
      ctx.stroke();
      ctx.globalAlpha = 1;

      LAUNCHES.forEach(function (it, i) {
        var x = w * (0.2 + i * 0.3);
        var col = it.won ? amber : accent;

        var climb = 1;
        var fade = 1;
        if (!reduced) {
          var t = (((time - i * STAGGER) % CYCLE) + CYCLE) % CYCLE / CYCLE;
          /* Climb over the first quarter, hold, then fade out and repeat. */
          climb = t < 0.26 ? 1 - Math.pow(1 - t / 0.26, 3) : 1;
          fade = t > 0.9 ? 1 - (t - 0.9) / 0.1 : 1;
        }

        var y = base - span * it.h * climb;
        var r = 4.6;

        /* Trail, fading out towards the ground it came from. */
        if (y < base - 1) {
          var grad = ctx.createLinearGradient(x, base, x, y);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, col);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.6 * fade;
          ctx.beginPath();
          ctx.moveTo(x, base);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        /* Marker: a soft halo, a ring, and a solid core. */
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.14 * fade * climb;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.85 * fade;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x, y, 9.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        /* A tick on the baseline, so the start point stays visible. */
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, base - 3);
        ctx.lineTo(x, base + 3);
        ctx.stroke();

        if (labels) {
          ctx.globalAlpha = 1;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = text2;
          ctx.font = '600 11px ' + MONO;
          ctx.fillText(it.name, x, base + 16);
          ctx.fillStyle = it.won ? amber : faint;
          ctx.font = '10px ' + MONO;
          ctx.fillText(it.note, x, base + 32);
        }
      });

      ctx.globalAlpha = 1;
    });
  }

  /* --- Small per-card visuals -------------------------------------------- */

  document.querySelectorAll("[data-card-viz]").forEach(function (canvas) {
    var kind = canvas.getAttribute("data-card-viz");
    var c = fitCanvas(canvas);

    runWhenVisible(canvas, function (time) {
      var w = canvas.__w;
      var h = canvas.__h;
      if (!w || !h) return;

      var teal = themeColor("--accent", "#4493f8");
      var amber = themeColor("--amber", "#d29922");
      var border = themeColor("--border-strong", "#46617f");
      var t = reduced ? 0 : time / 1000;

      c.clearRect(0, 0, w, h);

      if (kind === "deepcs") {
        /* One node at the centre answering everything: requests arrive from
           every direction and are served from the same single place. */
        var cx = w / 2;
        var cy = h / 2;
        var ring = Math.min(w, h) * 0.34;
        var pts = 5;

        c.strokeStyle = border;
        c.lineWidth = 1;
        for (var s = 0; s < pts; s++) {
          var ang = (s / pts) * Math.PI * 2 - Math.PI / 2;
          c.beginPath();
          c.moveTo(cx + Math.cos(ang) * ring, cy + Math.sin(ang) * ring);
          c.lineTo(cx, cy);
          c.stroke();
        }

        for (var s2 = 0; s2 < pts; s2++) {
          var a2 = (s2 / pts) * Math.PI * 2 - Math.PI / 2;
          c.fillStyle = border;
          c.globalAlpha = 0.75;
          c.beginPath();
          c.arc(cx + Math.cos(a2) * ring, cy + Math.sin(a2) * ring, 3, 0, Math.PI * 2);
          c.fill();

          /* In on the way there, back out on the way home. */
          var ph = (t * 0.4 + s2 / pts) % 1;
          var inbound = ph < 0.5;
          var leg = inbound ? ph * 2 : (ph - 0.5) * 2;
          var travel = inbound ? 1 - leg : leg;
          c.fillStyle = inbound ? teal : amber;
          c.globalAlpha = Math.sin(leg * Math.PI) * 0.85 + 0.15;
          c.beginPath();
          c.arc(cx + Math.cos(a2) * ring * travel, cy + Math.sin(a2) * ring * travel, 2.8, 0, Math.PI * 2);
          c.fill();
        }

        c.globalAlpha = 0.14;
        c.fillStyle = teal;
        c.beginPath();
        c.arc(cx, cy, 16, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = teal;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(cx, cy, 10, 0, Math.PI * 2);
        c.stroke();
      } else if (kind === "aquavitae") {
        /* A storefront funnel: visitors arrive across three lanes, narrow
           through one checkout, and a few come out the other side as orders. */
        var midY2 = h / 2;
        var neckX = w * 0.62;
        var lanes = [-1, 0, 1];

        c.lineWidth = 1;
        lanes.forEach(function (lane) {
          var y0 = midY2 + lane * 17;
          c.strokeStyle = border;
          c.beginPath();
          c.moveTo(10, y0);
          c.lineTo(neckX - 26, y0);
          c.quadraticCurveTo(neckX - 12, y0, neckX, midY2);
          c.stroke();
        });

        c.strokeStyle = border;
        c.beginPath();
        c.moveTo(neckX, midY2);
        c.lineTo(w - 10, midY2);
        c.stroke();

        /* The checkout: bought, not built, so it is drawn as one solid block. */
        c.globalAlpha = 0.16;
        c.fillStyle = amber;
        c.fillRect(neckX - 4, midY2 - 13, 8, 26);
        c.globalAlpha = 0.9;
        c.strokeStyle = amber;
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(neckX, midY2 - 13);
        c.lineTo(neckX, midY2 + 13);
        c.stroke();
        c.globalAlpha = 1;

        for (var v = 0; v < 6; v++) {
          var lane2 = lanes[v % 3];
          var vp = (t * 0.3 + v / 6) % 1;
          /* Only a couple of the six make it past the neck, which is what a
             real funnel looks like. */
          var converts = v % 3 === 0;
          if (!converts && vp > 0.58) continue;

          var vx, vy;
          if (vp < 0.58) {
            vx = 10 + (neckX - 10) * (vp / 0.58);
            var pinch = Math.max(0, (vx - (neckX - 26)) / 26);
            vy = midY2 + lane2 * 17 * (1 - pinch);
          } else {
            vx = neckX + (w - 10 - neckX) * ((vp - 0.58) / 0.42);
            vy = midY2;
          }
          c.fillStyle = vp < 0.58 ? teal : amber;
          c.globalAlpha = vp < 0.58 ? 0.8 : 0.95;
          c.beginPath();
          c.arc(vx, vy, vp < 0.58 ? 2.6 : 3.4, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      } else if (kind === "airlock") {
        /* A gate: packages approach, one is stopped at the barrier. */
        var gateX = w * 0.62;
        c.strokeStyle = border;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, h / 2);
        c.lineTo(w, h / 2);
        c.stroke();

        c.strokeStyle = teal;
        c.lineWidth = 2;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(gateX, h * 0.16);
        c.lineTo(gateX, h * 0.84);
        c.stroke();
        c.globalAlpha = 0.12;
        c.fillStyle = teal;
        c.fillRect(gateX - 3, h * 0.16, 6, h * 0.68);
        c.globalAlpha = 1;

        for (var i = 0; i < 3; i++) {
          var ph = (t * 0.36 + i / 3) % 1;
          var blocked = i === 1;
          var travel = blocked ? Math.min(ph, 0.52) : ph;
          var x = travel * w;
          var col = blocked && ph > 0.5 ? themeColor("--red", "#f85149") : teal;
          c.fillStyle = col;
          c.globalAlpha = blocked && ph > 0.5 ? 0.55 + Math.sin(t * 9) * 0.3 : 0.9;
          c.fillRect(x - 5, h / 2 - 5, 10, 10);
          c.globalAlpha = 1;
        }
      }
    });
  });

  /* --- Section spy for the systems sub-nav -------------------------------- */

  var spyLinks = document.querySelectorAll("[data-spy]");
  if (spyLinks.length && "IntersectionObserver" in window) {
    var sections = [];
    spyLinks.forEach(function (link) {
      var el = document.querySelector(link.getAttribute("href"));
      if (el) sections.push({ el: el, link: link });
    });

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          spyLinks.forEach(function (l) {
            l.classList.remove("is-active");
          });
          var match = sections.find(function (s) {
            return s.el === entry.target;
          });
          if (match) match.link.classList.add("is-active");
        });
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s.el);
    });
  }

  /* Expose helpers to the lab scripts. */
  window.WN = { fitCanvas: fitCanvas, themeColor: themeColor, reduced: reduced, runWhenVisible: runWhenVisible };
})();
