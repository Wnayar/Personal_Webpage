/* Recall's retrieval path, running for real in this page.

   The BM25 scores, IDF values and postings lists below are computed here from
   the sample corpus. Nothing is precomputed or faked. What this is NOT is
   Recall itself: Recall implements this in Go over a semester of my own notes,
   and its code is not written yet. This is the algorithm, made pokeable. */

(function () {
  "use strict";

  var lab = document.getElementById("ir-lab");
  if (!lab) return;

  /* --- Corpus ------------------------------------------------------------- */

  var CORPUS = [
    {
      src: "Computer networks",
      text: "TCP opens a connection with a three-way handshake: the client sends SYN, the server replies SYN-ACK, the client answers ACK. Only then can data flow."
    },
    {
      src: "Computer networks",
      text: "TCP congestion control keeps a window. Slow start doubles it each round trip, then it grows linearly. Three duplicate ACKs halve it and trigger a fast retransmit."
    },
    {
      src: "Operating systems",
      text: "A deadlock needs four conditions at once: mutual exclusion, hold and wait, no preemption, and circular wait. Break any one and deadlock becomes impossible."
    },
    {
      src: "Operating systems",
      text: "Virtual memory maps pages to frames through a page table. A page fault traps to the kernel, which fetches the page from disk. A TLB caches recent translations."
    },
    {
      src: "Databases",
      text: "A B-tree index keeps keys sorted, so a lookup reads a handful of nodes instead of scanning every row. It stays balanced by splitting full nodes."
    },
    {
      src: "Databases",
      text: "A transaction is atomic, consistent, isolated and durable. Isolation levels trade correctness for concurrency: serializable is safest but blocks and aborts more."
    },
    {
      src: "Distributed systems",
      text: "During a network partition a distributed system must choose: refuse writes and stay consistent, or accept them and reconcile the conflicts later."
    },
    {
      src: "Distributed systems",
      text: "Consistent hashing puts keys and nodes on a ring, so adding a node moves only one arc of keys instead of remapping everything."
    },
    {
      src: "Data structures",
      text: "A binary heap stores a tree in an array, so push and pop stay cheap. It is the usual way to keep the top k of something."
    }
  ];

  var STOPWORDS = {
    a: 1, an: 1, the: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, of: 1,
    to: 1, in: 1, on: 1, at: 1, for: 1, and: 1, or: 1, it: 1, its: 1, that: 1,
    this: 1, with: 1, as: 1, by: 1, from: 1, how: 1, what: 1, does: 1, do: 1,
    which: 1, when: 1, why: 1, can: 1, will: 1, would: 1, s: 1
  };

  var K1 = 1.2;
  var B = 0.75;

  /* --- Tokenising --------------------------------------------------------- */

  /* Deliberately crude suffix stripping, the same order of sophistication the
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
  var matchedEl = lab.querySelector("[data-ir-matched]");
  var results = lab.querySelector("[data-ir-results]");

  var REFUSE_BELOW = 1.0;

  function chipHtml(text, cls) {
    return '<span class="term' + (cls ? " term--" + cls : "") + '">' + text + "</span>";
  }

  function run() {
    var q = input.value.trim();

    if (!q) {
      matchedEl.textContent = "";
      results.innerHTML = "";
      return;
    }

    var a = analyse(q);
    var terms = a.kept.map(function (t) {
      return t.term;
    });
    var expanded = [];
    var all = terms;

    /* Score every candidate chunk. */
    var scores = [];
    for (var d = 0; d < N; d++) {
      var total = 0;
      var parts = [];
      all.forEach(function (t) {
        var s = bm25(t, d);
        /* Expansion terms contribute at a discount, since they are a weaker signal
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

    /* One plain line instead of a four-stage jargon pipeline. */
    var used = terms.filter(function (t) {
      return index[t] && Object.keys(index[t].postings).length;
    });
    matchedEl.innerHTML = used.length
      ? "Searching for " + used.map(function (t) { return "<b>" + t + "</b>"; }).join(", ") +
        " · found " + scores.length + " result" + (scores.length === 1 ? "" : "s")
      : "None of those words appear anywhere in the notes.";

    /* Results, or the refusal the build plan specifies. */
    var top = scores.slice(0, 2);

    if (!top.length || top[0].score < REFUSE_BELOW) {
      results.innerHTML =
        '<div class="refusal"><b>No answer</b>' +
        "Nothing in the notes is a good enough match" +
        (top.length ? " (best score " + top[0].score.toFixed(2) + ", it needs " + REFUSE_BELOW.toFixed(2) + ")" : "") +
        ". It would rather say nothing than make something up." +
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

        return (
          '<article class="hit" style="animation-delay:' + rank * 60 + 'ms">' +
          '<span class="hit__bar" style="--w:' + ((hit.score / maxScore) * 100).toFixed(1) + '%"></span>' +
          '<div class="hit__head"><span class="hit__rank">#' + (rank + 1) + '</span>' +
          '<span class="hit__src">' + doc.src + "</span>" +
          '<span class="hit__score">' + hit.score.toFixed(2) + "</span></div>" +
          '<p class="hit__text">' + highlighted + "</p>" +
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

  /* Corpus stats for the panel bar. */
  var statsEl = lab.querySelector("[data-ir-stats]");
  if (statsEl) {
    statsEl.textContent = N + " notes indexed";
  }

  input.value = "how does tcp start a connection";
  run();
})();
