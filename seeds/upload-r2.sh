#!/usr/bin/env bash
# Seed R2 with the demo asset(s) referenced by seeds/demo.sql.
#
# Usage:
#   bash seeds/upload-r2.sh local
#   bash seeds/upload-r2.sh remote
#
# Pairs with seeds/demo.sql: uploads a real image at raw/items/demo-09.jpg
# so the "Magic Fix" flow (POST /api/items/demo-09/process) can copy
# raw/ -> processed/ end-to-end against demo data.

set -euo pipefail

TARGET="${1:-local}"
case "$TARGET" in
  local)  FLAG="--local"  ;;
  remote) FLAG="--remote" ;;
  *) echo "Usage: $0 [local|remote]" >&2; exit 2 ;;
esac

BUCKET="klzt-bucket"

upload_one() {
  local url="$1"
  local key="$2"

  local tmp
  tmp=$(mktemp --suffix=.jpg)
  trap 'rm -f "$tmp"' RETURN

  echo "→ Fetching $url"
  curl -sSL --retry 3 -o "$tmp" "$url"

  echo "→ Uploading to R2 ($TARGET): $BUCKET/$key"
  npx wrangler r2 object put "$BUCKET/$key" \
    --file="$tmp" \
    --content-type="image/jpeg" \
    $FLAG >/dev/null

  rm -f "$tmp"
  trap - RETURN
}

# Matches demo-09 in seeds/demo.sql (Acne Studios Charcoal Scarf).
ACNE_URL="https://placehold.co/800x800/2c2c2c/eeeeee/jpg?text=Acne+Studios%0ACharcoal+Scarf&font=inter"
upload_one "$ACNE_URL" "raw/items/demo-09.jpg"

echo "✓ R2 demo seed complete ($TARGET)."
