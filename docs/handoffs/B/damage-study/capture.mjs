import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const directory = fileURLToPath(new URL('./', import.meta.url));
const label = process.argv[2];
if (!['before','after'].includes(label)) throw new Error('Specify before or after');
const session = 'deep-press-damage';
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx',['--yes','agent-browser@0.38.1','--session',session,'--json',...args],{cwd:root,encoding:'utf8',timeout:45000}));
  if (!response.success) throw new Error(JSON.stringify(response.error)); return response.data;
};
const sha = path => createHash('sha256').update(readFileSync(root + path)).digest('hex');
const fingerprint = () => Object.fromEntries([
  ...readdirSync(root+'src/render').filter(name=>name.endsWith('.ts')).map(name=>'src/render/'+name),
  ...readdirSync(root+'public/assets/models').filter(name=>name.endsWith('.glb')).map(name=>'public/assets/models/'+name),
  'public/assets/textures/workshop-v4.webp','public/assets/textures/pressure-dial.webp','docs/handoffs/B/damage-study/viewer.ts',
].map(path=>[path,sha(path)]));
const report = { checkedAt: new Date().toISOString(), label, kind: 'Actual production renderer, fixed pose and compression .55; synthetic integrity, not gameplay or iPhone recognition proof.', captures: [], sourceHashesBefore: fingerprint() };
mkdirSync(directory+'captures',{recursive:true});
try {
  for (const [width,height] of [[320,568],[390,844],[1024,1536]]) {
    run('set','viewport',String(width),String(height));
    run('open','http://127.0.0.1:5173/docs/handoffs/B/damage-study/index.html');
    run('wait','--load','networkidle');
    run('eval',`(async()=>{const deadline=performance.now()+20000;while(performance.now()<deadline){if(window.__damageProbe?.ready)return;if(window.__damageProbe?.errors.length)throw Error(window.__damageProbe.errors);await new Promise(requestAnimationFrame);}throw Error('Not ready');})()`);
    for (const pose of width === 1024 ? ['inspect'] : ['inspect','failed']) for (const damage of [0,.5,1]) {
      const state = run('eval',`(()=>{const p=window.__damageProbe;const result=p.compare(${damage},'${pose}');return {...result,...p.show(${damage},'${pose}')};})()`).result;
      if (state.errors.length || state.status.loadedAssets !== '4') throw new Error(JSON.stringify(state));
      const path = `captures/${label}-${width}-${pose}-${damage}.png`;
      run('screenshot',directory+path);
      report.captures.push({width,height,...state,screenshot:path,sha256:sha('docs/handoffs/B/damage-study/'+path)});
    }
    if (label === 'after' && width !== 1024) for (const damage of [0,.5,1]) {
      const state = run('eval',`window.__damageProbe.store(${damage})`).result;
      if (state.errors.length || state.status.loadedAssets !== '4') throw new Error(JSON.stringify(state));
      const path = `captures/${label}-${width}-stored-${damage}.png`; run('screenshot',directory+path);
      report.captures.push({width,height,...state,screenshot:path,sha256:sha('docs/handoffs/B/damage-study/'+path)});
    }
  }
  report.browserErrors=run('errors').errors??[]; if(report.browserErrors.length)throw new Error('Browser errors');
  report.sourceHashesAfter=fingerprint();
  if(JSON.stringify(report.sourceHashesBefore)!==JSON.stringify(report.sourceHashesAfter))throw new Error('Sources changed during capture');
  report.passed=true;
  console.log(JSON.stringify({label,captures:report.captures.length,passed:report.passed}));
} catch(error) { report.passed=false;report.failure=String(error);process.exitCode=1; }
finally { writeFileSync(directory+label+'-report.json',JSON.stringify(report,null,2)+'\n');try{run('close');}catch{} }
