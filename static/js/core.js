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
       Shape mirrors DeepCS as it runs today: a browser, one Worker doing the
       routing, its handlers, and what sits behind them. */
    var nodes = [
      { id: "client", x: 0.5, y: 0.08, r: 5.5, kind: "client", label: "browser" },
      { id: "edge", x: 0.5, y: 0.3, r: 7.5, kind: "edge", label: "worker" },
      { id: "auth", x: 0.19, y: 0.56, r: 5, kind: "svc", label: "verify" },
      { id: "gate", x: 0.5, y: 0.56, r: 5, kind: "svc", label: "gate" },
      { id: "pay", x: 0.81, y: 0.56, r: 5, kind: "svc", label: "payments" },
      { id: "d1", x: 0.5, y: 0.87, r: 6, kind: "store", label: "d1" },
      { id: "stripe", x: 0.83, y: 0.87, r: 6, kind: "store", label: "stripe" },
      { id: "firebase", x: 0.17, y: 0.87, r: 6, kind: "store", label: "firebase" }
    ];

    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });

    var edges = [
      ["client", "edge"],
      ["edge", "auth"],
      ["edge", "gate"],
      ["edge", "pay"],
      ["auth", "firebase"],
      ["auth", "gate"],
      ["gate", "d1"],
      ["pay", "d1"],
      ["pay", "stripe"]
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

      var cTeal = themeColor("--accent", "#4493f8");
      var cBorder = themeColor("--border-strong", "#46617f");
      var cAmber = themeColor("--amber", "#d29922");
      var cMuted = themeColor("--faint", "#7f93aa");

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
        g.addColorStop(1, "rgba(68,147,248,0)");
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
          ctx.fillText(n.label, x, y + n.r + 10);
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
