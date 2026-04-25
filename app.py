import os

from flask import Flask, redirect, render_template, request, Response, url_for
from flask_session import Session
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
# Update when page content changes meaningfully (drives sitemap <lastmod> when env unset):
SITEMAP_LASTMOD = os.environ.get("SITEMAP_LASTMOD", "2026-04-25").strip() or "2026-04-25"

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


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


@app.context_processor
def inject_seo_helpers():
    path = request.path or "/"
    canonical = _absolute_url(path)
    return {
        "canonical_url": canonical,
        "absolute_static": lambda rel: _absolute_url(f"/static/{rel.lstrip('/')}"),
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
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap_xml():
    """Helps search engines discover public HTML routes."""
    routes = (
        ("/", "weekly", "1.0"),
        ("/projects", "monthly", "0.8"),
        ("/guides", "monthly", "0.7"),
        ("/philosophy", "monthly", "0.7"),
    )
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, changefreq, priority in routes:
        lines.append("  <url>")
        lines.append(f"    <loc>{_absolute_url(loc)}</loc>")
        lines.append(f"    <lastmod>{SITEMAP_LASTMOD}</lastmod>")
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


@app.route("/projects")
def projects():
    return render_template("projects.html")


@app.route("/guides")
def guides():
    return render_template("guides.html")


@app.route("/blogs")
def blogs_redirect():
    return redirect(_absolute_url("/guides"), code=301)


@app.route("/insights")
def insights_redirect():
    return redirect(_absolute_url("/guides"), code=301)


@app.route("/philosophy")
def philosophy():
    return render_template("philosophy.html")


@app.route("/motivation")
def motivation_redirect():
    return redirect(url_for("philosophy"), code=301)


# the following below is to configure to host on pythonanywhere
if __name__ == "__main__":
    app.run(debug=True)