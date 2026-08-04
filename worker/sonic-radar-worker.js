// Cloudflare Worker — Airtable CRUD passthrough for Sonic Radar.
// No Spotify search proxy, no AI-discovery route (deliberately dropped —
// see CLAUDE.md). The Airtable token never reaches the client; it lives
// only as the AIRTABLE_TOKEN secret here.
//
// Public, collaborative app: anyone can add a release or heart one
// (POST /releases, POST /releases/:id/heart — no gate). Editing or
// deleting an existing release (PATCH/DELETE /releases/:id) requires the
// X-Curator-Passphrase header to match the CURATOR_PASSPHRASE secret —
// see CLAUDE.md "Collaborative write model" for why the split sits there
// (open contribution, curator-protected removal/editing) and
// project-reference.md for the caveat that this is a shared static
// passphrase, not per-user auth.

const AIRTABLE_API = 'https://api.airtable.com/v0';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Curator-Passphrase',
  };
}

function passthrough(status, body, headers) {
  return new Response(body, { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function isCurator(request, env) {
  const provided = request.headers.get('X-Curator-Passphrase') || '';
  return !!env.CURATOR_PASSPHRASE && provided === env.CURATOR_PASSPHRASE;
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

    // Answered unconditionally, before any other logic.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/health') {
      return passthrough(200, JSON.stringify({ ok: true }), headers);
    }

    // Lets the client confirm a passphrase immediately (for unlock UX)
    // without needing to attempt a real mutation to find out.
    if (url.pathname === '/verify-curator') {
      const ok = isCurator(request, env);
      return passthrough(ok ? 200 : 403, JSON.stringify({ ok }), headers);
    }

    if (url.pathname === '/releases') {
      if (request.method === 'GET') {
        const offset = url.searchParams.get('offset');
        const path = offset ? `?offset=${encodeURIComponent(offset)}` : '';
        const res = await airtableRequest(env, path);
        return passthrough(res.status, await res.text(), headers);
      }
      if (request.method === 'POST') {
        // Open — anyone can contribute a release. typecast lets a
        // contributor's Source:"community" value auto-create that
        // singleSelect choice the first time it's ever sent.
        const res = await airtableRequest(env, '', { method: 'POST', body: await request.text() });
        return passthrough(res.status, await res.text(), headers);
      }
      return new Response('Method not allowed', { status: 405, headers });
    }

    const heartMatch = url.pathname.match(/^\/releases\/([A-Za-z0-9]+)\/heart$/);
    if (heartMatch && request.method === 'POST') {
      // Open — the whole point is a low-friction collaborative signal.
      // Read-then-write is good enough at this app's scale; a lost
      // increment under a rare simultaneous double-click is an
      // acceptable trade-off for not needing a transactional counter.
      const id = heartMatch[1];
      const getRes = await airtableRequest(env, `/${id}`);
      if (!getRes.ok) return passthrough(getRes.status, await getRes.text(), headers);
      const record = await getRes.json();
      const current = record.fields?.['Hearts'] || 0;
      const patchRes = await airtableRequest(env, `/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { 'Hearts': current + 1 } }),
      });
      return passthrough(patchRes.status, await patchRes.text(), headers);
    }

    const recordMatch = url.pathname.match(/^\/releases\/([A-Za-z0-9]+)$/);
    if (recordMatch) {
      const id = recordMatch[1];
      if (request.method === 'PATCH') {
        if (!isCurator(request, env)) {
          return passthrough(403, JSON.stringify({ error: 'Curator passphrase required to edit a release.' }), headers);
        }
        const res = await airtableRequest(env, `/${id}`, { method: 'PATCH', body: await request.text() });
        return passthrough(res.status, await res.text(), headers);
      }
      if (request.method === 'DELETE') {
        if (!isCurator(request, env)) {
          return passthrough(403, JSON.stringify({ error: 'Curator passphrase required to delete a release.' }), headers);
        }
        const res = await airtableRequest(env, `/${id}`, { method: 'DELETE' });
        return passthrough(res.status, await res.text(), headers);
      }
      return new Response('Method not allowed', { status: 405, headers });
    }

    return new Response('Not found', { status: 404, headers });
  },
};
