# William Nayar: Personal Website

Personal site of William Nayar, a software engineer and founder in his final year of CS at NUS.
Authored as a small Flask app and **shipped as a static site** on Cloudflare Pages.

**Live site:** https://williamnayar.com

## How it works

The site has no database, forms, or logins, so every route renders a fixed page.
So Flask is used as a **static-site generator**: `freeze.py` renders each route to
plain HTML in a `dist/` folder, which Cloudflare Pages serves from its global CDN.

```
templates/ + static/  ──(freeze.py)──▶  dist/  ──(Cloudflare Pages)──▶  williamnayar.com
```

No Python runs in production, so hosting is free and there is nothing to scale.
Everything interactive on the site is client-side JavaScript with no network calls.

## The interactive pieces, and what they actually are

The `/work` page carries three labs. Each is labelled on the page, because a
demo that implies more than it is would undercut the point of the site:

| Lab | What it really is |
| --- | --- |
| DeepCS topology | Two renderings of the architecture in DeepCS's `DESIGN.md`, v1 (six services on Cloud Run) and v2 (one Cloudflare Worker), switchable, with the request paths each one describes. Neither is connected to a deployment. |
| CRDT convergence | A real (simplified RGA) CRDT implemented in `crdt.js`. Convergence is genuinely computed. DeepCS v1 itself used Yjs; v2 has no collaborative editing at all. |
| Airlock gate | A replay of the real recorded verdict output from the Airlock repo. |

## Tech stack

| Area | Tools |
| --- | --- |
| Authoring | Python, Flask, Jinja2 |
| Build | `freeze.py` (Flask test client → static HTML) |
| Frontend | HTML5, hand-written CSS, vanilla JS. No framework, no CDN scripts |
| Fonts/UI | Plus Jakarta Sans and JetBrains Mono, dark-first with a light theme toggle |
| Hosting | Cloudflare Pages (static, free TLS, global CDN) |
| Domain | Cloudflare Registrar (`williamnayar.com`) |

## Project structure

```
Personal_Webpage/
├── app.py              # Flask routes + SEO helpers (canonical URLs, sitemap, robots, redirects)
├── freeze.py           # Renders the app to a static dist/ folder for deployment
├── _redirects          # Cloudflare Pages 301s for retired paths
├── requirements.txt    # Python dependency (Flask, pinned)
├── .python-version     # Pins Python for reproducible Cloudflare builds
├── templates/
│   ├── layout.html     # Base template: <head>, nav, SEO meta, theme bootstrap
│   ├── index.html      # Home: hero, the three builds, signals
│   ├── work.html       # Deep dives: DeepCS, Aqua Vitae, Airlock + the three labs
│   └── about.html      # Background, timeline, teaching, skills, contact
└── static/
    ├── css/
    │   ├── site.css    # Design system: tokens, layout, nav, cards, both themes
    │   └── labs.css    # The interactive labs + /work and /about furniture
    ├── js/
    │   ├── core.js     # Theme, nav, scroll reveal, hero + card canvases
    │   ├── topology.js # DeepCS architecture SVG (v1 and v2) + scenario player
    │   ├── crdt.js     # RGA CRDT + simulated pub/sub channel
    │   └── gate.js     # Airlock run→read→judge replay
    └── profile_picture_black.png, favicon.ico, favicon-192.png
```

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py                    # dev server at http://127.0.0.1:5000
```

## Build the static site

```bash
# Bakes the public base URL into every canonical/OG/sitemap link.
# Defaults to https://williamnayar.com if CANONICAL_BASE_URL is unset.
CANONICAL_BASE_URL=https://williamnayar.com python freeze.py
```

```powershell
# PowerShell
$env:CANONICAL_BASE_URL = "https://williamnayar.com"; python freeze.py
```

Output goes to `dist/` (git-ignored): the three pages plus `robots.txt`,
`sitemap.xml`, the copied `static/` assets, and `_redirects`.

To preview the build exactly as Cloudflare serves it (extensionless URLs like
`/work`), serve `dist/` with a static server that falls back to `<path>.html`.

## Deployment (Cloudflare Pages)

Connect the GitHub repo to a Cloudflare Pages project and set:

| Setting | Value |
| --- | --- |
| Build command | `pip install -r requirements.txt && python freeze.py` |
| Build output directory | `dist` |
| Environment variable | `CANONICAL_BASE_URL=https://williamnayar.com` *(optional, it's the default)* |
| Python version | from `.python-version` (override with `PYTHON_VERSION` if the build can't find it) |

Then add `williamnayar.com` (and `www`) under **Custom domains**; TLS is automatic.
Every push to `main` triggers a rebuild and redeploy.

## SEO

- **Canonical URLs, Open Graph, and JSON-LD** (`Person` schema) are generated per page
  from `CANONICAL_BASE_URL`, so they always match the live domain.
- **`sitemap.xml`** lists the three public pages; **`robots.txt`** points crawlers to it.
- **`_redirects`** keeps retired paths alive as 301s so existing links and search
  signals carry over:

  | Old path | Now |
  | --- | --- |
  | `/systems`, `/projects` | `/work` |
  | `/guides`, `/blogs`, `/insights` | `/` |
  | `/philosophy`, `/motivation` | `/about` |

## Accessibility & performance notes

- No CSS or JS frameworks and no CDN scripts. Only the two stylesheets, four small
  scripts, and Google Fonts.
- Scroll-reveal styles are gated behind a `.js` class on `<html>`, so with scripts
  blocked the page renders fully visible instead of blank.
- Every animation is disabled under `prefers-reduced-motion`, and canvas loops only
  run while their canvas is on screen and the tab is visible.
- The topology diagram is keyboard-navigable; each service is a focusable control.

## Contact

- **Email:** wnayar98@gmail.com
- **LinkedIn:** [linkedin.com/in/william-nayar](https://www.linkedin.com/in/william-nayar/)
- **GitHub:** [github.com/Wnayar](https://github.com/Wnayar)

---

Originally built as a CS50 final project in 2023, since rebuilt into a static,
CDN-hosted personal site.
