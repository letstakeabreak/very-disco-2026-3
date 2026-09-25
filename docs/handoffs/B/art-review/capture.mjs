import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const directory=fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:5173';
const session='deep-press-art-evidence';
const run=(...args)=>{ let raw;try{raw=execFileSync('npx',['--yes','agent-browser@0.38.1','--session',session,'--json',...args],{cwd:root,encoding:'utf8',timeout:45000});}catch(error){throw new Error(`${error.message}\n${String(error.stdout??'').slice(-2000)}\n${String(error.stderr??'').slice(-2000)}`);}const response=JSON.parse(raw);if(!response.success)throw new Error(JSON.stringify(response.error));return response.data;};
const evaluate=(source)=>run('eval',source).result;
const sha=(path)=>createHash('sha256').update(readFileSync(`${root}${path}`)).digest('hex');
const fingerprint=()=>Object.fromEntries([
  ...readdirSync(`${root}src/render`).filter(name=>name.endsWith('.ts')).map(name=>`src/render/${name}`),
  ...readdirSync(`${root}public/assets/models`).filter(name=>name.endsWith('.glb')).map(name=>`public/assets/models/${name}`),
  ...readdirSync(`${root}docs/art/concepts`).filter(name=>name.endsWith('.png')).map(name=>`docs/art/concepts/${name}`),
  ...readdirSync(`${root}public/assets/textures`).filter(name=>name.endsWith('.webp')).map(name=>`public/assets/textures/${name}`),
  ...['capture.ts','capture.css','inspector.ts','capture.mjs'].map(name=>`docs/handoffs/B/art-review/${name}`),
].sort().map(path=>[path,sha(path)]));
mkdirSync(`${directory}captures`,{recursive:true});
const report={checkedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),kind:'Actual desktop Chromium WebGL art evidence. Scene fixture and independent asset inspector are distinct. Not iPhone or gameplay proof.',captures:[],errors:[]};
try {
  report.hashesBefore=fingerprint();
  for(const target of ['01','02','03','04','05']){
    const variants=target==='03'||target==='04'?[['canonical',1254,1254]]:[['canonical',1024,1536],['390',390,844],['320',320,568]];
    for(const [variant,width,height]of variants){
      run('set','viewport',String(width),String(height));
      const url=`${base}/docs/handoffs/B/art-review/capture.html?target=${target}`;
      run('open',url);run('wait','--load','networkidle');
      const state=evaluate(`(async()=>{const deadline=performance.now()+20000;while(performance.now()<deadline){const p=window.__artProbe;if(p?.errors.length)throw new Error(p.errors.join('; '));if(p?.ready){await new Promise(r=>setTimeout(r,600));return {target:p.target,ready:p.ready,errors:p.errors,status:p.status,viewport:p.viewport,snapshot:p.snapshot,frames:p.frames};}await new Promise(r=>requestAnimationFrame(r));}throw new Error('Art viewer ready timeout');})()`);
      if(!state.ready||state.errors.length||state.viewport.width!==width||state.viewport.height!==height)throw new Error(`Invalid capture: ${JSON.stringify(state)}`);
      if((target==='01'||target==='02'||target==='05')&&state.status.loadedAssets!=='4')throw new Error('Scene did not load all four GLBs');
      const screenshot=`captures/${target}-${variant}.png`;run('screenshot',`${directory}${screenshot}`);
      const bytes=readFileSync(`${directory}${screenshot}`);
      const dimensions={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
      if(dimensions.width!==width||dimensions.height!==height)throw new Error('Screenshot dimensions differ from comparison dimensions');
      report.captures.push({target,variant,url,screenshot,screenshotSha256:createHash('sha256').update(bytes).digest('hex'),dimensions,...state});
    }
  }
  report.errors=run('errors').errors??[];if(report.errors.length)throw new Error('Browser reported errors');
  report.hashesAfter=fingerprint();if(JSON.stringify(report.hashesBefore)!==JSON.stringify(report.hashesAfter))throw new Error('Source changed during art capture; repeat after freeze');
  report.passed=true;console.log('Art capture passed: five canonical targets plus six 390/320 scene readability screenshots.');
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;}
finally{writeFileSync(`${directory}capture-report.json`,JSON.stringify(report,null,2)+'\n');try{run('close');}catch{}}
