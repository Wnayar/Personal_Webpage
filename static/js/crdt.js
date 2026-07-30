/* Cross-instance convergence: the Collab service's sync topology, DESIGN.md §5.

   What is real here: this page implements a small RGA (Replicated Growable Array)
   CRDT. Two independent replicas each hold their own copy, operations are shipped
   between them over a simulated pub/sub channel with latency you control, and the
   convergence check below compares the two documents character by character.

   What is simulated: the network. DeepCS itself uses Yjs, a mature CRDT library.
   the interesting part there is the sync topology (cross-instance fanout,
   snapshots, reconnect), which is exactly the part Yjs does not do for you. */

(function () {
  "use strict";

  var lab = document.getElementById("crdt-lab");
  if (!lab) return;

  /* --- Total order over operation ids ------------------------------------- */

  /* Lamport counter first, then site id as a deterministic tie-break, so both
     replicas resolve a concurrent insert identically without talking. */
  function cmpId(a, b) {
    if (a.c !== b.c) return a.c - b.c;
    return a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
  }

  function keyOf(id) {
    return id.s + ":" + id.c;
  }

  /* --- Replica ------------------------------------------------------------ */

  function Replica(site) {
    this.site = site;
    this.clock = 0;
    this.chars = []; // { id, ch, deleted }
    this.seen = {};
  }

  Replica.prototype.indexOfId = function (id) {
    if (!id) return -1;
    var k = keyOf(id);
    for (var i = 0; i < this.chars.length; i++) {
      if (keyOf(this.chars[i].id) === k) return i;
    }
    return -1;
  };

  /* RGA insert: land just after the origin, then skip any element that was
     inserted at the same spot with a higher id. Both replicas run the same
     rule over the same set of ops, so both land on the same sequence. */
  Replica.prototype.applyInsert = function (op) {
    if (this.seen[keyOf(op.id)]) return;
    this.seen[keyOf(op.id)] = true;
    this.clock = Math.max(this.clock, op.id.c);

    var i = this.indexOfId(op.origin) + 1;
    while (i < this.chars.length && cmpId(this.chars[i].id, op.id) > 0) i++;

    this.chars.splice(i, 0, { id: op.id, ch: op.ch, deleted: false, fresh: true });
  };

  Replica.prototype.applyDelete = function (op) {
    var k = keyOf(op.target);
    if (this.seen["d" + k]) return;
    this.seen["d" + k] = true;
    var i = this.indexOfId(op.target);
    if (i > -1) this.chars[i].deleted = true;
  };

  Replica.prototype.apply = function (op) {
    if (op.kind === "ins") this.applyInsert(op);
    else this.applyDelete(op);
  };

  /* Visible characters only. Tombstones stay in the array forever. */
  Replica.prototype.visible = function () {
    return this.chars.filter(function (c) {
      return !c.deleted;
    });
  };

  Replica.prototype.text = function () {
    return this.visible()
      .map(function (c) {
        return c.ch;
      })
      .join("");
  };

  Replica.prototype.localInsert = function (visibleIndex, ch) {
    var vis = this.visible();
    var origin = visibleIndex > 0 ? vis[visibleIndex - 1].id : null;
    this.clock += 1;
    var op = { kind: "ins", id: { s: this.site, c: this.clock }, origin: origin, ch: ch };
    this.applyInsert(op);
    return op;
  };

  Replica.prototype.localDelete = function (visibleIndex) {
    var vis = this.visible();
    if (visibleIndex <= 0 || visibleIndex > vis.length) return null;
    var target = vis[visibleIndex - 1].id;
    var op = { kind: "del", target: target };
    this.applyDelete(op);
    return op;
  };

  /* --- Panes -------------------------------------------------------------- */

  var wireTrack = lab.querySelector("[data-wire]");
  var latencyInput = lab.querySelector("[data-latency]");
  var latencyOut = lab.querySelector("[data-latency-out]");
  var convergedEl = lab.querySelector("[data-converged]");
  var opCountEl = lab.querySelector("[data-opcount]");
  var tombEl = lab.querySelector("[data-tombstones]");

  var panes = {};
  var opsSent = 0;

  ["a", "b"].forEach(function (side) {
    var paneEl = lab.querySelector('[data-pane="' + side + '"]');
    panes[side] = {
      side: side,
      el: paneEl,
      editor: paneEl.querySelector(".editor"),
      pauseBtn: paneEl.querySelector("[data-pause]"),
      replica: new Replica(side === "a" ? "A" : "B"),
      caret: 0,
      paused: false,
      inbox: []
    };
  });

  function latency() {
    return parseInt(latencyInput.value, 10);
  }

  /* Ship an op to the other replica through the simulated channel. */
  function publish(fromSide, op) {
    opsSent += 1;
    var toSide = fromSide === "a" ? "b" : "a";
    var target = panes[toSide];
    var ms = latency();

    animateOp(fromSide, ms);

    setTimeout(function () {
      if (target.paused) {
        target.inbox.push(op);
        updateStatus();
      } else {
        target.replica.apply(op);
        render(target);
        updateStatus();
      }
    }, ms);
  }

  /* A dot travelling the wire between the two panes. */
  function animateOp(fromSide, ms) {
    if (window.WN && window.WN.reduced) return;
    var dot = document.createElement("span");
    dot.className = "crdt__op";
    wireTrack.appendChild(dot);

    var vertical = window.matchMedia("(min-width: 901px)").matches;
    var start = fromSide === "a" ? 0 : 100;
    var end = fromSide === "a" ? 100 : 0;
    var t0 = performance.now();

    function step(now) {
      var t = Math.min(1, (now - t0) / ms);
      var p = start + (end - start) * t;
      if (vertical) dot.style.top = p + "%";
      else dot.style.left = p + "%";
      dot.style.opacity = String(Math.sin(t * Math.PI) * 0.85 + 0.15);
      if (t < 1) requestAnimationFrame(step);
      else dot.remove();
    }
    requestAnimationFrame(step);
  }

  /* --- Rendering ---------------------------------------------------------- */

  function render(pane) {
    var vis = pane.replica.visible();
    var frag = document.createDocumentFragment();

    vis.forEach(function (c, i) {
      if (i === pane.caret) frag.appendChild(caretEl());
      var span = document.createElement("span");
      span.className = "editor__char" + (c.fresh ? " editor__char--new" : "");
      span.setAttribute("data-i", String(i));
      /* Newlines need to be a real line break inside the rendered run. */
      span.textContent = c.ch === "\n" ? "\n" : c.ch;
      frag.appendChild(span);
      c.fresh = false;
    });

    if (pane.caret >= vis.length) frag.appendChild(caretEl());

    pane.editor.innerHTML = "";
    pane.editor.appendChild(frag);
  }

  function caretEl() {
    var c = document.createElement("span");
    c.className = "editor__caret";
    return c;
  }

  function updateStatus() {
    var ta = panes.a.replica.text();
    var tb = panes.b.replica.text();
    var same = ta === tb;
    var pendingA = panes.a.inbox.length;
    var pendingB = panes.b.inbox.length;

    convergedEl.className = "converged " + (same ? "is-yes" : "is-no");
    convergedEl.innerHTML = same
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> replicas identical'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/></svg> diverged, ' +
        (pendingA + pendingB) + " op(s) still in flight or buffered";

    opCountEl.textContent = String(opsSent);

    var tombs = panes.a.replica.chars.filter(function (c) {
      return c.deleted;
    }).length;
    tombEl.textContent = String(tombs);
  }

  /* --- Input handling ----------------------------------------------------- */

  function bind(pane) {
    var ed = pane.editor;
    ed.setAttribute("tabindex", "0");
    ed.setAttribute("role", "textbox");
    ed.setAttribute("aria-multiline", "true");

    ed.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var vis = pane.replica.visible();
      var handled = true;

      if (e.key === "Backspace") {
        var op = pane.replica.localDelete(pane.caret);
        if (op) {
          pane.caret -= 1;
          publish(pane.side, op);
        }
      } else if (e.key === "ArrowLeft") {
        pane.caret = Math.max(0, pane.caret - 1);
      } else if (e.key === "ArrowRight") {
        pane.caret = Math.min(vis.length, pane.caret + 1);
      } else if (e.key === "Home") {
        pane.caret = 0;
      } else if (e.key === "End") {
        pane.caret = vis.length;
      } else if (e.key === "Enter") {
        var nl = pane.replica.localInsert(pane.caret, "\n");
        pane.caret += 1;
        publish(pane.side, nl);
      } else if (e.key.length === 1) {
        var ins = pane.replica.localInsert(pane.caret, e.key);
        pane.caret += 1;
        publish(pane.side, ins);
      } else {
        handled = false;
      }

      if (handled) {
        e.preventDefault();
        render(pane);
        updateStatus();
      }
    });

    /* Click to place the caret. */
    ed.addEventListener("mousedown", function (e) {
      var span = e.target.closest(".editor__char");
      if (span) {
        var i = parseInt(span.getAttribute("data-i"), 10);
        var r = span.getBoundingClientRect();
        pane.caret = e.clientX > r.left + r.width / 2 ? i + 1 : i;
      } else {
        pane.caret = pane.replica.visible().length;
      }
      setTimeout(function () {
        render(pane);
      }, 0);
    });

    pane.pauseBtn.addEventListener("click", function () {
      pane.paused = !pane.paused;
      pane.editor.classList.toggle("is-paused", pane.paused);
      pane.pauseBtn.textContent = pane.paused ? "Reconnect" : "Drop connection";
      pane.pauseBtn.setAttribute("aria-pressed", String(pane.paused));

      if (!pane.paused && pane.inbox.length) {
        /* Reconnect: drain everything buffered while it was away. Order does
           not matter to the merge, which is the entire point of a CRDT. */
        var queued = pane.inbox.slice();
        pane.inbox = [];
        queued.forEach(function (op) {
          pane.replica.apply(op);
        });
        render(pane);
      }
      updateStatus();
    });
  }

  bind(panes.a);
  bind(panes.b);

  /* --- Seed both replicas identically ------------------------------------- */

  var seed = "## Our answer\nTCP uses a three-way handshake: ";
  var seedOps = [];
  var seeder = new Replica("S");
  for (var i = 0; i < seed.length; i++) {
    seedOps.push(seeder.localInsert(i, seed[i]));
  }
  seedOps.forEach(function (op) {
    panes.a.replica.apply(op);
    panes.b.replica.apply(op);
  });
  panes.a.caret = panes.a.replica.visible().length;
  panes.b.caret = panes.b.replica.visible().length;

  render(panes.a);
  render(panes.b);
  updateStatus();

  latencyInput.addEventListener("input", function () {
    latencyOut.textContent = latencyInput.value + " ms";
  });
  latencyOut.textContent = latencyInput.value + " ms";

  /* Type the same instant into both replicas: the concurrent-edit case. */
  lab.querySelector("[data-collide]").addEventListener("click", function () {
    var wordA = "SYN, ";
    var wordB = "SYN-ACK, ";
    var ai = 0;
    var bi = 0;

    var tick = setInterval(function () {
      if (ai < wordA.length) {
        var opA = panes.a.replica.localInsert(panes.a.caret, wordA[ai]);
        panes.a.caret += 1;
        publish("a", opA);
        render(panes.a);
        ai++;
      }
      if (bi < wordB.length) {
        var opB = panes.b.replica.localInsert(panes.b.caret, wordB[bi]);
        panes.b.caret += 1;
        publish("b", opB);
        render(panes.b);
        bi++;
      }
      updateStatus();
      if (ai >= wordA.length && bi >= wordB.length) clearInterval(tick);
    }, 90);
  });

  lab.querySelector("[data-reset-crdt]").addEventListener("click", function () {
    panes.a.replica = new Replica("A");
    panes.b.replica = new Replica("B");
    panes.a.inbox = [];
    panes.b.inbox = [];
    opsSent = 0;

    var s2 = new Replica("S");
    var ops = [];
    for (var j = 0; j < seed.length; j++) ops.push(s2.localInsert(j, seed[j]));
    ops.forEach(function (op) {
      panes.a.replica.apply(op);
      panes.b.replica.apply(op);
    });

    panes.a.caret = panes.a.replica.visible().length;
    panes.b.caret = panes.b.replica.visible().length;
    render(panes.a);
    render(panes.b);
    updateStatus();
  });
})();
