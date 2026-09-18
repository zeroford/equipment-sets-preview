#!/usr/bin/env python3
"""เสิร์ฟไฟล์ในโปรเจกต์แบบไม่ให้เบราว์เซอร์ cache

    python3 tools/serve.py [port]

NOTE: `python3 -m http.server` เฉยๆ ทำให้เบราว์เซอร์ cache .mjs ไว้
      แก้โค้ดแล้ว refresh ธรรมดาจะยังได้ของเก่า ต้อง hard reload ทุกครั้ง
      (บน GitHub Pages ไม่มีปัญหานี้ เพราะมี ETag ให้ revalidate)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, *args):
        pass  # เงียบไว้ ไม่งั้นรกเทอร์มินัล


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
root = Path(__file__).resolve().parent.parent
handler = partial(NoCacheHandler, directory=str(root))
print(f'serving {root} → http://localhost:{port}/index.html')
ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
