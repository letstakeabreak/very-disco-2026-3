// Usage: node docs/handoffs/C/v4-review/slow-server.mjs <dist-dir> [delay-ms]  (serves on 127.0.0.1:8777)
// Serves dist/ with a delay on 3D models, to see the loading state a phone on mobile data would see.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const root = process.argv[2]; const delay = Number(process.argv[3] ?? 3000);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.otf': 'font/otf', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain' };
createServer(async (req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const path = requested.endsWith('/') ? requested + 'index.html' : requested;
  try {
    const body = await readFile(join(root, path));
    if (path.endsWith('.glb') || path.endsWith('.otf')) await new Promise((r) => setTimeout(r, delay));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(8777, '127.0.0.1');
