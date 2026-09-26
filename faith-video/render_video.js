const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const [,, pageUrl, out, from, to] = process.argv;
  const FF = __dirname + '/ffmpeg';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('pageerror', e.message));
  await p.goto(pageUrl, { waitUntil: 'load' });
  await p.evaluate(async () => { await document.fonts.load('104px Marcellus', '0123'); await document.fonts.load('600 32px Figtree', 'ŚṃāAa'); await document.fonts.load('400 37px Figtree', 'Aa'); await document.fonts.ready; });
  const total = await p.evaluate(() => VIDEO.frames);
  const i0 = from ? +from : 0, i1 = to ? Math.min(+to, total) : total;
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = i0; i < i1; i++) {
    const url = await p.evaluate(i => VIDEO.frame(i, 0.95), i);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - i0) % 300 === 0) console.log(`frame ${i}/${i1} ${((Date.now() - t0)/1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', out, ((Date.now() - t0)/1000).toFixed(0) + 's');
  await b.close();
})();
