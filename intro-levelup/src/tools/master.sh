#!/bin/bash
# Masters a rendered soundtrack to about -14 LUFS (true peak about -1 dBTP), writes the MP3 the player streams,
# and swaps the mastered audio into the MP4 (video stream copied untouched).
#   master.sh gz2h-x.wav [gz2h-x.mp4] [gainDb]
set -e
WAV=$1; MP4=$2; GAIN=${3:-auto}
TMP=$(mktemp -d)
if [ "$GAIN" = auto ]; then
  I=$(ffmpeg -hide_banner -i "$WAV" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}')
  GAIN=$(python3 -c "print(round(-14.0 - ($I), 2))")
fi
ffmpeg -v error -y -i "$WAV" -af "volume=${GAIN}dB,aresample=192000,alimiter=limit=0.8:attack=1:release=50:level=false,aresample=48000" -ar 48000 "$TMP/m.wav"
mv "$TMP/m.wav" "$WAV"
ffmpeg -v error -y -i "$WAV" -c:a libmp3lame -b:a 192k "${WAV%.wav}.mp3"
if [ -n "$MP4" ] && [ -f "$MP4" ]; then
  ffmpeg -v error -y -i "$MP4" -i "$WAV" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest "$TMP/v.mp4" && mv "$TMP/v.mp4" "$MP4"
fi
echo "gain ${GAIN} dB →"; ffmpeg -hide_banner -i "$WAV" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|^\s+Peak:"
