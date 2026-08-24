/* DeepCS architecture, in two versions.

   v1 is the six-service system this project started as: Docker, Redis,
   PostgreSQL, WebSockets, live collaborative editing. v2 is what replaced it
   after early users showed no appetite for the collaborative half: one
   Cloudflare Worker at the edge, with D1 behind it.

   Both draw the *designed* system. Neither is wired to a running deployment;
   the packets walk the request paths described in DESIGN.md. */

(function () {
  "use strict";

  var stage = document.getElementById("topo-stage");
  if (!stage) return;

  var reduced = (window.WN && window.WN.reduced) || false;
  var NS = "http://www.w3.org/2000/svg";

  /* ======================================================================
     v1 -- six services on Cloud Run
     ====================================================================== */

  var V1 = {
    key: "v1",
    label: "v1 · six services",
    note: "retired · Docker, Redis, PostgreSQL, WebSockets",
    view: "0 0 960 620",
    aria:
      "DeepCS v1: browsers enter through a gateway, which routes to Users, Questions, Matching and Collab on Cloud Run; " +
      "a scheduled Stats job drains an event log; PostgreSQL and Redis sit behind them.",

    zones: [
      { x: 10, y: 200, w: 940, h: 250, label: "Cloud Run · stateless, scales to zero", lx: 24, ly: 216 },
      { x: 130, y: 470, w: 560, h: 112, label: "Managed free tiers · always on", lx: 144, ly: 488 }
    ],

    legend: [
      { line: true, text: "request path" },
      { line: true, dash: true, text: "service-to-service call" },
      { box: true, text: "stacked = scales 0 to 2 instances" },
      { text: "amber = the only always-on machines" }
    ],

    nodes: [
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
        kindLabel: "Service · the hard part, and the part that went",
        info: [
          ["Owns", "Live Yjs documents and their snapshots."],
          ["Why separate", "Forced by the platform. One WebSocket occupies a concurrency slot for twenty minutes; this service needs the opposite --concurrency and --timeout values from every other one, and those are per-service flags."],
          ["Detail", "Cross-instance sync goes through a Redis channel per session, because the two users may be connected to different instances. Sticky sessions cannot fix that, because affinity pins a client, not a pair."],
          ["What happened to it", "Deleted. It was the most interesting thing here and nobody asked for it, so v2 does not have it."]
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
    ],

    edges: [
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
    ],

    /* Scenario scripts. Every caption is a claim taken from DESIGN.md. */
    scenarios: {
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
        close: "This is the most interesting path in v1, and it is the one that killed v1. Nobody used it. Everything here was built to make two people type in one document, and the users who arrived wanted to read and practise alone."
      },
      stats: {
        label: "The stats drain",
        steps: [
          { nodes: ["stats"], edges: [], text: "Cloud Scheduler starts the Stats job every 5 minutes. It is a job, not a server: a scale-to-zero service has no running process for a timer to fire inside." },
          { nodes: ["stats", "redis"], edges: ["e17"], text: "It reads everything past its bookmark on the events stream, an append-only log, so reading never deletes. Services appended those events fire-and-forget; a log hiccup never fails a user request." },
          { nodes: ["stats", "pg"], edges: ["e18"], text: "Summaries and aggregates are written to Postgres, and only then are the entries acked. A crash mid-batch means redelivery, not loss. Delivery is at-least-once." },
          { nodes: ["stats"], edges: [], text: "So every write is idempotent, keyed by entry ID. That is what converts at-least-once into effectively exactly-once. With a queue instead of a log, a bug in this logic would have destroyed the data needed to recompute." }
        ],
        close: "A log keeps entries after reading. Rewind the bookmark after a bug fix, or add a consumer later, and the history is still there. The idempotency habit is the one thing from v1 that survived into v2 unchanged."
      }
    },

    /* Single-column re-lay for phones. Same nodes, same edges, new geometry. */
    mobile: {
      w: 360, h: 560,
      entry: "e1",
      stores: ["pg", "redis"],
      box: {
        client:    { x: 64, y: 6, w: 232, h: 38 },
        gw:        { x: 64, y: 68, w: 232, h: 44 },
        users:     { x: 64, y: 142, w: 232, h: 40 },
        questions: { x: 64, y: 194, w: 232, h: 40 },
        matching:  { x: 64, y: 246, w: 232, h: 40 },
        collab:    { x: 64, y: 298, w: 232, h: 40 },
        stats:     { x: 64, y: 366, w: 232, h: 40 },
        pg:        { x: 64, y: 452, w: 232, h: 40 },
        redis:     { x: 64, y: 506, w: 232, h: 40 }
      }
    }
  };

  /* ======================================================================
     v2 -- one Cloudflare Worker at the edge
     ====================================================================== */

  var V2 = {
    key: "v2",
    label: "v2 · one edge Worker",
    note: "live at deepcs.org · one deployment, $0 idle",
    view: "0 0 960 600",
    aria:
      "DeepCS v2: a browser talks to a single Cloudflare Worker that routes, verifies the Firebase token, " +
      "enforces the paywall and rate limit, and handles Stripe webhooks; D1 sits behind it, with Firebase Auth " +
      "and Stripe as bought services.",

    zones: [
      { x: 60, y: 130, w: 840, h: 250, label: "One Cloudflare Worker · one deployment, nothing running between requests", lx: 74, ly: 150 }
    ],

    legend: [
      { line: true, text: "request path" },
      { line: true, dash: true, text: "inside the same Worker" },
      { box: true, text: "no stacks: there are no instances to count" },
      { text: "blue = bought, not built" }
    ],

    nodes: [
      {
        id: "client",
        label: "One reader",
        sub: "React app, served from the edge",
        x: 350, y: 20, w: 260, h: 52,
        kind: "client",
        kindLabel: "Browser",
        info: [
          ["Talks to", "The Worker for everything, and Stripe's hosted checkout for exactly one thing: paying."],
          ["Carries", "A Firebase ID token. It also carries a user id in its own state, and the server ignores that id completely."]
        ]
      },
      {
        id: "edge",
        label: "Worker entry",
        sub: "route · serve the app",
        idx: "1",
        x: 340, y: 172, w: 280, h: 56,
        kind: "svc",
        kindLabel: "The whole server · [built]",
        info: [
          ["Owns", "Routing, and the React bundle itself. The same Worker that answers the API also serves the app, so there is no second thing to deploy, configure or pay for."],
          ["Why one", "v1 had six services because I wanted to learn distributed systems, and that was a good reason to build it. It was not a good reason to keep it. One process is the correct shape for this much traffic."],
          ["What it costs", "Nothing at rest. There is no container to keep warm, so an idle month and a busy month differ by the requests actually served."]
        ]
      },
      {
        id: "auth",
        label: "Verify",
        sub: "Firebase JWT · JWKS",
        idx: "2",
        x: 90, y: 296, w: 220, h: 64,
        kind: "svc",
        kindLabel: "Handler · [built]",
        info: [
          ["Owns", "Deciding who the caller is. Nothing else in the Worker is allowed to answer that question."],
          ["The rule", "The user id comes out of the verified token, never out of the request. No route reads a user id the client sent, which kills the entire class of bug rather than the instance of it I happened to think of."],
          ["Detail", "Verification is against Google's published JWKS. There is no service-account credential here, so this code can check a token and could not mint one if it were compromised."]
        ]
      },
      {
        id: "gate",
        label: "Gate + serve",
        sub: "paywall · rate limit · content",
        idx: "3",
        x: 370, y: 296, w: 220, h: 64,
        kind: "svc",
        kindLabel: "Handler · [built]",
        info: [
          ["Owns", "Whether this verified user is allowed this content, and how often they may ask."],
          ["Server-side, always", "The client decides what to show. It never decides what to allow. Paid content is not fetched and hidden; it is not sent."],
          ["Detail", "Rate limits are per user, not per IP, because the id is trustworthy by the time this code runs. Both the limit counter and the entitlement live in D1, so the check is one hop away."]
        ]
      },
      {
        id: "pay",
        label: "Payments",
        sub: "Stripe webhooks",
        idx: "4",
        x: 650, y: 296, w: 220, h: 64,
        kind: "svc",
        kindLabel: "Handler · [built]",
        info: [
          ["Owns", "The only code path in the system that can grant access."],
          ["Signature first", "The payload is verified against Stripe's signature before it is parsed. An unsigned or replayed body is rejected without ever being believed."],
          ["Idempotent", "Writes are keyed on Stripe's event id. Webhooks are delivered at least once by design, so the second delivery has to land on the same row and change nothing."]
        ]
      },
      {
        id: "firebase",
        label: "Firebase Auth",
        sub: "identity · JWKS",
        x: 100, y: 490, w: 200, h: 64,
        kind: "ext",
        kindLabel: "Bought · not built",
        info: [
          ["Why bought", "Auth is the one thing where being clever is purely downside. Sessions, resets, provider flows and token rotation are solved, audited, and not my competitive edge."],
          ["What I kept", "Verification. Issuing tokens is theirs; deciding what a verified user may do is entirely mine."]
        ]
      },
      {
        id: "d1",
        label: "D1",
        sub: "users · entitlements · limits",
        x: 380, y: 490, w: 200, h: 64,
        kind: "store",
        kindLabel: "SQLite at the edge",
        info: [
          ["Holds", "Profiles, entitlements, progress and rate-limit counters. Two tables of it matter; the rest is convenience."],
          ["Why it can be lost", "The entitlements table is a cache of a fact Stripe already owns. That is deliberate, and it is what makes the rebuild path below possible."],
          ["Versus v1", "v1 ran PostgreSQL and Redis, five jobs across two managed instances. One SQLite database does all of it now, because the load never justified either."]
        ]
      },
      {
        id: "stripe",
        label: "Stripe",
        sub: "checkout · the ledger",
        x: 660, y: 490, w: 200, h: 64,
        kind: "ext",
        kindLabel: "Bought · and the source of truth",
        info: [
          ["Why bought", "Card details never touch my code, so PCI scope, disputes and tax stay where the expertise is."],
          ["Source of truth", "Stripe's ledger is authoritative, not my database. Every payment it processes is replayable, so access can be rebuilt from it after any data loss."],
          ["Detail", "Checkout is Stripe-hosted. The browser leaves my Worker to pay and comes back, which means no code of mine ever sees a card number."]
        ]
      }
    ],

    edges: [
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
    ],

    scenarios: {
      gated: {
        label: "A request for paid content",
        steps: [
          { nodes: ["client", "edge"], edges: ["e1"], text: "The browser asks for a paid lesson. There is one Worker and one entry point, and the code that serves the React app is the same code that answers the API. Nothing else is reachable, because nothing else exists." },
          { nodes: ["edge", "auth"], edges: ["e2"], text: "Before anything is decided, the caller is identified. Exactly one place in this system answers the question 'who is this', which is the only property that made v1's gateway worth keeping." },
          { nodes: ["auth", "firebase"], edges: ["e6"], text: "The Firebase ID token is verified against Google's published JWKS. There is no service-account key in this Worker, so the code can check a token and could not issue one." },
          { nodes: ["auth", "gate"], edges: ["e5"], text: "The user id is taken from the verified token, never from the request body or a header the client controls. That is not a guard against one attack; it removes a whole family of them at once." },
          { nodes: ["gate", "d1"], edges: ["e7"], text: "The gate spends a per-user rate-limit token and reads the entitlement, both from D1. No entitlement means the request is refused right here, before any content is loaded." },
          { nodes: ["gate"], edges: [], text: "Only now is the lesson read and returned. Paid content is never sent and hidden by the client. If the check fails, the bytes do not leave the server." }
        ],
        close: "Six services became four handlers in one file. Every enforcement property v1 had is still here, and none of it needs a container running to be true."
      },
      purchase: {
        label: "Someone pays",
        steps: [
          { nodes: ["client", "stripe"], edges: ["e10"], text: "Checkout happens on Stripe's page, not mine. The browser leaves the Worker entirely, so no code I wrote ever sees a card number and PCI scope stays where the expertise is." },
          { nodes: ["stripe", "pay"], edges: ["e9"], text: "When the payment settles, Stripe POSTs a webhook to the Worker. This is the only path in the system that can grant access, and it arrives from Stripe rather than from a browser I do not control." },
          { nodes: ["pay"], edges: [], text: "The signature is checked before the body is parsed. An unsigned or replayed payload is rejected while it is still bytes, so nobody grants themselves a subscription by posting a plausible-looking JSON object." },
          { nodes: ["pay", "d1"], edges: ["e8"], text: "The entitlement is written keyed on Stripe's event id. Webhooks are delivered at least once by design, so a redelivery has to land on the same row and change nothing. Idempotency is not a nicety here, it is the contract." },
          { nodes: ["gate", "d1"], edges: ["e7"], text: "The next request from that user finds the entitlement and passes the gate. Access was granted by a payment, not by a request that claimed a payment happened." }
        ],
        close: "Notice what my database is holding: a copy of something Stripe already knows. That is deliberate, and the next path is why."
      },
      rebuild: {
        label: "Rebuilding after data loss",
        steps: [
          { nodes: ["d1"], edges: [], text: "Suppose D1 is gone. Entitlements, the rows that decide who has access to what, are wiped, and anyone who has bought a tier is locked out of it." },
          { nodes: ["stripe", "pay"], edges: ["e9"], text: "Stripe still knows. Every payment it has processed sits in its ledger, and every one of those events can be replayed against the same webhook handler that first handled it." },
          { nodes: ["pay", "d1"], edges: ["e8"], text: "Replaying rebuilds the table, because the write was idempotent and keyed on the event id from the beginning. The code path that grants access live is the code path that restores it. There is no separate recovery script to be wrong." },
          { nodes: ["gate", "d1"], edges: ["e7"], text: "The gate reads the restored rows and everyone is back in. No support queue, no refunds, no asking users to prove what they bought. This path is covered by the end-to-end tests, so it is something I have run rather than something I hope works." }
        ],
        close: "This works because of a decision made before there was anything to lose: keep Stripe's ledger authoritative and treat my own table as a cache of it. Design it the other way round and a lost database is a business problem, not an afternoon."
      }
    },

    mobile: {
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
    }
  };

  var ARCH = { v1: V1, v2: V2 };

  /* ======================================================================
     Rendering. Everything below is architecture-agnostic: it reads whichever
     definition is currently mounted, so adding a v3 is a data change.
     ====================================================================== */

  var capStep = document.getElementById("topo-cap-step");
  var capText = document.getElementById("topo-cap-text");
  var ctrls = document.getElementById("topo-controls");
  var btnPrev = document.getElementById("topo-prev");
  var btnPlay = document.getElementById("topo-play");
  var btnNext = document.getElementById("topo-next");
  var inspect = document.getElementById("topo-inspect");
  var scenarioHost = document.getElementById("topo-scenarios");
  var legendHost = document.getElementById("topo-legend");
  var archSwitch = document.getElementById("topo-arch");
  var archNote = document.querySelector("[data-arch-note]");

  var DWELL = 4600;
  var IDLE_TEXT = "Pick a request path, or tap any part of the system to see what it owns.";
  var EMPTY_INSPECT =
    '<p class="topo__inspect-empty">Tap a box to see what it owns. Tap it again to close.</p>';

  /* Current mount. Everything in here is torn down and rebuilt on a switch. */
  var A = null;          // active architecture definition
  var svg = null;
  var packetLayer = null;
  var nodeEls = {};
  var edgeEls = {};
  var zoneEls = [];
  var byId = {};
  var isMobile = null;
  var selected = null;
  var livePackets = [];
  var player = { key: null, i: 0, playing: false, timer: null };

  function scenarioActive() {
    return !!player.key;
  }

  /* --- Mobile edge routing ------------------------------------------------
     The wide diagram needs a sideways swipe on a phone, which is a poor way to
     read a system. On narrow screens the same nodes become a single column,
     with edges routed through channels down either side. Routes are generated
     from the box positions rather than hand-authored per architecture. */

  var M_LEFT = 30;   // channel for entry-point to handler edges
  var M_INNER = 47;  // channel for calls between siblings
  var M_RIGHT = 332; // channel for anything touching a datastore

  function mcy(id) {
    var b = A.mobile.box[id];
    return b.y + b.h / 2;
  }

  function mobileEdge(e) {
    var a = A.mobile.box[e.from];
    var b = A.mobile.box[e.to];
    if (!a || !b) return "";
    var ay = mcy(e.from);
    var by = mcy(e.to);

    if (e.id === A.mobile.entry) {
      return "M180," + (a.y + a.h) + " L180," + b.y;
    }
    if (A.mobile.stores.indexOf(e.to) > -1 || A.mobile.stores.indexOf(e.from) > -1) {
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

  /* --- Build -------------------------------------------------------------- */

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    (parent || svg).appendChild(node);
    return node;
  }

  function buildSvg() {
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", A.view);
    svg.setAttribute("class", "topo__svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", A.aria);

    zoneEls = [];
    A.zones.forEach(function (z) {
      zoneEls.push(el("rect", { class: "zone", x: z.x, y: z.y, width: z.w, height: z.h, rx: 14 }));
      var label = el("text", { class: "zone__label", x: z.lx, y: z.ly });
      label.textContent = z.label;
      zoneEls.push(label);
    });

    /* Edges first so nodes paint over them. */
    edgeEls = {};
    A.edges.forEach(function (e) {
      var cls = "edge";
      if (e.type === "internal") cls += " edge--internal";
      if (e.type === "data") cls += " edge--data";
      edgeEls[e.id] = el("path", { class: cls, d: e.d, id: "topo-" + e.id });
    });

    nodeEls = {};
    byId = {};
    A.nodes.forEach(function (n) {
      byId[n.id] = n;

      var g = el("g", {
        class: "node node--" + n.kind,
        tabindex: "0",
        role: "button",
        "aria-label": n.label + ": " + n.kindLabel
      });

      var stackEl = null;
      if (n.stack) {
        stackEl = el("rect", { class: "node__stack", x: n.x + 5, y: n.y - 5, width: n.w, height: n.h, rx: 9 }, g);
      }
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

      g.__parts = { stack: stackEl, box: boxEl, label: t1, sub: t2, idx: t3 };
      nodeEls[n.id] = g;

      var select = function () {
        if (selected === n.id) deselectNode();
        else selectNode(n.id);
      };
      g.addEventListener("click", select);
      g.addEventListener("mouseenter", function () {
        if (!scenarioActive()) hoverNode(n.id);
      });
      g.addEventListener("mouseleave", function () {
        if (!scenarioActive()) clearHighlight();
      });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select();
        }
      });
    });

    packetLayer = el("g", { class: "packet-layer" });
    stage.appendChild(svg);
  }

  /* --- Layout switching --------------------------------------------------- */

  function applyLayout(mobile) {
    isMobile = mobile;

    svg.setAttribute("viewBox", mobile ? "0 0 " + A.mobile.w + " " + A.mobile.h : A.view);
    svg.classList.toggle("topo__svg--stacked", mobile);

    zoneEls.forEach(function (z) {
      z.style.display = mobile ? "none" : "";
    });

    A.nodes.forEach(function (n) {
      var box = mobile ? A.mobile.box[n.id] : n;
      var g = nodeEls[n.id];
      var parts = g.__parts;
      var cx = box.x + box.w / 2;

      if (parts.stack) {
        parts.stack.setAttribute("x", box.x + 5);
        parts.stack.setAttribute("y", box.y - 5);
        parts.stack.setAttribute("width", box.w);
        parts.stack.setAttribute("height", box.h);
        parts.stack.style.display = mobile ? "none" : "";
      }
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

    A.edges.forEach(function (e) {
      edgeEls[e.id].setAttribute("d", mobile ? mobileEdge(e) : e.d);
    });
  }

  var mq = window.matchMedia("(max-width: 1000px)");
  if (mq.addEventListener) {
    mq.addEventListener("change", function (ev) {
      if (A) applyLayout(ev.matches);
    });
  } else if (mq.addListener) {
    mq.addListener(function (ev) {
      if (A) applyLayout(ev.matches);
    });
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

  /* Hovering a node lights it and everything it touches. */
  function hoverNode(id) {
    var eIds = [];
    var nIds = [id];
    A.edges.forEach(function (e) {
      if (e.from === id || e.to === id) {
        eIds.push(e.id);
        nIds.push(e.from === id ? e.to : e.from);
      }
    });
    highlight(nIds, eIds);
  }

  /* --- Inspector ---------------------------------------------------------- */

  function deselectNode() {
    selected = null;
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.remove("is-sel");
    });
    inspect.innerHTML = EMPTY_INSPECT;
    if (!scenarioActive()) clearHighlight();
  }

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

    if (!scenarioActive()) hoverNode(id);
  }

  /* --- Packets ------------------------------------------------------------ */

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

  /* --- Scenario player ----------------------------------------------------
     The captions carry real detail, so this is a stepper rather than a fixed
     animation: it can be paused, and stepped back and forth by hand. */

  function clearTimer() {
    if (player.timer) {
      clearTimeout(player.timer);
      player.timer = null;
    }
  }

  function scenarioButtons() {
    return scenarioHost ? scenarioHost.querySelectorAll(".scenario-btn") : [];
  }

  function syncControls() {
    var sc = A.scenarios[player.key];
    var active = !!sc;
    if (ctrls) ctrls.hidden = !active;

    Array.prototype.forEach.call(scenarioButtons(), function (b) {
      b.classList.toggle("is-running", active && b.getAttribute("data-scenario") === player.key);
    });
    if (!active) return;

    btnPrev.disabled = player.i <= 0;
    btnNext.disabled = player.i >= sc.steps.length;
    btnPlay.setAttribute("aria-pressed", String(player.playing));
    btnPlay.querySelector("[data-play-label]").textContent = player.playing
      ? "Pause"
      : player.i >= sc.steps.length
      ? "Replay"
      : "Play";
    btnPlay.classList.toggle("is-playing", player.playing);
  }

  function renderStep() {
    var sc = A.scenarios[player.key];
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
    capStep.textContent = "Step " + (player.i + 1) + " of " + sc.steps.length + " · " + sc.label;
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

  function startScenario(key) {
    player.key = key;
    player.i = 0;
    player.playing = true;
    renderStep();
    tick();
  }

  function stopScenario() {
    clearTimer();
    clearPackets();
    player.key = null;
    player.playing = false;
    clearHighlight();
    Array.prototype.forEach.call(scenarioButtons(), function (b) {
      b.classList.remove("is-running");
    });
    if (ctrls) ctrls.hidden = true;
    capStep.textContent = "Idle";
    capText.textContent = IDLE_TEXT;
  }

  if (btnPlay) {
    btnPlay.addEventListener("click", function () {
      var sc = A.scenarios[player.key];
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
      if (!A.scenarios[player.key]) return;
      player.playing = false;
      clearTimer();
      player.i = Math.max(0, player.i - 1);
      renderStep();
    });

    btnNext.addEventListener("click", function () {
      var sc = A.scenarios[player.key];
      if (!sc) return;
      player.playing = false;
      clearTimer();
      player.i = Math.min(sc.steps.length, player.i + 1);
      renderStep();
    });
  }

  /* --- Chrome that changes with the architecture -------------------------- */

  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">' +
    '<path d="m5 3 14 9-14 9z"/></svg>';

  function renderScenarioButtons() {
    if (!scenarioHost) return;
    scenarioHost.innerHTML = "";
    Object.keys(A.scenarios).forEach(function (key) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenario-btn";
      btn.setAttribute("data-scenario", key);
      btn.innerHTML = PLAY_ICON + A.scenarios[key].label;
      btn.addEventListener("click", function () {
        if (player.key === key) stopScenario();
        else startScenario(key);
      });
      scenarioHost.appendChild(btn);
    });
  }

  function renderLegend() {
    if (!legendHost) return;
    legendHost.innerHTML = "";
    A.legend.forEach(function (item) {
      var span = document.createElement("span");
      if (item.line || item.box) {
        var i = document.createElement("i");
        if (item.dash) i.className = "dash";
        if (item.box) i.className = "box";
        span.appendChild(i);
      }
      span.appendChild(document.createTextNode(item.text));
      legendHost.appendChild(span);
    });
  }

  /* --- Mount / switch ----------------------------------------------------- */

  function mount(key) {
    var next = ARCH[key];
    if (!next || (A && A.key === key)) return;

    /* Tear down whatever is on screen. The player and inspector are shared,
       so both are reset rather than carried across: a step index from v1 has
       no meaning in v2, and neither does a selected node. */
    clearTimer();
    clearPackets();
    player.key = null;
    player.playing = false;
    player.i = 0;
    selected = null;
    stage.innerHTML = "";

    A = next;
    isMobile = null;
    buildSvg();
    applyLayout(mq.matches);

    renderScenarioButtons();
    renderLegend();
    if (archNote) archNote.textContent = A.note;
    if (archSwitch) {
      Array.prototype.forEach.call(archSwitch.querySelectorAll("[data-arch]"), function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-arch") === A.key));
      });
    }

    if (ctrls) ctrls.hidden = true;
    capStep.textContent = "Idle";
    capText.textContent = IDLE_TEXT;
    inspect.innerHTML = EMPTY_INSPECT;
    clearHighlight();
  }

  if (archSwitch) {
    archSwitch.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-arch]");
      if (btn) mount(btn.getAttribute("data-arch"));
    });
  }

  /* v2 is what is actually running, so it is what loads first. */
  mount("v2");
})();
