#!/bin/bash
# Labeled storyboard of key frames from a video.
#   storyboard.sh in.mp4 out.png COLS "0.45|LOW E PLUCK" "1.66|THE STRUM" ...
set -e
IN=$1; OUT=$2; COLS=$3; shift 3
F=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf; T=$(mktemp -d); i=0
W=$(ffprobe -v error -select_streams v -show_entries stream=width -of csv=p=0 "$IN"); H=$(ffprobe -v error -select_streams v -show_entries stream=height -of csv=p=0 "$IN")
TW=640; TH=$(( TW * H / W ))
for spec in "$@"; do t=${spec%%|*}; label=${spec#*|}; i=$((i+1))
  ffmpeg -v error -y -ss $t -i "$IN" -frames:v 1 -vf "scale=$TW:$TH,drawbox=x=0:y=$((TH-38)):w=$TW:h=38:color=black@0.6:t=fill,drawtext=fontfile=$F:text='$(printf %02d $i)  $label':x=14:y=$((TH-27)):fontsize=16:fontcolor=white,drawtext=fontfile=$F:text='${t}s':x=w-tw-14:y=$((TH-27)):fontsize=16:fontcolor=0xff7a66" "$T/$(printf %02d $i).png"
done
ROWS=$(( (i + COLS - 1) / COLS ))
ffmpeg -v error -y -i "$T/%02d.png" -vf "tile=${COLS}x${ROWS}:padding=6:color=0x111111" -frames:v 1 "$OUT"
echo "wrote $OUT ($i frames)"
