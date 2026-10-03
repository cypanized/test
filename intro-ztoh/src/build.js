// Inlines glyph outlines, the traced logo, the audio kit and the brand fonts into the template → ../gz2h-ztoh.html
// The output is pure ASCII (entities in markup, \u escapes in scripts), so it reads the same whatever charset a viewer assumes.
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const glyphs = fs.readFileSync(here('assets/glyphs.json'), 'utf8');
const logo = fs.readFileSync(here('assets/logo-paths.json'), 'utf8');
const kit = fs.readFileSync(here('assets/audio-kit.js'), 'utf8');
const font = f => fs.readFileSync(here('assets/' + f)).toString('base64');
const data = `const GLYPHS = ${glyphs};\nconst LOGO = ${logo};\nconst FONTS = ${JSON.stringify({ sg: font('SpaceGrotesk-VF.woff2'), sm4: font('SpaceMono-400.woff2'), sm7: font('SpaceMono-700.woff2') })};\n${kit}`;
let html = fs.readFileSync(here('template.html'), 'utf8').replace('/*__DATA__*/', () => data);
const esc = (str, js) => str.replace(/[^\x00-\x7f]/gu, ch => { const cp = ch.codePointAt(0); return js ? (cp > 0xffff ? `\\u{${cp.toString(16)}}` : '\\u' + cp.toString(16).padStart(4, '0')) : `&#x${cp.toString(16)};`; });
html = html.split(/(<script>[\s\S]*?<\/script>)/).map(part => esc(part, part.startsWith('<script>'))).join('');
fs.writeFileSync(here('../gz2h-ztoh.html'), html);
console.log('wrote gz2h-ztoh.html', (html.length / 1024).toFixed(0) + ' KB', /[^\x00-\x7f]/.test(html) ? 'NON-ASCII LEFT' : 'ascii');
