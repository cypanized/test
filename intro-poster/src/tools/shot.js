// usage: node shot.js file.html|svg out.png [w] [h]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [, , file, out, w = 1600, h = 900] = process.argv;
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.goto('file://' + require('path').resolve(file));
  await p.waitForTimeout(+process.env.WAIT || 300);
  await p.screenshot({ path: out });
  await b.close();
})();
