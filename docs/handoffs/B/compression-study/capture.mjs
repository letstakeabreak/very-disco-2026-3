import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = fileURLToPath(new URL('./', import.meta.url));
const baselineRoot = process.argv[2];
if (!baselineRoot) throw new Error('Pass the baseline checkout path; serve it on 4176 and the candidate on 4177.');
const baselineUrl = process.argv[3] ?? 'http://127.0.0.1:4176';
const candidateUrl = process.argv[4] ?? 'http://127.0.0.1:4177';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['package.json', 'package-lock.json', 'docs/handoffs/B/preview.ts', 'docs/handoffs/B/preview.css', 'docs/handoffs/B/normal-study/probe.ts',
  ...['src/render', 'src/contracts'].flatMap(dir => readdirSync(root + dir).filter(name => name.endsWith('.ts')).map(name => `${dir}/${name}`)),
  ...readdirSync(root + 'public/assets/models').map(name => `public/assets/models/${name}`),
  'public/assets/textures/workshop-v4.webp', 'public/assets/textures/pressure-dial.webp'];
const fingerprint = directory => Object.fromEntries(paths.map(path => {
  try { return [path, hash(readFileSync(`${directory}/${path}`))]; } catch { return [path, null]; }
}));
// [viewport, phase, specimen, pressure01, integrity01, yawDeg]. Fixture states, not A's rules.
const states = [
  ['390x844', 'compressing', 'salvage-core', .35, 1, 26],
  ['390x844', 'compressing', 'salvage-core', .7, 1, 26],
  ['390x844', 'inspecting', 'salvage-core', .9, .6, 26],
  ['390x844', 'failed', 'salvage-core', 1, 0, 26],
  ['390x844', 'compressing', 'salvage-cassette', .6, 1, 26],
  ['390x844', 'inspecting', 'salvage-cassette', .8, .6, 26],
  ['390x844', 'failed', 'salvage-cassette', 1, 0, 26],
  ['390x844', 'inspecting', 'salvage-lens', .6, .7, 26],
  ['390x844', 'failed', 'salvage-lens', 1, 0, 26],
  ['1024x1536', 'compressing', 'salvage-cassette', .6, 1, 26],
  ['1024x1536', 'failed', 'salvage-cassette', 1, 0, 26],
].map(([viewport, phase, specimenId, pressure01, integrity01, yawDeg]) => ({ viewport, controls: { phase, specimenId, pressure01, integrity01, yawDeg, storedCount: 0 } }));
const report = { at: new Date().toISOString(), baselineCommit: 'bbe18c46fc4e019070ae71527db692841ba82192',
  kind: 'Desktop Chromium WebGL: compression bulge and damage debris. Actual canvas captures plus the GPU normal derivative check. Not gameplay or iPhone evidence.', variants: [] };
let session;
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 32 * 1024 * 1024 }));
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
};
try {
  for (const [label, directory, url] of [['before', baselineRoot, baselineUrl], ['after', root, candidateUrl]]) {
    session = `deep-press-compression-${label}`;
    const variant = { label, sourceHashesBefore: fingerprint(directory), captures: [] };
    report.variants.push(variant);
    mkdirSync(`${output}${label}`, { recursive: true });
    try {
      if (label === 'after') {
        run('open', `${url}/docs/handoffs/B/normal-study/index.html`);
        run('wait', '--load', 'networkidle');
        variant.numeric = run('eval', `(async()=>{const end=performance.now()+20000;while(document.querySelector('#status').textContent==='Running'){if(performance.now()>end)throw new Error('Numeric timeout');await new Promise(requestAnimationFrame);}return window.__normalCheck;})()`).result;
        if (variant.numeric.error || !variant.numeric.passed) throw new Error(`Normal derivative check failed: ${JSON.stringify(variant.numeric).slice(0, 2000)}`);
      }
      let viewport = '';
      for (const [index, { viewport: size, controls }] of states.entries()) {
        if (size !== viewport) {
          viewport = size;
          run('set', 'viewport', ...size.split('x'));
          run('open', `${url}/docs/handoffs/B/preview.html`);
          run('wait', '--load', 'networkidle');
        }
        const record = run('eval', `(async () => {
          const probe=window.__renderProbe;
          const deadline=performance.now()+20000;
          while(probe.metrics.rendererStatus.renderState!=='ready' && !probe.errors.length && performance.now()<deadline) await new Promise(requestAnimationFrame);
          if(probe.metrics.rendererStatus.renderState!=='ready') throw new Error(JSON.stringify(probe.errors));
          probe.setState({...${JSON.stringify(controls)},phase:'paused'});
          for(let n=0;n<2;n++) await new Promise(requestAnimationFrame);
          probe.setState(${JSON.stringify(controls)});
          for(let n=0;n<150;n++) await new Promise(requestAnimationFrame);
          return new Promise(resolve => requestAnimationFrame(() => {
            const canvas=document.querySelector('canvas');
            resolve({controls:probe.controls,errors:probe.errors,width:canvas.width,height:canvas.height,
              status:{...canvas.dataset},image:canvas.toDataURL('image/png')});
          }));
        })()`).result;
        if (record.errors.length || record.status.renderState !== 'ready') throw new Error(JSON.stringify(record));
        const png = Buffer.from(record.image.split(',')[1], 'base64');
        delete record.image;
        record.file = `${label}/${String(index + 1).padStart(2, '0')}-${viewport}-${controls.phase}-${controls.specimenId}.png`;
        record.sha256 = hash(png);
        writeFileSync(output + record.file, png);
        variant.captures.push(record);
      }
      variant.browserErrors = run('errors').errors ?? [];
      variant.console = run('console');
      if ((variant.console.messages ?? []).some(message => message.type === 'error' || /Multiple instances of Three/.test(message.text ?? ''))) throw new Error('Console shader error or duplicate Three instance');
      if (variant.browserErrors.length) throw new Error('Browser errors detected');
      variant.sourceHashesAfter = fingerprint(directory);
      if (JSON.stringify(variant.sourceHashesBefore) !== JSON.stringify(variant.sourceHashesAfter)) throw new Error('Source changed while capturing');
    } finally { run('close'); }
  }
  report.comparisons = report.variants[0].captures.map((before, index) => {
    const after = report.variants[1].captures[index];
    return { state: states[index], before: before.file, after: after.file, identicalPng: before.sha256 === after.sha256,
      beforeDrawCalls: Number(before.status.drawCalls), afterDrawCalls: Number(after.status.drawCalls) };
  });
  // Every pressed or damaged state must visibly change. Debris is one instanced
  // draw, repeated in the transmission pass when glass is on screen.
  report.passed = report.comparisons.every(item => !item.identicalPng && item.afterDrawCalls - item.beforeDrawCalls <= 2);
  if (!report.passed) process.exitCode = 1;
  console.log(JSON.stringify({ passed: report.passed, numeric: report.variants[1].numeric?.passed, comparisons: report.comparisons.map(({ before, identicalPng, beforeDrawCalls, afterDrawCalls }) => ({ before, identicalPng, beforeDrawCalls, afterDrawCalls })) }, null, 2));
} catch (error) {
  report.passed = false; report.failure = String(error); process.exitCode = 1;
  console.error(report.failure);
} finally { writeFileSync(output + 'comparison.json', JSON.stringify(report, null, 2) + '\n'); }
