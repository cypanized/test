// Inlines the traced logo, the wordmark outlines, the brand fonts and the audio kit into the template → ../gz2h-highway.html
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const logo = JSON.parse(fs.readFileSync(here('assets/logo-paths.json'), 'utf8'));
const wordmark = fs.readFileSync(here('assets/wordmark.json'), 'utf8');
const font = f => fs.readFileSync(here('assets/' + f)).toString('base64');
const kit = fs.readFileSync(here('assets/audio-kit.js'), 'utf8');
const data = `const LOGO = ${JSON.stringify(logo)};\nconst WORDMARK = ${wordmark};\nconst FONTS = ${JSON.stringify({ sg: font('SpaceGrotesk-VF.woff2'), sm4: font('SpaceMono-400.woff2'), sm7: font('SpaceMono-700.woff2') })};\n${kit}`;
const html = fs.readFileSync(here('template.html'), 'utf8').replace('/*__DATA__*/', () => data);
fs.writeFileSync(here('../gz2h-highway.html'), html);
console.log('wrote gz2h-highway.html', (html.length / 1024).toFixed(0) + ' KB');
