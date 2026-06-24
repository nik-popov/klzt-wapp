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
# Local `wrangler dev` binds BUCKET to preview_bucket_name (klzt-bucket-dev),
# so local seed uploads must target that bucket to be visible to the worker.
# Remote uses the real bucket_name (klzt-bucket).
case "$TARGET" in
  local)  FLAG="--local"; BUCKET="klzt-bucket-dev" ;;
  remote) FLAG="";        BUCKET="klzt-bucket"     ;;
  *) echo "Usage: $0 [local|remote]" >&2; exit 2 ;;
esac

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

# Closet seed: upload every photo in seeds/klzt-seed-pic/ to
# raw/items/seed-<photo-number>.jpg. The matching D1 rows live in
# seeds/closet.sql. The two paired backs (IMG_3770, IMG_3787) are still
# uploaded here so the front row's metadata.back_image_url resolves.
PIC_DIR="$(dirname "$0")/klzt-seed-pic"
upload_local() {
  local file="$1"
  local key="$2"
  echo "→ Uploading to R2 ($TARGET): $BUCKET/$key"
  npx wrangler r2 object put "$BUCKET/$key" \
    --file="$file" \
    --content-type="image/jpeg" \
    $FLAG >/dev/null
}

if [[ -d "$PIC_DIR" ]]; then
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    # Extract leading IMG_NNNN number, ignore any -front/-back suffix.
    if [[ "$base" =~ ^IMG_([0-9]+) ]]; then
      num="${BASH_REMATCH[1]}"
      upload_local "$f" "raw/items/seed-${num}.jpg"
    fi
  done < <(find "$PIC_DIR" -maxdepth 1 -type f -name '*.jpeg' -print0 | sort -z)
else
  echo "! Skipping closet pics: $PIC_DIR not found"
fi

echo "✓ R2 demo seed complete ($TARGET)."
