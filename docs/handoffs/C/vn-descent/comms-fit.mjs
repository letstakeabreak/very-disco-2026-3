// Lays every bench line into the two-line message window and reports any that need a third row.
// Usage: node docs/handoffs/C/vn-descent/comms-fit.mjs <url> <lines.txt: one line per row>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [url, linesFile] = process.argv.slice(2);
const lines = readFileSync(linesFile, 'utf8').trim().split('\n');
const run = (...args) => { const r = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', 'fit', '--json', ...args], { encoding: 'utf8', timeout: 90000, maxBuffer: 1 << 26 })); if (!r.success) throw new Error(JSON.stringify(r.error)); return r.data; };
try {
  for (const [w, h] of [[402, 714], [375, 600], [320, 568], [1280, 800]]) {
    run('set', 'viewport', String(w), String(h)); run('open', url); run('wait', '--load', 'networkidle');
    const r = run('eval', `(async () => { const q=(s)=>document.querySelector(s); const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
      for (let i=0;i<100 && q('canvas').dataset.renderState!=='ready';i++) await wait(200);
      q('[data-action=story-open]').click(); await wait(200); q('[data-action=story-skip]').click(); await wait(300); q('#transition').click(); await wait(1500);
      const DEP = new Set(['것','게','거','수','건','줄','데','때','뿐','채','듯','척']); const strip = (w) => w.replace(/[.?!]+$/u, '');
      const bind = (s) => { const ws = s.split(' '); return ws.reduce((o, w, i) => i === 0 ? w : o + ((i === ws.length - 1 || ([...strip(w)].length === 1 && DEP.has(strip(w))) || ([...strip(ws[i-1])].length === 1 && !DEP.has(strip(ws[i-1])))) ? '\\u00A0' : ' ') + w, ''); };
      const box = q('#comms'); const text = q('#comms-text'); const base = box.getBoundingClientRect().height; const out = [];
      for (const line of ${JSON.stringify(lines)}) {
        text.dataset.line = '__probe__';
        text.replaceChildren(...[...line.matchAll(/.+?(?:[.?!](?=\\s|$)|$)\\s*/gu)].map(m => m[0].trimEnd()).filter(Boolean).flatMap((s, i) => { const p = document.createElement('span'); p.className = 'phrase'; p.textContent = bind(s); return i ? [' ', p] : [p]; }));
        const rows = new Set([...text.querySelectorAll('.phrase')].flatMap(p => [...p.getClientRects()].map(r => Math.round(r.top)))).size;
        const lh = parseFloat(getComputedStyle(box).lineHeight); const rowCount = Math.round(text.getBoundingClientRect().height / lh);
        out.push([rowCount, Math.round(box.getBoundingClientRect().height) - Math.round(base), line]);
      }
      return { base: Math.round(base), out }; })()`).result;
    console.log(`== ${w}x${h} base box ${r.base}px`);
    for (const [rows, grow, line] of r.out) if (rows > 2 || grow > 0) console.log(`  ${rows} rows (+${grow}px): ${line}`);
  }
} finally { run('close'); }
