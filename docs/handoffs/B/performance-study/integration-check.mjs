import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = fileURLToPath(new URL('./integration/', import.meta.url));
const candidate = process.argv[2];
const url = process.argv[3] ?? 'http://127.0.0.1:4178';
if (!candidate) throw new Error('Pass the disposable A+B+C candidate checkout path.');
mkdirSync(output, { recursive: true });
const session = 'deep-press-connected-recovery';
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000 }));
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
};
const evaluate = source => run('eval', source).result;
const paths = ['src/main.ts', ...['src/app','src/core','src/content','src/render','src/contracts'].flatMap(dir => readdirSync(`${candidate}/${dir}`).filter(name => /\.(ts|css)$/.test(name)).map(name => `${dir}/${name}`))];
const fingerprint = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(`${candidate}/${path}`)).digest('hex')]));
const report = { at: new Date().toISOString(), kind: 'Desktop Chromium connected A+B+C UI using real mouse press/release; explicit synthetic WebGL context loss. Not iPhone, touch, or spontaneous GPU stability evidence.',
  candidateCommit: execFileSync('git', ['rev-parse','HEAD'], { cwd: candidate, encoding:'utf8' }).trim(),
  roleCommits: { A: '0c7634b7600f8831b1feca968d0dfad05a4e7986', B: 'd9db1df', C: 'f42f919b1284d7604d2aac217c43702338563bac' }, states: [] };
const state = label => {
  const value = evaluate(`({phase:document.querySelector('#phase').textContent, pressure:document.querySelector('#pressure-value').textContent,
    score:document.querySelector('#score').textContent,capacity:document.querySelector('#capacity').textContent,
    dialog:document.querySelector('[role=dialog],[role=alertdialog]')?.textContent??null,
    renderer:{...document.querySelector('canvas').dataset}, viewport:[innerWidth,innerHeight],
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth,verticalOverflow:document.documentElement.scrollHeight>innerHeight})`);
  const screenshot = `${label}.png`;
  run('screenshot', output + screenshot);
  report.states.push({ label, ...value, screenshot });
  return value;
};
const waitFor = expression => evaluate(`(async()=>{const end=performance.now()+15000;while(!(${expression})){if(performance.now()>end)throw new Error('State timeout');await new Promise(requestAnimationFrame);}return true;})()`);
const pressTo = target => {
  const point = evaluate(`(()=>{const r=document.querySelector('#hold').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  run('mouse', 'move', String(point.x), String(point.y)); run('mouse', 'down');
  try { waitFor(`parseInt(document.querySelector('#pressure-value').textContent,10)>=${target}`); }
  finally { run('mouse', 'up'); }
};
try {
  report.sourceHashesBefore = fingerprint();
  run('set','viewport','390','844'); run('open',url); run('wait','--load','networkidle'); run('snapshot','-i');
  waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);
  state('01-start'); run('click','[data-action=start]');
  pressTo(35); waitFor(`!document.querySelector('#store').disabled`);
  const pressed=state('02-pressed');
  if(pressed.phase!=='회수물 검사' || parseInt(pressed.pressure,10)<35) throw new Error('Press/release did not settle');
  run('click','#store'); const stored=state('03-stored');
  if(Number(stored.score.replaceAll(',',''))<=0 || Number(stored.capacity)>=1) throw new Error('Store did not commit score and volume');
  evaluate(`(()=>{const canvas=document.querySelector('canvas');const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!ext)throw new Error('Missing context-loss extension');ext.loseContext();})()`);
  waitFor(`document.querySelector('[data-action=retry-renderer]')`);
  const lost=state('04-context-lost');
  if(lost.renderer.renderState!=='error') throw new Error('Renderer did not report error');
  run('click','[data-action=retry-renderer]');
  waitFor(`document.querySelector('canvas').dataset.renderState==='ready'`);
  const recovered=state('05-recovered-paused');
  if(recovered.score!==stored.score || recovered.capacity!==stored.capacity || recovered.phase!=='일시 정지') throw new Error('Recovery changed game state or failed to pause');
  run('click','[data-action=resume]'); state('06-resumed');
  run('click','[data-specimen=salvage-cassette]'); pressTo(100);
  waitFor(`document.querySelector('[data-action=cash-out]')`);
  const failed=state('07-failed');
  if(failed.score!==stored.score || failed.renderer.renderState!=='ready') throw new Error('Failure lost stored score or renderer');
  run('click','[data-action=cash-out]'); const complete=state('08-complete');
  if(complete.score!==stored.score) throw new Error('Cash out changed committed score');
  run('click','[data-action=restart]'); const restarted=state('09-restarted');
  if(restarted.score!=='0' || restarted.capacity!=='1.00' || restarted.phase!=='회수물 검사') throw new Error('Restart did not reset');
  run('set','viewport','320','568'); const small=state('10-small');
  if(small.horizontalOverflow || small.verticalOverflow || small.renderer.renderState!=='ready') throw new Error('Small viewport overflow or renderer failure');
  report.browserErrors=run('errors').errors??[];
  if(report.browserErrors.length) throw new Error('Unhandled browser errors');
  report.sourceHashesAfter=fingerprint();
  if(JSON.stringify(report.sourceHashesBefore)!==JSON.stringify(report.sourceHashesAfter)) throw new Error('Sources changed');
  report.passed=true;
  console.log('Connected press, store, forced context-loss recovery, failure, cash-out, restart and short viewport passed. Physical-device and stored appearance continuity remain unverified.');
} catch(error) { report.passed=false;report.failure=String(error);process.exitCode=1; }
finally { writeFileSync(output+'report.json',JSON.stringify(report,null,2)+'\n');try{run('close');}catch{} }
