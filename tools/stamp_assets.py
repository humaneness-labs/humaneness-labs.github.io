"""Stamp ?v=<content hash> on every local CSS/JS reference in docs/**/*.html.

Usage: python3 tools/stamp_assets.py
The hash is the first 12 hex characters of the file's SHA-256, matching the
existing convention, so returning visitors receive updated assets.
"""
import hashlib
import pathlib
import re

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
REF = re.compile(r'((?:href|src)=")([^"?#]*assets/(?:css|js)/[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]*)?(")')

for page in sorted(DOCS.rglob("*.html")):
    html = page.read_text(encoding="utf-8")

    def stamp(match):
        target = (page.parent / match.group(2)).resolve()
        digest = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
        return f"{match.group(1)}{match.group(2)}?v={digest}{match.group(3)}"

    updated = REF.sub(stamp, html)
    if updated != html:
        page.write_text(updated, encoding="utf-8")
        print("stamped", page.relative_to(DOCS))
