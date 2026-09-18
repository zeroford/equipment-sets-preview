#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$DIR/.index.html.tmp"
erb "$DIR/index.html.erb" > "$TMP"
mv "$TMP" "$DIR/index.html"
echo "OK → $DIR/index.html ($(date '+%H:%M:%S'))"
echo "เปิดไฟล์นี้ใน browser (ไม่ใช่ preview .erb ค้าง)"
open "$DIR/index.html" 2>/dev/null || true
