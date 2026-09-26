#!/bin/bash
# Renders family-tree-of-faiths.mp4 (1080x1920, 30 fps) from video.html + render.js.
# Needs: node with playwright + Chromium, python3 with numpy, and an ffmpeg with libx264 at ./ffmpeg
set -e
cd "$(dirname "$0")"
node stills.js "file://$PWD/video.html" "$PWD" 1            # writes timeline.json
python3 soundtrack.py "$PWD"                                 # writes soundtrack.wav
node render_video.js "file://$PWD/video.html" seg1.mp4 0 1066 &
node render_video.js "file://$PWD/video.html" seg2.mp4 1066 2132 &
node render_video.js "file://$PWD/video.html" seg3.mp4 2132 99999 &
wait
printf "file 'seg1.mp4'\nfile 'seg2.mp4'\nfile 'seg3.mp4'\n" > concat.txt
./ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -i soundtrack.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart family-tree-of-faiths.mp4
