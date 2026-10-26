#!/usr/bin/env bash
# Prepare catalog seed candidates locally (GLB + manifest + renders). Does not publish anything.
set -euo pipefail
cd "$(dirname "$0")/.."
FAMILIES="work-lantern cottage tree fence crate boulder bench planter treasure-chest wheelbarrow stone-well conifer stylized-humanoid stylized-fox"
OUT=seeds/out
rm -rf "$OUT"; mkdir -p "$OUT"
for f in $FAMILIES; do
  mkdir -p "$OUT/$f"
  npx tsx scripts/cli.ts export --family "$f" --out "$OUT/$f/$f.glb" >"$OUT/$f/export.log" 2>&1 || { echo "EXPORT FAIL $f"; continue; }
  npx tsx scripts/recipe-render.ts --family "$f" --out "$OUT/$f/renders" >"$OUT/$f/render.log" 2>&1 || echo "RENDER FAIL $f"
  echo "ok $f"
done
