// Renders gz2h-highway.html to video with headless Chromium + ffmpeg.
//   node render.js                      → ../gz2h-highway.mp4 (1920×1080, 60 fps, motion blur, sound)
//   node render.js --stills 0.5,2.2 DIR → PNG stills of the given times (STILL_MB=n for motion blur)
//   node render.js --audio              → ../gz2h-highway.wav only
// Every frame is a pure function of time, so if the browser dies mid-render it is relaunched and the render resumes.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 60, MB = +(process.env.MB || 4);
const pageUrl = 'file://' + path.resolve(__dirname, '../gz2h-highway.html') + '?render';

let browser = null, page = null;
async function open() {
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(pageUrl);
  await page.evaluate(() => window.GZ.ready);
}
async function grab(t, n) {
  for (let attempt = 0; ; attempt++) {
    try { return Buffer.from(await page.evaluate(([t, n]) => window.GZ.capture(t, n), [t, n]), 'base64'); }
    catch (err) { if (attempt > 4) throw err; console.log(`browser lost at t=${t.toFixed(3)} (${err.message.split('\n')[0]}), relaunching`); await open(); }
  }
}

(async () => {
  const args = process.argv.slice(2);
  await open();
  if (args[0] === '--stills') {
    const dir = args[2] || '.'; fs.mkdirSync(dir, { recursive: true });
    const n = +(process.env.STILL_MB || 1);
    for (const t of args[1].split(',').map(Number)) fs.writeFileSync(path.join(dir, `f_${t.toFixed(2)}.png`), await grab(t, n));
    return browser.close();
  }
  const out = path.resolve(__dirname, '../gz2h-highway.mp4'), wav = path.resolve(__dirname, '../gz2h-highway.wav');
  const { b64, peak } = await page.evaluate(() => window.GZ.audio());
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  console.log('audio rendered, raw peak', peak.toFixed(3));
  if (args[0] === '--audio') return browser.close();

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
