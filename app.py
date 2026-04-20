from flask import Flask, redirect, render_template, request, Response, url_for
from flask_session import Session

# Configure application
app = Flask(__name__)

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


def _absolute_url(path: str) -> str:
    """Full URL for the current host (works on PythonAnywhere and local dev)."""
    root = request.url_root.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return root + path


@app.context_processor
def inject_seo_helpers():
    path = request.path or "/"
    canonical = _absolute_url(path)
    return {
        "canonical_url": canonical,
        "absolute_static": lambda rel: _absolute_url(f"/static/{rel.lstrip('/')}"),
    }


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
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response("\n".join(lines), mimetype="application/xml")


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
    return render_template("guides.html")


@app.route("/insights")
def insights_redirect():
    return render_template("guides.html")


@app.route("/philosophy")
def philosophy():
    return render_template("philosophy.html")


@app.route("/motivation")
def motivation_redirect():
    return redirect(url_for("philosophy"), code=301)


# the following below is to configure to host on pythonanywhere
if __name__ == "__main__":
    app.run(debug=True)