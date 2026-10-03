// Inlines the traced logo, the wordmark outlines, the brand fonts and the audio kit into the template → ../gz2h-poster.html
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const logo = JSON.parse(fs.readFileSync(here('assets/logo-paths.json'), 'utf8'));
const wm = JSON.parse(fs.readFileSync(here('assets/wordmark-paths.json'), 'utf8'));
const font = f => fs.readFileSync(here('assets/' + f)).toString('base64');
const data = `const LOGO = ${JSON.stringify(logo)};\nconst WM = ${JSON.stringify(wm)};\nconst FONTS = ${JSON.stringify({ sg: font('SpaceGrotesk-VF.woff2'), sm4: font('SpaceMono-400.woff2'), sm7: font('SpaceMono-700.woff2') })};`;
const kit = fs.readFileSync(here('lib/audio-kit.js'), 'utf8');
const html = fs.readFileSync(here('template.html'), 'utf8').replace('/*__DATA__*/', () => data).replace('/*__AUDIOKIT__*/', () => kit);
fs.writeFileSync(here('../gz2h-poster.html'), html);
console.log('wrote gz2h-poster.html', (html.length / 1024).toFixed(0) + ' KB');
