#!/usr/bin/env python3
"""Local mock for the codebn.cn/d/ layout.

Uses sendfile + explicit UTF-8 path decoding because Python's built-in
SimpleHTTPRequestHandler occasionally mishandles percent-encoded CJK
filenames on Windows, which masks real loading bugs.
"""
import os, sys, urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5181
MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".mjs":  "application/javascript; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg":  "image/svg+xml",
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".ico":  "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = self.path.split("?", 1)[0]
        if url.startswith("/d/") or url == "/d":
            rel = url[3:] if url.startswith("/d/") else ""
        else:
            rel = url.lstrip("/")
        decoded = urllib.parse.unquote(rel, encoding="utf-8")
        fs_path = os.path.normpath(os.path.join(ROOT, decoded))
        # Block escape attempts
        if not fs_path.startswith(os.path.normpath(ROOT)):
            self.send_response(403); self.end_headers(); return
        if os.path.isdir(fs_path):
            fs_path = os.path.join(fs_path, "index.html")
        if not os.path.isfile(fs_path):
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
            self.wfile.write(b"<h1>Not Found</h1>"); return
        ext = os.path.splitext(fs_path)[1].lower()
        size = os.path.getsize(fs_path)
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        with open(fs_path, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk: break
                self.wfile.write(chunk)

    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + (fmt % args) + "\n")

print(f"[mock] serving {ROOT} under /d/ on http://127.0.0.1:{PORT}/d/", flush=True)
HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
