// Local-network-only static fixture server. The control endpoint accepts loopback requests only.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
const directory = '/tmp/deep-press-b-device-qa';
const output = '/tmp/deep-press-b-device-results';
mkdirSync(output, { recursive: true });
const run = randomUUID();
let command = { id: 0, action: 'setState', controls: {} };
let report = null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
  const send = (code, value) => { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  try {
    if (url.pathname.startsWith('/qa/')) {
      if (!loopback && url.searchParams.get('run') !== run) { send(403, 'Wrong run'); return; }
      if (request.method === 'GET' && url.pathname === '/qa/command') { send(200, command); return; }
      if (request.method === 'GET' && url.pathname === '/qa/status' && loopback) { send(200, report); return; }
      if (request.method === 'POST') {
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 2000000) throw new Error('Report too large'); }
        const value = JSON.parse(body);
        if (url.pathname === '/qa/command' && loopback && ['setState', 'soak'].includes(value.action)) {
          command = { ...value, id: command.id + 1 }; send(200, command); return;
        }
        if (url.pathname === '/qa/report') {
          report = { receivedAt: new Date().toISOString(), requestUserAgent: request.headers['user-agent'], ...value };
          writeFileSync(output + '/latest.json', JSON.stringify(report, null, 2) + '\n');
          if (report.result) writeFileSync(output + `/soak-${report.result.startedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(report, null, 2) + '\n');
          send(200, { received: true }); return;
        }
      }
      send(404, 'Unknown QA endpoint'); return;
    }
    const path = resolve(directory, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(directory + sep) || !statSync(path).isFile()) { send(404, 'Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(path).pipe(response);
  } catch (error) { send(400, String(error)); }
});
writeFileSync(output + '/qa-build.json', readFileSync(directory + '/qa-build.json'));
writeFileSync(output + '/session.json', JSON.stringify({ run, path: `/docs/handoffs/B/preview.html?run=${run}` }));
server.listen(4175, '::', () => console.log(`Local device QA on port 4175 (LAN or paired-device IPv6 tunnel): /docs/handoffs/B/preview.html?run=${run}`));
