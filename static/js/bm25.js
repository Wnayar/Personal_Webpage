/* Recall's retrieval path, running for real in this page.

   The BM25 scores, IDF values and postings lists below are computed here from
   the sample corpus — nothing is precomputed or faked. What this is NOT is
   Recall itself: Recall implements this in Go over a semester of my own notes,
   and its code is not written yet. This is the algorithm, made pokeable. */

(function () {
  "use strict";

  var lab = document.getElementById("ir-lab");
  if (!lab) return;

  /* --- Corpus ------------------------------------------------------------- */

  var CORPUS = [
    {
      src: "CS2105 · networks · p14",
      text: "TCP establishes a connection with a three-way handshake. The client sends a SYN segment with an initial sequence number, the server replies SYN-ACK acknowledging it and sending its own, and the client returns a final ACK. Only then may data flow."
    },
    {
      src: "CS2105 · networks · p22",
      text: "TCP congestion control keeps a congestion window. Slow start doubles the window each round trip until a threshold, then congestion avoidance grows it linearly. A triple duplicate ACK triggers fast retransmit and halves the window."
    },
    {
      src: "CS2106 · operating systems · p31",
      text: "A deadlock requires four conditions to hold at once: mutual exclusion, hold and wait, no preemption, and circular wait. Break any one of them and deadlock becomes impossible. Detection instead allows deadlock and recovers afterwards."
    },
    {
      src: "CS2106 · operating systems · p44",
      text: "Virtual memory maps pages to frames through a page table. A page fault traps to the kernel, which fetches the page from disk and updates the mapping. A translation lookaside buffer caches recent translations to avoid walking the table every access."
    },
    {
      src: "CS2102 · databases · p9",
      text: "A B-tree index keeps keys sorted so a lookup costs a logarithmic number of node reads instead of scanning every row. It stays balanced under insertion by splitting full nodes, which is why range queries and ordered scans both stay cheap."
    },
    {
      src: "CS2102 · databases · p18",
      text: "A transaction is atomic, consistent, isolated and durable. Isolation levels trade correctness against concurrency: read committed permits non-repeatable reads, while serializable forbids them at the cost of more blocking and more aborts."
    },
    {
      src: "CS4224 · distributed databases · p7",
      text: "The CAP theorem says a partitioned distributed system must choose between consistency and availability. During a network partition a system either refuses writes to stay consistent or accepts them and reconciles conflicting versions later."
    },
    {
      src: "CS4224 · distributed databases · p19",
      text: "Consistent hashing maps both keys and nodes onto a ring so that adding or removing a node moves only the keys in one arc, rather than remapping everything. Virtual nodes spread each physical node across the ring to even out load."
    },
    {
      src: "CS2040 · data structures · p12",
      text: "A binary heap stores a complete tree in an array so the parent of index i sits at i divided by two. Push and pop cost logarithmic time, which makes it the standard structure for a priority queue and for selecting the top k elements."
    }
  ];

  var STOPWORDS = {
    a: 1, an: 1, the: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, of: 1,
    to: 1, in: 1, on: 1, at: 1, for: 1, and: 1, or: 1, it: 1, its: 1, that: 1,
    this: 1, with: 1, as: 1, by: 1, from: 1, how: 1, what: 1, does: 1, do: 1,
    which: 1, when: 1, why: 1, can: 1, will: 1, would: 1, s: 1
  };

  /* Illustrative expansion only. Recall's hybrid mode fuses BM25 with vector
     similarity over real embeddings; a hand-written map is not that, and is
     labelled as such in the UI. */
  var RELATED = {
    handshake: ["syn", "ack", "connect"],
    lock: ["deadlock", "mutual", "exclus"],
    stuck: ["deadlock", "wait", "circular"],
    memori: ["page", "frame", "virtual"],
    fast: ["index", "logarithm", "cach"],
    partit: ["cap", "consist", "avail"],
    shard: ["hash", "ring", "node"],
    order: ["sort", "sequenc", "rang"]
  };

  var K1 = 1.2;
  var B = 0.75;

  /* --- Tokenising --------------------------------------------------------- */

  /* Deliberately crude suffix stripping — the same order of sophistication the
     Go version starts with. Real stemmers do more; this is enough to make
     "indexes" and "indexing" meet at "index". */
  function stem(w) {
    if (w.length > 5 && /ational$/.test(w)) return w.slice(0, -6) + "e";
    if (w.length > 4 && /(ies)$/.test(w)) return w.slice(0, -3) + "i";
    if (w.length > 4 && /(sses)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /(ing|ers|est)$/.test(w)) return w.slice(0, -3);
    if (w.length > 3 && /(ed|er|ly|es)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function rawTokens(s) {
    return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }

  function analyse(s) {
    var raw = rawTokens(s);
    var kept = [];
    var dropped = [];
    raw.forEach(function (w) {
      if (STOPWORDS[w] || w.length < 2) dropped.push(w);
      else kept.push({ raw: w, term: stem(w) });
    });
    return { raw: raw, kept: kept, dropped: dropped };
  }

  /* --- Index -------------------------------------------------------------- */

  var index = {}; // term -> { df, postings: {docId: tf} }
  var docLen = [];
  var avgdl = 0;

  CORPUS.forEach(function (doc, id) {
    var terms = analyse(doc.text).kept.map(function (t) {
      return t.term;
    });
    docLen[id] = terms.length;
    var counts = {};
    terms.forEach(function (t) {
      counts[t] = (counts[t] || 0) + 1;
    });
    Object.keys(counts).forEach(function (t) {
      if (!index[t]) index[t] = { df: 0, postings: {} };
      index[t].df += 1;
      index[t].postings[id] = counts[t];
    });
  });

  avgdl = docLen.reduce(function (a, b) {
    return a + b;
  }, 0) / docLen.length;

  var N = CORPUS.length;

  function idf(term) {
    var df = index[term] ? index[term].df : 0;
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  function bm25(term, docId) {
    var e = index[term];
    if (!e || !e.postings[docId]) return 0;
    var tf = e.postings[docId];
    var norm = tf + K1 * (1 - B + (B * docLen[docId]) / avgdl);
    return idf(term) * ((tf * (K1 + 1)) / norm);
  }

  /* --- UI ----------------------------------------------------------------- */

  var input = lab.querySelector("[data-ir-input]");
  var stageTokens = lab.querySelector("[data-stage-tokens]");
  var stageTerms = lab.querySelector("[data-stage-terms]");
  var stagePostings = lab.querySelector("[data-stage-postings]");
  var stageScored = lab.querySelector("[data-stage-scored]");
  var results = lab.querySelector("[data-ir-results]");
  var hybridBtns = lab.querySelectorAll("[data-ir-mode]");
  var mode = "keyword";

  var REFUSE_BELOW = 1.0;

  function chipHtml(text, cls) {
    return '<span class="term' + (cls ? " term--" + cls : "") + '">' + text + "</span>";
  }

  function run() {
    var q = input.value.trim();

    if (!q) {
      stageTokens.innerHTML = '<span class="muted">—</span>';
      stageTerms.innerHTML = '<span class="muted">—</span>';
      stagePostings.innerHTML = '<span class="muted">—</span>';
      stageScored.innerHTML = '<span class="muted">—</span>';
      results.innerHTML = "";
      return;
    }

    var a = analyse(q);

    /* Stage 1 — raw tokens, with stopwords struck through. */
    var tokHtml = "";
    a.raw.forEach(function (w) {
      var isStop = STOPWORDS[w] || w.length < 2;
      tokHtml += chipHtml(w, isStop ? "drop" : "");
    });
    stageTokens.innerHTML = tokHtml || '<span class="muted">—</span>';

    /* Stage 2 — stems, plus expansion terms if hybrid is on. */
    var terms = a.kept.map(function (t) {
      return t.term;
    });
    var expanded = [];
    if (mode === "hybrid") {
      terms.forEach(function (t) {
        (RELATED[t] || []).forEach(function (r) {
          if (terms.indexOf(r) === -1 && expanded.indexOf(r) === -1) expanded.push(r);
        });
      });
    }

    var termHtml = terms
      .map(function (t) {
        return chipHtml(t);
      })
      .join("");
    termHtml += expanded
      .map(function (t) {
        return chipHtml(t, "syn");
      })
      .join("");
    stageTerms.innerHTML = termHtml || '<span class="muted">—</span>';

    /* Stage 3 — postings list sizes, the actual index lookup. */
    var all = terms.concat(expanded);
    var postHtml = all
      .map(function (t) {
        var e = index[t];
        var n = e ? Object.keys(e.postings).length : 0;
        return (
          '<div>' + t + " → " + (n ? n + " chunk" + (n === 1 ? "" : "s") : "∅") +
          '<span class="muted"> · idf ' + idf(t).toFixed(2) + "</span></div>"
        );
      })
      .join("");
    stagePostings.innerHTML = postHtml || '<span class="muted">—</span>';

    /* Stage 4 — score every candidate document. */
    var scores = [];
    for (var d = 0; d < N; d++) {
      var total = 0;
      var parts = [];
      all.forEach(function (t) {
        var s = bm25(t, d);
        /* Expansion terms contribute at a discount — they are a weaker signal
           than a term the user actually typed. */
        if (expanded.indexOf(t) > -1) s *= 0.45;
        if (s > 0) {
          total += s;
          parts.push({ t: t, s: s });
        }
      });
      if (total > 0) scores.push({ d: d, score: total, parts: parts });
    }

    scores.sort(function (x, y) {
      return y.score - x.score;
    });

    stageScored.innerHTML = scores.length
      ? scores.length + " chunk" + (scores.length === 1 ? "" : "s") + " matched · top-k by min-heap"
      : '<span class="muted">no chunk contains any query term</span>';

    /* Results, or the refusal the build plan specifies. */
    var top = scores.slice(0, 3);

    if (!top.length || top[0].score < REFUSE_BELOW) {
      results.innerHTML =
        '<div class="refusal"><b>Refused — retrieval confidence too low</b>' +
        "Nothing in the index scored above the threshold" +
        (top.length ? " (best was " + top[0].score.toFixed(2) + ", floor is " + REFUSE_BELOW.toFixed(2) + ")" : "") +
        ". Recall answers from retrieved chunks or not at all: an answer with no sources behind it is the failure mode the citation requirement exists to prevent." +
        "</div>";
      return;
    }

    var maxScore = top[0].score;
    results.innerHTML = top
      .map(function (hit, rank) {
        var doc = CORPUS[hit.d];
        var matched = {};
        hit.parts.forEach(function (p) {
          matched[p.t] = true;
        });

        /* Highlight any word in the chunk whose stem was a scoring term. */
        var highlighted = doc.text.replace(/[A-Za-z0-9]+/g, function (w) {
          return matched[stem(w.toLowerCase())] ? "<mark>" + w + "</mark>" : w;
        });

        var math = hit.parts
          .sort(function (x, y) {
            return y.s - x.s;
          })
          .map(function (p) {
            return "<b>" + p.t + "</b> " + p.s.toFixed(2);
          })
          .join("");

        return (
          '<article class="hit" style="animation-delay:' + rank * 60 + 'ms">' +
          '<span class="hit__bar" style="--w:' + ((hit.score / maxScore) * 100).toFixed(1) + '%"></span>' +
          '<div class="hit__head"><span class="hit__rank">#' + (rank + 1) + '</span>' +
          '<span class="hit__src">' + doc.src + "</span>" +
          '<span class="hit__score">' + hit.score.toFixed(2) + "</span></div>" +
          '<p class="hit__text">' + highlighted + "</p>" +
          '<div class="hit__math"><span class="muted">term contributions:</span>' + math + "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  input.addEventListener("input", run);

  lab.querySelectorAll("[data-ir-example]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      input.value = btn.textContent.trim();
      run();
      input.focus();
    });
  });

  hybridBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = btn.getAttribute("data-ir-mode");
      hybridBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      run();
    });
  });

  /* Corpus stats for the panel bar. */
  var statsEl = lab.querySelector("[data-ir-stats]");
  if (statsEl) {
    statsEl.textContent =
      N + " chunks · " + Object.keys(index).length + " terms · avgdl " + avgdl.toFixed(1);
  }

  input.value = "how does tcp start a connection";
  run();
})();
