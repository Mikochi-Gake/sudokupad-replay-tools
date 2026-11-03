#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { basename } from 'node:path';
import { parseReplayText } from './core.js';
import { asReplayError, ReplayError } from './errors.js';
import { LIMITS } from './limits.js';
import { buildReview } from './review.js';
import { UI_CSS, UI_HTML, UI_JS } from './ui-assets.js';

const host = '127.0.0.1';

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > LIMITS.maxFileBytes) {
    throw new ReplayError('FILE_TOO_LARGE', 'Replay file exceeds the configured size limit.', { bytes: declared, maxBytes: LIMITS.maxFileBytes });
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > LIMITS.maxFileBytes) {
      throw new ReplayError('FILE_TOO_LARGE', 'Replay file exceeds the configured size limit.', { bytes, maxBytes: LIMITS.maxFileBytes });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function openBrowser(url: string): void {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}

const server = createServer(async (request, response) => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
  if (request.method === 'GET' && requestUrl.pathname === '/') return send(response, 200, 'text/html', UI_HTML);
  if (request.method === 'GET' && requestUrl.pathname === '/app.css') return send(response, 200, 'text/css', UI_CSS);
  if (request.method === 'GET' && requestUrl.pathname === '/app.js') return send(response, 200, 'text/javascript', UI_JS);
  if (request.method === 'POST' && requestUrl.pathname === '/api/analyze') {
    const expectedOrigin = `http://${host}:${port}`;
    if (request.headers.origin && request.headers.origin !== expectedOrigin) {
      return send(response, 403, 'application/json', JSON.stringify({ error: { code: 'INVALID_CONTAINER', message: 'Cross-origin requests are not allowed.' } }));
    }
    try {
      const sourceName = basename(requestUrl.searchParams.get('name') || 'replay.replay');
      const analysis = parseReplayText(await readBody(request));
      return send(response, 200, 'application/json', JSON.stringify(buildReview(analysis, false, sourceName)));
    } catch (error) {
      const replayError = asReplayError(error);
      return send(response, 400, 'application/json', JSON.stringify({ error: replayError.toJSON() }));
    }
  }
  return send(response, 404, 'text/plain', 'Not found');
});

server.listen(0, host, () => {
  const address = server.address();
  if (typeof address !== 'object' || address === null) return;
  const url = `http://${host}:${address.port}`;
  process.stdout.write(`Sudoku Replay Desk is ready: ${url}\nClose this window to stop it.\n`);
  if (!process.argv.includes('--no-open')) openBrowser(url);
});

server.on('error', error => {
  process.stderr.write(`Could not start Sudoku Replay Desk: ${error.message}\n`);
  process.exitCode = 1;
});
