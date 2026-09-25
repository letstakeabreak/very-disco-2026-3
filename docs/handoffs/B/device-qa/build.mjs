import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const outDir = '/tmp/deep-press-b-device-qa';
const paths = ['docs/handoffs/B/preview.html', 'docs/handoffs/B/preview.ts', 'docs/handoffs/B/preview.css',
  'docs/handoffs/B/device-qa/client.ts', 'docs/handoffs/B/device-qa/build.mjs', 'package.json', 'package-lock.json',
  ...['src/render', 'src/contracts'].flatMap(directory => readdirSync(root + directory).filter(name => name.endsWith('.ts')).map(name => `${directory}/${name}`)),
  ...readdirSync(root + 'public/assets/models').filter(name => name.endsWith('.glb')).map(name => `public/assets/models/${name}`),
  'public/assets/textures/workshop-v4.webp', 'public/assets/textures/pressure-dial.webp'];
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const before = hashes();
await build({ configFile: false, root, base: '/', plugins: [{ name: 'device-fixture',
  transformIndexHtml: { order: 'pre', handler: html => html.replace('./preview.ts', './device-qa/client.ts') } }],
  build: { outDir, emptyOutDir: true, rolldownOptions: { input: root + 'docs/handoffs/B/preview.html' } } });
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source changed during device QA build');
writeFileSync(outDir + '/qa-build.json', JSON.stringify({ builtAt: new Date().toISOString(), sourceHashesBefore: before, sourceHashesAfter: after }, null, 2) + '\n');
