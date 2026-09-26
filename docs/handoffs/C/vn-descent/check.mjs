// Headless walk-through: title -> VN intro -> descent video -> press/store -> auto-advance/swap -> pause finish -> ending -> result.
// Usage (dev or preview server running): node docs/handoffs/C/vn-descent/check.mjs <url> <out-dir> [width] [height]
import { execFileSync } from 'node:child_process';
const [url, out, w = '393', h = '760'] = process.argv.slice(2);
const session = 'deep-press-vn';
const run = (...args) => {
  const r = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { encoding: 'utf8', timeout: 90000, maxBuffer: 64 * 1024 * 1024 }));
  if (!r.success) throw new Error(JSON.stringify(r.error)); return r.data;
};
const js = (code) => run('eval', `(async () => { const q=(s)=>document.querySelector(s); const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); ${code} })()`).result;
const shot = (name) => run('screenshot', `${out}/${name}.png`);
try {
  run('set', 'viewport', w, h);
  run('open', url); run('wait', '--load', 'networkidle');
  console.log('ready', js(`for (let i=0;i<100 && q('canvas').dataset.renderState!=='ready';i++) await wait(200); return q('canvas').dataset.renderState;`));
  shot('01-title');
  js(`q('[data-action=story-open]').click(); await wait(700); return 1`); shot('02-narration-typing');
  js(`await wait(1600); return 1`); shot('03-narration-done');
  const lines = js(`const seen=[]; for (let i=0;i<3;i++) { q('.vn').click(); await wait(60); q('.vn').click(); await wait(80); seen.push(q('.vn-line').textContent); } return seen;`);
  console.log(lines);
  js(`await wait(2600); return 1`); shot('04-yunseo');
  js(`q('.vn').click(); await wait(80); q('.vn').click(); await wait(900); return 1`); shot('05-dohyeon');
  const tr = js(`q('[data-action=story-skip]').click(); await wait(1200); const v=q('#transition video'); return { hidden: q('#transition').hidden, t: v.currentTime, err: v.error && v.error.code, ready: v.readyState, hud: getComputedStyle(q('.screen')).visibility, lot: q('#swap').textContent };`);
  console.log('transition', tr);
  shot('06-video-1s');
  js(`await wait(3400); return 1`); shot('07-video-4.6s');
  const after = js(`for (let i=0;i<50 && !q('#transition').hidden;i++) await wait(200); await wait(800); return { hidden: q('#transition').hidden, hud: getComputedStyle(q('.screen')).visibility, facts: q('#result-value').textContent, cue: q('#comms-line').textContent };`);
  console.log('after', after);
  shot('08-game');
  const box = js(`const r=q('#hold').getBoundingClientRect(); return [Math.round(r.x+r.width/2), Math.round(r.y+r.height/2)];`);
  run('mouse', 'move', String(box[0]), String(box[1])); run('mouse', 'down');
  const mid = js(`await wait(250); return { facts: q('#result-value').textContent, cue: q('#comms-line').textContent, lot: q('#swap').textContent };`);
  shot('08b-pressing');
  run('mouse', 'up');
  const played = js(`await wait(1000); const before={facts:q('#result-value').textContent, cue:q('#comms-line').textContent}; q('#store').click(); await wait(1200); const next=q('#swap').textContent; q('#swap').click(); await wait(300); const swapped=q('#swap').textContent;
    q('#pause').click(); await wait(300); q('[data-action=finish]').click(); await wait(900); before.next=next; before.swapped=swapped; return { before, overlay: q('#overlay').className, line: q('.vn-line')?.textContent };`);
  console.log('played', mid, played);
  js(`await wait(1500); return 1`); shot('09-outro');
  const res = js(`q('[data-action=story-skip]').click(); await wait(500); return { overlay: q('#overlay').className, score: q('#result-score')?.textContent, items: q('#dialog-items')?.innerText, record: q('#dialog-record')?.textContent };`);
  console.log('result', res);
  shot('10-result');
  console.log('errors', run('errors'));
} finally { run('close'); }
