// Clicks the big play button and samples the player: sound must run from the soundtrack file ("file" mode)
// with the timecode following it; re-run with the MP3 moved away to check the synth fallback.
//   node playtest.js /abs/path/gz2h-x.html
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [file] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + file); await p.waitForTimeout(1500);
  await p.click('#big');
  const samples = [];
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(700); samples.push(await p.evaluate(() => ({ mode: GZ.player.mode, paused: GZ.player.snd.paused, audioT: +GZ.player.snd.currentTime.toFixed(2), shown: document.getElementById('tcNow').textContent, label: document.getElementById('soundLabel').textContent }))); }
  console.log(JSON.stringify(samples), 'errors:', errs);
  await b.close();
})();
