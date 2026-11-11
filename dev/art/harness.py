"""Shared helpers: local static server + headless Chromium with WebGL (SwiftShader)."""
import threading, http.server, functools, os
from playwright.sync_api import sync_playwright

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(root, port=8765):
    h = functools.partial(_Quiet, directory=root)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{port}'

GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
