// Inlines the beam shapes and brand fonts into the template → ../gz2h-phosphor.html
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const shapes = fs.readFileSync(here('assets/shapes.json'), 'utf8');
const font = f => fs.readFileSync(here('assets/' + f)).toString('base64');
const data = `const SHAPES = ${shapes};\nconst FONTS = ${JSON.stringify({ sg: font('SpaceGrotesk-VF.woff2'), sm4: font('SpaceMono-400.woff2'), sm7: font('SpaceMono-700.woff2') })};`;
const html = fs.readFileSync(here('template.html'), 'utf8').replace('/*__DATA__*/', () => data);
fs.writeFileSync(here('../gz2h-phosphor.html'), html);
console.log('wrote gz2h-phosphor.html', (html.length / 1024).toFixed(0) + ' KB');
