import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const directory=fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:5173';
const session='deep-press-shadow-agent';
const run=(...args)=>{const raw=execFileSync('npx',['--yes','agent-browser@0.38.1','--session',session,'--json',...args],{cwd:root,encoding:'utf8',timeout:45000});const r=JSON.parse(raw);if(!r.success)throw new Error(JSON.stringify(r.error));return r.data;};
const sha=(path)=>createHash('sha256').update(readFileSync(`${root}${path}`)).digest('hex');
const paths=['public/assets/models/press-chamber.glb','public/assets/models/salvage-cassette.glb','src/render/index.ts','src/render/ram.ts','docs/handoffs/B/shadow-study/capture.ts'];
const fingerprint=()=>Object.fromEntries(paths.map(path=>[path,sha(path)]));
mkdirSync(`${directory}captures`,{recursive:true});
const report={checkedAt:new Date().toISOString(),kind:'Actual desktop Chromium WebGL static inspection. Not mobile or gameplay performance evidence.',captures:[],errors:[],hashesBefore:fingerprint()};
try{
 for(const [asset,variant]of [['contact','baseline'],['contact','receive']]){
  run('set','viewport','1024','1536');
  const url=`${base}/docs/handoffs/B/shadow-study/capture.html?variant=${variant}`;
  run('open',url);run('wait','--load','networkidle');
  const state=run('eval',`(async()=>{const deadline=performance.now()+20000;while(performance.now()<deadline){const p=window.__shadowProbe;if(p?.errors.length)throw new Error(p.errors.join(';'));if(p?.ready){await new Promise(r=>setTimeout(r,300));return {ready:p.ready,errors:p.errors,status:p.status,sceneFacts:p.sceneFacts,depthFacts:p.depthFacts,renderer:document.querySelector('canvas').getContext('webgl2').getParameter(7937)};}await new Promise(r=>requestAnimationFrame(r));}throw new Error('timeout');})()`).result;
  const screenshot=`captures/${asset}-${variant}.png`;run('screenshot',`${directory}${screenshot}`);
  const logs=run('console'); const browserErrors=run('errors').errors??[]; if((logs.messages??[]).some(message=>message.type==='error'))throw new Error(JSON.stringify(logs)); if(browserErrors.length)throw new Error(JSON.stringify(browserErrors));
  report.captures.push({asset,variant,url,screenshot,sha256:sha(`docs/handoffs/B/shadow-study/${screenshot}`),...state,console:logs});
  console.log(`${asset} ${variant}: ready, ${state.status.drawCalls} visible calls, ${state.status.gpuTriangles} reported triangles`);
 }
 report.hashesAfter=fingerprint();if(JSON.stringify(report.hashesBefore)!==JSON.stringify(report.hashesAfter))throw new Error('Study sources changed during capture');
 report.passed=true;
}catch(error){report.passed=false;report.failure=String(error);console.error(error);process.exitCode=1;}
finally{writeFileSync(`${directory}capture-report.json`,JSON.stringify(report,null,2)+'\n');try{run('close');}catch{}}
