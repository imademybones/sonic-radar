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

## Product direction — status as of 2026-08-04

Staying **ambient-only deliberately** for now, focused on building out
catalogue depth before expanding genres. Pivoted from a personal
curated tool to a **public, collaborative** one: anyone can add a
release or heart it, no login. Editing/deleting requires a shared
curator passphrase (Stephen's). See CLAUDE.md "Collaborative write
model" for the full reasoning and its limits.

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
| Source | `fldv1Xrw5cUUeNwmQ` | singleSelect (`curated`, `community`; `manual` is a retired unused choice, harmless leftover) |
| Hearts | `fldczCJJrTRXm9y1F` | number (aggregate, open to anyone) |
| Spotify URL | `fldG1PirapSvv99IM` | url (contributor-pasted, see CLAUDE.md) |
| Added By | `fldxNMr7EyxvPgYYb` | singleLineText (optional, free-text, unverified) |
| Added At | `fldcZU3qgMsaqlef6` | number (epoch ms) |
| Updated At | `fldbujz7v3zw0wLh4` | number (epoch ms) |

**Retired fields (still exist in Airtable, unused by the app since the
2026-08-04 collaborative pivot):** `Listened` (`fldMUHtqGyHUFZR6F`),
`Rating` (`fldihZkQuykPMSqAr`) — personal-log fields that didn't have a
coherent meaning once anyone could visit and toggle them. Left in place
rather than deleted in case a personal-only view is wanted later; do not
wire new UI to them without deciding what "personal" means for a
multi-visitor site first.

Seed data: the 30 releases from `ambient-radar-v3.html`'s `seedAlbums`
were migrated in on 2026-08-04 via `scripts/migrate-seed.mjs` (run
through direct Airtable access at the time, not the token-based path —
see the script's own comments for the token-based flow for future
reruns). All 30 were descriptor-tagged the same day (Texture/Tone/
Character/Density/Motion) so Similar Releases has real matches from the
start. Spotify URLs are being backfilled separately — check a given
release's `Spotify URL` field before assuming it's empty.

## Cloudflare Worker

Deployed at `https://sonic-radar-worker.stephen-nolan85.workers.dev`.
Source committed at `worker/sonic-radar-worker.js` (unlike music-tracker's
Worker, which only exists as pasted-in Cloudflare dashboard code — see
CLAUDE.md for why this one is versioned instead), deployed via
`wrangler deploy` from `worker/`.

Env vars / secrets (see `worker/wrangler.toml`):
- `BASE_ID` = `appDPw0HGOMswBZfR`
- `TABLE_NAME` = `Releases`
- `ALLOWED_ORIGIN` = `https://imademybones.github.io`
- `AIRTABLE_TOKEN` (secret, set via `wrangler secret put AIRTABLE_TOKEN`
  — never committed)
- `CURATOR_PASSPHRASE` (secret, set via
  `wrangler secret put CURATOR_PASSPHRASE` — gates edit/delete only, see
  CLAUDE.md "Collaborative write model")

Routes:
- `GET /health`, `GET /releases` — open
- `POST /releases` — open (anyone can add a release)
- `POST /releases/:id/heart` — open (aggregate engagement counter)
- `GET /verify-curator` — open, just echoes whether the passed
  `X-Curator-Passphrase` header is correct (no Airtable call)
- `PATCH /releases/:id`, `DELETE /releases/:id` — require a correct
  `X-Curator-Passphrase` header

No Spotify Web API proxy, no AI-discovery route — both deliberately out
of scope, see CLAUDE.md.

**Public app, no Cloudflare Access gate.** Reads and the open write
routes above are intentionally ungated. Edit/delete are gated by a
single shared passphrase, not real per-user auth — see CLAUDE.md for
exactly what that does and doesn't protect against.
