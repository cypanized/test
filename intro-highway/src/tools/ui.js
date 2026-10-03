// Screenshots the player page at desktop (1280) and phone (400) widths, reports horizontal overflow and errors.
//   node ui.js /abs/path/gz2h-x.html /out/dir
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const [w, h, name] of [[1280, 1000, 'desk'], [400, 900, 'phone']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file://' + file); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/ui_${name}.png`, fullPage: true });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    console.log(name, 'scrollWidth/innerWidth', sw, sw[0] > sw[1] ? 'OVERFLOW' : 'ok', 'errors', errs);
    await p.close();
  }
  await b.close();
})();
