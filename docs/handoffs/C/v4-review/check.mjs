// Usage: node docs/handoffs/C/v4-review/check.mjs <url> <out-dir> [width] [height] [clear|keep]
// Goal v4 flow: title -> story -> video -> choose lots from the manifest -> rotate -> press to the creak -> store x3 -> ending -> graded result.
import { execFileSync } from 'node:child_process';
const [url, out, w = '402', h = '714', clear = 'clear'] = process.argv.slice(2);
const run = (...args) => { const r = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', 'v4', '--json', ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 1 << 26 })); if (!r.success) throw new Error(JSON.stringify(r.error)); return r.data; };
const js = (code) => run('eval', `(async () => { const q=(s)=>document.querySelector(s); const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); ${code} })()`).result;
const shot = (name) => run('screenshot', `${out}/${name}.png`);
const log = (label, value) => console.log(label, JSON.stringify(value));
try {
  run('set', 'viewport', w, h); run('open', url); run('wait', '--load', 'networkidle');
  if (clear === 'clear') { js(`localStorage.clear(); return 1`); run('open', url); run('wait', '--load', 'networkidle'); }
  js(`for (let i=0;i<100 && q('canvas').dataset.renderState!=='ready';i++) await wait(200); await document.fonts.ready; return 1`);
  log('title buttons', js(`return [...document.querySelectorAll('#overlay button')].map(b=>b.textContent)`)); shot('01-title');
  log('story', js(`q('[data-action=story-open],[data-action=quick-start]').click(); await wait(300); const lines=[]; for (let i=0;i<10 && q('.vn');i++){ q('.vn').click(); await wait(60); lines.push(q('.vn-line')?.textContent); q('.vn').click(); await wait(120);} return lines;`));
  js(`await wait(600); if (!q('#transition').hidden) q('#transition').click(); await wait(900); return 1`);
  log('game', js(`return { chips: [...document.querySelectorAll('.lot')].map(b=>b.innerText.replace(/\\n/g,' ')+(b.disabled?' [x]':'')), comms: q('#comms-line').textContent, facts: q('#result-value').textContent }`)); shot('02-manifest');
  const lot = async (id, label) => {
    js(`q('[data-lot=${id}]').click(); await wait(400); return 1`);
    const box = js(`const r=q('#workbench-input').getBoundingClientRect(); return [Math.round(r.x+r.width*0.3), Math.round(r.y+r.height*0.5), Math.round(r.x+r.width*0.8)]`);
    run('mouse', 'move', String(box[0]), String(box[1])); run('mouse', 'down'); run('mouse', 'move', String(box[2]), String(box[1])); run('mouse', 'up');
    log(label + ' after rotate', js(`await wait(1500); return { comms: q('#comms-line').textContent, facts: q('#result-value').textContent }`));
    if (label === 'first') shot('03-rotated');
    // A player who lets go about 0.15 s after the creak starts (PRD v1.2 warning band and ram lag).
    const at = js(`const h=q('#hold'); h.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); const t0=performance.now(); for (let i=0;i<600;i++){ if (q('.status-card').classList.contains('strained')) break; await wait(5);} const creakMs=Math.round(performance.now()-t0); await wait(150); const facts=q('#result-value').textContent, comms=q('#comms-line').textContent; h.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true})); return { creakMs, facts, comms }`);
    if (label === 'first') shot('04-creak');
    log(label + ' creak', at);
    log(label + ' settled', js(`await wait(700); return { facts: q('#result-value').textContent, store: !q('#store').disabled }`));
    js(`q('#store').click(); await wait(500); return 1`);
    log(label + ' stored', js(`return { comms: q('#comms-line').textContent, score: q('#score').textContent, room: q('#capacity').textContent, chips: [...document.querySelectorAll('.lot')].map(b=>b.dataset.state) }`));
  };
  await lot('salvage-lens', 'first'); shot('05-after-first');
  await lot('salvage-cassette', 'second');
  // Last lot: press until the preview fits the room, then release.
  js(`q('[data-lot=salvage-core]').click(); await wait(400); return 1`);
  log('last pressing', js(`const h=q('#hold'); h.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); const room=Number(q('#capacity').textContent); for (let i=0;i<900;i++){ const m=q('#result-value').textContent.match(/예상 ([0-9.]+)L/); if (m && Number(m[1])<=room-0.005) break; await wait(5);} const f=q('#result-value').textContent; h.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true})); return f`));
  log('last settled', js(`await wait(700); return { facts: q('#result-value').textContent, store: !q('#store').disabled }`));
  js(`q('#store').click(); await wait(900); return 1`); shot('06-outro');
  log('ending', js(`const lines=[]; for (let i=0;i<8 && q('.vn');i++){ lines.push(q('.vn-line')?.textContent); q('.vn')?.click(); await wait(60); q('.vn')?.click(); await wait(150);} await wait(400); return lines;`));
  log('result', js(`return { overlay: q('#overlay').className, score: q('#result-score')?.textContent, grade: q('#result-grade')?.textContent, par: q('#result-par')?.textContent, rows: [...document.querySelectorAll('#dialog-items li')].map(li=>li.innerText.replace(/\\n/g,' | ')), record: q('#dialog-record')?.textContent }`)); shot('07-result');
  log('replay', js(`q('[data-action=restart]').click(); await wait(600); return { comms: q('#comms-line').textContent, chips: [...document.querySelectorAll('.lot')].map(b=>b.dataset.state) }`));
  log('errors', run('errors').errors);
} finally { run('close'); }
