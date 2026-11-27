import { parse } from 'node:querystring';
import draw from '../api/draw.js';
import subscribe from '../api/subscribe.js';
import unsubscribe from '../api/unsubscribe.js';
import sendDailyOracle from '../api/send-daily-oracle.js';

const routes = new Map([
  ['/api/draw', draw],
  ['/api/subscribe', subscribe],
  ['/api/unsubscribe', unsubscribe],
  ['/api/send-daily-oracle', sendDailyOracle],
]);

function adaptResponse() {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  let status = 200;

  return {
    status(code) {
      status = code;
      return this;
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
    json(value) {
      return Response.json(value, { status, headers });
    },
    send(value) {
      return new Response(value, { status, headers });
    },
  };
}

async function parseBody(request) {
  if (!request.body) return;

  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type === 'application/json') return request.json();
  if (type === 'application/x-www-form-urlencoded') return parse(await request.text());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const handler = routes.get(url.pathname.replace(/\/$/, ''));
    if (!handler) return env.ASSETS.fetch(request);

    const response = adaptResponse();
    let body;
    if (handler === subscribe && request.method === 'POST') {
      try {
        body = await parseBody(request);
      } catch {
        return response.status(400).json({ error: 'Corps JSON invalide.' });
      }
    }

    return handler({
      method: request.method,
      headers: { ...Object.fromEntries(request.headers), host: url.host },
      query: parse(url.search.slice(1)),
      body,
    }, response);
  },
};
