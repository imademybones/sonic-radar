// Cloudflare Worker — Airtable CRUD passthrough for Sonic Radar.
// No Spotify proxy, no AI-discovery route (deliberately dropped — see
// the repo's CLAUDE.md). The Airtable token never reaches the client;
// it lives only as the AIRTABLE_TOKEN secret here.
//
// Public app, no Cloudflare Access gate: the Origin check below is the
// only barrier to a scripted (non-browser) client writing/deleting
// records directly — acceptable for a personal curated site, but worth
// knowing. See project-reference.md.

const AIRTABLE_API = 'https://api.airtable.com/v0';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function passthrough(status, body, headers) {
  return new Response(body, { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function airtableRequest(env, path, options = {}) {
  const table = encodeURIComponent(env.TABLE_NAME || 'Releases');
  const url = `${AIRTABLE_API}/${env.BASE_ID}/${table}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(env);

    // Answered unconditionally, before any other logic — mirrors the
    // approach documented in music-tracker's project-reference.md.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/health') {
      return passthrough(200, JSON.stringify({ ok: true }), headers);
    }

    if (url.pathname === '/releases') {
      if (request.method === 'GET') {
        const offset = url.searchParams.get('offset');
        const path = offset ? `?offset=${encodeURIComponent(offset)}` : '';
        const res = await airtableRequest(env, path);
        return passthrough(res.status, await res.text(), headers);
      }
      if (request.method === 'POST') {
        const res = await airtableRequest(env, '', { method: 'POST', body: await request.text() });
        return passthrough(res.status, await res.text(), headers);
      }
      return new Response('Method not allowed', { status: 405, headers });
    }

    const recordMatch = url.pathname.match(/^\/releases\/([A-Za-z0-9]+)$/);
    if (recordMatch) {
      const id = recordMatch[1];
      if (request.method === 'PATCH') {
        const res = await airtableRequest(env, `/${id}`, { method: 'PATCH', body: await request.text() });
        return passthrough(res.status, await res.text(), headers);
      }
      if (request.method === 'DELETE') {
        const res = await airtableRequest(env, `/${id}`, { method: 'DELETE' });
        return passthrough(res.status, await res.text(), headers);
      }
      return new Response('Method not allowed', { status: 405, headers });
    }

    return new Response('Not found', { status: 404, headers });
  },
};
