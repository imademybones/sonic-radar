# Sonic Radar — project reference

Quick lookup for IDs and endpoints. Update this whenever a table/field is
added, renamed, or the Worker is redeployed elsewhere. Mirrors the format
of music-tracker's `tracker-project-reference.md`.

## Naming & domain handoff — status: not yet done

This app is the one that eventually becomes **Found Frequency** at
**foundfrequency.com** (the domain currently used by `music-tracker`,
which gets renamed to **Spun** and drops back to a GitHub Pages default
URL). This is a deliberate, deferred cutover — do not do it until this
app is fully built and verified. See the plan this was built from
(`nifty-watching-newell` plan, "Naming & domain handoff") for the exact
steps: branding text + `<title>` + `CNAME` + Worker `ALLOWED_ORIGIN` swap
in both repos, plus the account-level DNS/Cloudflare reassignment.

## Airtable

Base: **Sonic Radar** — `appDPw0HGOMswBZfR` (workspace: Music Tracker,
`wspotGbgO9MPot606` — co-located with the sibling music-cataloging bases;
no dedicated workspace exists for this app specifically, the Airtable API
used to create it doesn't support creating new workspaces).

### Releases — `tblGbS5I6WtgpMtGU`

Fields (name → id):

| Field | ID | Type |
|---|---|---|
| Artist | `fldUJ5J9ILuEdNBOq` | singleLineText (primary) |
| Title | `fldWROCiNkYUMGPhj` | singleLineText |
| Label | `fldvlVzKK8gX4PJTA` | singleLineText |
| Release Date | `fldFHnho6rGkfSeqc` | date (ISO) |
| Genre | `fldzCScZDb7yWXFP9` | multipleSelects |
| Descriptor: Texture | `fldWtmzyRetfowEnm` | multipleSelects |
| Descriptor: Tone | `fldIUhF98Wx0QQubi` | multipleSelects |
| Descriptor: Character | `fld8caeVyV0lCULl0` | multipleSelects |
| Descriptor: Density | `fldHpS1y2yzNjl8MV` | number (1–5) |
| Descriptor: Motion | `fldEAh8s9bHItn9f5` | number (1–5) |
| Notes | `fldJioam2VVxBV0ih` | multilineText |
| Source | `fldv1Xrw5cUUeNwmQ` | singleSelect (`curated`, `manual`) |
| Listened | `fldMUHtqGyHUFZR6F` | checkbox |
| Rating | `fldihZkQuykPMSqAr` | number (0–5) |
| Added At | `fldcZU3qgMsaqlef6` | number (epoch ms) |
| Updated At | `fldbujz7v3zw0wLh4` | number (epoch ms) |

Seed data: the 30 releases from `ambient-radar-v3.html`'s `seedAlbums`
were migrated in on 2026-08-04 via `scripts/migrate-seed.mjs` (run
through direct Airtable access at the time, not the token-based path —
see the script's own comments for the token-based flow for future
reruns). Descriptor fields (Texture/Tone/Character/Density/Motion) were
left blank on import — see CLAUDE.md "Descriptor tagging pass" for why
that's a deliberately separate, reviewed step.

## Cloudflare Worker

**Status: not yet deployed.** Source is committed at
`worker/sonic-radar-worker.js` (unlike music-tracker's Worker, which only
exists as pasted-in Cloudflare dashboard code — see the plan for why this
one is versioned instead).

Once deployed, update:
- `WORKER_URL` in `index.html` (currently a placeholder)
- `ALLOWED_ORIGIN` in `worker/wrangler.toml` if it differs from the
  GitHub Pages default assumed there

Env vars / secrets (see `worker/wrangler.toml`):
- `BASE_ID` = `appDPw0HGOMswBZfR`
- `TABLE_NAME` = `Releases`
- `ALLOWED_ORIGIN` — the deployed app's real origin
- `AIRTABLE_TOKEN` (secret, set via `wrangler secret put AIRTABLE_TOKEN`
  — never committed)

Routes: `GET /health`, `GET /releases`, `POST /releases`,
`PATCH /releases/:id`, `DELETE /releases/:id`. No Spotify proxy, no
AI-discovery route — both deliberately out of scope, see CLAUDE.md.

**Public app, no Cloudflare Access gate.** The Origin check is the only
barrier to a scripted client writing/deleting records directly — accepted
trade-off for a personal curated site, see CLAUDE.md.
