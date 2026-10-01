#!/bin/sh
# Lädt Musik und Schrift nach assets/. Beides wird bewusst nicht ins Repo eingecheckt.
#  - Musik: "Electro Dreams" von Arulo, Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree)
#  - Schrift: Inter (SIL Open Font License 1.1) über @fontsource auf jsDelivr
set -e
cd "$(dirname "$0")"
mkdir -p assets/fonts
UA="Mozilla/5.0"
[ -s assets/electro-dreams.mp3 ] || curl -fsSL -A "$UA" -o assets/electro-dreams.mp3 https://assets.mixkit.co/music/190/190.mp3
for w in 300 500 600 700 800; do
  [ -s assets/fonts/inter-$w.woff2 ] || curl -fsSL -o assets/fonts/inter-$w.woff2 \
    https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-$w-normal.woff2
done
echo "assets/ bereit:"; ls -la assets assets/fonts
