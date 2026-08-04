# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

A curated tracker and discovery tool for studio LP releases, starting
with ambient/drone-adjacent music and meant to expand to other genres
over time. `index.html` (markup + `<script type="module">`) plus
`styles.css`, with pure helper/scoring logic factored out to `lib/pure.js`.
No build step, no package manager, no framework — served as a static
file (GitHub Pages) directly from `index.html`.

It evolved from a single-file prototype (`ambient-radar-v3.html`,
30 seed releases, localStorage-only) into a real app backed by Airtable
via a Cloudflare Worker. It is **not** a component of the sibling project
`music-tracker` — separate repo, separate Airtable base, separate Worker.
It is, however, the app that eventually takes over the "Found Frequency"
name and foundfrequency.com domain — see project-reference.md
"Naming & domain handoff" before touching branding, `<title>`, or `CNAME`.

## Development

`lib/pure.js` has a `node:test` suite (`lib/pure.test.js`) covering date
parsing, Airtable field mapping, and the similarity-scoring functions —
run via `node --test lib/pure.test.js`. A GitHub Actions workflow
(`.github/workflows/test.yml`) runs it on every push/PR to `main`,
mirroring music-tracker's non-blocking setup.

- Open `index.html` directly in a browser, or serve it locally
  (`python3 -m http.server` from the repo root) — no build step either way.
- `index.html` needs a live Worker to load/save real data — see
  project-reference.md for the current `WORKER_URL` and deploy status.
  Without one, the app still renders its shell and fails gracefully
  (a status message, not a crash) — useful for pure UI iteration.
- Verify changes by exercising the UI in a browser (filter, search, add,
  listen/rate, delete, open a release's Similar Releases modal) — no UI
  test automation, only the pure-function suite above.

## Architecture

**No frontend framework**, same philosophy as music-tracker: module-level
state (`releases`, `activeFilter`, `openModalId`, etc.), `innerHTML`
template-literal rendering into slot elements (`#albumGrid`,
`#filterPills`, `#modalSlot`). Every mutation is followed by an explicit
`render()` call — there's no reactivity.

**Event handling is delegated, not inline.** Unlike music-tracker (which
uses inline `onclick="..."` + an explicit `Object.assign(window, {...})`
allow-list to work around ES-module scoping — an easy-to-forget footgun),
this app uses a single `document.addEventListener('click', ...)` keyed
off `data-action`/`data-id` attributes on rendered markup. Adding a new
interactive element just needs a `data-action` value and a `case` in that
one switch — no allow-list to maintain.

**Data persistence is remote, via a Cloudflare Worker proxy — and the
Worker's source lives in this repo** (`worker/sonic-radar-worker.js`),
deployed with `wrangler deploy`. This is a deliberate departure from
music-tracker/library-tracker, whose Workers exist only as pasted-in
Cloudflare dashboard code with no local copy — versioning the source here
trades a little deploy convenience for it being reviewable and not
tribal knowledge. The Worker proxies Airtable CRUD only — no Spotify
proxy, no AI-discovery route (see below).

**No Cloudflare Access gate — this app is intentionally public.** The
Worker's only protection on writes is an Origin check, which is
spoofable outside a browser (same caveat music-tracker documents for
itself). The Airtable token never leaves the Worker either way. If this
ever needs to be private, bolting on Access later is a contained change —
see music-tracker's own setup for the recipe.

**The "Refresh with AI" release-discovery feature from the prototype was
deliberately dropped, not ported.** It called the Anthropic API directly
from the browser with no key and never actually worked. Release discovery
now happens conversationally (e.g. in a Claude Code session) and
confirmed finds get added through the normal manual-add path. Do not
re-add a live AI-search route without discussing the tradeoffs (API cost,
key handling) first.

**Data model.** A `release` object (`recordToRelease`/`releaseToFields`
in `lib/pure.js`) has: `id`, `artist`, `title`, `releaseDate` (ISO
`YYYY-MM-DD`), `label`, `genre` (array of full display strings like
`"Drone / Textural"`, not short codes), `texture`/`tone`/`character`
(descriptor tag arrays), `density`/`motion` (1–5 or `null`), `notes`,
`source` (`curated` | `manual`), `listened`, `rating` (0–5), `addedAt`,
`updatedAt`. These map 1:1 to Airtable field names — see
project-reference.md for the actual field IDs.

**Genre is data-driven, not hardcoded.** The filter pill row is built
from the distinct `Genre` values present in loaded data (plus fixed
`All`/`My Picks`/`Heard` pills), not a static list — so adding a new
genre later (the whole point of eventually expanding past ambient) is an
Airtable-choices change, not a code change. The manual-add form's genre
checkboxes are still a fixed list matching the current Airtable choices
(`index.html`, `#genreChecks`) — update that list by hand when a new
genre choice is added to Airtable.

**"Sonic similarity" is structured, not just genre overlap.** The whole
point of this app over a plain release tracker: `lib/pure.js` computes a
weighted score per release pair from descriptor-tag overlap (Texture,
Tone, Character), Density/Motion proximity, genre overlap, same-label
bonus, and **release-year proximity** (the user explicitly wants "similar
releases from the same year" surfaced — don't drop that term when
touching the scoring formula). Same-artist releases are excluded from
"Similar Releases" and shown separately under "More From This Artist" —
don't fold those back together, an artist's own discography would
otherwise crowd out genuinely different-sounding matches.

**Descriptor tagging is a separate, reviewed step — not automated
end-to-end.** New/seed releases can exist with blank Texture/Tone/
Character/Density/Motion (similarity scoring degrades gracefully — see
`descriptorScore`'s neutral-on-missing behavior). When doing a tagging
pass, propose values for review (e.g. in a Claude Code session, drawing
on the curatorial `notes` text) rather than writing directly to Airtable
un-reviewed — this was an explicit user decision, not just caution.

**`esc()` (in `lib/pure.js`) must wrap any user-provided string
interpolated into `innerHTML`** (artist, title, label, notes, genre/
descriptor tag values) — the only XSS defense, applied consistently
across every render path. Keep doing this for new fields.

**Import/export** round-trips the full `releases` array as JSON
(client-side download / file picker), separate from the Airtable Worker's
own storage — a backup mechanism, not a sync mechanism. Writes batch in
chunks of 10 (Airtable's per-request cap), same as music-tracker.
