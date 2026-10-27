#!/usr/bin/env bash
# Prepare one catalog seed candidate per family (default preset, preset palette) locally.
# Does not publish anything and never deletes: pass a fresh or forge-owned output dir.
# Usage: seeds/build.sh [OUT_DIR]   (default: seeds/out-<timestamp>)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-seeds/out-$(date +%Y%m%d-%H%M%S)}
exec scripts/forge-batch --worker seeds --out "$OUT" --families all --presets all --palettes preset --variants 0 --formats all --render
