import { createRoomStore, RoomError } from './rooms.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

function reply(response, status, body) { response.writeHead(status, JSON_HEADERS).end(JSON.stringify(body)); }

async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new RoomError(415, 'Send JSON data.');
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 2048) throw new RoomError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RoomError(400, 'Invalid JSON data.'); }
}

export function createApi() {
  const rooms = createRoomStore();
  const limits = new Map();

  function rateLimit(request, kind) {
    const now = Date.now();
    for (const [key, bucket] of limits) if (bucket.until <= now) limits.delete(key);
    // Do not trust forwarded IP headers supplied by arbitrary clients.
    const key = `${request.socket.remoteAddress}:${kind}`;
    let bucket = limits.get(key);
    if (!bucket) {
      if (limits.size >= 5000) throw new RoomError(503, 'Server is busy. Please try again shortly.');
      bucket = { count: 0, until: now + 60000 };
      limits.set(key, bucket);
    }
    if (++bucket.count > (kind === 'create' ? 20 : 240)) {
      throw new RoomError(429, 'Too many requests. Wait a minute and try again.');
    }
  }

  return async (request, response, pathname) => {
    try {
      if (request.method === 'GET' && pathname === '/api/health') return reply(response, 200, { status: 'ok', version: '1.1.0' });
      const route = pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|actions))?$/);
      const creates = pathname === '/api/rooms';
      if (!route && !creates) throw new RoomError(404, 'Unknown endpoint.');
      const method = creates || route?.[2] ? 'POST' : 'GET';
      if (request.method !== method) {
        response.setHeader('Allow', method);
        throw new RoomError(405, 'Method not allowed.');
      }
      // Browser requests stay on the game's origin; room tokens never go in URLs.
      if (request.headers.origin) {
        let origin;
        try { origin = new URL(request.headers.origin); } catch { throw new RoomError(403, 'Invalid origin.'); }
        if (origin.host !== request.headers.host || !['http:', 'https:'].includes(origin.protocol)) {
          throw new RoomError(403, 'Open the game and its room on the same website.');
        }
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') throw new RoomError(403, 'Cross-site requests are not allowed.');
      if (request.method === 'POST') rateLimit(request, creates ? 'create' : 'action');
      const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] || '';
      if (creates) {
        const body = await readBody(request);
        return reply(response, 201, rooms.create(body.name, body.entryKey));
      }
      const [, code, operation] = route;
      if (operation === 'join') {
        const body = await readBody(request);
        return reply(response, 200, rooms.join(code, body.name, body.entryKey));
      }
      if (operation === 'actions') return reply(response, 200, rooms.act(code, token, await readBody(request)));
      return reply(response, 200, rooms.read(code, token));
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        reply(response, error instanceof RoomError ? error.status : 500,
          { error: error instanceof RoomError ? error.message : 'The server could not complete that request.' });
      }
    }
  };
}
