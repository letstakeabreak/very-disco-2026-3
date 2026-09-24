import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url)); const directory = fileURLToPath(new URL('./', import.meta.url));
const run = (...args) => { const r = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', 'deep-press-case-proof', '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000 })); if (!r.success) throw new Error(JSON.stringify(r.error)); return r.data; };
const sha = path => createHash('sha256').update(readFileSync(root + path)).digest('hex');
const paths = ['src/render/index.ts', 'src/render/case-depth.ts', 'src/render/deformation.ts', 'src/render/ram.ts', 'public/assets/textures/workshop-v4.webp',
  ...['press-chamber', 'salvage-core', 'salvage-lens', 'salvage-cassette'].map(id => `public/assets/models/${id}.glb`), 'docs/handoffs/B/layout-study/foreground.ts'];
const hashes = () => Object.fromEntries(paths.map(p => [p, sha(p)]));
const report = { checkedAt: new Date().toISOString(), kind: 'Actual WebGL production renderer with synthetic stored-history fixtures. CPU projection of actual deformed GLB vertices plus synchronous GPU pixel comparison with depth on/off and empty case. Not physical containment, C HUD, gameplay or iPhone validation.', sourceHashesBefore: hashes(), layouts: [], captures: [] };
mkdirSync(directory + 'foreground-captures', { recursive: true });
try {
  for (const [width, height] of [[390, 844], [320, 568]]) {
    run('set', 'viewport', String(width), String(height));
    run('open', `${process.argv[2] ?? 'http://127.0.0.1:5173'}/docs/handoffs/B/layout-study/foreground.html`);
    run('wait', '--load', 'networkidle'); run('snapshot', '-i');
    const layouts = run('eval', `(async()=>{for(let i=0;i<1200&&!window.__caseProbe?.ready;i++)await new Promise(r=>requestAnimationFrame(r));const p=window.__caseProbe;if(!p?.ready)throw new Error('Not ready');const ids=['salvage-cassette','salvage-lens','salvage-core'];const out=[];for(const a of ids)for(const b of ids.filter(x=>x!==a)){const c=ids.find(x=>x!==a&&x!==b);for(const compression of [0,.55,1]){const result=p.show([a,b,c],compression);result.depth=p.compareDepth([a,b,c],compression);out.push(result);}}return out;})()`).result;
    for (const layout of layouts) {
      if (layout.errors.length || layout.bounds.length !== 3 || layout.status.loadedAssets !== '4') throw new Error('Incomplete fixture');
      for (const b of layout.bounds) if (b.minX < 0 || b.maxX > width || b.minY < 50 || b.bottomMarginTo130pxStudyDock < 0) throw new Error(`Object clipped or under B study dock: ${JSON.stringify(layout)}`);
      const sorted = [...layout.bounds].sort((a, b) => a.minX - b.minX);
      layout.horizontalClearancePx = Math.min(sorted[1].minX - sorted[0].maxX, sorted[2].minX - sorted[1].maxX);
      if (layout.horizontalClearancePx < 0) throw new Error(`Stored objects overlap: ${JSON.stringify(layout)}`);
      const d = layout.depth;
      if (d.errors.length || d.changedOutsideCase !== 0 || d.specimenPixelsOnFrontAfter !== 0 || d.visiblePixelsInApertures.some(n => n < 20)) throw new Error(`Depth regression: ${JSON.stringify(d)}`);
    }
    report.layouts.push(...layouts);
    for (const compression of [0, .55, 1]) {
      const state = run('eval', `window.__caseProbe.show(['salvage-cassette','salvage-lens','salvage-core'],${compression})`).result;
      const screenshot = `foreground-captures/${width}-compression-${compression}.png`; run('screenshot', directory + screenshot);
      report.captures.push({ state, screenshot, sha256: sha(`docs/handoffs/B/layout-study/${screenshot}`) });
    }
  }
  report.errors = run('errors').errors ?? []; report.console = run('console');
  if (report.errors.length || (report.console.messages ?? []).some(m => m.type === 'error')) throw new Error('Browser error');
  report.sourceHashesAfter = hashes(); if (JSON.stringify(report.sourceHashesBefore) !== JSON.stringify(report.sourceHashesAfter)) throw new Error('Sources changed');
  report.passed = true;
  console.log(JSON.stringify({ layouts: report.layouts.length, minimumDockMarginPx: Math.min(...report.layouts.flatMap(l => l.bounds.map(b => b.bottomMarginTo130pxStudyDock))), minimumHorizontalClearancePx: Math.min(...report.layouts.map(l => l.horizontalClearancePx)) }));
} catch (error) { report.passed = false; report.failure = String(error); process.exitCode = 1; console.error(error); }
finally { writeFileSync(directory + 'foreground-report.json', JSON.stringify(report, null, 2) + '\n'); try { run('close'); } catch {} }
