import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:4180';
const run=(...args)=>{const r=JSON.parse(execFileSync('npx',['--yes','agent-browser@0.38.1','--session','deep-press-ui-proof','--json',...args],{cwd:root,encoding:'utf8',timeout:45000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;};
const evaluate=s=>run('eval',s).result;
const ensure=(value,message)=>{if(!value)throw Error(message);};
const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
const paths=['src/app/index.ts','src/app/style.css','src/app/presentation.ts','src/app/input.ts','src/app/runtime.ts','src/core/index.ts','src/render/index.ts','src/render/deformation.ts',...['SCDream4.otf','SCDream6.otf','RIDIBatang.otf','RIDIBatang-license.txt','S-Core-Dream-license.png'].map(p=>'src/app/fonts/'+p)];
const fingerprints=()=>Object.fromEntries(paths.map(p=>[p,hash(p)]));
const report={checkedAt:new Date().toISOString(),kind:'Actual M1 core + C app + v1 production renderer in desktop Chromium. Real browser pointer actions, no injected snapshots. Not iPhone or touch validation.',sourcesBefore:fingerprints(),layouts:[],flow:[],captures:[]};
const waitFor=expression=>evaluate(`(async()=>{for(let i=0;i<1200;i++){if(${expression})return true;await new Promise(r=>requestAnimationFrame(r));}throw Error('Condition timeout');})()`);
const capture=name=>{const path='after/'+name+'.png';run('screenshot',out+path);report.captures.push({path,sha256:hash('docs/handoffs/C/workshop-ui/'+path)});};
const state=()=>evaluate(`({phase:document.querySelector('#phase').textContent,pressure:document.querySelector('#pressure-value').textContent,score:document.querySelector('#score').textContent,capacity:document.querySelector('#capacity').textContent,result:document.querySelector('#result-value').textContent,cue:document.querySelector('#cue').textContent,light:document.querySelector('.status-card').style.getPropertyValue('--light-x'),strained:document.querySelector('.status-card').classList.contains('strained'),pressing:document.querySelector('#hold').classList.contains('pressing'),note:document.querySelector('#recovery-note')?.textContent,inert:document.querySelector('.screen').inert,renderer:{...document.querySelector('canvas').dataset}})`);
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),width:r.width};})()`);
const press=()=>{const p=center('#hold');run('mouse','move',String(p.x),String(p.y));run('mouse','down');};
mkdirSync(out+'after',{recursive:true});
try {
  for(const [width,height]of[[390,844],[320,568],[1440,900],[844,390]]){
    run('set','viewport',String(width),String(height));run('open',base);run('wait','--load','networkidle');run('snapshot','-i');
    waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);
    const fonts=evaluate(`document.fonts.ready.then(()=>[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})))`);
    ensure(fonts.length===3&&fonts.every(f=>f.status==='loaded'),'Fonts did not load');
    ensure(state().inert,'Background remains interactive under intro');
    const intro=evaluate(`['.mission-identity','#dialog-title','[data-action=\"start\"]'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {selector:s,top:r.top,bottom:r.bottom,left:r.left,right:r.right};})`);
    ensure(intro.every(r=>r.top>=0&&r.bottom<=height&&r.left>=0&&r.right<=width),'Intro content clipped');
    capture(`${width}-start`);
    run('click','[data-action="start"]');
    waitFor(`document.querySelector('#phase').textContent==='살펴보기'`);
    const layout=evaluate(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();const buttons=[...document.querySelectorAll('.screen button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,overflow:b.scrollWidth>b.clientWidth}));return {width:innerWidth,height:innerHeight,canvas:rect('canvas'),status:rect('.status-card'),controls:rect('.controls'),font:getComputedStyle(document.body).fontFamily,glass:getComputedStyle(document.querySelector('.status-card')).backgroundImage,filter:getComputedStyle(document.querySelector('.status-card')).backdropFilter,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons};})()`);
    ensure(!layout.overflow,'Document overflow');ensure(layout.buttons.every(b=>b.width>=44&&b.height>=44&&!b.overflow),'Control target or text overflow');
    ensure(!state().inert,'Start did not release background');
    if(width<height&&height<700){ensure(layout.canvas.y+layout.canvas.height*.14>=layout.status.bottom+9,'Gauge margin lost');ensure(layout.canvas.y+layout.canvas.height*.88<=layout.controls.top-9,'Case margin lost');}
    report.layouts.push({...layout,fonts,intro});capture(`${width}-game`);
  }
  run('set','viewport','390','844');run('open',base);run('wait','--load','networkidle');waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);run('snapshot','-i');run('click','[data-action="start"]');run('click','[data-specimen="salvage-cassette"]');
  const area=center('#workbench-input');run('mouse','move',String(area.x-55),String(area.y));run('mouse','down');run('mouse','move',String(area.x+55),String(area.y));run('mouse','up');
  ensure(state().cue.includes('적당히'),'Inspect failed to reveal tolerance');report.flow.push({step:'inspect',...state()});
  press();waitFor(`parseInt(document.querySelector('#pressure-value').textContent)>=25`);run('mouse','up');waitFor(`document.querySelector('#phase').textContent==='살펴보기'`);
  const settled=state();ensure(parseInt(settled.pressure)>0,'Hold did not compress');ensure(parseFloat(settled.light)>14,'HUD light did not react');report.flow.push({step:'release',...settled});capture('390-settled');
  run('click','#store');waitFor(`Number(document.querySelector('#score').textContent.replaceAll(',',''))>0`);report.flow.push({step:'store',...state()});
  run('click','#cash-out');waitFor(`!!document.querySelector('#recovery-note')`);ensure(state().note.includes('연구 기록'),'Ending does not follow stored cassette');ensure(state().inert,'Result background interactive');report.flow.push({step:'complete',...state()});capture('390-complete');
  run('click','[data-action="restart"]');run('click','[data-specimen="salvage-lens"]');press();waitFor(`document.querySelector('.status-card').classList.contains('strained')`);
  report.flow.push({step:'strain',...state()});capture('390-strain');
  waitFor(`!!document.querySelector('#dialog-discard')`);run('mouse','up');ensure(state().inert,'Failure background interactive');report.flow.push({step:'failed',...state()});capture('390-failed');run('click','[data-action="discard"]');
  run('click','#cash-out');waitFor(`!!document.querySelector('#recovery-note')`);ensure(state().note.includes('빈 케이스'),'Empty ending claims a recovery');report.flow.push({step:'empty',...state()});capture('390-empty');
  run('click','[data-action="restart"]');run('click','#pause');ensure(state().inert,'Pause background interactive');capture('390-paused');run('click','[data-action="resume"]');ensure(!state().inert,'Resume stays inert');
  evaluate(`document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`);waitFor(`!!document.querySelector('[data-action="retry-renderer"]')`);capture('390-retry');run('click','[data-action="retry-renderer"]');waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);run('click','[data-action="resume"]');ensure(!state().inert,'Retry stays inert');report.flow.push({step:'retry',...state()});
  report.errors=run('errors').errors??[];report.console=run('console');
  ensure(report.errors.length===0,'Browser errors');ensure(!(report.console.messages??[]).some(m=>m.type==='error'||/Multiple instances of Three/.test(m.text??'')),'Console errors');
  report.sourcesAfter=fingerprints();ensure(JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter),'Sources changed during run');
  report.passed=true;console.log(JSON.stringify({layouts:report.layouts.length,flow:report.flow.map(f=>f.step),captures:report.captures.length}));
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;console.error(error);}
finally{writeFileSync(out+'report.json',JSON.stringify(report,null,2)+'\n');try{run('close')}catch{}}
