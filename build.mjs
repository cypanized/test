// Builds a single, self-contained HTML file (works offline and from file://).
//   node build.mjs            -> dist/index.html
//   node build.mjs --serve    -> rebuild on change + http://localhost:8080
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { watch } from 'node:fs';

const entry = process.argv.includes('--entry') ? process.argv[process.argv.indexOf('--entry') + 1] : 'src/main.js';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'dist/index.html';

async function build() {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020'],
    write: false,
    legalComments: 'eof',
  });
  const js = result.outputFiles[0].text;
  const css = await readFile('src/styles.css', 'utf8');
  let html = await readFile('src/index.html', 'utf8');
  // inline: escape any closing tags that would end the <script> early
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => safeJs);
  await mkdir(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  await writeFile(out, html);
  console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

await build();

if (process.argv.includes('--serve')) {
  let timer = null;
  watch('src', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
  createServer(async (req, res) => {
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await readFile(out));
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  }).listen(8080, () => console.log('serving on http://localhost:8080'));
}
