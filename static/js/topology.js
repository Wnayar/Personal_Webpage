/* DeepCS architecture: one Cloudflare Worker at the edge.

   This draws the designed system. It is not wired to a deployment; the packets
   walk the request paths described in DESIGN.md. */

(function () {
  "use strict";

  var stage = document.getElementById("topo-stage");
  if (!stage) return;

  var reduced = (window.WN && window.WN.reduced) || false;
  var NS = "http://www.w3.org/2000/svg";

  var VIEW = "0 0 960 600";
  var ARIA =
    "DeepCS: a browser talks to a single Cloudflare Worker that routes, verifies the Firebase token, " +
    "enforces the paywall and handles Stripe webhooks. D1 sits behind it, with Firebase Auth and Stripe bought in.";

  var ZONES = [
    { x: 60, y: 130, w: 840, h: 250, label: "One Worker · one deployment, nothing running between requests", lx: 74, ly: 150 }
  ];

  var LEGEND = [
    { line: true, text: "request path" },
    { line: true, dash: true, text: "inside the Worker" },
    { text: "blue = bought" }
  ];

  var NODES = [
    {
      id: "client", label: "Browser", sub: "React app, from the edge",
      x: 350, y: 20, w: 260, h: 52, kind: "client", kindLabel: "Client",
      info: [
        ["Sends", "A Firebase ID token. Any user id it puts in the request is ignored."]
      ]
    },
    {
      id: "edge", label: "Worker entry", sub: "route · serve the app",
      idx: "1", x: 340, y: 172, w: 280, h: 56, kind: "svc", kindLabel: "The whole server",
      info: [
        ["Owns", "Routing, and the React bundle. One deployment, not six."],
        ["Costs", "Nothing at rest. There is no container to keep warm."]
      ]
    },
    {
      id: "auth", label: "Verify", sub: "Firebase JWT",
      idx: "2", x: 90, y: 296, w: 220, h: 64, kind: "svc", kindLabel: "Handler",
      info: [
        ["Owns", "Who the caller is. Nothing else answers that."],
        ["Rule", "The user id comes from the verified token, never from the request."]
      ]
    },
    {
      id: "gate", label: "Gate + serve", sub: "paywall · rate limit",
      idx: "3", x: 370, y: 296, w: 220, h: 64, kind: "svc", kindLabel: "Handler",
      info: [
        ["Owns", "Whether this user gets this content, and how often they may ask."],
        ["Server-side", "Paid content is not fetched and hidden. It is not sent."]
      ]
    },
    {
      id: "pay", label: "Payments", sub: "Stripe webhooks",
      idx: "4", x: 650, y: 296, w: 220, h: 64, kind: "svc", kindLabel: "Handler",
      info: [
        ["Owns", "The only path that can grant access."],
        ["Safe", "Signature checked first. Writes keyed on the event id, so a redelivery changes nothing."]
      ]
    },
    {
      id: "firebase", label: "Firebase Auth", sub: "identity",
      x: 100, y: 490, w: 200, h: 64, kind: "ext", kindLabel: "Bought",
      info: [
        ["Why", "Auth is solved. Issuing tokens is theirs, deciding what a user may do is mine."]
      ]
    },
    {
      id: "d1", label: "D1", sub: "users · entitlements · limits",
      x: 380, y: 490, w: 200, h: 64, kind: "store", kindLabel: "SQLite at the edge",
      info: [
        ["Holds", "Profiles, entitlements, rate-limit counters."],
        ["Replaces", "PostgreSQL and Redis, two managed instances, from v1."]
      ]
    },
    {
      id: "stripe", label: "Stripe", sub: "checkout · ledger",
      x: 660, y: 490, w: 200, h: 64, kind: "ext", kindLabel: "Bought",
      info: [
        ["Why", "Card details never touch my code."],
        ["Truth", "Stripe's ledger is authoritative. Entitlements can be rebuilt from it."]
      ]
    }
  ];

  var EDGES = [
    { id: "e1", from: "client", to: "edge", d: "M480,72 L480,172", type: "req" },
    { id: "e2", from: "edge", to: "auth", d: "M480,228 C480,264 200,256 200,296", type: "req" },
    { id: "e3", from: "edge", to: "gate", d: "M480,228 L480,296", type: "req" },
    { id: "e4", from: "edge", to: "pay", d: "M480,228 C480,264 760,256 760,296", type: "req" },
    { id: "e5", from: "auth", to: "gate", d: "M310,328 L370,328", type: "internal" },
    { id: "e6", from: "auth", to: "firebase", d: "M200,360 L200,490", type: "data" },
    { id: "e7", from: "gate", to: "d1", d: "M480,360 L480,490", type: "data" },
    { id: "e8", from: "pay", to: "d1", d: "M700,360 C662,428 604,468 566,502", type: "data" },
    { id: "e9", from: "stripe", to: "pay", d: "M800,490 L800,360", type: "data" },
    { id: "e10", from: "client", to: "stripe", d: "M610,46 C840,46 942,180 942,368 C942,462 916,502 862,514", type: "req" }
  ];

  var SCENARIOS = {
    request: {
      label: "A paid request",
      steps: [
        { nodes: ["client", "edge"], edges: ["e1"], text: "One Worker, one entry point. The code that serves the app also answers the API." },
        { nodes: ["auth", "firebase"], edges: ["e6"], text: "Firebase token verified against Google's JWKS. No key here can mint one." },
        { nodes: ["auth", "gate"], edges: ["e5"], text: "The user id comes from the token, not the request." },
        { nodes: ["gate", "d1"], edges: ["e7"], text: "Rate limit and entitlement, both in D1. No entitlement, no content." }
      ],
      close: "Every check the old six-service gateway did, with nothing running between requests."
    },
    pays: {
      label: "Someone pays",
      steps: [
        { nodes: ["client", "stripe"], edges: ["e10"], text: "Checkout is Stripe's page. No card touches my code." },
        { nodes: ["stripe", "pay"], edges: ["e9"], text: "Stripe posts a webhook. The only path that can grant access." },
        { nodes: ["pay"], edges: [], text: "Signature checked before the body is parsed." },
        { nodes: ["pay", "d1"], edges: ["e8"], text: "Written keyed on Stripe's event id, so a redelivery changes nothing." }
      ],
      close: "Stripe's ledger is the source of truth, so a lost database is rebuilt by replaying it."
    }
  };

  /* Single-column re-lay for phones. Same nodes and edges, new geometry. */
  var MOBILE = {
    w: 360, h: 500,
    entry: "e1",
    stores: ["firebase", "d1", "stripe"],
    box: {
      client:   { x: 64, y: 6, w: 232, h: 38 },
      edge:     { x: 64, y: 68, w: 232, h: 44 },
      auth:     { x: 64, y: 144, w: 232, h: 40 },
      gate:     { x: 64, y: 196, w: 232, h: 40 },
      pay:      { x: 64, y: 248, w: 232, h: 40 },
      firebase: { x: 64, y: 334, w: 232, h: 40 },
      d1:       { x: 64, y: 386, w: 232, h: 40 },
      stripe:   { x: 64, y: 438, w: 232, h: 40 }
    }
  };

  var M_LEFT = 30;
  var M_INNER = 47;
  var M_RIGHT = 332;

  function mcy(id) {
    var b = MOBILE.box[id];
    return b.y + b.h / 2;
  }

  function mobileEdge(e) {
    var a = MOBILE.box[e.from];
    var b = MOBILE.box[e.to];
    var ay = mcy(e.from);
    var by = mcy(e.to);

    if (e.id === MOBILE.entry) {
      return "M180," + (a.y + a.h) + " L180," + b.y;
    }
    if (MOBILE.stores.indexOf(e.to) > -1 || MOBILE.stores.indexOf(e.from) > -1) {
      return "M" + (a.x + a.w) + "," + ay + " L" + M_RIGHT + "," + ay +
             " L" + M_RIGHT + "," + by + " L" + (b.x + b.w) + "," + by;
    }
    if (e.type === "internal") {
      return "M" + a.x + "," + ay + " L" + M_INNER + "," + ay +
             " L" + M_INNER + "," + by + " L" + b.x + "," + by;
    }
    return "M180," + (a.y + a.h) + " L180," + (a.y + a.h + 14) +
           " L" + M_LEFT + "," + (a.y + a.h + 14) +
           " L" + M_LEFT + "," + by + " L" + b.x + "," + by;
  }

  /* --- Build the SVG ------------------------------------------------------ */

  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", VIEW);
  svg.setAttribute("class", "topo__svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ARIA);

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    (parent || svg).appendChild(node);
    return node;
  }

  var zoneEls = [];
  ZONES.forEach(function (z) {
    zoneEls.push(el("rect", { class: "zone", x: z.x, y: z.y, width: z.w, height: z.h, rx: 14 }));
    var label = el("text", { class: "zone__label", x: z.lx, y: z.ly });
    label.textContent = z.label;
    zoneEls.push(label);
  });

  /* Edges first so nodes paint over them. */
  var edgeEls = {};
  EDGES.forEach(function (e) {
    var cls = "edge";
    if (e.type === "internal") cls += " edge--internal";
    if (e.type === "data") cls += " edge--data";
    edgeEls[e.id] = el("path", { class: cls, d: e.d, id: "topo-" + e.id });
  });

  var nodeEls = {};
  var byId = {};
  NODES.forEach(function (n) {
    byId[n.id] = n;

    var g = el("g", {
      class: "node node--" + n.kind,
      tabindex: "0",
      role: "button",
      "aria-label": n.label + ": " + n.kindLabel
    });

    var boxEl = el("rect", { class: "node__box", x: n.x, y: n.y, width: n.w, height: n.h, rx: 9 }, g);

    var cx = n.x + n.w / 2;
    var t1 = el("text", { class: "node__label", x: cx, y: n.y + n.h / 2 - 3, "text-anchor": "middle" }, g);
    t1.textContent = n.label;
    var t2 = el("text", { class: "node__sub", x: cx, y: n.y + n.h / 2 + 13, "text-anchor": "middle" }, g);
    t2.textContent = n.sub;

    var t3 = null;
    if (n.idx) {
      t3 = el("text", { class: "node__idx", x: n.x + 9, y: n.y + 14 }, g);
      t3.textContent = n.idx;
    }

    g.__parts = { box: boxEl, label: t1, sub: t2, idx: t3 };
    nodeEls[n.id] = g;

    var select = function () {
      if (selected === n.id) deselectNode();
      else selectNode(n.id);
    };
    g.addEventListener("click", select);
    g.addEventListener("mouseenter", function () {
      if (!player.key) hoverNode(n.id);
    });
    g.addEventListener("mouseleave", function () {
      if (!player.key) clearHighlight();
    });
    g.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        select();
      }
    });
  });

  var packetLayer = el("g", { class: "packet-layer" });
  stage.appendChild(svg);

  /* --- Layout switching --------------------------------------------------- */

  var isMobile = null;

  function applyLayout(mobile) {
    if (mobile === isMobile) return;
    isMobile = mobile;

    svg.setAttribute("viewBox", mobile ? "0 0 " + MOBILE.w + " " + MOBILE.h : VIEW);
    svg.classList.toggle("topo__svg--stacked", mobile);

    zoneEls.forEach(function (z) {
      z.style.display = mobile ? "none" : "";
    });

    NODES.forEach(function (n) {
      var box = mobile ? MOBILE.box[n.id] : n;
      var parts = nodeEls[n.id].__parts;
      var cx = box.x + box.w / 2;

      parts.box.setAttribute("x", box.x);
      parts.box.setAttribute("y", box.y);
      parts.box.setAttribute("width", box.w);
      parts.box.setAttribute("height", box.h);

      parts.label.setAttribute("x", cx);
      parts.label.setAttribute("y", box.y + box.h / 2 - (mobile ? 1 : 3));
      parts.sub.setAttribute("x", cx);
      parts.sub.setAttribute("y", box.y + box.h / 2 + 13);
      parts.sub.style.display = mobile && n.kind === "client" ? "none" : "";

      if (parts.idx) {
        parts.idx.setAttribute("x", box.x + 8);
        parts.idx.setAttribute("y", box.y + 13);
      }
    });

    EDGES.forEach(function (e) {
      edgeEls[e.id].setAttribute("d", mobile ? mobileEdge(e) : e.d);
    });
  }

  var mq = window.matchMedia("(max-width: 1000px)");
  applyLayout(mq.matches);
  if (mq.addEventListener) {
    mq.addEventListener("change", function (ev) { applyLayout(ev.matches); });
  } else if (mq.addListener) {
    mq.addListener(function (ev) { applyLayout(ev.matches); });
  }

  /* --- Highlighting ------------------------------------------------------- */

  function clearHighlight() {
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.remove("is-lit", "is-dim");
    });
    Object.keys(edgeEls).forEach(function (k) {
      edgeEls[k].classList.remove("is-lit", "is-dim");
    });
  }

  function highlight(nodeIds, edgeIds) {
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("is-lit", nodeIds.indexOf(k) > -1);
      nodeEls[k].classList.toggle("is-dim", nodeIds.indexOf(k) === -1);
    });
    Object.keys(edgeEls).forEach(function (k) {
      edgeEls[k].classList.toggle("is-lit", edgeIds.indexOf(k) > -1);
      edgeEls[k].classList.toggle("is-dim", edgeIds.indexOf(k) === -1);
    });
  }

  function hoverNode(id) {
    var eIds = [];
    var nIds = [id];
    EDGES.forEach(function (e) {
      if (e.from === id || e.to === id) {
        eIds.push(e.id);
        nIds.push(e.from === id ? e.to : e.from);
      }
    });
    highlight(nIds, eIds);
  }

  /* --- Inspector ---------------------------------------------------------- */

  var inspect = document.getElementById("topo-inspect");
  var selected = null;
  var EMPTY_INSPECT = '<p class="topo__inspect-empty">Tap a box to see what it owns.</p>';

  function deselectNode() {
    selected = null;
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.remove("is-sel");
    });
    inspect.innerHTML = EMPTY_INSPECT;
    if (!player.key) clearHighlight();
  }

  function selectNode(id) {
    selected = id;
    var n = byId[id];
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("is-sel", k === id);
    });

    var html = "<h4>" + n.label + "</h4>" +
      '<span class="topo__inspect-kind">' + n.kindLabel + "</span><dl>";
    n.info.forEach(function (pair) {
      html += "<dt>" + pair[0] + "</dt><dd>" + pair[1] + "</dd>";
    });
    inspect.innerHTML = html + "</dl>";

    if (!player.key) hoverNode(id);
  }

  /* --- Packets ------------------------------------------------------------ */

  var livePackets = [];

  function firePacket(edgeId, dir, delay) {
    var path = edgeEls[edgeId];
    if (!path) return;
    var len = path.getTotalLength();

    var dot = el("circle", { class: "packet", r: 4.2, fill: "var(--accent)" }, packetLayer);
    dot.style.filter = "drop-shadow(0 0 6px var(--glow-accent))";
    dot.style.opacity = "0";

    var start = null;
    var dur = Math.max(420, Math.min(1150, len * 1.5));

    function step(ts) {
      if (start === null) start = ts;
      var t = (ts - start - delay) / dur;
      if (t < 0) { requestAnimationFrame(step); return; }
      if (t >= 1) { dot.remove(); return; }
      var pt = path.getPointAtLength(dir === -1 ? (1 - t) * len : t * len);
      dot.setAttribute("cx", pt.x);
      dot.setAttribute("cy", pt.y);
      dot.style.opacity = String(Math.sin(t * Math.PI) * 0.9 + 0.1);
      requestAnimationFrame(step);
    }
    livePackets.push({ dot: dot, raf: requestAnimationFrame(step) });
  }

  function clearPackets() {
    livePackets.forEach(function (p) {
      cancelAnimationFrame(p.raf);
      if (p.dot.parentNode) p.dot.remove();
    });
    livePackets = [];
  }

  /* --- Scenario player ---------------------------------------------------- */

  var capStep = document.getElementById("topo-cap-step");
  var capText = document.getElementById("topo-cap-text");
  var ctrls = document.getElementById("topo-controls");
  var btnPrev = document.getElementById("topo-prev");
  var btnPlay = document.getElementById("topo-play");
  var btnNext = document.getElementById("topo-next");
  var legendHost = document.getElementById("topo-legend");
  var buttons = document.querySelectorAll(".scenario-btn");
  var DWELL = 4000;
  var IDLE_TEXT = "Pick a path, or tap any box.";

  var player = { key: null, i: 0, playing: false, timer: null };

  function clearTimer() {
    if (player.timer) {
      clearTimeout(player.timer);
      player.timer = null;
    }
  }

  function syncControls() {
    var sc = SCENARIOS[player.key];
    if (ctrls) ctrls.hidden = !sc;

    Array.prototype.forEach.call(buttons, function (b) {
      b.classList.toggle("is-running", !!sc && b.getAttribute("data-scenario") === player.key);
    });
    if (!sc) return;

    btnPrev.disabled = player.i <= 0;
    btnNext.disabled = player.i >= sc.steps.length;
    btnPlay.setAttribute("aria-pressed", String(player.playing));
    btnPlay.querySelector("[data-play-label]").textContent = player.playing
      ? "Pause"
      : player.i >= sc.steps.length ? "Replay" : "Play";
    btnPlay.classList.toggle("is-playing", player.playing);
  }

  function renderStep() {
    var sc = SCENARIOS[player.key];
    if (!sc) return;
    clearPackets();

    if (player.i >= sc.steps.length) {
      capStep.textContent = "Done · " + sc.label;
      capText.textContent = sc.close;
      clearHighlight();
      player.playing = false;
      clearTimer();
      syncControls();
      return;
    }

    var step = sc.steps[player.i];
    highlight(step.nodes, step.edges || []);
    capStep.textContent = "Step " + (player.i + 1) + " of " + sc.steps.length;
    capText.textContent = step.text;

    if (!reduced) {
      (step.edges || []).forEach(function (eid) {
        for (var k = 0; k < 3; k++) firePacket(eid, step.dir || 1, k * 420);
      });
    }
    syncControls();
  }

  function tick() {
    clearTimer();
    if (!player.playing) return;
    player.timer = setTimeout(function () {
      player.i += 1;
      renderStep();
      tick();
    }, DWELL);
  }

  function stopScenario() {
    clearTimer();
    clearPackets();
    player.key = null;
    player.playing = false;
    clearHighlight();
    if (ctrls) ctrls.hidden = true;
    Array.prototype.forEach.call(buttons, function (b) { b.classList.remove("is-running"); });
    capStep.textContent = "Idle";
    capText.textContent = IDLE_TEXT;
  }

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-scenario");
      if (player.key === key) { stopScenario(); return; }
      player.key = key;
      player.i = 0;
      player.playing = true;
      renderStep();
      tick();
    });
  });

  if (btnPlay) {
    btnPlay.addEventListener("click", function () {
      var sc = SCENARIOS[player.key];
      if (!sc) return;
      if (player.i >= sc.steps.length) {
        player.i = 0;
        player.playing = true;
        renderStep();
        tick();
        return;
      }
      player.playing = !player.playing;
      if (player.playing) tick();
      else clearTimer();
      syncControls();
    });

    btnPrev.addEventListener("click", function () {
      if (!SCENARIOS[player.key]) return;
      player.playing = false;
      clearTimer();
      player.i = Math.max(0, player.i - 1);
      renderStep();
    });

    btnNext.addEventListener("click", function () {
      var sc = SCENARIOS[player.key];
      if (!sc) return;
      player.playing = false;
      clearTimer();
      player.i = Math.min(sc.steps.length, player.i + 1);
      renderStep();
    });
  }

  if (legendHost) {
    LEGEND.forEach(function (item) {
      var span = document.createElement("span");
      if (item.line) {
        var i = document.createElement("i");
        if (item.dash) i.className = "dash";
        span.appendChild(i);
      }
      span.appendChild(document.createTextNode(item.text));
      legendHost.appendChild(span);
    });
  }

  inspect.innerHTML = EMPTY_INSPECT;
  clearHighlight();
})();
