import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidenceDir = fileURLToPath(new URL('./evidence/', import.meta.url));
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const session = 'deep-press-render-study-check';
const run = (...args) => {
  let output;
  try {
    output = execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000 });
  } catch (error) {
    throw new Error(`${error.message}\n${String(error.stdout ?? '').slice(-2000)}\n${String(error.stderr ?? '').slice(-2000)}`);
  }
  const result = JSON.parse(output);
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data;
};
const evaluate = (source) => run('eval', source).result;
const fingerprint = () => Object.fromEntries([
  ...['index.ts','deformation.ts','ram.ts','gauge.ts','resources.ts','visual-state.ts','assets.ts'].map(name=>`src/render/${name}`),
  ...['press-chamber','salvage-core','salvage-lens','salvage-cassette'].map(id=>`public/assets/models/${id}.glb`),
  'public/assets/textures/workshop.webp',
  'public/assets/textures/pressure-dial.webp',
].map(path=>[path,createHash('sha256').update(readFileSync(`${root}${path}`)).digest('hex')]));
mkdirSync(evidenceDir, { recursive: true });
const report = { checkedAt: new Date().toISOString(), kind: 'Actual WebGL render fixture QA in desktop Chromium; not iPhone or gameplay validation', url: `${baseUrl}/docs/handoffs/B/preview.html`, viewports: [], phases: [], specimens: [], errors: [] };
try {
  report.fileHashesBefore = fingerprint();
  run('open', report.url);
  run('wait', '--load', 'networkidle');
  const ready = evaluate(`(async () => {
    const deadline=performance.now()+20000;
    while (performance.now()<deadline) {
      const probe=window.__renderProbe;
      const state=probe?.metrics.rendererStatus.renderState;
      if (state==='ready' || state==='error' || probe?.errors.length) return {state,metrics:probe.metrics,errors:probe.errors};
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    return {state:'timeout',metrics:window.__renderProbe?.metrics,errors:window.__renderProbe?.errors};
  })()`);
  report.initialReady = ready;
  if (ready.state !== 'ready' || ready.metrics.rendererStatus.loadedAssets !== '4' || ready.errors.length) throw new Error(`Renderer not ready: ${JSON.stringify(ready)}`);
  run('snapshot', '-i');
  run('select', '#phase', 'compressing');
  run('select', '#specimen', 'salvage-lens');
  for (const id of ['pressure','integrity','yaw','stored']) {
    run('click', `#${id}`); run('press', 'Home'); run('press', 'ArrowRight');
  }
  report.controls = evaluate('window.__renderProbe.controls');
  if (report.controls.phase!=='compressing' || report.controls.specimenId!=='salvage-lens' || Math.abs(report.controls.pressure01-0.01)>1e-9 || Math.abs(report.controls.integrity01-0.01)>1e-9 || report.controls.yawDeg!==-179 || report.controls.storedCount!==1) throw new Error(`Native control events failed: ${JSON.stringify(report.controls)}`);
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    run('set', 'viewport', String(width), String(height));
    evaluate('window.__renderProbe.setState({phase:"inspecting",specimenId:"salvage-core",pressure01:0,integrity01:1,yawDeg:0,storedCount:0})');
    const viewport = evaluate(`(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
      window.__renderProbe.resetMetrics();
      for (let frame=0;frame<120;frame++) await new Promise(resolve=>requestAnimationFrame(resolve));
      const header = document.querySelector('.study-header').getBoundingClientRect();
      const dock = document.querySelector('.control-dock').getBoundingClientRect();
      return { width:innerWidth,height:innerHeight,headerHeight:header.height,dockHeight:dock.height,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,metrics:window.__renderProbe.metrics,probeErrors:window.__renderProbe.errors };
    })()`);
    if (viewport.horizontalOverflow || viewport.headerHeight !== 50 || viewport.dockHeight !== 130 || viewport.probeErrors.length) throw new Error(`Viewport QA failed: ${JSON.stringify(viewport)}`);
    report.viewports.push(viewport);
    run('screenshot', `${evidenceDir}runtime-${width}x${height}.png`);
  }
  run('set', 'viewport', '390', '844');
  const captureCase = (state, filename) => {
    evaluate(`window.__renderProbe.setState(${JSON.stringify(state)})`);
    const record = evaluate(`(async () => {
      await new Promise(resolve=>setTimeout(resolve,400));
      const probe=window.__renderProbe;
      return {phase:probe.snapshot.phase,specimenId:probe.controls.specimenId,immutable:Object.isFrozen(probe.snapshot)&&Object.isFrozen(probe.snapshot.entities),metrics:probe.metrics,errors:probe.errors};
    })()`);
    if (record.errors.length || !record.immutable || record.metrics.rendererStatus.renderState!=='ready') throw new Error(`Fixture QA failed: ${JSON.stringify(record)}`);
    run('screenshot', `${evidenceDir}${filename}.png`);
    return {...record,screenshot:`${filename}.png`};
  };
  for (const phase of ['idle','inspecting','compressing','settling','stored','failed','complete','paused']) {
    report.phases.push(captureCase({phase,specimenId:'salvage-lens',pressure01:phase==='failed'?1:phase==='inspecting'?0:0.6,integrity01:phase==='failed'?0:0.8,yawDeg:0,storedCount:phase==='complete'?3:phase==='stored'?1:0}, `runtime-phase-${phase}`));
  }
  for (const specimenId of ['salvage-core','salvage-lens','salvage-cassette']) {
    for (const [phase,pressure01,integrity01] of [['inspecting',0,1],['compressing',0.6,1],['failed',1,0]]) {
      report.specimens.push(captureCase({phase,specimenId,pressure01,integrity01,yawDeg:0,storedCount:0}, `runtime-${specimenId}-${phase}`));
    }
  }
  report.errors = run('errors').errors ?? [];
  if (report.errors.length) throw new Error('Browser errors detected');
  report.fileHashesAfter = fingerprint();
  if (JSON.stringify(report.fileHashesBefore)!==JSON.stringify(report.fileHashesAfter)) throw new Error('Renderer or assets changed during browser run; repeat against stable files');
  report.passed = true;
  console.log('Actual WebGL: 4 GLBs ready, both layouts, 8 phases and 9 specimen states passed. Screenshots require visual review; this is not iPhone performance evidence.');
} catch (error) {
  report.passed = false;
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  writeFileSync(`${evidenceDir}runtime-browser-check.json`, `${JSON.stringify(report, null, 2)}\n`);
  try { run('close'); } catch { /* Preserve the primary QA failure. */ }
}
