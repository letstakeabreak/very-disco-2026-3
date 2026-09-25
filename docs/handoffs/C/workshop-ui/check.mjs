import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const out=process.argv[3]?resolve(root,process.argv[3])+'/':fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:4180';
const run=(...args)=>{const r=JSON.parse(execFileSync('npx',['--yes','agent-browser@0.38.1','--session','deep-press-ui-proof','--json',...args],{cwd:root,encoding:'utf8',timeout:45000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;};
const evaluate=s=>run('eval',s).result;
const ensure=(value,message)=>{if(!value)throw Error(message);};
const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
const paths=['src/app/index.ts','src/app/style.css','src/app/story.ts','src/render/gauge.ts','src/render/visual-state.ts','src/app/presentation.ts','src/app/input.ts','src/app/runtime.ts','src/core/index.ts','src/render/index.ts','src/render/deformation.ts',...['SCDream4.otf','SCDream6.otf','RIDIBatang.otf','RIDIBatang-license.txt','S-Core-Dream-license.png','Cafe24PROSlimMax.woff2','Cafe24PROSlimMax-license.pdf','Cafe24PROSlimMax-license.txt'].map(p=>'src/app/fonts/'+p),...['yunseo-concerned','yunseo-relieved','dohyeon-explaining','dohyeon-resolved'].map(p=>'public/assets/characters/'+p+'.webp')];
const fingerprints=()=>Object.fromEntries(paths.map(p=>[p,hash(p)]));
const report={checkedAt:new Date().toISOString(),baseline:'b0c9da296c13ed29c3b961795f3938bb70583299',kind:'Actual integrated A/B/C M1 production build in desktop Chromium. Real browser pointer actions, no injected snapshots. Not iPhone or touch validation.',sourcesBefore:fingerprints(),layouts:[],flow:[],captures:[]};
const waitFor=expression=>{const deadline=Date.now()+25000;while(Date.now()<deadline){if(evaluate(expression))return true;run('wait','50');}throw Error('Condition timeout: '+expression);};
const capture=name=>{const path='after/'+name+'.png';run('screenshot',out+path);report.captures.push({path,sha256:hash(relative(root,out+path))});};
const state=()=>evaluate(`({phase:document.querySelector('#phase').textContent,pressure:document.querySelector('#pressure-value').textContent,score:document.querySelector('#score').textContent,capacity:document.querySelector('#capacity').textContent,result:document.querySelector('#result-value').textContent,cue:document.querySelector('#cue').textContent,light:document.querySelector('.status-card').style.getPropertyValue('--light-x'),strained:document.querySelector('.status-card').classList.contains('strained'),pressing:document.querySelector('#hold').classList.contains('pressing'),note:document.querySelector('#recovery-note')?.textContent,inert:document.querySelector('.screen').inert,renderer:{...document.querySelector('canvas').dataset}})`);
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),width:r.width};})()`);
const press=()=>{const p=center('#hold');run('mouse','move',String(p.x),String(p.y));run('mouse','down');};
mkdirSync(out+'after',{recursive:true});
try {
  for(const [width,height]of[[390,844],[320,568],[768,1024],[1440,900],[844,390]]){
    run('set','viewport',String(width),String(height));run('open',base);run('wait','--load','networkidle');run('snapshot','-i');
    waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);
    const fonts=evaluate(`document.fonts.ready.then(()=>[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})))`);
    ensure(fonts.length===4&&fonts.every(f=>f.status==='loaded'),'Fonts did not load');
    ensure(state().inert,'Background remains interactive under intro');
    const intro=evaluate(`['.mission-identity','#dialog-title','[data-action=\"start\"]'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {selector:s,top:r.top,bottom:r.bottom,left:r.left,right:r.right};})`);
    ensure(intro.every(r=>r.top>=0&&r.bottom<=height&&r.left>=0&&r.right<=width),'Intro content clipped');
    ensure(evaluate(`document.querySelector('[data-action="start"]').getBoundingClientRect().height===48`),'Start button size drift');
    capture(`${width}-start`);
    run('click','[data-action="start"]');
    waitFor(`document.querySelector('#phase').textContent==='살펴보기'`);
    const layout=evaluate(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();const buttons=[...document.querySelectorAll('.screen button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,overflow:b.scrollWidth>b.clientWidth}));return {width:innerWidth,height:innerHeight,canvas:rect('canvas'),status:rect('.status-card'),controls:rect('.controls'),font:getComputedStyle(document.body).fontFamily,glass:getComputedStyle(document.querySelector('.status-card')).backgroundImage,filter:getComputedStyle(document.querySelector('.status-card')).backdropFilter,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons};})()`);
    ensure(!layout.overflow,'Document overflow');ensure(layout.buttons.every(b=>b.width>=48&&b.height===48&&!b.overflow),'Control size drift or text overflow');
    const rhythm=evaluate(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();const style=s=>getComputedStyle(document.querySelector(s));const controls=rect('.controls'),choices=rect('.specimen-choices'),operations=rect('.operation-row'),actions=rect('.specimen-actions'),finish=rect('.finish-controls');const top=[...document.querySelectorAll('.topbar > *')].map(b=>b.getBoundingClientRect());const buttons=[...document.querySelectorAll('.screen button')];return {sameRadius:buttons.every(b=>getComputedStyle(b).borderRadius==='4px'),topAligned:top.every(b=>b.top===top[0].top&&b.height===48),trayGap:operations.top-choices.bottom,withinActionGap:parseFloat(style('.specimen-actions').gap),betweenActionGap:parseFloat(style('.operation-row').gap),finishSeparated:parseFloat(style('.finish-controls').borderLeftWidth)>0||parseFloat(style('.finish-controls').borderTopWidth)>0,groupsInside:choices.left>=controls.left&&choices.right<=controls.right&&actions.right<=controls.right&&finish.right<=controls.right,selectedDistinct:style('[aria-current="true"]').backgroundColor!==style('#hold').backgroundColor};})()`);
    ensure(rhythm.sameRadius&&rhythm.topAligned&&rhythm.groupsInside&&rhythm.finishSeparated&&rhythm.selectedDistinct,'Control grouping or alignment drift');
    ensure(rhythm.trayGap===16&&rhythm.betweenActionGap>rhythm.withinActionGap,'Inter-group proximity no longer exceeds intra-group spacing');
    ensure(!state().inert,'Start did not release background');
    if(width<height&&height<700){ensure(layout.canvas.y+layout.canvas.height*.14>=layout.status.bottom+9,'Gauge margin lost');ensure(layout.canvas.y+layout.canvas.height*.88<=layout.controls.top-9,'Case margin lost');}
    report.layouts.push({...layout,fonts,intro,rhythm});run('mouse','move','0','0');capture(`${width}-game`);
  }
  run('set','viewport','390','844');run('open',base);run('wait','--load','networkidle');waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);run('snapshot','-i');run('click','[data-action="start"]');run('click','[data-specimen="salvage-cassette"]');
  const area=center('#workbench-input');run('mouse','move',String(area.x-55),String(area.y));run('mouse','down');run('mouse','move',String(area.x+55),String(area.y));run('mouse','up');
  ensure(state().cue.includes('적당히'),'Inspect failed to reveal tolerance');report.flow.push({step:'inspect',...state()});
  press();waitFor(`parseInt(document.querySelector('#pressure-value').textContent)>=25`);run('mouse','up');waitFor(`document.querySelector('#phase').textContent==='살펴보기'`);
  const settled=state();ensure(parseInt(settled.pressure)>0,'Hold did not compress');ensure(parseFloat(settled.light)>14,'HUD light did not react');report.flow.push({step:'release',...settled});capture('390-settled');
  run('click','#store');waitFor(`Number(document.querySelector('#score').textContent.replaceAll(',',''))>0`);report.flow.push({step:'store',...state()});
  run('click','#cash-out');waitFor(`!!document.querySelector('.overlay-outro')`);ensure(evaluate(`document.querySelector('#story-text').textContent.includes('데이터')`),'Cassette ending absent');capture('390-outro-cassette');run('click','.story-actions [data-action="result"]');waitFor(`!!document.querySelector('#recovery-note')`);ensure(state().note.includes('연구 기록'),'Ending does not follow stored cassette');ensure(state().inert,'Result background interactive');report.flow.push({step:'complete',...state()});capture('390-complete');
  run('click','[data-action="restart"]');run('click','[data-specimen="salvage-lens"]');press();waitFor(`document.querySelector('.status-card').classList.contains('strained')`);
  report.flow.push({step:'strain',...state()});capture('390-strain');
  waitFor(`!!document.querySelector('#dialog-discard')`);run('mouse','up');ensure(state().inert,'Failure background interactive');
  report.dialogButtons=evaluate(`[...document.querySelectorAll('.dialog-card button')].map(b=>({text:b.textContent,height:b.getBoundingClientRect().height,radius:getComputedStyle(b).borderRadius}))`);
  ensure(report.dialogButtons.every(b=>b.height===48&&b.radius==='4px'),'Dialog choice size drift');
  report.flow.push({step:'failed',...state()});capture('390-failed');run('click','[data-action="discard"]');
  run('click','#cash-out');waitFor(`!!document.querySelector('.overlay-outro')`);ensure(evaluate(`document.querySelector('#dialog-title').textContent.includes('빈 케이스')`),'Empty ending absent');capture('390-outro-empty');run('click','.story-actions [data-action="result"]');waitFor(`!!document.querySelector('#recovery-note')`);ensure(state().note.includes('빈 케이스'),'Empty ending claims a recovery');report.flow.push({step:'empty',...state()});capture('390-empty');
  run('click','[data-action="restart"]');run('click','#pause');ensure(state().inert,'Pause background interactive');capture('390-paused');run('click','[data-action="resume"]');ensure(!state().inert,'Resume stays inert');
  evaluate(`document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`);waitFor(`!!document.querySelector('[data-action="retry-renderer"]')`);capture('390-retry');run('click','[data-action="retry-renderer"]');waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);run('click','[data-action="resume"]');ensure(!state().inert,'Retry stays inert');report.flow.push({step:'retry',...state()});
  report.errors=run('errors').errors??[];report.console=run('console');
  ensure(report.errors.length===0,'Browser errors');ensure(!(report.console.messages??[]).some(m=>m.type==='error'||/Multiple instances of Three/.test(m.text??'')),'Console errors');
  report.sourcesAfter=fingerprints();ensure(JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter),'Sources changed during run');
  report.passed=true;console.log(JSON.stringify({layouts:report.layouts.length,flow:report.flow.map(f=>f.step),captures:report.captures.length}));
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;console.error(error);}
finally{writeFileSync(out+'report.json',JSON.stringify(report,null,2)+'\n');try{run('close')}catch{}}
