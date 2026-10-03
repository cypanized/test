#!/bin/bash
# 10 fps filmstrip sheets (5x4 = 2 s each) of a video, for reviewing motion: filmstrip.sh in.mp4 outdir
set -e
IN=$1; OUT=$2; mkdir -p "$OUT/f"; rm -f "$OUT"/f/*.png
ffmpeg -v error -i "$IN" -vf "fps=10,scale=384:-2" "$OUT/f/%03d.png"
N=$(ls "$OUT/f" | wc -l); k=0
while [ $((k*20)) -lt $N ]; do ffmpeg -v error -y -start_number $((k*20+1)) -i "$OUT/f/%03d.png" -vf "tile=5x4" -frames:v 1 "$OUT/strip_$k.png"; k=$((k+1)); done
ls "$OUT"/strip_*.png
