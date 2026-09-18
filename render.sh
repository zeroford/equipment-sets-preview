#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"
TMP="$DIR/.index.html.tmp"

erb "$DIR/index.html.erb" > "$TMP"
mv "$TMP" "$DIR/index.html"
echo "OK → $DIR/index.html ($(date '+%H:%M:%S'))"

# NOTE: ต้องเสิร์ฟผ่าน HTTP — เปิดเป็น file:// แล้ว ES modules โดน CORS บล็อก หน้าจะว่างเปล่า
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  (cd "$DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1 &)
  sleep 1
  echo "เปิดเซิร์ฟเวอร์ที่ port $PORT"
fi

echo "→ http://localhost:$PORT/index.html"
open "http://localhost:$PORT/index.html" 2>/dev/null || true
