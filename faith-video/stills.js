const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, page_url, outDir, ...times] = process.argv;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.goto(page_url, { waitUntil: 'load' });
  await p.evaluate(async () => { await document.fonts.load('104px Marcellus', '0123'); await document.fonts.load('600 30px Figtree', 'ŚṃāAa'); await document.fonts.load('400 37px Figtree', 'Aa'); await document.fonts.ready; });
  const info = await p.evaluate(() => ({ frames: VIDEO.frames, duration: VIDEO.duration, tl: VIDEO.timeline() }));
  console.log('frames', info.frames, 'duration', info.duration.toFixed(2), 'today', info.tl.tToday.toFixed(2));
  fs.writeFileSync(outDir + '/timeline.json', JSON.stringify(info.tl));
  for (const ts of times) {
    const i = Math.round(parseFloat(ts) * 30);
    const t0 = Date.now();
    const url = await p.evaluate(i => VIDEO.frame(i, 0.95), i);
    fs.writeFileSync(`${outDir}/still_${ts}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('t=' + ts, 'ms', Date.now() - t0);
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
