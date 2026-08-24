"""Render the Flask site to a static ``dist/`` folder for Cloudflare Pages.

Usage (PowerShell):
    $env:CANONICAL_BASE_URL = "https://williamnayar.com"; python freeze.py
Usage (bash):
    CANONICAL_BASE_URL=https://williamnayar.com python freeze.py

Every canonical/OG/sitemap URL is built from CANONICAL_BASE_URL, so the static
output is correct for whatever public domain you deploy to. Redirect-only routes
(/blogs, /insights, /motivation) are handled by the Pages `_redirects` file, not
frozen here.
"""

import os
import shutil
from pathlib import Path

# Bake the public base URL into canonical/OG/sitemap links. Override via env.
os.environ.setdefault("CANONICAL_BASE_URL", "https://williamnayar.com")

from app import app  # noqa: E402  (must import after the env var is set)

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

# Each rendered route -> its output file (relative to dist/). Cloudflare Pages
# serves "/work" from work.html automatically, matching our canonical URLs.
PAGES = {
    "/": "index.html",
    "/work": "work.html",
    "/about": "about.html",
    "/robots.txt": "robots.txt",
    "/sitemap.xml": "sitemap.xml",
}


def build() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    client = app.test_client()
    for route, filename in PAGES.items():
        resp = client.get(route)
        if resp.status_code != 200:
            raise SystemExit(f"{route} returned {resp.status_code}, expected 200")
        out = DIST / filename
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(resp.data)
        print(f"  {route:<13} -> dist/{filename}")

    # Copy static assets (css/js/images) verbatim.
    shutil.copytree(ROOT / "static", DIST / "static")
    print("  static/       -> dist/static/")

    # Carry the Pages redirects map into the deploy output.
    redirects = ROOT / "_redirects"
    if redirects.exists():
        shutil.copy(redirects, DIST / "_redirects")
        print("  _redirects    -> dist/_redirects")

    print(f"\nBuilt {len(PAGES)} pages into {DIST}")
    print(f"Base URL: {os.environ['CANONICAL_BASE_URL']}")


if __name__ == "__main__":
    build()
