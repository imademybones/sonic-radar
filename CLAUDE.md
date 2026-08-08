# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

A **public, collaborative** discovery tool for studio LP releases,
spanning three genre families — **Ambient**, **Jazz**, and **Metal** —
with the architecture built to add more later without a rewrite. Anyone can add
a release or heart one; no accounts, no login. `index.html` (markup +
`<script type="module">`) plus
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
  heart, curator unlock + delete, open a release's Similar Releases
  modal) — no UI test automation, only the pure-function suite above.

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
Airtable token never leaves the Worker either way. If this ever needs to
be private, bolting on Access later is a contained change — see
music-tracker's own setup for the recipe.

**Collaborative write model — split by risk, not by feature.** This was
an explicit user decision, not a default: `POST /releases` (add a
release) and `POST /releases/:id/heart` (aggregate engagement signal)
are open to anyone, no gate — that's the point of a collaborative
catalogue. `PATCH /releases/:id` and `DELETE /releases/:id` require an
`X-Curator-Passphrase` header matching the `CURATOR_PASSPHRASE` Worker
secret, checked via `isCurator()` in the Worker. The client caches a
verified passphrase in `localStorage` (`sonicRadar_curatorKey`) after
confirming it against `GET /verify-curator`, and clears it on a 403 so a
stale/wrong cached value doesn't keep silently failing. **This is a
single shared static passphrase, not per-user auth** — anyone the
passphrase is shared with has full curator power (edit/delete anything),
and it's still only an Origin-plus-header check, spoofable outside a
browser the same way music-tracker's Origin check is. Acceptable for
this app's stakes (worst case: a trusted collaborator's mistake, not a
stranger's), but don't describe it to users as real authentication.

**Hearts are an open, low-stakes aggregate counter, not a vote you can
trust adversarially.** `POST /releases/:id/heart` does a read-then-write
increment against Airtable with no locking — a rare simultaneous
double-click can lose an increment, and nothing stops someone from
clearing `localStorage` and re-hearting the same release repeatedly from
one browser. Both are accepted trade-offs for staying gate-free; don't
"fix" this by adding auth or a transactional counter unless the
collaborative-but-ungated premise itself changes.

**The "Refresh with AI" release-discovery feature from the prototype was
deliberately dropped, not ported.** It called the Anthropic API directly
from the browser with no key and never actually worked. Release discovery
now happens conversationally (e.g. in a Claude Code session) and
confirmed finds get added through the normal manual-add path. Do not
re-add a live AI-search route without discussing the tradeoffs (API cost,
key handling) first.

