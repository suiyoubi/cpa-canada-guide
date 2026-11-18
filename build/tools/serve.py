"""Local test server for the guide.
GET  /...        files from the report folder
GET  /__nojs     the guide with its executable script removed (what a phone file previewer shows)
POST /__save     stores the posted JSON as src/prerender.json in the scratchpad
"""
import http.server, pathlib, re, sys, functools

ROOT = pathlib.Path(sys.argv[1])          # report folder
OUT = pathlib.Path(sys.argv[2])           # where prerender.json goes
PORT = int(sys.argv[3])
GUIDE = ROOT / 'CPA-Professional-Program-Guide.html'

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/__nojs'):
            h = GUIDE.read_text()
            h = re.sub(r'<script data-own>[\s\S]*?</script>', '', h)
            b = h.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()
    def do_POST(self):
        if self.path != '/__save':
            self.send_response(404); self.end_headers(); return
        n = int(self.headers.get('Content-Length', '0'))
        OUT.write_bytes(self.rfile.read(n))
        self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.end_headers(); self.wfile.write(b'saved')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=str(ROOT))).serve_forever()
