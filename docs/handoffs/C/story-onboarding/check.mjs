import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:4180';
const run=(...args)=>{const r=JSON.parse(execFileSync('npx',['--yes','agent-browser@0.38.1','--session','deep-press-story-proof','--json',...args],{cwd:root,encoding:'utf8',timeout:45000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;};
const evaluate=s=>run('eval',s).result;
const ensure=(v,message)=>{if(!v)throw Error(message);};
const waitFor=expression=>{const deadline=Date.now()+25000;while(Date.now()<deadline){if(evaluate(expression))return true;run('wait','50');}throw Error('Condition timeout: '+expression);};
const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
const paths=['src/core/index.ts','src/render/index.ts','src/app/index.ts','src/app/story.ts','src/render/gauge.ts','src/render/visual-state.ts','src/app/style.css',...['yunseo-concerned','yunseo-relieved','dohyeon-explaining','dohyeon-resolved'].map(p=>'public/assets/characters/'+p+'.webp')];
const fingerprints=()=>Object.fromEntries(paths.map(p=>[p,hash(p)]));
const report={checkedAt:new Date().toISOString(),baseline:'b0c9da296c13ed29c3b961795f3938bb70583299',kind:'Actual browser actions with integrated A/B/C M1; no injected game state. Desktop Chromium only.',sourcesBefore:fingerprints(),layouts:[],flow:[],captures:[]};
mkdirSync(out+'after',{recursive:true});
const capture=name=>{const path='after/'+name+'.png';run('mouse','move','0','0');run('screenshot',out+path);report.captures.push({path,sha256:hash('docs/handoffs/C/story-onboarding/'+path)});};
const state=()=>evaluate(`({phase:document.querySelector('#phase').textContent,score:document.querySelector('#score').textContent,pressure:document.querySelector('#pressure-value').textContent,specimen:document.querySelector('#specimen-name').textContent,capacity:document.querySelector('#capacity').textContent,title:document.querySelector('#dialog-title')?.textContent,text:document.querySelector('#story-text')?.textContent,inert:document.querySelector('.screen').inert,portrait:document.querySelector('.story-art img')?.getAttribute('src'),renderer:{...document.querySelector('canvas').dataset},hidden:document.hidden})`);
const pressTo=percent=>{const p=evaluate(`(()=>{const r=document.querySelector('#hold').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);run('mouse','move',String(p.x),String(p.y));run('mouse','down');waitFor(`parseInt(document.querySelector('#pressure-value').textContent)>=${percent}`);run('mouse','up');waitFor(`document.querySelector('#phase').textContent==='살펴보기'`);};
const ready=()=>{run('open',base);run('wait','--load','networkidle');waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);run('snapshot','-i');};
try {
  for(const [width,height]of(process.argv.includes('--flow-only')?[]:[[390,844],[320,568],[768,1024],[1440,900],[844,390]])){
    run('set','viewport',String(width),String(height));ready();
    const logo=evaluate(`document.fonts.ready.then(()=>{const e=document.querySelector('.wordmark'),r=e.getBoundingClientRect(),card=document.querySelector('.mission-card').getBoundingClientRect();return {font:getComputedStyle(e).fontFamily,loaded:document.fonts.check('48px "Cafe24 PRO SLIM Max"'),inside:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,clear:r.right<=card.left||r.bottom<=card.top||r.top>=card.bottom};})`);
    ensure(logo.loaded&&logo.inside&&logo.clear&&logo.font.includes('Cafe24'),'Logo missing, clipped or overlapping mission');capture(`${width}-title`);
    run('click','[data-action="story-open"]');
    for(let page=0;page<3;page++){
      waitFor(`document.querySelector('.story-art img').complete&&document.querySelector('.story-art img').naturalWidth>0`);
      const layout=evaluate(`(()=>{const card=document.querySelector('.story-card').getBoundingClientRect();const buttons=[...document.querySelectorAll('.story-card button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,width:r.width,height:r.height,inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};});return {title:document.querySelector('#dialog-title').textContent,cardInside:card.top>=0&&card.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,buttons};})()`);
      ensure(layout.cardInside&&!layout.overflow&&layout.buttons.every(b=>b.inside&&b.width>=48&&b.height===48),'Story clipping or target regression');
      ensure(state().inert&&state().score==='0'&&state().phase==='대기','Story advanced game or left gameplay interactive');
      report.layouts.push({width,height,page,...layout,logo});capture(`${width}-story-${page+1}`);
      if(page===1){run('click','[data-action="story-back"]');ensure(state().title==='물속에 남은 연구소','Back failed');run('click','[data-action="story-next"]');}
      run('click','[data-action="story-next"]');
    }
    ensure(state().phase==='살펴보기'&&!state().inert,'Intro did not begin play');capture(`${width}-tutorial`);
  }
  run('set','viewport','390','844');ready();run('click','[data-action="story-open"]');run('press','Escape');ensure(evaluate(`!!document.querySelector('[data-action="story-open"]')`),'Escape did not return to title');run('click','[data-action="story-open"]');run('click','[data-action="story-skip"]');ensure(state().phase==='살펴보기','Skip failed');
  run('click','[data-specimen="salvage-cassette"]');pressTo(63);const before=state();
  run('click','#pause');run('click','[data-action="story-open"]');run('click','[data-action="story-next"]');
  run('click','[data-action="story-skip"]');const after=state();ensure(after.phase==='살펴보기'&&before.pressure===after.pressure&&before.specimen===after.specimen&&before.capacity===after.capacity,'Story replay reset the active round');ensure(evaluate(`document.activeElement.id==='pause'`),'Replay did not restore keyboard focus');report.flow.push({step:'pause-replay-resume',before,after});
  run('click','#store');run('click','#cash-out');waitFor(`!!document.querySelector('.overlay-outro')`);ensure(state().text.includes('손상은 있지만'),'Damaged cassette ending misreported');ensure(state().inert,'Outro allows background play');report.flow.push({step:'damaged-cassette',...state()});capture('390-outro-damaged');run('click','.story-actions [data-action="result"]');run('click','[data-action="restart"]');ensure(state().phase==='살펴보기'&&!state().inert,'Restart repeats intro');
  pressTo(25);run('click','#store');run('click','#cash-out');waitFor(`!!document.querySelector('.overlay-outro')`);ensure(state().text.includes('연구 기록까지 가져오진 못했지만'),'Parts ending claims records');report.flow.push({step:'parts-ending',...state()});capture('390-outro-parts');
  run('click','.story-actions [data-action="result"]');run('click','[data-action="restart"]');
  for(let i=0;i<3;i++){
    if(i>0){const selector=evaluate(`'[data-specimen="'+document.querySelector('[data-specimen]:not(:disabled)').dataset.specimen+'"]'`);run('click',selector);}
    pressTo(15);ensure(!evaluate(`!!document.querySelector('.overlay-outro')`),'Ending appeared before the last object was processed');run('click','#discard');
  }
  waitFor(`!!document.querySelector('.overlay-outro')`);ensure(state().title==='아직, 빈 케이스','Automatic last-lot ending absent');report.flow.push({step:'last-compressed-object-discarded',...state()});capture('390-outro-last-lot');
  report.errors=run('errors').errors??[];report.console=run('console');ensure(report.errors.length===0,'Browser errors');ensure(!(report.console.messages??[]).some(m=>m.type==='error'),'Console errors');
  report.sourcesAfter=fingerprints();ensure(JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter),'Sources changed during verification');report.passed=true;console.log(JSON.stringify({passed:true,layouts:report.layouts.length,flows:report.flow.length,captures:report.captures.length}));
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;console.error(error);try{report.failureState=state();report.errors=run('errors');report.console=run('console');capture('failure');}catch{}}
finally{writeFileSync(out+'report.json',JSON.stringify(report,null,2)+'\n');try{run('close')}catch{}}
