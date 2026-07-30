/* Airlock's gate, replayed.

   Airlock is built and it won the Daytona HackSprint. The BLOCKED output typed
   out below is the real verdict text from the repo's README. This page replays
   a recorded run, it does not call Daytona, Nosana, Doubleword, Oxylabs or ai&
   from your browser. The lane timings are a paced replay, not measurements. */

(function () {
  "use strict";

  var lab = document.getElementById("gate-lab");
  if (!lab) return;

  var reduced = (window.WN && window.WN.reduced) || false;

  /* Inline SVG rather than emoji: emoji fall back to tofu boxes on systems
     without an emoji font, and these stay on-theme with the rest of the site. */
  var SVG = {
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8l-9 5-9-5V8l9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 8-4 4 4 4M15 8l4 4-4 4"/></svg>',
    match: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></svg>'
  };

  var LANES = [
    { key: "run", icon: SVG.box, name: "Daytona", role: "runs it", detail: "disposable sandbox, honeytokens planted" },
    { key: "read", icon: SVG.read, name: "Nosana", role: "reads it", detail: "GPU static read of the whole source" },
    { key: "match", icon: SVG.match, name: "Doubleword", role: "matches it", detail: "embed + cosine against known malware" },
    { key: "rep", icon: SVG.globe, name: "Oxylabs", role: "checks it", detail: "live web + registry reputation" }
  ];

  var CASES = {
    evil: {
      pkg: "python-pillow",
      verdict: "block",
      lanes: {
        run: { text: "read ~/.aws/credentials, ~/.env · connected to 45.11.87.9", hit: true },
        read: { text: "credential exfiltration on install · risk 10/10", hit: true },
        match: { text: "close match to a known stealer family", hit: true },
        rep: { text: "not published on PyPI · name mimics 'pillow'", hit: true }
      },
      tier: "Three tripwires fired. A honeytoken read, an outbound connection to a non-registry host, and a shell spawn are never acceptable during an install. That's a plain if-statement, decided before any model is consulted.",
      /* Verbatim from the Airlock README. */
      terminal: [
        { t: "$ ", c: "t-prompt" },
        { t: "pip install python-pillow\n", c: "" },
        { t: "\n" },
        { t: "🚫  BLOCKED: python-pillow is not safe to install\n", c: "t-block" },
        { t: "\n" },
        { t: "Airlock installed this package on a throwaway machine and watched\nexactly what it did. Here's what it caught:\n", c: "t-dim" },
        { t: "\n" },
        { t: "  When we ran it\n", c: "t-key" },
        { t: "    • Secretly read private files we'd planted as bait:\n      ~/.aws/credentials, ~/.env\n" },
        { t: "    • Tried to send data out to an unknown server: 45.11.87.9:443\n" },
        { t: "\n" },
        { t: "  When we read its code  (rated 10/10 for risk)\n", c: "t-key" },
        { t: "    • Steals credential files during install and sends them to an\n      outside server.\n" },
        { t: "\n" },
        { t: "  About the package itself\n", c: "t-key" },
        { t: "    • Not a real published package (not on PyPI)\n" },
        { t: "    • Its name mimics the popular package 'pillow'\n" },
        { t: "\n" },
        { t: "The install was stopped before it could run on your real machine.\n", c: "t-dim" }
      ]
    },
    safe: {
      pkg: "requests",
      verdict: "safe",
      lanes: {
        run: { text: "no honeytoken reads · no outbound to unknown hosts", hit: false },
        read: { text: "nothing matching exfiltration or C2 patterns", hit: false },
        match: { text: "no similarity to the known-malware corpus", hit: false },
        rep: { text: "published, widely used, no advisories", hit: false }
      },
      tier: "No tripwire fired, so the evidence goes to the judge for the gray zone. ai& can only ever make the gate stricter. It cannot overrule a tripwire and turn a BLOCK into a SAFE.",
      terminal: [
        { t: "$ ", c: "t-prompt" },
        { t: "pip install requests\n", c: "" },
        { t: "\n" },
        { t: "Collecting requests\n", c: "t-dim" },
        { t: "Successfully installed requests-2.32.3\n", c: "t-dim" },
        { t: "\n" },
        { t: "✓  Airlock: nothing to report\n", c: "t-safe" },
        { t: "\n" },
        { t: "A safe package produces no noise at all. The install simply proceeds,\nexactly as if Airlock were not there.\n", c: "t-dim" }
      ]
    }
  };

  /* --- Build lanes -------------------------------------------------------- */

  var lanesEl = lab.querySelector("[data-lanes]");
  var laneEls = {};

  LANES.forEach(function (l) {
    var row = document.createElement("div");
    row.className = "lane";
    row.innerHTML =
      '<span class="lane__icon" aria-hidden="true">' + l.icon + "</span>" +
      '<span class="lane__meta">' +
      '<span class="lane__name">' + l.name + " <span>" + l.role + "</span></span>" +
      '<span class="lane__result">' + l.detail + "</span></span>" +
      '<span class="lane__spinner" aria-hidden="true"></span>';
    lanesEl.appendChild(row);
    laneEls[l.key] = row;
  });

  var verdictEl = lab.querySelector("[data-verdict]");
  var tierEl = lab.querySelector("[data-tier]");
  var termEl = lab.querySelector("[data-terminal]");
  var runBtns = lab.querySelectorAll("[data-case]");

  var timers = [];
  var typing = null;

  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
    if (typing) {
      clearInterval(typing);
      typing = null;
    }
    LANES.forEach(function (l) {
      var row = laneEls[l.key];
      row.className = "lane";
      row.querySelector(".lane__result").textContent = l.detail;
    });
    verdictEl.className = "verdict";
    verdictEl.textContent = "waiting for an install";
    tierEl.innerHTML = "<b>Tier 1 · deterministic tripwires.</b> Plain code, no model. Reading a planted honeytoken, connecting out to a non-registry host, or spawning a shell during an install triggers an instant block on its own.";
    termEl.innerHTML = "";
  }

  /* --- Terminal typing ---------------------------------------------------- */

  function typeOut(chunks, done) {
    termEl.innerHTML = "";
    var ci = 0;
    var pos = 0;
    var cursor = document.createElement("span");
    cursor.className = "term-cursor";

    var current = null;

    function newSpan(c) {
      current = document.createElement("span");
      if (c) current.className = c;
      termEl.appendChild(current);
    }

    if (reduced) {
      chunks.forEach(function (chunk) {
        newSpan(chunk.c);
        current.textContent = chunk.t;
      });
      if (done) done();
      return;
    }

    newSpan(chunks[0].c);
    termEl.appendChild(cursor);

    typing = setInterval(function () {
      if (ci >= chunks.length) {
        clearInterval(typing);
        typing = null;
        cursor.remove();
        if (done) done();
        return;
      }
      var chunk = chunks[ci];
      /* Type a few characters per tick so long blocks don't crawl. */
      var take = chunk.t.length > 60 ? 4 : 2;
      current.textContent += chunk.t.slice(pos, pos + take);
      pos += take;

      termEl.appendChild(cursor);
      termEl.scrollTop = termEl.scrollHeight;

      if (pos >= chunk.t.length) {
        ci += 1;
        pos = 0;
        if (ci < chunks.length) newSpan(chunks[ci].c);
      }
    }, 16);
  }

  /* --- Run a case --------------------------------------------------------- */

  function run(caseKey) {
    clearAll();
    var c = CASES[caseKey];

    verdictEl.textContent = "checking " + c.pkg + " …";

    LANES.forEach(function (l, i) {
      var row = laneEls[l.key];
      var startAt = 220 + i * 130;
      var endAt = startAt + 900 + i * 260;

      timers.push(
        setTimeout(function () {
          row.classList.add("is-running");
          row.querySelector(".lane__result").textContent = "running…";
        }, startAt)
      );

      timers.push(
        setTimeout(function () {
          var res = c.lanes[l.key];
          row.classList.remove("is-running");
          row.classList.add(res.hit ? "is-hit" : "is-done");
          row.querySelector(".lane__result").textContent = res.text;
        }, endAt)
      );
    });

    var finish = 220 + LANES.length * 130 + 900 + LANES.length * 260;

    timers.push(
      setTimeout(function () {
        verdictEl.className = "verdict " + (c.verdict === "block" ? "is-block" : "is-safe");
        verdictEl.textContent =
          c.verdict === "block" ? "BLOCKED · " + c.pkg : "SAFE · " + c.pkg + " installs normally";
        tierEl.innerHTML = "<b>" + (c.verdict === "block" ? "Tier 1 · tripwires." : "Tier 2 · the judge.") + "</b> " + c.tier;
        typeOut(c.terminal);
      }, finish)
    );
  }

  runBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      run(btn.getAttribute("data-case"));
    });
  });

  clearAll();
})();
