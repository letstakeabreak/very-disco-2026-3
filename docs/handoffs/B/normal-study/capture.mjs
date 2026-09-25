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
const fingerprint = directory => Object.fromEntries(paths.map(path => [path, hash(readFileSync(`${directory}/${path}`))]));
const states = [
  ['idle', 'salvage-core', 0, 1, 0, 0],
  ['inspecting', 'salvage-core', 0, 1, 26, 0],
  ['compressing', 'salvage-core', .6, 1, 26, 0],
  ['inspecting', 'salvage-lens', 0, 1, 26, 0],
  ['failed', 'salvage-lens', 1, 0, 26, 0],
  ['inspecting', 'salvage-cassette', 0, 1, 26, 0],
  ['compressing', 'salvage-cassette', .6, .5, 26, 0],
  ['failed', 'salvage-cassette', 1, 0, 26, 0],
  ['stored', 'salvage-cassette', .55, .5, 0, 3],
].map(([phase, specimenId, pressure01, integrity01, yawDeg, storedCount]) => ({ phase, specimenId, pressure01, integrity01, yawDeg, storedCount }));
const report = { at: new Date().toISOString(), baselineCommit: '238c0c7bbae74ca8557c27e281c155220b7ea229',
  kind: 'Desktop Chromium WebGL normal correction: GPU numeric derivative checks and actual canvas captures. Neither physical iPhone FPS nor integrated gameplay.', variants: [] };
let session;
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024 }));
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
};
try {
  for (const [label, directory, url] of [['before', baselineRoot, baselineUrl], ['after', root, candidateUrl]]) {
    session = `deep-press-normal-${label}`;
    const variant = { label, sourceHashesBefore: fingerprint(directory), captures: [] };
    report.variants.push(variant);
    mkdirSync(`${output}${label}`, { recursive: true });
    try {
      run('open', `${url}/docs/handoffs/B/normal-study/index.html`);
      run('wait', '--load', 'networkidle');
      variant.numeric = run('eval', `(async()=>{const end=performance.now()+20000;while(document.querySelector('#status').textContent==='Running'){if(performance.now()>end)throw new Error('Numeric timeout');await new Promise(requestAnimationFrame);}return window.__normalCheck;})()`).result;
      if (variant.numeric.error || variant.numeric.cases.length !== 27 || variant.numeric.passed !== (label === 'after')) throw new Error(`Unexpected numeric result for ${label}`);
      run('set', 'viewport', '390', '844');
      run('open', `${url}/docs/handoffs/B/preview.html`);
      run('wait', '--load', 'networkidle');
      run('snapshot', '-i');
      for (const [index, controls] of states.entries()) {
        const record = run('eval', `(async () => {
          const probe=window.__renderProbe;
          const deadline=performance.now()+20000;
          while(probe.metrics.rendererStatus.renderState!=='ready' && !probe.errors.length && performance.now()<deadline) await new Promise(requestAnimationFrame);
          if(probe.metrics.rendererStatus.renderState!=='ready') throw new Error(JSON.stringify(probe.errors));
          // Snap to an authoritative paused pose before the target state so both
          // variants start their easing from identical values.
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
        record.file = `${label}/${String(index + 1).padStart(2, '0')}-${controls.phase}-${controls.specimenId}.png`;
        record.sha256 = hash(png);
        writeFileSync(output + record.file, png);
        variant.captures.push(record);
        if (index === 0) console.log(`${label}: page ready, first actual canvas captured, four models loaded.`);
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
    const identicalPng = before.sha256 === after.sha256;
    return { before: before.file, after: after.file, identicalPng,
      beforeDrawCalls: Number(before.status.drawCalls), afterDrawCalls: Number(after.status.drawCalls),
      beforeTriangles: Number(before.status.triangles), afterTriangles: Number(after.status.triangles) };
  });
  report.passed = report.comparisons.some(item => !item.identicalPng) && report.comparisons.every(item => item.afterDrawCalls === item.beforeDrawCalls && item.afterTriangles === item.beforeTriangles);
  if (!report.passed) process.exitCode = 1;
  console.log(JSON.stringify({ passed: report.passed, comparisons: report.comparisons }, null, 2));
} catch (error) {
  report.passed = false; report.failure = String(error); process.exitCode = 1;
} finally { writeFileSync(output + 'comparison.json', JSON.stringify(report, null, 2) + '\n'); }
