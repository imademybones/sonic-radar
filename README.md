# Sonic Radar

A public, collaborative discovery tool for studio LP releases, spanning
two genre families — **Ambient** and **Jazz** — with two-tier
family/subgenre navigation, and built to add more families over time.
Surfaces genuinely **sonic** similarity between releases (shared
texture, tone, character, density, motion, plus release-year proximity),
not just shared genre tags — and that similarity deliberately crosses
genre families.

No build step, no framework — a static `index.html` backed by Airtable
via a Cloudflare Worker. See `CLAUDE.md` for architecture notes and
`project-reference.md` for live IDs/URLs and deploy status.

This app is the eventual home of the "Found Frequency" name and
foundfrequency.com domain, currently used by the sibling project
`music-tracker`. That handoff is a deliberate, deferred step — see
`project-reference.md` "Naming & domain handoff" — not yet done.

## Development

```
python3 -m http.server   # serve index.html locally, no build step
node --test lib/pure.test.js   # run the pure-function/scoring test suite
```
