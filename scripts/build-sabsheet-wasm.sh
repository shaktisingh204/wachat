#!/usr/bin/env bash
# Build the SabSheet client calc engine to wasm and publish it under public/sabsheet-engine/<hash>/.
#
# Why not bundle through Turbopack: the repo builds with `next build --turbo`; routing the .wasm
# through the bundler is the moving part. Instead we emit a content-hashed folder the calc worker
# fetches + instantiateStreaming's at runtime — bundler-agnostic, immutable-cacheable, no next.config
# change. Run via `npm run sabsheet:wasm` (pre-dev / pre-build).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$ROOT/rust/crates/sabsheet-engine-wasm"
OUT_ROOT="$ROOT/public/sabsheet-engine"
PKG_NAME="sabsheet_engine_wasm"

command -v wasm-pack >/dev/null 2>&1 || {
  echo "error: wasm-pack not found. Install it: https://rustwasm.github.io/wasm-pack/installer/" >&2
  exit 1
}
rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown \
  || rustup target add wasm32-unknown-unknown

echo "→ wasm-pack build (release, target=web)…"
wasm-pack build "$CRATE_DIR" --release --target web --out-name "$PKG_NAME" --out-dir "$CRATE_DIR/pkg"

WASM_FILE="$CRATE_DIR/pkg/${PKG_NAME}_bg.wasm"

# Optional extra size pass if wasm-opt (binaryen) is present.
if command -v wasm-opt >/dev/null 2>&1; then
  echo "→ wasm-opt -Oz…"
  wasm-opt -Oz "$WASM_FILE" -o "$WASM_FILE"
fi

# Content hash → immutable folder name.
HASH="$(shasum -a 256 "$WASM_FILE" | cut -c1-12)"
OUT_DIR="$OUT_ROOT/$HASH"
mkdir -p "$OUT_DIR"
cp "$CRATE_DIR/pkg/${PKG_NAME}_bg.wasm" "$OUT_DIR/"
cp "$CRATE_DIR/pkg/${PKG_NAME}.js" "$OUT_DIR/"
cp "$CRATE_DIR/pkg/${PKG_NAME}.d.ts" "$OUT_DIR/" 2>/dev/null || true

# Stable manifest the worker reads to discover the current hash + sizes.
GZ_BYTES="$(gzip -c "$OUT_DIR/${PKG_NAME}_bg.wasm" | wc -c | tr -d ' ')"
RAW_BYTES="$(wc -c < "$OUT_DIR/${PKG_NAME}_bg.wasm" | tr -d ' ')"
cat > "$OUT_ROOT/manifest.json" <<JSON
{
  "hash": "$HASH",
  "dir": "/sabsheet-engine/$HASH",
  "wasm": "/sabsheet-engine/$HASH/${PKG_NAME}_bg.wasm",
  "js": "/sabsheet-engine/$HASH/${PKG_NAME}.js",
  "rawBytes": $RAW_BYTES,
  "gzipBytes": $GZ_BYTES
}
JSON

echo "✓ published /sabsheet-engine/$HASH  (raw=${RAW_BYTES}B gz=${GZ_BYTES}B)"
