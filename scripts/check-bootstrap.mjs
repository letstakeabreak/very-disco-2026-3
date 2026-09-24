import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('docs/bootstrap.json', 'utf8'));
const failures = [];
for (const [path, expected] of Object.entries(manifest.frozenFiles)) {
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) failures.push(path);
}
if (failures.length) {
  console.error(`Shared baseline differs: ${failures.join(', ')}. Use the documented contract-change process; do not silently regenerate hashes.`);
  process.exitCode = 1;
} else console.log(`Bootstrap ${manifest.ref}, PRD ${manifest.prdVersion}, contract ${manifest.contractVersion}: ${Object.keys(manifest.frozenFiles).length} frozen files match.`);
