/* DeepCS architecture: an interactive rendering of the topology in DESIGN.md §3.
   This draws the *designed* system. It is not connected to a running deployment;
   the packets are a walkthrough of the request paths described in the doc. */

(function () {
  "use strict";

  var stage = document.getElementById("topo-stage");
  if (!stage) return;

  var reduced = (window.WN && window.WN.reduced) || false;
  var NS = "http://www.w3.org/2000/svg";

  /* --- Model -------------------------------------------------------------- */

  var NODES = [
    {
      id: "client",
      label: "User A + User B",
      sub: "React · CDN",
      x: 350, y: 18, w: 260, h: 48,
      kind: "client",
      kindLabel: "Browsers",
      info: [
        ["Talks to", "The Gateway, and nothing else. The browser never reaches Postgres or Redis."],
        ["Carries", "A Firebase ID token, refreshed transparently by the client SDK."]
      ]
    },
    {
      id: "gw",
      label: "Gateway",
      sub: "verify · limit · route",
      idx: "1", stack: true,
      x: 340, y: 112, w: 280, h: 54,
      kind: "svc",
      kindLabel: "Service · [built · learning]",
      info: [
        ["Owns", "Nothing. It is stateless."],
        ["Why separate", "Position. A cross-cutting enforcement point has to sit in front of what it protects. That holds even if its scaling profile matched everything else exactly."],
        ["The catch", "Every WebSocket burns a slot here and on Collab, and these slots are shared with every HTTP request in the system."]
      ]
    },
    {
      id: "users",
      label: "Users",
      sub: "profiles",
      idx: "2", stack: true,
      x: 24, y: 232, w: 176, h: 62,
      kind: "svc",
      kindLabel: "Service",
      info: [
        ["Owns", "Profile rows keyed by firebase_uid."],
        ["Why separate", "One capability, one owner. Small and stable, and it will change less than anything else here."],
        ["Detail", "No auth code at all. The row is created lazily by an upsert whose RETURNING clause is the only reliable signal of a genuine first sign-up."]
      ]
    },
    {
      id: "questions",
      label: "Questions",
      sub: "bank · search",
      idx: "3", stack: true,
      x: 248, y: 232, w: 176, h: 62,
      kind: "svc",
      kindLabel: "Service",
      info: [
        ["Owns", "The question bank, tags, full-text index, and reference_md."],
        ["Why separate", "Read-heavy and cacheable in a way nothing else is; also the only service holding answer keys, so a narrower blast radius is worth something."],
        ["Detail", "Cursor pagination, not OFFSET. OFFSET makes Postgres read and discard every skipped row, and it duplicates rows that shift between requests."]
      ]
    },
    {
      id: "matching",
      label: "Matching",
      sub: "queue · claim · sessions",
      idx: "4", stack: true,
      x: 472, y: 232, w: 176, h: 62,
      kind: "svc",
      kindLabel: "Service",
      info: [
        ["Owns", "Queue state, the pair claim, session rows, consent."],
        ["Why separate", "A hard concurrency problem of its own: two users joining at the same instant race for the same partner, so the claim has to be atomic."],
        ["Detail", "The claim lives in Redis and the session row in Postgres, so no transaction spans them. Recovery is client-driven and joining is idempotent, so a retry can never double-book."]
      ]
    },
    {
      id: "collab",
      label: "Collab",
      sub: "WebSockets · Yjs",
      idx: "5", stack: true,
      x: 696, y: 232, w: 176, h: 62,
      kind: "svc",
      kindLabel: "Service · the hard part",
      info: [
        ["Owns", "Live Yjs documents and their snapshots."],
        ["Why separate", "Forced by the platform. One WebSocket occupies a concurrency slot for twenty minutes; this service needs the opposite --concurrency and --timeout values from every other one, and those are per-service flags."],
        ["Detail", "Cross-instance sync goes through a Redis channel per session, because the two users may be connected to different instances. Sticky sessions cannot fix that, because affinity pins a client, not a pair."]
      ]
    },
    {
      id: "stats",
      label: "Stats",
      sub: "scheduled job · drains, exits",
      idx: "6",
      x: 730, y: 370, w: 176, h: 58,
      kind: "job",
      kindLabel: "Job, not a service",
      info: [
        ["Owns", "Session summaries and aggregates."],
        ["Why separate", "Trigger. It is time-driven rather than request-driven, and a scaled-to-zero service has no running process for a timer to fire inside. So it cannot be a server at all."],
        ["Detail", "Reads past its bookmark on the event stream, then acks. Redis holds delivered-but-unacked entries pending, so a crash means redelivery, not loss. Delivery is at-least-once, which is what forces every write to be idempotent."]
      ]
    },
    {
      id: "pg",
      label: "PostgreSQL",
      sub: "schema per service",
      x: 150, y: 498, w: 200, h: 58,
      kind: "store",
      kindLabel: "Managed · [bought]",
      info: [
        ["Shape", "One Neon instance, one schema per service, one Postgres role each."],
        ["The boundary", "A cross-service read is rejected by the database, not discouraged by convention. No foreign key crosses a schema boundary."],
        ["Cost accepted", "One instance is a shared failure domain. Database-per-service was rejected because session creation would then need a saga, and a saga wants an always-on orchestrator the cost ceiling forbids."]
      ]
    },
    {
      id: "redis",
      label: "Redis",
      sub: "queue · limits · pub/sub · events",
      x: 470, y: 498, w: 200, h: 58,
      kind: "store",
      kindLabel: "Managed · [bought]",
      info: [
        ["Shape", "One Upstash instance doing five jobs: match queue, rate-limit buckets, cross-instance pub/sub, the event stream, and the question-bank cache."],
        ["Why here", "Split from Postgres by access pattern (ephemeral shared state versus durable relational data), not by service."],
        ["Detail", "Atomicity has to live where the single copy of the state lives. That is why the token bucket is a Lua script and not an in-process mutex."]
      ]
    }
  ];

  var EDGES = [
    { id: "e1", from: "client", to: "gw", d: "M480,66 L480,112", type: "req" },
    { id: "e2", from: "gw", to: "users", d: "M480,166 C480,204 112,192 112,232", type: "req" },
    { id: "e3", from: "gw", to: "questions", d: "M480,166 C480,204 336,196 336,232", type: "req" },
    { id: "e4", from: "gw", to: "matching", d: "M480,166 C480,204 560,196 560,232", type: "req" },
    { id: "e5", from: "gw", to: "collab", d: "M480,166 C480,204 784,192 784,232", type: "ws" },
    { id: "e6", from: "gw", to: "redis", d: "M620,139 C880,158 942,300 902,462 C884,528 782,530 670,527", type: "data" },
    { id: "e7", from: "matching", to: "users", d: "M490,294 C430,352 250,352 185,294", type: "internal" },
    { id: "e8", from: "matching", to: "questions", d: "M505,294 C482,332 438,332 412,294", type: "internal" },
    { id: "e9", from: "collab", to: "matching", d: "M712,294 C692,332 646,332 622,294", type: "internal" },
    { id: "e10", from: "users", to: "pg", d: "M112,294 C112,404 186,428 226,498", type: "data" },
    { id: "e11", from: "questions", to: "pg", d: "M330,294 C330,398 292,436 266,498", type: "data" },
    { id: "e12", from: "matching", to: "pg", d: "M540,294 C512,404 372,448 300,498", type: "data" },
    { id: "e13", from: "collab", to: "pg", d: "M762,294 C700,432 470,468 352,520", type: "data" },
    { id: "e14", from: "questions", to: "redis", d: "M366,294 C404,398 484,442 536,498", type: "data" },
    { id: "e15", from: "matching", to: "redis", d: "M580,294 C584,382 578,442 574,498", type: "data" },
    { id: "e16", from: "collab", to: "redis", d: "M800,294 C802,400 706,472 642,500", type: "data" },
    { id: "e17", from: "stats", to: "redis", d: "M762,428 C716,462 684,482 658,498", type: "data" },
    { id: "e18", from: "stats", to: "pg", d: "M730,399 C548,394 404,462 352,514", type: "data" }
  ];

  /* Scenario scripts. Every caption is a claim taken from DESIGN.md. */
  var SCENARIOS = {
    match: {
      label: "A match request",
      steps: [
        { nodes: ["client", "gw"], edges: ["e1"], text: "The browser joins the queue. Every request, HTTP or WebSocket, enters through the Gateway, because exactly one place should verify a token." },
        { nodes: ["gw", "redis"], edges: ["e6"], text: "The Gateway verifies the Firebase ID token against Google's published JWKS. It holds no service-account credential, so it can verify a token but cannot mint one. Then it spends a token-bucket token in Redis." },
        { nodes: ["gw", "matching"], edges: ["e4"], text: "Routed to Matching, and X-User-Id is injected here. Downstream services never re-verify. They read that header and trust it, which is only safe because no other service has public ingress." },
        { nodes: ["matching", "users"], edges: ["e7"], text: "Matching validates the UID by calling Users. It cannot join to Users' tables: each service has its own Postgres role, so the database rejects a cross-schema read outright." },
        { nodes: ["matching", "questions"], edges: ["e8"], text: "It fetches parts[] from Questions to seed the shared scaffold. The reference answer stays behind. Questions releases it only after Matching verifies both users consented." },
        { nodes: ["matching", "redis"], edges: ["e15"], text: "The partner is claimed from the Redis queue by a Lua script. Two users joining in the same instant race for the same partner, so the claim has to be atomic. It is the same shape of race as the rate limiter." },
        { nodes: ["matching", "pg"], edges: ["e12"], text: "Session row written to Matching's own schema, then a match event published. The claim is in Redis and the row is in Postgres, so nothing spans them. The client re-checks after about 10 seconds if no event arrives." }
      ],
      close: "Cold, this chain can start four containers from zero. That is the accepted price of --min-instances=0, and it's why cross-service calls are kept off the browsing path a first-time visitor hits."
    },
    edit: {
      label: "An edit crossing instances",
      steps: [
        { nodes: ["client", "gw", "collab"], edges: ["e1", "e5"], text: "User A types. The Yjs update rides A's WebSocket, proxied by the Gateway, into whichever Collab instance A happened to land on." },
        { nodes: ["collab"], edges: [], text: "Instance 1 merges the update into its own copy of the document." },
        { nodes: ["collab", "redis"], edges: ["e16"], text: "It publishes the update on a Redis channel for that session. That is necessary because the two users may be connected to different Collab instances, and Cloud Run's session affinity pins a client, not a pair." },
        { nodes: ["redis", "collab"], edges: ["e16"], dir: -1, text: "Instance 2 is subscribed, receives it, and merges. A CRDT converges to the same document regardless of the order updates arrive in. There is no central referee." },
        { nodes: ["collab", "pg"], edges: ["e13"], text: "Every 30 seconds, and on disconnect, and before SIGTERM, the doc is snapshotted to Postgres. The live document exists only in one instance's memory, so without this a restart loses the session." }
      ],
      close: "Per-keystroke writes would exhaust the free tier and add latency to the hot path. 30s bounds worst-case loss; the disconnect and SIGTERM snapshots mean deploys and closed tabs lose nothing at all."
    },
    stats: {
      label: "The stats drain",
      steps: [
        { nodes: ["stats"], edges: [], text: "Cloud Scheduler starts the Stats job every 5 minutes. It is a job, not a server: a scale-to-zero service has no running process for a timer to fire inside." },
        { nodes: ["stats", "redis"], edges: ["e17"], text: "It reads everything past its bookmark on the events stream, an append-only log, so reading never deletes. Services appended those events fire-and-forget; a log hiccup never fails a user request." },
        { nodes: ["stats", "pg"], edges: ["e18"], text: "Summaries and aggregates are written to Postgres, and only then are the entries acked. A crash mid-batch means redelivery, not loss. Delivery is at-least-once." },
        { nodes: ["stats"], edges: [], text: "So every write is idempotent, keyed by entry ID. That is what converts at-least-once into effectively exactly-once. With a queue instead of a log, a bug in this logic would have destroyed the data needed to recompute." }
      ],
      close: "A log keeps entries after reading. Rewind the bookmark after a bug fix, or add a consumer later, and the history is still there."
    }
  };

  /* --- Build the SVG ------------------------------------------------------ */

  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 960 620");
  svg.setAttribute("class", "topo__svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "DeepCS architecture: browsers enter through a gateway, which routes to Users, Questions, Matching and Collab on Cloud Run; a scheduled Stats job drains an event log; PostgreSQL and Redis sit behind them.");

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    (parent || svg).appendChild(node);
    return node;
  }

  /* Zones */
  el("rect", { class: "zone", x: 10, y: 200, width: 940, height: 250, rx: 14 });
  el("text", { class: "zone__label", x: 24, y: 216 }).textContent = "Cloud Run · stateless, scales to zero";
  el("rect", { class: "zone", x: 130, y: 470, width: 560, height: 112, rx: 14 });
  el("text", { class: "zone__label", x: 144, y: 488 }).textContent = "Managed free tiers · always on";

  /* Edges first so nodes paint over them */
  var edgeEls = {};
  EDGES.forEach(function (e) {
    var cls = "edge";
    if (e.type === "internal") cls += " edge--internal";
    if (e.type === "data") cls += " edge--data";
    var p = el("path", { class: cls, d: e.d, id: "topo-" + e.id });
    edgeEls[e.id] = p;
  });

  /* Nodes */
  var nodeEls = {};
  NODES.forEach(function (n) {
    var g = el("g", {
      class: "node node--" + n.kind,
      tabindex: "0",
      role: "button",
      "aria-label": n.label + ": " + n.kindLabel
    });

    if (n.stack) {
      el("rect", { class: "node__stack", x: n.x + 5, y: n.y - 5, width: n.w, height: n.h, rx: 9 }, g);
    }
    el("rect", { class: "node__box", x: n.x, y: n.y, width: n.w, height: n.h, rx: 9 }, g);

    var cx = n.x + n.w / 2;
    var t1 = el("text", { class: "node__label", x: cx, y: n.y + n.h / 2 - 3, "text-anchor": "middle" }, g);
    t1.textContent = n.label;
    var t2 = el("text", { class: "node__sub", x: cx, y: n.y + n.h / 2 + 13, "text-anchor": "middle" }, g);
    t2.textContent = n.sub;

    if (n.idx) {
      var t3 = el("text", { class: "node__idx", x: n.x + 9, y: n.y + 14 }, g);
      t3.textContent = n.idx;
    }

    nodeEls[n.id] = g;

    var select = function () {
      selectNode(n.id);
    };
    g.addEventListener("click", select);
    g.addEventListener("mouseenter", function () {
      if (!running) hoverNode(n.id);
    });
    g.addEventListener("mouseleave", function () {
      if (!running) clearHighlight();
    });
    g.addEventListener("focus", select);
    g.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        select();
      }
    });
  });

  var packetLayer = el("g", { class: "packet-layer" });
  stage.appendChild(svg);

  /* --- Highlighting ------------------------------------------------------- */

  var byId = {};
  NODES.forEach(function (n) {
    byId[n.id] = n;
  });

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

  /* Hovering a node lights it and everything it touches. */
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

  function selectNode(id) {
    selected = id;
    var n = byId[id];
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("is-sel", k === id);
    });

    var html =
      "<h4>" + n.label + "</h4>" +
      '<span class="topo__inspect-kind">' + n.kindLabel + "</span><dl>";
    n.info.forEach(function (pair) {
      html += "<dt>" + pair[0] + "</dt><dd>" + pair[1] + "</dd>";
    });
    html += "</dl>";
    inspect.innerHTML = html;

    if (!running) hoverNode(id);
  }

  /* --- Packets ------------------------------------------------------------ */

  var livePackets = [];

  function firePacket(edgeId, dir, delay) {
    var path = edgeEls[edgeId];
    if (!path) return;
    var len = path.getTotalLength();

    var dot = el("circle", { class: "packet", r: 4.2, fill: "var(--teal)" }, packetLayer);
    dot.style.filter = "drop-shadow(0 0 6px var(--glow-teal))";
    dot.style.opacity = "0";

    var start = null;
    var dur = Math.max(420, Math.min(1150, len * 1.5));

    function step(ts) {
      if (start === null) start = ts;
      var t = (ts - start - delay) / dur;
      if (t < 0) {
        requestAnimationFrame(step);
        return;
      }
      if (t >= 1) {
        dot.remove();
        return;
      }
      var at = dir === -1 ? (1 - t) * len : t * len;
      var pt = path.getPointAtLength(at);
      dot.setAttribute("cx", pt.x);
      dot.setAttribute("cy", pt.y);
      dot.style.opacity = String(Math.sin(t * Math.PI) * 0.9 + 0.1);
      requestAnimationFrame(step);
    }
    var raf = requestAnimationFrame(step);
    livePackets.push({ dot: dot, raf: raf });
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
  var buttons = document.querySelectorAll(".scenario-btn");
  var running = null;
  var timers = [];

  function stopScenario() {
    timers.forEach(clearTimeout);
    timers = [];
    clearPackets();
    running = null;
    buttons.forEach(function (b) {
      b.classList.remove("is-running");
    });
  }

  function playScenario(key, btn) {
    stopScenario();
    running = key;
    btn.classList.add("is-running");

    var sc = SCENARIOS[key];
    var stepMs = reduced ? 2600 : 3000;

    sc.steps.forEach(function (step, i) {
      timers.push(
        setTimeout(function () {
          highlight(step.nodes, step.edges || []);
          capStep.textContent = "Step " + (i + 1) + " / " + sc.steps.length + " · " + sc.label;
          capText.textContent = step.text;

          if (!reduced) {
            (step.edges || []).forEach(function (eid) {
              for (var k = 0; k < 3; k++) {
                firePacket(eid, step.dir || 1, k * 420);
              }
            });
          }
        }, i * stepMs)
      );
    });

    timers.push(
      setTimeout(function () {
        capStep.textContent = "Done · " + sc.label;
        capText.textContent = sc.close;
        clearHighlight();
        running = null;
        buttons.forEach(function (b) {
          b.classList.remove("is-running");
        });
      }, sc.steps.length * stepMs)
    );
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-scenario");
      if (running === key) {
        stopScenario();
        capStep.textContent = "Idle";
        capText.textContent = "Pick a request path, or hover any service to see what it owns.";
        return;
      }
      playScenario(key, btn);
    });
  });

  /* Start on the gateway so the inspector is never empty. */
  selectNode("gw");
  clearHighlight();
})();
