import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const directory=fileURLToPath(new URL('./',import.meta.url));
const base=process.argv[2]??'http://127.0.0.1:5173';
const session='deep-press-art-gallery';
const run=(...args)=>{const raw=execFileSync('npx',['--yes','agent-browser@0.38.1','--session',session,'--json',...args],{cwd:root,encoding:'utf8',timeout:45000});const response=JSON.parse(raw);if(!response.success)throw new Error(JSON.stringify(response.error));return response.data;};
const evaluate=(source)=>run('eval',source).result;
const report={checkedAt:new Date().toISOString(),kind:'Static image gallery verification; does not open a WebGL view.',url:`${base}/docs/handoffs/B/art-review/index.html`,checks:[],errors:[]};
try{
  run('set','viewport','1440','1000');run('open',report.url);run('wait','--load','networkidle');
  report.interactiveSnapshot=run('snapshot','-i');
  const content=evaluate(`(async()=>{const images=[...document.images];for(const image of images)image.loading='eager';await Promise.all(images.map(image=>image.decode()));return{articles:document.querySelectorAll('article').length,rows:document.querySelectorAll('tbody tr').length,selectors:document.querySelectorAll('select').length,images:images.map(image=>({path:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight,complete:image.complete})),canvases:document.querySelectorAll('canvas').length,pendingText:/촬영 전|촬영 대기/.test(document.body.innerText)};})()`);
  if(content.articles!==5||content.rows!==35||content.selectors!==5||content.images.length!==16||content.canvases!==0||content.pendingText)throw new Error(`Unexpected gallery content: ${JSON.stringify(content)}`);
  if(content.images.some(image=>!image.complete||!image.width||!image.height))throw new Error('Gallery image missing');
  report.checks.push({content});
  for(const [label,value,expected]of [['실제만','only-actual',['none','block']],['목표만','only-reference',['block','none']],['나란히','',['block','block']]]){
    run('select','[aria-label="01 비교 보기"]',value);
    const figures=evaluate(`[...document.querySelector('#target-01 .pairs').children].map(e=>getComputedStyle(e).display)`);
    if(JSON.stringify(figures)!==JSON.stringify(expected))throw new Error(`View toggle failed: ${label}`);
    report.checks.push({toggle:label,figures});
  }
  run('screenshot',`${directory}gallery-desktop.png`);
  for(const width of [390,320]){
    run('set','viewport',String(width),'844');
    const layout=evaluate(`(()=>{for(const d of document.querySelectorAll('details'))d.open=true;return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,openDetails:document.querySelectorAll('details[open]').length,canvases:document.querySelectorAll('canvas').length};})()`);
    if(layout.documentWidth>width||layout.bodyWidth>width||layout.openDetails!==3||layout.canvases!==0)throw new Error(`Mobile gallery overflow: ${JSON.stringify(layout)}`);
    report.checks.push({layout});
    run('screenshot',`${directory}gallery-${width}.png`);
  }
  report.errors=run('errors').errors??[];if(report.errors.length)throw new Error('Gallery browser errors');
  report.sources=Object.fromEntries(['index.html','gallery.ts','gallery.css','review-data.ts','gallery-check.mjs','capture-report.json'].map(path=>[path,createHash('sha256').update(readFileSync(`${directory}${path}`)).digest('hex')]));
  report.passed=true;console.log('Static art gallery passed: 5 targets, 35 verdicts, 16 images, 3 view modes, 390/320 layout.');
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;}
finally{writeFileSync(`${directory}gallery-check.json`,JSON.stringify(report,null,2)+'\n');try{run('close');}catch{}}
