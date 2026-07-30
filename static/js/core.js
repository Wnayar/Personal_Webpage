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

  /* --- Hero: request flowing through a service graph ---------------------- */

  var hero = document.getElementById("hero-canvas");
  if (hero) {
    var ctx = fitCanvas(hero);

    /* Layout is in normalised 0..1 space so it scales with the box.
       Shape mirrors the DeepCS topology: one edge, a fan of services, two stores. */
    var nodes = [
      { id: "client", x: 0.5, y: 0.08, r: 5.5, kind: "client", label: "browsers" },
      { id: "gw", x: 0.5, y: 0.3, r: 7.5, kind: "edge", label: "gateway" },
      { id: "users", x: 0.15, y: 0.56, r: 5, kind: "svc", label: "users" },
      { id: "questions", x: 0.38, y: 0.56, r: 5, kind: "svc", label: "questions" },
      { id: "matching", x: 0.62, y: 0.56, r: 5, kind: "svc", label: "matching" },
      { id: "collab", x: 0.85, y: 0.56, r: 5, kind: "svc", label: "collab" },
      { id: "pg", x: 0.32, y: 0.87, r: 6, kind: "store", label: "postgres" },
      { id: "redis", x: 0.7, y: 0.87, r: 6, kind: "store", label: "redis" }
    ];

    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });

    var edges = [
      ["client", "gw"],
      ["gw", "users"],
      ["gw", "questions"],
      ["gw", "matching"],
      ["gw", "collab"],
      ["users", "pg"],
      ["questions", "pg"],
      ["matching", "redis"],
      ["collab", "redis"],
      ["questions", "redis"]
    ];

    /* Each packet walks one edge, then hands off to a connected edge. */
    var packets = [];
    var spawnAt = 0;

    function spawn() {
      packets.push({
        e: 0,
        t: 0,
        speed: 0.006 + Math.random() * 0.005,
        hops: 1 + Math.floor(Math.random() * 2)
      });
    }

    function edgesFrom(nodeId) {
      var out = [];
      edges.forEach(function (e, i) {
        if (e[0] === nodeId) out.push(i);
      });
      return out;
    }

    runWhenVisible(hero, function (time) {
      var w = hero.__w;
      var h = hero.__h;
      if (!w || !h) return;

      var pad = 26;
      var px = function (n) {
        return pad + n.x * (w - pad * 2);
      };
      var py = function (n) {
        return pad + n.y * (h - pad * 2);
      };

      var cTeal = themeColor("--teal", "#2dd4bf");
      var cBorder = themeColor("--border-strong", "#2a3140");
      var cAmber = themeColor("--amber", "#fbbf24");
      var cMuted = themeColor("--faint", "#59616f");

      ctx.clearRect(0, 0, w, h);

      /* Edges */
      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var a = byId[e[0]];
        var b = byId[e[1]];
        ctx.strokeStyle = cBorder;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      /* Packets */
      if (!reduced && time - spawnAt > 620 && packets.length < 7) {
        spawnAt = time;
        spawn();
      }

      var arrivals = {};
      for (var i = packets.length - 1; i >= 0; i--) {
        var p = packets[i];
        p.t += p.speed;

        var e = edges[p.e];
        var a = byId[e[0]];
        var b = byId[e[1]];
        var x = px(a) + (px(b) - px(a)) * p.t;
        var y = py(a) + (py(b) - py(a)) * p.t;

        if (p.t >= 1) {
          arrivals[e[1]] = time;
          var next = edgesFrom(e[1]);
          if (p.hops > 0 && next.length) {
            p.e = next[Math.floor(Math.random() * next.length)];
            p.t = 0;
            p.hops--;
          } else {
            packets.splice(i, 1);
            continue;
          }
        }

        var g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, cTeal);
        g.addColorStop(1, "rgba(45,212,191,0)");
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = cTeal;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Nodes */
      nodes.forEach(function (n) {
        var x = px(n);
        var y = py(n);
        var hit = arrivals[n.id] ? 1 : 0;
        var pulse = hit ? 1 : 0.55 + Math.sin(time / 900 + n.x * 7) * 0.12;
        var color = n.kind === "store" ? cAmber : n.kind === "client" ? cMuted : cTeal;

        if (n.kind === "store") {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.ellipse(x, y, n.r + 2, n.r - 1, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.16 * pulse;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, n.r + 7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = n.kind === "client" ? 0.6 : 0.95;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, n.r * (n.kind === "edge" ? 0.62 : 0.5), 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.stroke();

        /* Labels make this read as an architecture rather than abstract dots. */
        if (n.label && w > 300) {
          ctx.globalAlpha = hit ? 0.95 : 0.5;
          ctx.fillStyle = color;
          ctx.font = '9px ui-monospace, "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.label, x, y + n.r + 6);
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

      var teal = themeColor("--teal", "#2dd4bf");
      var amber = themeColor("--amber", "#fbbf24");
      var border = themeColor("--border-strong", "#2a3140");
      var t = reduced ? 0 : time / 1000;

      c.clearRect(0, 0, w, h);

      if (kind === "deepcs") {
        /* Two replicas converging: same document, edits crossing between them. */
        var midY = h / 2;
        var lx = w * 0.2;
        var rx = w * 0.8;

        c.strokeStyle = border;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(lx, midY);
        c.lineTo(rx, midY);
        c.stroke();

        [lx, rx].forEach(function (x, idx) {
          c.fillStyle = idx === 0 ? teal : amber;
          c.globalAlpha = 0.15;
          c.beginPath();
          c.arc(x, midY, 17, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
          c.strokeStyle = idx === 0 ? teal : amber;
          c.lineWidth = 1.4;
          c.beginPath();
          c.arc(x, midY, 11, 0, Math.PI * 2);
          c.stroke();
        });

        for (var k = 0; k < 3; k++) {
          var phase = (t * 0.42 + k / 3) % 1;
          var dir = k % 2 === 0 ? 1 : -1;
          var pt = dir === 1 ? phase : 1 - phase;
          var x = lx + (rx - lx) * pt;
          var y = midY + Math.sin(phase * Math.PI) * 15 * dir;
          c.fillStyle = dir === 1 ? teal : amber;
          c.globalAlpha = Math.sin(phase * Math.PI) * 0.9 + 0.1;
          c.beginPath();
          c.arc(x, y, 3, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      } else if (kind === "recall") {
        /* Postings lists: rows of cells, a scan sweeping across the matches. */
        var rows = 4;
        var cols = 14;
        var cw = (w - 32) / cols;
        var rh = 13;
        var top = (h - rows * rh) / 2;
        var scan = ((t * 0.3) % 1) * cols;

        for (var r = 0; r < rows; r++) {
          for (var col = 0; col < cols; col++) {
            /* Deterministic "postings" pattern — no randomness per frame. */
            var on = (col * 7 + r * 3) % 5 === 0 || (col * 3 + r) % 11 === 0;
            var near = Math.abs(col - scan) < 1.6;
            c.fillStyle = on ? teal : border;
            c.globalAlpha = on ? (near ? 1 : 0.45) : 0.3;
            c.fillRect(16 + col * cw, top + r * rh, cw - 3, rh - 4);
          }
        }
        c.globalAlpha = 0.7;
        c.strokeStyle = amber;
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(16 + scan * cw, top - 5);
        c.lineTo(16 + scan * cw, top + rows * rh + 1);
        c.stroke();
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
          var col = blocked && ph > 0.5 ? themeColor("--red", "#f87171") : teal;
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
