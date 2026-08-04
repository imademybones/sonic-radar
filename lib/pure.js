// Pure, DOM-free helpers shared by index.html and lib/pure.test.js.
// node --test lib/pure.test.js runs these directly — see CLAUDE.md.

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((m, i) => [m.toLowerCase(), i]));

// ---- Dates ----
// Release Date is stored in Airtable as ISO (YYYY-MM-DD), day defaulting to
// the 1st since neither the old prototype nor this app track day-of-month
// precision. legacyMonthYearToIso exists only to migrate the prototype's
// free-text "Jan 2026" style dates during the one-time seed import.

export function legacyMonthYearToIso(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.trim().match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (!m) return '';
  const monthIdx = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
  if (monthIdx == null) return '';
  return `${m[2]}-${String(monthIdx + 1).padStart(2, '0')}-01`;
}

export function parseReleaseDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

export function releaseYear(iso) {
  const d = parseReleaseDate(iso);
  return d ? d.getFullYear() : null;
}

export function formatMonthLabel(iso) {
  const d = parseReleaseDate(iso);
  if (!d) return 'Date Unknown';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- Misc ----

export function dedupeKey(artist, title) {
  return `${(artist || '').trim().toLowerCase()}|${(title || '').trim().toLowerCase()}`;
}

export function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Airtable <-> app record mapping ----

export function recordToRelease(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    artist: f['Artist'] || '',
    title: f['Title'] || '',
    releaseDate: f['Release Date'] || '',
    label: f['Label'] || '',
    genre: f['Genre'] || [],
    texture: f['Descriptor: Texture'] || [],
    tone: f['Descriptor: Tone'] || [],
    character: f['Descriptor: Character'] || [],
    density: f['Descriptor: Density'] ?? null,
    motion: f['Descriptor: Motion'] ?? null,
    notes: f['Notes'] || '',
    source: f['Source'] || 'manual',
    listened: !!f['Listened'],
    rating: f['Rating'] || 0,
    addedAt: f['Added At'] || null,
    updatedAt: f['Updated At'] || null,
  };
}

export function releaseToFields(entry) {
  const fields = {
    'Artist': entry.artist || '',
    'Title': entry.title || '',
    'Genre': entry.genre || [],
    'Descriptor: Texture': entry.texture || [],
    'Descriptor: Tone': entry.tone || [],
    'Descriptor: Character': entry.character || [],
    'Source': entry.source || 'manual',
    'Listened': !!entry.listened,
    'Rating': entry.rating || 0,
    'Added At': entry.addedAt || Date.now(),
    'Updated At': Date.now(),
  };
  if (entry.releaseDate) fields['Release Date'] = entry.releaseDate;
  if (entry.label) fields['Label'] = entry.label;
  if (entry.notes) fields['Notes'] = entry.notes;
  if (entry.density != null) fields['Descriptor: Density'] = entry.density;
  if (entry.motion != null) fields['Descriptor: Motion'] = entry.motion;
  return fields;
}

// ---- Similarity ----
// "Sonic similarity" is a weighted blend of structured descriptor-tag
// overlap, shared genre, shared label, and release-year proximity — not
// just "these share a genre tag". Same-artist releases are deliberately
// excluded here and surfaced separately via moreFromArtist, so an artist's
// own discography doesn't crowd out genuinely different-sounding matches.

export const DESCRIPTOR_WEIGHTS = { texture: 0.35, tone: 0.25, character: 0.25, density: 0.075, motion: 0.075 };
export const SIMILARITY_WEIGHTS = { descriptor: 0.6, genre: 0.2, label: 0.1, year: 0.1 };
const YEAR_DECAY_YEARS = 5; // year-proximity term reaches 0 once release years differ by this much

export function jaccard(a = [], b = []) {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function numericProximity(x, y, maxDiff) {
  if (x == null || y == null) return 0.5; // untagged is neutral, not a penalty
  return Math.max(0, 1 - Math.abs(x - y) / maxDiff);
}

export function descriptorScore(a, b, weights = DESCRIPTOR_WEIGHTS) {
  return weights.texture * jaccard(a.texture, b.texture)
    + weights.tone * jaccard(a.tone, b.tone)
    + weights.character * jaccard(a.character, b.character)
    + weights.density * numericProximity(a.density, b.density, 4)
    + weights.motion * numericProximity(a.motion, b.motion, 4);
}

export function scoreSimilarity(a, b, weights = SIMILARITY_WEIGHTS) {
  const ya = releaseYear(a.releaseDate), yb = releaseYear(b.releaseDate);
  const yearProximity = (ya == null || yb == null)
    ? 0.5
    : Math.max(0, 1 - Math.abs(ya - yb) / YEAR_DECAY_YEARS);
  const labelBonus = (a.label && b.label &&
    a.label.trim().toLowerCase() === b.label.trim().toLowerCase()) ? 1 : 0;
  return weights.descriptor * descriptorScore(a, b, DESCRIPTOR_WEIGHTS)
    + weights.genre * jaccard(a.genre, b.genre)
    + weights.label * labelBonus
    + weights.year * yearProximity;
}

export function similarReleases(target, all, { limit = 6, minScore = 0.08, weights } = {}) {
  const targetArtist = (target.artist || '').trim().toLowerCase();
  return all
    .filter(r => r.id !== target.id && (r.artist || '').trim().toLowerCase() !== targetArtist)
    .map(r => ({ release: r, score: scoreSimilarity(target, r, weights) }))
    .filter(x => x.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

export function moreFromArtist(target, all, { limit = 8 } = {}) {
  const targetArtist = (target.artist || '').trim().toLowerCase();
  const time = r => parseReleaseDate(r.releaseDate)?.getTime() ?? 0;
  return all
    .filter(r => r.id !== target.id && (r.artist || '').trim().toLowerCase() === targetArtist)
    .sort((a, b) => time(b) - time(a))
    .slice(0, limit);
}
