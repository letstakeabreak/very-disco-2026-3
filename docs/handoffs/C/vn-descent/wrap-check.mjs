// Types each intro line and reports characters that change line while typing, plus the final rows.
// Usage: node docs/handoffs/C/vn-descent/wrap-check.mjs <url> <out-dir> [width] [height]
import { execFileSync } from 'node:child_process';
const [url, out, w = '402', h = '714'] = process.argv.slice(2);
const run = (...args) => { const r = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', 'wrap', '--json', ...args], { encoding: 'utf8', timeout: 90000, maxBuffer: 1 << 26 })); if (!r.success) throw new Error(JSON.stringify(r.error)); return r.data; };
const js = (code) => run('eval', `(async () => { const q=(s)=>document.querySelector(s); const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); ${code} })()`).result;
// Record each visible word's line (top) while it types and after; a word that changes line mid-typing is a reflow.
const probe = `const tops = (el) => { const r = document.createRange(); const out = new Map(); for (const phrase of el.querySelectorAll('.phrase')) { const node = phrase.firstElementChild.firstChild; if (!node) continue; for (let i = 0; i < node.data.length; i++) { if (/\\s/.test(node.data[i])) continue; r.setStart(node, i); r.setEnd(node, i + 1); out.set(Number(phrase.dataset.start) + i, Math.round(r.getBoundingClientRect().top)); } } return out; };
  const rows = (el) => { const r = document.createRange(); const words = []; for (const phrase of el.querySelectorAll('.phrase')) { const text = phrase.dataset.text; const node = phrase.firstElementChild.firstChild; if (!node) continue; const re = /[^ \\u00A0]+/g; let m; while ((m = re.exec(text))) { r.setStart(node, m.index); r.setEnd(node, m.index + 1); words.push([m[0], Math.round(r.getBoundingClientRect().top)]); } } return [...new Set(words.map(w => w[1]))].map(t => words.filter(w => w[1] === t).map(w => w[0]).join(' ')); };`;
try {
  run('set', 'viewport', w, h); run('open', url); run('wait', '--load', 'networkidle');
  const r = js(`${probe} for (let i=0;i<100 && q('canvas').dataset.renderState!=='ready';i++) await wait(200);
    q('[data-action=story-open]').click(); const report = [];
    for (let line = 0; line < 9; line++) {
      const seen = new Map(); let jumps = 0;
      for (let t = 0; t < 80; t++) { await wait(30);
        for (const [index, top] of tops(q('.vn-text'))) { if (seen.has(index) && seen.get(index) !== top) jumps++; seen.set(index, top); }
        if (!q('.vn').classList.contains('typing')) break; }
      report.push({ line, jumps, rows: rows(q('.vn-text')) });
      q('.vn').click(); await wait(80);
    }
    return report;`);
  for (const item of r) console.log(item.line, 'jumps', item.jumps, '|', item.rows.join('  /  '));
  run('screenshot', `${out}/wrap-${w}.png`);
} finally { run('close'); }
