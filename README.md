# William Nayar — Personal Website

Personal portfolio and writing of William Nayar (CS @ NUS, founder of Aqua Vitae).
Authored as a small Flask app and **shipped as a static site** on Cloudflare Pages.

**Live site:** https://williamnayar.com

## How it works

The site has no database, forms, or logins — every route renders a fixed page.
So Flask is used as a **static-site generator**: `freeze.py` renders each route to
plain HTML in a `dist/` folder, which Cloudflare Pages serves from its global CDN.

```
templates/ + static/  ──(freeze.py)──▶  dist/  ──(Cloudflare Pages)──▶  williamnayar.com
```

This keeps the authoring ergonomics of Jinja templates (shared layout, SEO helpers,
one source of truth for canonical URLs) while deploying as fast, cache-friendly static
files — no Python server in production.

## Tech stack

| Area | Tools |
| --- | --- |
| Authoring | Python, Flask, Jinja2 |
| Build | `freeze.py` (Flask test client → static HTML) |
| Frontend | HTML5, CSS3, vanilla JS, Bootstrap 5, Typed.js |
| Fonts/UI | Plus Jakarta Sans, light/dark theme toggle |
| Hosting | Cloudflare Pages (static, free TLS, global CDN) |
| Domain | Cloudflare Registrar — `williamnayar.com` |

## Project structure

```
Personal_Webpage/
├── app.py              # Flask routes + SEO helpers (canonical URLs, sitemap, robots, redirects)
├── freeze.py           # Renders the app to a static dist/ folder for deployment
├── _redirects          # Cloudflare Pages 301s for legacy paths (/blogs, /insights, /motivation)
├── requirements.txt    # Python dependency (Flask, pinned)
├── .python-version     # Pins Python for reproducible Cloudflare builds
├── templates/
│   ├── layout.html     # Base template: <head>, navbar, SEO meta, theme bootstrap
│   ├── index.html      # Home — hero, Aqua Vitae showcase, stats
│   ├── projects.html   # Project case studies
│   ├── guides.html     # Developer guides
│   └── philosophy.html # Philosophy page with timeline
└── static/
    ├── style.css       # Global styling (teal/gold accents, light + dark themes)
    ├── theme.js        # Light/dark theme toggle
    ├── site-nav.js     # Navbar behavior
    ├── index.js        # Home interactions
    ├── insights.js     # Guides interactions
    ├── *.png / *.svg   # Profile photo, favicon, social icons
    └── aqua-vitae/     # Home-page showcase screenshots (see README.txt there)
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

Output goes to `dist/` (git-ignored): the four pages plus `robots.txt`, `sitemap.xml`,
the copied `static/` assets, and `_redirects`.

## Deployment (Cloudflare Pages)

Connect the GitHub repo to a Cloudflare Pages project and set:

| Setting | Value |
| --- | --- |
| Build command | `pip install -r requirements.txt && python freeze.py` |
| Build output directory | `dist` |
| Environment variable | `CANONICAL_BASE_URL=https://williamnayar.com` *(optional — it's the default)* |
| Python version | from `.python-version` (override with `PYTHON_VERSION` if the build can't find it) |

Then add `williamnayar.com` (and `www`) under **Custom domains**; TLS is automatic.
Every push to `main` triggers a rebuild and redeploy.

## SEO

- **Canonical URLs, Open Graph, and JSON-LD** (`Person` schema) are generated per page
  from `CANONICAL_BASE_URL`, so they always match the live domain.
- **`sitemap.xml`** lists the four public pages; **`robots.txt`** points crawlers to it.
- **`_redirects`** keeps legacy paths alive as 301s so existing links and search signals
  carry over.

## Contact

- **Email:** wnayar98@gmail.com
- **LinkedIn:** [linkedin.com/in/william-nayar](https://sg.linkedin.com/in/william-nayar)
- **GitHub:** [github.com/Wnayar](https://github.com/Wnayar)

---

Originally built as a CS50 final project in 2023; since rebuilt into a static,
CDN-hosted personal site.
