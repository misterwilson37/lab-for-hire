#!/bin/sh
# Downloads the Kenney CC0 models the lab uses (16 files) from the Hidencod/tge-assets GitHub mirror into ./models
# usage (from tools/lab-bake): sh fetch_models.sh
set -e
B=https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs
mkdir -p models
for m in furniture-kit/desk furniture-kit/chairdesk furniture-kit/chairmoderncushion furniture-kit/bookcaseopen \
         furniture-kit/bookcaseclosed furniture-kit/books furniture-kit/pottedplant furniture-kit/ruground \
         furniture-kit/rugrectangle space-kit/machine-generator cube-pets/animal-cat cube-pets/animal-dog \
         cube-pets/animal-bunny graveyard-kit/candle-multiple graveyard-kit/lantern-candle graveyard-kit/pumpkin-carved; do
  curl -sfL "$B/$m.glb" -o "models/$(basename $m).glb" || echo "FAILED $m"
done
ls models | wc -l
