// Inlines sprites, the bitmap font, the pixelized logo and wordmark, the fonts and the audio kit → ../gz2h-levelup-run.html
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const read = f => fs.readFileSync(here(f), 'utf8');
const b64 = f => fs.readFileSync(here('assets/' + f)).toString('base64');
const data = [
  read('sprites.js'),
  `const PFONT = ${read('assets/pixelfont.json')};`,
  `const PIX = ${read('assets/pixels.json')};`,
  `const FONTS = ${JSON.stringify({ px: b64('GZ2HPixel.otf'), sm4: b64('SpaceMono-400.woff2') })};`,
  read('assets/audio-kit.js'),
].join('\n');
const html = read('template.html').replace('/*__DATA__*/', () => data);
fs.writeFileSync(here('../gz2h-levelup-run.html'), html);
console.log('wrote gz2h-levelup-run.html', (html.length / 1024).toFixed(0) + ' KB');
