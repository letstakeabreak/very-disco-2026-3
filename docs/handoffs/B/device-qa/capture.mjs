import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const device = process.env.DEEP_PRESS_DEVICE;
const label = process.argv[2];
if (!device || !/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Set DEEP_PRESS_DEVICE and supply a capture label');
const output = fileURLToPath(new URL(`./captures/${label}/`, import.meta.url));
mkdirSync(output, { recursive: true });
const base = 'http://127.0.0.1:4175/qa';
const states = [
  ['cassette-intact', { phase: 'inspecting', specimenId: 'salvage-cassette', pressure01: .55, integrity01: 1 }],
  ['cassette-broken', { phase: 'inspecting', specimenId: 'salvage-cassette', pressure01: .55, integrity01: 0 }],
  ['cassette-failed', { phase: 'failed', specimenId: 'salvage-cassette', pressure01: 1, integrity01: 0 }],
  ['lens-intact', { phase: 'inspecting', specimenId: 'salvage-lens', pressure01: 0, integrity01: 1 }],
  ['lens-broken', { phase: 'failed', specimenId: 'salvage-lens', pressure01: 1, integrity01: 0 }],
  ['core-pressed', { phase: 'compressing', specimenId: 'salvage-core', pressure01: .8, integrity01: .5 }],
  ['stored', { phase: 'stored', specimenId: 'salvage-core', pressure01: .8, integrity01: .5, storedCount: 3 }],
];
const captures = [];
for (const [name, controls] of states) {
  const command = await fetch(base + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'setState', controls: { yawDeg: 26, storedCount: 0, ...controls } }) }).then(r => r.json());
  let status;
  for (let retry = 0; retry < 20; retry++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    status = await fetch(base + '/status').then(r => r.json());
    if (status?.lastCommand === command.id && status.ready && !status.measuring) break;
  }
  if (status?.lastCommand !== command.id || status.measuring || status.errors.length) throw new Error('Device did not acknowledge valid state');
  await new Promise(resolve => setTimeout(resolve, 1500));
  execFileSync('xcrun', ['devicectl', 'device', 'capture', 'screenshot', '--device', device, '--destination', output + name + '.png'], { stdio: 'ignore', timeout: 30000 });
  const after = await fetch(base + '/status').then(r => r.json());
  captures.push({ name, controls: after.controls, environment: after.environment, rendererStatus: after.metrics.rendererStatus,
    errors: after.errors, at: after.at, sha256: createHash('sha256').update(readFileSync(output + name + '.png')).digest('hex') });
  console.log(`Captured device fixture ${name}`);
}
writeFileSync(output + 'report.json', JSON.stringify({ method: 'Xcode devicectl screenshot from independently verified physical iPhone; fixture controls, not touch gameplay', label, captures }, null, 2) + '\n');
