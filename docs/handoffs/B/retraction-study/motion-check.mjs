import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const directory = fileURLToPath(new URL('./', import.meta.url));
const session = 'deep-press-approach';
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000 }));
  if (!response.success) throw new Error(JSON.stringify(response.error)); return response.data;
};
const sha = path => createHash('sha256').update(readFileSync(root + path)).digest('hex');
const paths = ['src/render/index.ts', 'src/render/ram.ts', 'src/render/deformation.ts',
  ...['press-chamber', 'salvage-core', 'salvage-lens', 'salvage-cassette'].map(id => `public/assets/models/${id}.glb`),
  'docs/handoffs/B/retraction-study/motion.ts'];
const fingerprint = () => Object.fromEntries(paths.map(path => [path, sha(path)]));
const report = { checkedAt: new Date().toISOString(), kind: 'Actual desktop Chromium WebGL production renderer. Deterministic stepped fixtures, shader uniforms and CPU evaluation of actual GLB vertices; not integrated gameplay, physics collision certification or iPhone validation.', sourcesBefore: fingerprint(), sequences: [], captures: [] };
mkdirSync(directory + 'captures', { recursive: true });
try {
  run('set', 'viewport', '390', '844');
  run('open', `${process.argv[2] ?? 'http://127.0.0.1:5173'}/docs/handoffs/B/retraction-study/motion.html`);
  run('wait', '--load', 'networkidle'); run('snapshot', '-i');
  run('eval', `(async()=>{for(let i=0;i<1200;i++){if(window.__motionProbe?.ready)return true;await new Promise(r=>requestAnimationFrame(r));}throw new Error('Not ready');})()`);
  for (const id of ['salvage-cassette', 'salvage-core', 'salvage-lens']) {
    const sequence = run('eval', `(()=>{const p=window.__motionProbe;const samples=[p.reset(${JSON.stringify(id)})];for(let i=0;i<30;i++)samples.push(p.advance(16));return {id:${JSON.stringify(id)},samples,errors:p.errors};})()`).result;
    if (sequence.errors.length || sequence.samples.some(s => s.vertexGapM < -1e-5 || s.renderState !== 'ready' || s.loadedAssets !== '4')) throw new Error(`Invalid sequence: ${JSON.stringify(sequence)}`);
    const approach = sequence.samples.filter(s => s.elapsedMs > 0 && s.vertexGapM > 1e-5);
    if (approach.length < 3 || approach.some(s => s.compression !== 0)) throw new Error(`Air compression or missing approach: ${id}`);
    const contact = sequence.samples.find(s => s.vertexGapM < 1e-5);
    if (!contact || contact.elapsedMs > 240 || sequence.samples.at(-1).compression < .39) throw new Error(`No timely contact: ${id}`);
    report.sequences.push({ ...sequence, firstContactMs: contact.elapsedMs });
  }
  run('eval', 'window.__motionProbe.reset("salvage-cassette")');
  for (const time of [0, 48, 96, 144, 192, 320]) {
    const state = run('eval', `(()=>{const p=window.__motionProbe;while(p.measure().elapsedMs<${time})p.advance(16);return p.measure();})()`).result;
    const screenshot = `captures/motion-${time}ms.png`; run('screenshot', directory + screenshot);
    report.captures.push({ ...state, screenshot, sha256: sha(`docs/handoffs/B/retraction-study/${screenshot}`) });
  }
  report.console = run('console'); report.errors = run('errors').errors ?? [];
  if (report.errors.length || (report.console.messages ?? []).some(m => m.type === 'error')) throw new Error('Browser error');
  report.sourcesAfter = fingerprint();
  if (JSON.stringify(report.sourcesBefore) !== JSON.stringify(report.sourcesAfter)) throw new Error('Sources changed during capture');
  report.passed = true; console.log(JSON.stringify(report.sequences.map(s => ({ id: s.id, firstContactMs: s.firstContactMs, minGapM: Math.min(...s.samples.map(x => x.vertexGapM)) }))));
} catch (error) { report.passed = false; report.failure = String(error); process.exitCode = 1; console.error(error); }
finally { writeFileSync(directory + 'motion-report.json', JSON.stringify(report, null, 2) + '\n'); try { run('close'); } catch {} }
