// Renders gz2h-intro.html to video with headless Chromium + ffmpeg.
//   node render.js                      → ../gz2h-intro.mp4 (1920×1080, 60 fps, with sound)
//   node render.js --stills 0.5,1.7 DIR → PNG stills of the given times into DIR
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

const FPS = 60;
const page_url = 'file://' + path.resolve(__dirname, '../gz2h-intro.html') + '?render';

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-device-scale-factor=1'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(page_url);
  await page.evaluate(() => window.GZ.ready);

  const grab = async (t, mb = 1) => {
    const b64 = await page.evaluate(([t, mb]) => { mb > 1 ? window.GZ.frameMB(t, mb) : window.GZ.frame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, [t, mb]);
    return Buffer.from(b64, 'base64');
  };

  if (args[0] === '--stills') {
    const times = args[1].split(',').map(Number), dir = args[2] || '.';
    fs.mkdirSync(dir, { recursive: true });
    for (const t of times) fs.writeFileSync(path.join(dir, `f_${t.toFixed(2)}.png`), await grab(t));
    await browser.close();
    return;
  }

  const out = path.resolve(__dirname, '../gz2h-intro.mp4');
  const wavPath = path.resolve(__dirname, '../gz2h-intro.wav');
  const { b64, peak } = await page.evaluate(() => window.GZ.audio());
  fs.writeFileSync(wavPath, Buffer.from(b64, 'base64'));
  console.log('audio rendered, raw peak', peak.toFixed(3));
  if (args[0] === '--audio') { await browser.close(); return; }

  const dur = await page.evaluate(() => window.GZ.DUR);
  const frames = Math.round(dur * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', wavPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'grain', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await grab(i / FPS, 4);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