**Data model.** A `release` object (`recordToRelease`/`releaseToFields`
in `lib/pure.js`) has: `id`, `artist`, `title`, `releaseDate` (ISO
`YYYY-MM-DD`), `label`, `genreFamily` (`"Ambient"` | `"Jazz"` | `"Metal"`,
defaults to `"Ambient"` on write if omitted), `genre` (array of full display
strings like `"Drone / Textural"`, not short codes — scoped to
`genreFamily`, see "Genre navigation" above), `texture`/`tone`/`character`
(descriptor tag arrays), `density`/`motion` (1–5 or `null`), `notes`,
`source` (`curated` | `community`), `hearts` (number, aggregate),
`spotifyUrl`, `addedBy` (free-text, optional, no verification it's real),
`addedAt`, `updatedAt`. These map 1:1 to Airtable field names — see
project-reference.md for the actual field IDs. There is deliberately no
per-user `listened`/`rating` anymore — that was personal-log state from
before the collaborative pivot and doesn't have a coherent meaning when
"who listened" could be any visitor; see the git history around the
collaborative-pivot commit if you need the old semantics for reference.

**Genre navigation is two-tier — Genre Family, then Genre (subgenre) —
and both levels are data-driven.** A release has a `Genre Family`
singleSelect (`Ambient`, `Jazz`, or `Metal`) plus a `Genre` multipleSelects
field whose choices are scoped to that family (5 subgenres each — see
`FAMILY_GENRES` in `index.html`; Metal's are `Death Metal`, `Black Metal`,
`Doom / Sludge`, `Metalcore / Mathcore`, `Post-Metal / Progressive` —
consolidated buckets, not the ~20 fine-grained genre strings the source
data used, since a two-tier pill row needs a small, browsable set).
The UI renders family pills first (`renderFamilyPills`, from
`distinctFamilies()`), then a second row of subgenre pills scoped to
whichever family is active (`renderSubgenrePills`, from
`distinctSubgenres(family)`) — both computed from what's actually present
in loaded data, not hardcoded, so a new subgenre added to Airtable just
shows up. `FAMILY_GENRES` itself *is* a hardcoded map (it also drives the
add-form's genre checkboxes via `renderFormGenreChecks`) — adding a whole
new family means updating `FAMILY_GENRES` and `FAMILY_ORDER` in
`index.html`, not just an Airtable-choices change (see the `family-metal`
CSS badge color in `styles.css` — `--accent4` — for the other place a new
family touches). `matchesFilter()` handles the two-tier logic plus the
special-case `Community Adds` pill (filters on `source`, not
`genreFamily`/`genre`).

**Cover art is fetched client-side from the iTunes Search API, session-only
— no persistence, and lazy/concurrency-limited.** `fetchCover()`/
`coverHtml()` in `index.html` mirror music-tracker's cover-art pattern
(same public, no-auth, CORS-permissive endpoint, same `artist|||title`
cache key), but differ in two ways. First, **no persistence** — writing
a resolved URL back to Airtable the way music-tracker does would mean a
`PATCH` on every visitor's session, and Sonic Radar's `PATCH
/releases/:id` route is curator-gated (see "Collaborative write model")
— an anonymous contributor shouldn't be able to trigger writes just by
loading the page. Second, **lazy loading via `IntersectionObserver` plus
a `COVER_MAX_CONCURRENT`-capped queue** (`enqueueCoverFetch`/
`pumpCoverQueue`/`getCoverObserver` in `index.html`): firing a lookup for
every release in the catalogue on page load (190+ at once) was hammering
iTunes' search endpoint hard enough that even genuine browser requests
started coming back empty — "some covers load, some don't" was a real
rate-limiting bug, not a cosmetic one. Only card tiles actually scrolled
near-into-view get queued, a few at a time; the modal header fetches
eagerly since it's the one thing being looked at. `coverCache` is a
plain in-memory object shared across both variants.

**A resolved cover patches only its own DOM element — it must never
call `render()`.** This was a real bug: `resolveCover()` originally
called `render()` on every single cover resolution, which rebuilds the
*entire* grid's `innerHTML`. Every `.album-card` has a `fadeUp`
entry animation starting at `opacity: 0`, so destroying and recreating
every card's DOM on every cover load (many, in quick succession, while
scrolling through a lazy-loaded grid) made the whole page flash blank
repeatedly. Fixed via `updateCoverInPlace(key, release)`: every cover
wrap (`.card-cover-wrap`/`.modal-cover-wrap`) carries `data-cover-key` +
`data-cover-variant`, and a resolution finds and replaces only the
matching wrap(s)' `innerHTML` — no grid rebuild, no animation restart.
If you touch this flow again, keep it that way; reintroducing a
`render()` call here reintroduces the flash.

**Cover art can be manually overridden per release — curator-gated,
like edit/delete.** The `Cover Override` Airtable field (`fld9ruNqKQDudqc9h`,
url type) wins over the iTunes auto-lookup whenever
set (checked first in `coverHtml()`, via `safeExternalUrl()` since it's
a contributor-pasted URL rendered into an `<img src>`). The pencil
button (`.card-edit-cover`/`.modal-edit-cover`, `data-action=
"edit-cover"`) only renders when `curatorKey` is set — same gating as
the delete button — because an open, ungated "set any image URL for
any release" action would be a real moderation/abuse surface, unlike
the low-stakes Hearts counter. `requestEditCover()` uses a plain
`window.prompt()` rather than a dedicated modal/form; this is a rare
curator action, not worth its own UI surface. Passing an empty string
clears the override and falls back to the iTunes lookup.

**Design language is deliberately Rdio-inspired — bold, confident,
minimal chrome, content-forward.** It went through two passes: the
first (2026-08-06) kept the original dark palette and just changed
typography/layout, which the user judged as not going far enough; the
second (2026-08-07) switched to a **full light theme** (white/near-white
`--bg`/`--surface`, near-black `--text`, saturated-but-legible accent
colors) — the actual Rdio look, not a dark-mode approximation of it.
Concretely: the wordmark and all headline/card-artist/modal typography
moved from a delicate serif-italic (Cormorant Garamond, dropped from the
font stack entirely) to bold DM Sans (700–800 weight); art tiles (16:10,
deliberately shorter than a full square — an early pass had them too
large and dominant) lead each card; gapped rounded cards replaced the
old flush-bordered list grid; the static "Ambient · Jazz · Metal ·
Studio LPs" eyebrow line was removed from the header entirely — a
hardcoded family list doesn't scale as more genre families get added,
and it read as boilerplate. If another genre family is added later, do
not add it back in that form; the family pill row (already data-driven)
is the correct place for that information to live.

**The overlay badges on card art (`.card-number`, `.card-delete`) stay
on a fixed dark translucent chip regardless of page theme** — they sit
on top of arbitrary album-art colors, not the page background, so they
need their own guaranteed contrast. Their text uses `--overlay-text`
(always light), not `--text` (which flips between themes) — don't
"fix" this by swapping them to `--text` when touching this CSS, that
would make them unreadable in light mode.

**Spotify previews are contributor-pasted links, not an API integration.**
`spotifyEmbedUrl()` in `lib/pure.js` normalizes whatever a contributor
pastes (a full `open.spotify.com/{album|track}/ID` link, with or without
a `?si=` tracking param, or a `spotify:album:ID` URI) into Spotify's
no-auth-required embed iframe URL. There is intentionally no Spotify Web
API integration (no client ID/secret, no search-autofill) — that was
explicitly scoped out to keep the Worker simple; if autofill is wanted
later it's a new, separate decision, not an assumed next step.

**Bandcamp is a link-out, not an embed — and deliberately the only other
service.** Spotify (inline player) + Bandcamp (a "Bandcamp ↗" link on
the card/modal) is the intentional full set; Apple Music/Tidal/etc. were
considered and rejected as add-form friction with no audience in this
scene. Bandcamp can't be an embed because its player iframes need a
numeric album ID that isn't derivable from a pasted page URL. Because
`bandcampUrl` is a contributor-pasted string rendered into an `href`, it
MUST go through `safeExternalUrl()` (scheme check) at every render site —
`esc()` alone does not stop a `javascript:` URL. Bandcamp links pass
through as-is (no domain pinning) since labels use custom domains.

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

**Unreleased albums don't belong in the catalogue, in any family.**
Sonic similarity is a comparison between records that actually exist to
be heard — an album with a future `Release Date` has nothing genuine to
compare yet, so it gets removed on sight rather than added "for later."
This was caught twice on 2026-08-06: 7 of 83 Metal imports had future
dates, and a follow-up full-catalogue sweep found one more in Ambient
(added earlier that same day, releasing the next day) — the rule is
app-wide, not specific to the Metal import it was first noticed on. Any
import or discovery-sweep addition must filter to `Release Date <=
today` before writing.

**Descriptor tagging is a separate, reviewed step — not automated
end-to-end.** New/seed releases can exist with blank Texture/Tone/
Character/Density/Motion (similarity scoring degrades gracefully — see
`descriptorScore`'s neutral-on-missing behavior). When doing a tagging
pass, propose values for review (e.g. in a Claude Code session, drawing
on the curatorial `notes` text) rather than writing directly to Airtable
un-reviewed — this was an explicit user decision, not just caution.
The Texture/Tone/Character/Density/Motion vocabulary is deliberately
genre-agnostic — it needed no redesign when Jazz or Metal were added,
and cross-genre similarity (an ambient release scoring high against a
jazz or metal one) is allowed and intentional, not a bug to filter out.
`scoreSimilarity` in `lib/pure.js` never restricts by `genreFamily`.

**The Metal family (76 releases) was imported from a different source
than Ambient/Jazz — the sibling `music-tracker` app's own Airtable
base** (a personal listening log, not a curated prototype), filtered to
records whose free-text `Genre` field matched a metal/extreme-metal
vocabulary (hardcore/punk-family genres like Metallic Hardcore,
Post-Hardcore, Powerviolence, and Screamo were deliberately excluded as
a different genre family, even though metal-adjacent). 7 of the original
83 `music-tracker` matches had future release dates (the personal log
tracks upcoming releases the user hasn't heard yet) and were removed —
see "Unreleased albums don't belong in the catalogue" above.

**Descriptor tagging must differentiate within a subgenre, not just
label it — a first pass at Metal got this wrong and was corrected the
same day.** The initial import used a scripted per-subgenre archetype
(every "Black Metal" release got a near-identical Texture/Tone/
Character profile, differing only by light jitter), which meant Similar
Releases effectively degenerated into "this is black metal, so here's
more black metal" — exactly the shallow genre-tag-matching the whole
descriptor system exists to avoid (see "Sonic similarity is structured"
above). It was replaced with real per-release judgment: each of the 76
Metal releases was tagged individually based on the artist's actual
sonic character (e.g. Archspire's hyper-fast technical precision vs.
Immolation's dissonant mid-tempo atmosphere vs. Temple of Void's doom-
death crawl — three "Death Metal" releases with three different
Density/Motion/Character profiles). Verified after the fact: the
Death Metal bucket alone (35 releases) now has 23 distinct full
descriptor combinations, not 2-3. If a new large batch import happens
again, tag it with this same level of per-release distinction —
archetype-by-subgenre is a trap that looks fine at a glance (every
record has *plausible* tags) but silently defeats the whole point of
descriptor-based similarity.

**Notes should read like the discovery-sweep's curatorial style by
default, not a casual personal aside.** The user explicitly called out
liking the sweep's Notes ("Second collaborative LP from Mogard and
Irisarri — emerging from a three-day residency at Morphine Raum,
Berlin.") over off-the-cuff supplied text — that curatorial register
(what's actually notable: label, collaborators, recording context,
sonic character, in 1-2 sentences) is the default bar for *any* Notes
written for this app, whether by a batch import, the discovery sweep,
or written on the user's behalf in a session — not just something the
sweep prompt happens to ask for. The add-form's Notes placeholder
(`#f-note` in `index.html`) demonstrates this register directly rather
than a generic "say something about the record" prompt.

**`esc()` (in `lib/pure.js`) must wrap any user-provided string
interpolated into `innerHTML`** (artist, title, label, notes, genre/
descriptor tag values) — the only XSS defense, applied consistently
across every render path. Keep doing this for new fields.

**Import/export** round-trips the full `releases` array as JSON
(client-side download / file picker), separate from the Airtable Worker's
own storage — a backup mechanism, not a sync mechanism. Writes batch in
chunks of 10 (Airtable's per-request cap), same as music-tracker.
