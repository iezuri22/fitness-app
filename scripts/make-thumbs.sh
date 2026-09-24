#!/bin/zsh
# Makes a small still for every demo in public/gifs, for list rows and chips.
#
#   npm run thumbs
#
# The 40–96pt tiles on Exercises, the picker and the workout runner used to load
# the full demo — 343 KB on average, up to 12 MB — to draw a square the size of
# a fingertip. A 288px WebP of the first frame (96pt × 3x screens) is ~10 KB.
# The hero and banner views still play the full animation.
#
# Idempotent: only (re)builds a thumb that is missing or older than its source.
# Needs sips (macOS) and cwebp (brew install webp).
set -euo pipefail
setopt extendedglob
cd "${0:A:h}/../public/gifs"
mkdir -p thumbs
command -v cwebp >/dev/null || { echo "cwebp not found — brew install webp" >&2; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
made=0; kept=0; bad=()
for src in *.(gif|jpg|jpeg|png|webp)(N); do
  out="thumbs/${src:r}.webp"
  if [[ -f "$out" && "$out" -nt "$src" ]]; then kept=$((kept + 1)); continue; fi
  # A failed download can leave an error page saved under an image name.
  if [[ $(file -b --mime-type "$src") != image/* ]]; then bad+=("$src"); continue; fi
  # sips reads the first frame of an animated GIF; -Z caps the long side.
  sips -s format png -Z 288 "$src" --out "$tmp/f.png" >/dev/null
  cwebp -quiet -q 72 -m 6 "$tmp/f.png" -o "$out"
  made=$((made + 1))
done
echo "thumbs: $made made, $kept up to date, $(du -sh thumbs | cut -f1) total"
(( ${#bad} )) && echo "skipped — not images: ${bad[*]}" >&2
exit 0
