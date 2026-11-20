import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectLocalReview } from './build_site.mjs';

const host = '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};
const headers = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

export async function startLocalReview({ port = 8000, staging } = {}) {
  const files = await collectLocalReview({ staging });
  const server = createServer((request, response) => {
    if (request.headers.host !== `${host}:${server.address().port}`) {
      response.writeHead(403, headers).end();
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
      return;
    }
    const path = request.url.split('?')[0];
    const name = path === '/' ? 'index.html' : path.slice(1);
    if (!path.startsWith('/') || !files.has(name)) {
      response.writeHead(404, headers).end();
      return;
    }
    const content = files.get(name);
    response.writeHead(200, {
      ...headers, 'Content-Type': mime[extname(name)], 'Content-Length': Buffer.byteLength(content),
    }).end(request.method === 'GET' ? content : undefined);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let port = 8000;
    let staging;
    const args = process.argv.slice(2);
    while (args.length) {
      const option = args.shift();
      if (option === '--catalog') staging = resolve(import.meta.dirname, '../.experiment-import/catalog');
      else if (option === '--port' && /^\d{1,5}$/.test(args[0] ?? '') && Number(args[0]) <= 65535) port = Number(args.shift());
      else throw new Error('Uso: node scripts/preview_site.mjs [--port 8000] [--catalog]');
    }
    const server = await startLocalReview({ port, staging });
    process.stdout.write(`Revisão científica privada em http://${host}:${server.address().port}/ (Ctrl+C para sair)\n`);
  } catch (error) {
    process.stderr.write(`Revisão local indisponível: ${error.message}\n`);
    process.exitCode = 1;
  }
}
