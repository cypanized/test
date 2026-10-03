// Renders gz2h-ztoh.html to video with headless Chromium + ffmpeg.
//   node render.js                         → ../gz2h-ztoh.mp4 (1920×1080, 60 fps, motion blur, sound)
//   node render.js --vertical              → ../gz2h-ztoh-vertical.mp4 (1080×1920, same soundtrack: run after master.sh)
//   node render.js --audio                 → ../gz2h-ztoh.wav only
//   node render.js --stills 0.5,2.2 DIR    → PNG stills of the given times (add --v for 9:16, --q 0.5 for half size)
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 60, MB = 4;
const args = process.argv.slice(2);
const V = args.includes('--vertical') || args.includes('--v');
const qi = args.indexOf('--q'), q = qi >= 0 ? +args[qi + 1] : 1;
const [VW, VH] = V ? [1080, 1920] : [1920, 1080];
const pageUrl = 'file://' + path.resolve(__dirname, '../gz2h-ztoh.html') + '?render' + (V ? '&v' : '') + (q !== 1 ? '&q=' + q : '');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(pageUrl);
  await page.evaluate(() => window.GZ.ready);
  const grab = async (t, n) => Buffer.from(await page.evaluate(([t, n]) => window.GZ.capture(t, n), [t, n]), 'base64');

  if (args[0] === '--stills') {
    const dir = args[2] || '.'; fs.mkdirSync(dir, { recursive: true });
    const mb = args.includes('--mb') ? MB : 1;
    for (const t of args[1].split(',').map(Number)) fs.writeFileSync(path.join(dir, `${V ? 'v' : 'f'}_${t.toFixed(3)}.png`), await grab(t, mb));
    return browser.close();
  }
  const wav = path.resolve(__dirname, '../gz2h-ztoh.wav');
  const out = path.resolve(__dirname, V ? '../gz2h-ztoh-vertical.mp4' : '../gz2h-ztoh.mp4');
  if (!V) {
    const { b64, peak } = await page.evaluate(() => window.GZ.audio());
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    console.log('audio rendered, raw peak', peak.toFixed(3));
    if (args[0] === '--audio') return browser.close();
  } else if (!fs.existsSync(wav)) throw new Error('render the 16:9 version and master the soundtrack first');

  const frames = Math.round((await page.evaluate(() => window.GZ.DUR)) * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await grab(i / FPS, MB);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
