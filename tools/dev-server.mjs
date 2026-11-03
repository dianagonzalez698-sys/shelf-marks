// Tiny static server for local preview. Sends no-store so an edit is always
// what you see on reload — the app itself needs no server beyond plain static
// hosting (that's the point of GitHub Pages).
//
//   node tools/dev-server.mjs [port]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';

    // Keep requests inside the project directory.
    const resolved = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!resolved.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(resolved);
    const file = info.isDirectory()
      ? await readFile(join(resolved, 'index.html'))
      : await readFile(resolved);

    res.writeHead(200, {
      'Content-Type': TYPES[extname(resolved)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(file);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Shelf Marks dev server: http://localhost:${PORT}`);
});
