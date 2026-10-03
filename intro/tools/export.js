// Renders the intro deterministically: --preview t1,t2,... (contact sheet frames) or --full fps duration outdir
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const mode = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../gz2h-intro.html') + '?export=1');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(150);
  const seekShot = async (t, out) => {
    await page.evaluate(t => window.__seek(t), t);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  };
  if (mode === '--preview') {
    const times = process.argv[3].split(',').map(Number);
    fs.mkdirSync('preview', { recursive: true });
    for (const t of times) await seekShot(t, `preview/p_${t.toFixed(2)}.png`);
  } else {
    const fps = Number(process.argv[3]), dur = Number(process.argv[4]), outdir = process.argv[5];
    fs.mkdirSync(outdir, { recursive: true });
    const n = Math.round(fps * dur);
    const t0 = Date.now();
    for (let i = 0; i <= n; i++) await seekShot(i / fps, `${outdir}/f_${String(i).padStart(4, '0')}.png`);
    console.log(`rendered ${n + 1} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();
