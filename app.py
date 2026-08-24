import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, redirect, render_template, request, Response
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure application
app = Flask(__name__)

# So canonical URLs, sitemap, and robots Sitemap: line use the same scheme/host as
# the public site when the app is behind a reverse proxy (e.g. PythonAnywhere, Cloudflare).
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1,
    x_prefix=1,
)
# If crawl diagnostics still show http URLs for https-only sites, set in the host env, e.g.:
#   CANONICAL_BASE_URL=https://youruser.pythonanywhere.com
# or your custom domain, with no trailing slash.
#
def _sitemap_lastmod() -> str:
    """W3C date (YYYY-MM-DD) for sitemap; avoid hard-coded future dates."""
    override = (os.environ.get("SITEMAP_LASTMOD") or "").strip()
    if override:
        return override
    return datetime.now(timezone.utc).date().isoformat()

def _canonical_base() -> str:
    """Root URL of the public site, e.g. https://example.com (no trailing slash)."""
    env = (os.environ.get("CANONICAL_BASE_URL") or "").strip()
    if env:
        return env.rstrip("/")
    return (request.url_root or "").rstrip("/")


def _absolute_url(path: str) -> str:
    """Full URL for the current public host and scheme (sitemap, canonical, robots Sitemap:)."""
    if not path.startswith("/"):
        path = "/" + path
    return _canonical_base() + path


_STATIC_DIR = Path(__file__).resolve().parent / "static"
_asset_hashes: dict[str, str] = {}


def _asset(rel: str) -> str:
    """Static URL with a content hash appended, e.g. /static/css/site.css?v=a1b2c3d4.

    Without this, a visitor can hold a cached stylesheet for as long as its
    max-age (4 hours on Cloudflare Pages) while receiving freshly deployed HTML.
    New markup against an old stylesheet renders as an unstyled page. The hash
    changes whenever the file does, so that mismatch cannot happen.
    """
    rel = rel.lstrip("/")
    if rel not in _asset_hashes:
        f = _STATIC_DIR / rel
        try:
            digest = hashlib.sha256(f.read_bytes()).hexdigest()[:10]
        except OSError:
            digest = ""
        _asset_hashes[rel] = digest
    digest = _asset_hashes[rel]
    return f"/static/{rel}" + (f"?v={digest}" if digest else "")


@app.context_processor
def inject_seo_helpers():
    path = request.path or "/"
    canonical = _absolute_url(path)
    return {
        "canonical_url": canonical,
        "absolute_static": lambda rel: _absolute_url(f"/static/{rel.lstrip('/')}"),
        "asset": _asset,
    }


@app.before_request
def _redirect_trailing_slashes():
    """One canonical path per page (e.g. /projects not /projects/) for consistent indexing."""
    p = request.path
    if len(p) > 1 and p.endswith("/"):
        if p.startswith(("/static/", "/.well-known/")):
            return None
        target = f"{_canonical_base()}{p.rstrip('/')}"
        if request.query_string:
            target = f"{target}?{request.query_string.decode()}"
        return redirect(target, code=301)
    return None


@app.route("/robots.txt")
def robots_txt():
    sitemap_url = _absolute_url("/sitemap.xml")
    body = f"User-agent: *\nAllow: /\n\nSitemap: {sitemap_url}\n"
    return Response(
        body,
        mimetype="text/plain; charset=utf-8",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.route("/sitemap.xml")
def sitemap_xml():
    """Helps search engines discover public HTML routes."""
    routes = (
        ("/", "weekly", "1.0"),
        ("/work", "weekly", "0.9"),
        ("/about", "monthly", "0.7"),
    )
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, changefreq, priority in routes:
        lines.append("  <url>")
        lines.append(f"    <loc>{_absolute_url(loc)}</loc>")
        lines.append(f"    <lastmod>{_sitemap_lastmod()}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response(
        "\n".join(lines),
        mimetype="application/xml; charset=utf-8",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/work")
def work():
    return render_template("work.html")


@app.route("/about")
def about():
    return render_template("about.html")


# Retired routes. The static deploy serves these from _redirects; the Flask
# versions keep local dev and any non-Pages host behaving identically.
_RETIRED = {
    "/systems": "/work",
    "/projects": "/work",
    "/guides": "/",
    "/blogs": "/",
    "/insights": "/",
    "/philosophy": "/about",
    "/motivation": "/about",
}


@app.route("/systems")
@app.route("/projects")
@app.route("/guides")
@app.route("/blogs")
@app.route("/insights")
@app.route("/philosophy")
@app.route("/motivation")
def retired_redirect():
    return redirect(_absolute_url(_RETIRED[request.path]), code=301)


# the following below is to configure to host on pythonanywhere
if __name__ == "__main__":
    app.run(debug=True)