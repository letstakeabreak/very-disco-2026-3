import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),dir=fileURLToPath(new URL('./',import.meta.url));
const session='deep-press-retraction-agent';
const run=(...args)=>{const r=JSON.parse(execFileSync('npx',['--yes','agent-browser@0.38.1','--session',session,'--json',...args],{cwd:root,encoding:'utf8',timeout:45000}));if(!r.success)throw new Error(JSON.stringify(r.error));return r.data;};
const sha=path=>createHash('sha256').update(readFileSync(root+path)).digest('hex');
const fingerprint=()=>Object.fromEntries(['src/render/ram.ts','src/render/deformation.ts','src/render/gauge.ts','public/assets/models/press-chamber.glb','public/assets/models/salvage-cassette.glb','public/assets/textures/pressure-dial.webp','docs/handoffs/B/retraction-study/viewer.ts','docs/handoffs/B/retraction-study/viewer.css','docs/handoffs/B/retraction-study/capture.mjs'].map(path=>[path,sha(path)]));
const report={checkedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Actual GLB pose inspection in independent Three.js scene; not game state integration or device proof',captures:[]};
mkdirSync(dir+'captures',{recursive:true});
try{
 report.hashesBefore=fingerprint();
 for(const view of ['front','oblique','phone'])for(const pose of ['rest','retracted','contact']){
  const width=view==='phone'?390:900,height=view==='phone'?844:1100;
  run('set','viewport',String(width),String(height));run('open',`http://127.0.0.1:5173/docs/handoffs/B/retraction-study/index.html?pose=${pose}&view=${view==='phone'?'front':view}`);run('wait','--load','networkidle');run('snapshot','-i');
  const probe=run('eval',`(async()=>{const end=performance.now()+20000;while(performance.now()<end){if(window.__retractionProbe?.errors.length)throw new Error(window.__retractionProbe.errors.join(';'));if(window.__retractionProbe?.ready){await new Promise(r=>setTimeout(r,250));return {...window.__retractionProbe,width:innerWidth,height:innerHeight,dpr:devicePixelRatio};}await new Promise(r=>requestAnimationFrame(r));}throw new Error('Pose not ready');})()`).result;
  if(probe.loadedGlbs!==2||probe.errors.length||probe.dpr!==1)throw new Error(JSON.stringify(probe));
  const file=`captures/${view}-${pose}.png`;run('screenshot',dir+file);const bytes=readFileSync(dir+file);
  if(bytes.readUInt32BE(16)!==width||bytes.readUInt32BE(20)!==height)throw new Error('Unexpected capture size');
  report.captures.push({file,...probe,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 report.errors=run('errors').errors??[];if(report.errors.length)throw new Error('Browser errors');
 report.hashesAfter=fingerprint();if(JSON.stringify(report.hashesBefore)!==JSON.stringify(report.hashesAfter))throw new Error('Pose capture sources changed');
 report.passed=true;console.log('Nine retraction pose captures passed; no gameplay or device validation implied.');
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;}
finally{writeFileSync(dir+'capture-report.json',JSON.stringify(report,null,2)+'\n');try{run('close');}catch{}}
