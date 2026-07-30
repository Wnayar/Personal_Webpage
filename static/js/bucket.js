/* Token bucket under two Gateway instances — the race in DeepCS ADR-08.

   This is a simulation running in your browser, not a recording of a deployment.
   What it reproduces faithfully is the *shape* of the bug: a read-then-write
   sequence on shared state, interleaved between two processes, loses a decrement.
   The fix is the same one the design doc reaches for — make the whole
   read-compute-write happen where the single copy of the state lives. */

(function () {
  "use strict";

  var root = document.getElementById("bucket-lab");
  if (!root) return;

  var CAPACITY = 10;
  var REFILL_PER_SEC = 2;

  var state = {
    mode: "atomic",
    tokens: CAPACITY,
    lastRefill: Date.now(),
    admitted: 0,
    overAdmitted: 0,
    rejected: 0,
    auto: false
  };

  var tank = root.querySelector("[data-tank]");
  var tokensOut = root.querySelector("[data-tokens]");
  var logEl = root.querySelector("[data-log]");
  var statAdmit = root.querySelector("[data-stat-admitted]");
  var statOver = root.querySelector("[data-stat-over]");
  var statRejected = root.querySelector("[data-stat-rejected]");
  var gwA = root.querySelector('[data-gw="A"]');
  var gwB = root.querySelector('[data-gw="B"]');
  var readA = gwA.querySelector("[data-read]");
  var readB = gwB.querySelector("[data-read]");

  /* Build the tank cells once. */
  var cells = [];
  for (var i = 0; i < CAPACITY; i++) {
    var c = document.createElement("div");
    c.className = "token-cell";
    tank.appendChild(c);
    cells.push(c);
  }

  function log(text, cls, who) {
    var line = document.createElement("div");
    line.className = "logline" + (cls ? " logline--" + cls : "");
    var whoEl = document.createElement("span");
    whoEl.className = "logline__who";
    whoEl.textContent = who || "";
    var body = document.createElement("span");
    body.textContent = text;
    line.appendChild(whoEl);
    line.appendChild(body);
    logEl.appendChild(line);
    while (logEl.children.length > 90) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function render() {
    var whole = Math.floor(state.tokens);
    cells.forEach(function (cell, idx) {
      cell.classList.toggle("is-full", idx < whole);
      cell.classList.remove("is-over");
    });
    tokensOut.textContent = whole + " / " + CAPACITY;
    statAdmit.textContent = String(state.admitted);
    statOver.textContent = String(state.overAdmitted);
    statRejected.textContent = String(state.rejected);
    statOver.classList.toggle("is-bad", state.overAdmitted > 0);
    statOver.classList.toggle("is-good", state.overAdmitted === 0);
  }

  /* Continuous refill, exactly as a token bucket describes it. */
  function refill() {
    var now = Date.now();
    var elapsed = (now - state.lastRefill) / 1000;
    state.lastRefill = now;
    state.tokens = Math.min(CAPACITY, state.tokens + elapsed * REFILL_PER_SEC);
  }

  function flash(box, cls) {
    box.classList.add(cls);
    setTimeout(function () {
      box.classList.remove(cls);
    }, 520);
  }

  /* --- Atomic path: one Lua script, run start to finish by Redis ---------- */

  function atomicRequest(who) {
    refill();
    var box = who === "A" ? gwA : gwB;
    var readEl = who === "A" ? readA : readB;
    var have = Math.floor(state.tokens);

    readEl.textContent = have;
    flash(box, "is-active");

    if (have >= 1) {
      state.tokens -= 1;
      state.admitted += 1;
      log("EVALSHA bucket → allow (tokens " + have + " → " + (have - 1) + ")", "good", "gw-" + who);
    } else {
      state.rejected += 1;
      log("EVALSHA bucket → 429 (bucket empty)", "sys", "gw-" + who);
    }
    render();
  }

  /* --- Racy path: read, compute, write — with a window in between --------- */

  var pending = [];

  function racyRequest(who) {
    refill();
    var box = who === "A" ? gwA : gwB;
    var readEl = who === "A" ? readA : readB;
    var have = Math.floor(state.tokens);

    readEl.textContent = have;
    flash(box, "is-active");
    log("GET bucket → " + have, null, "gw-" + who);

    /* The write lands a moment later. Anything that reads in the meantime
       reads the stale value — that gap is the entire bug. */
    var record = { who: who, read: have };
    pending.push(record);

    setTimeout(function () {
      var idx = pending.indexOf(record);
      if (idx > -1) pending.splice(idx, 1);

      if (record.read >= 1) {
        var written = record.read - 1;
        /* Two instances that both read the same value both write the same
           value. The second write silently erases the first decrement. */
        var lost = Math.floor(state.tokens) < record.read;

        state.tokens = Math.min(state.tokens, written);
        state.admitted += 1;

        if (lost) {
          state.overAdmitted += 1;
          flash(box, "is-conflict");
          log("SET bucket = " + written + " — lost update: this decrement overwrote the other instance's", "bad", "gw-" + who);
          log("request admitted that the bucket could not pay for", "bad", "");
        } else {
          log("SET bucket = " + written + " → allow", null, "gw-" + who);
        }
      } else {
        state.rejected += 1;
        log("bucket empty → 429", "sys", "gw-" + who);
      }
      render();
    }, 160);
  }

  function request(who) {
    if (state.mode === "atomic") atomicRequest(who);
    else racyRequest(who);
  }

  /* --- Controls ----------------------------------------------------------- */

  root.querySelectorAll("[data-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.mode = btn.getAttribute("data-mode");
      root.querySelectorAll("[data-mode]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      reset();
      log(
        state.mode === "atomic"
          ? "mode: Lua script — Redis runs it start to finish, nothing interleaves"
          : "mode: read-then-write — two instances, one bucket, no lock",
        "sys",
        "system"
      );
    });
  });

  root.querySelector("[data-burst]").addEventListener("click", function () {
    log("two instances receive a request in the same instant", "sys", "system");
    request("A");
    request("B");
  });

  root.querySelector("[data-single]").addEventListener("click", function () {
    request(Math.random() < 0.5 ? "A" : "B");
  });

  var autoBtn = root.querySelector("[data-auto]");
  var autoTimer = null;

  autoBtn.addEventListener("click", function () {
    state.auto = !state.auto;
    autoBtn.setAttribute("aria-pressed", String(state.auto));
    autoBtn.textContent = state.auto ? "Stop traffic" : "Run traffic";

    if (state.auto) {
      log("sustained load: concurrent pairs arriving", "sys", "system");
      autoTimer = setInterval(function () {
        request("A");
        request("B");
      }, 620);
    } else {
      clearInterval(autoTimer);
    }
  });

  function reset() {
    state.tokens = CAPACITY;
    state.lastRefill = Date.now();
    state.admitted = 0;
    state.overAdmitted = 0;
    state.rejected = 0;
    pending = [];
    readA.textContent = "—";
    readB.textContent = "—";
    logEl.innerHTML = "";
    render();
  }

  root.querySelector("[data-reset]").addEventListener("click", function () {
    reset();
    log("reset", "sys", "system");
  });

  /* Keep the tank refilling visually even when idle. */
  setInterval(function () {
    refill();
    render();
  }, 250);

  reset();
  log("bucket: capacity 10, refill 2/sec, shared by both instances", "sys", "system");
  log("mode: Lua script — Redis runs it start to finish, nothing interleaves", "sys", "system");
})();
