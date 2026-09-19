#!/usr/bin/env bash
# Render a QA page headlessly to a PNG.
# usage: shoot.sh "<query>" <out.png> [WxH] [page]
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
Q="${1:-grid=12}"; OUT="${2:-/tmp/frames.png}"; SIZE="${3:-1800x1200}"; PAGE="${4:-frames}"
TMP="$(mktemp -d)"
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=1 \
  --virtual-time-budget=25000 --window-size="${SIZE/x/,}" \
  --screenshot="$TMP/s.png" "file://$ROOT/qa/$PAGE.html?$Q" >/dev/null 2>&1
cp "$TMP/s.png" "$OUT"; rm -rf "$TMP"
echo "$OUT"
