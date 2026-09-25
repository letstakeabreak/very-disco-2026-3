/** Build the B fixture harness without a development HMR client. */
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const outDir = '/tmp/deep-press-b-static-preview';
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = ['docs/handoffs/B/preview.html', 'docs/handoffs/B/preview.ts', 'docs/handoffs/B/preview.css',
  ...['src/render', 'src/contracts'].flatMap(directory => readdirSync(root + directory).filter(name => name.endsWith('.ts')).map(name => `${directory}/${name}`)),
  'package.json', 'package-lock.json'];
const hashes = () => Object.fromEntries(inputs.map(path => [path, sha(root + path)]));
const before = hashes();
await build({ configFile: false, root, base: '/', build: { outDir, emptyOutDir: true,
  rolldownOptions: { input: root + 'docs/handoffs/B/preview.html' } } });
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source changed during static QA build');
const files = {};
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    if (statSync(path).isDirectory()) walk(path);
    else files[path.slice(outDir.length + 1)] = { bytes: statSync(path).size, sha256: sha(path) };
  }
}
walk(outDir);
writeFileSync(root + 'docs/handoffs/B/evidence/static-preview-build.json', JSON.stringify({ builtAt: new Date().toISOString(),
  purpose: 'Static production build of B fixture harness without Vite HMR; not the integrated game or itch deployment validation',
  root, outDir, base: '/', sourceHashesBefore: before, sourceHashesAfter: after, files }, null, 2) + '\n');
