import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyMonthYearToIso,
  parseReleaseDate,
  releaseYear,
  formatMonthLabel,
  dedupeKey,
  esc,
  recordToRelease,
  releaseToFields,
  spotifyEmbedUrl,
  jaccard,
  descriptorScore,
  scoreSimilarity,
  similarReleases,
  moreFromArtist,
} from './pure.js';

// ---- dates ----

test('legacyMonthYearToIso: converts "Jan 2026" style strings', () => {
  assert.equal(legacyMonthYearToIso('Jan 2026'), '2026-01-01');
  assert.equal(legacyMonthYearToIso('Jun 2026'), '2026-06-01');
});

test('legacyMonthYearToIso: rejects unrecognized shapes', () => {
  assert.equal(legacyMonthYearToIso(''), '');
  assert.equal(legacyMonthYearToIso('2026'), '');
  assert.equal(legacyMonthYearToIso('Not a date'), '');
});

test('parseReleaseDate: parses ISO, rejects everything else', () => {
  const d = parseReleaseDate('2026-06-26');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5);
  assert.equal(d.getDate(), 26);
  assert.equal(parseReleaseDate(''), null);
  assert.equal(parseReleaseDate('Jun 2026'), null);
});

test('releaseYear / formatMonthLabel', () => {
  assert.equal(releaseYear('2026-06-26'), 2026);
  assert.equal(releaseYear(''), null);
  assert.equal(formatMonthLabel('2026-01-15'), 'Jan 2026');
  assert.equal(formatMonthLabel(''), 'Date Unknown');
});

// ---- misc ----

test('dedupeKey: case/whitespace-insensitive', () => {
  assert.equal(dedupeKey(' Zakè ', 'HH'), dedupeKey('zakè', 'hh'));
});

test('esc: escapes HTML-significant characters', () => {
  assert.equal(esc(`<script>"'&`), '&lt;script&gt;&quot;&#39;&amp;');
  assert.equal(esc(''), '');
  assert.equal(esc(null), '');
});

// ---- Airtable mapping ----

test('recordToRelease / releaseToFields round-trip the core fields', () => {
  const record = {
    id: 'rec123',
    fields: {
      'Artist': 'zakè',
      'Title': 'HH',
      'Release Date': '2026-04-01',
      'Label': 'Zakè Drone Recordings',
      'Genre': ['Drone / Textural'],
      'Descriptor: Texture': ['Glacial/Smooth'],
      'Descriptor: Tone': ['Warm'],
      'Descriptor: Character': ['Static/Drone-based'],
      'Descriptor: Density': 2,
      'Descriptor: Motion': 1,
      'Notes': 'Four pieces of glacial synth layers.',
      'Source': 'curated',
      'Hearts': 7,
      'Spotify URL': 'https://open.spotify.com/album/abc123',
      'Added By': 'Stephen',
      'Added At': 1000,
      'Updated At': 2000,
    },
  };
  const release = recordToRelease(record);
  assert.equal(release.id, 'rec123');
  assert.equal(release.artist, 'zakè');
  assert.deepEqual(release.texture, ['Glacial/Smooth']);
  assert.equal(release.density, 2);
  assert.equal(release.hearts, 7);
  assert.equal(release.spotifyUrl, 'https://open.spotify.com/album/abc123');
  assert.equal(release.addedBy, 'Stephen');

  const fields = releaseToFields(release);
  assert.equal(fields['Artist'], 'zakè');
  assert.deepEqual(fields['Descriptor: Texture'], ['Glacial/Smooth']);
  assert.equal(fields['Descriptor: Density'], 2);
  assert.equal(fields['Hearts'], 7);
  assert.equal(fields['Spotify URL'], 'https://open.spotify.com/album/abc123');
  assert.equal(fields['Added By'], 'Stephen');
});

test('recordToRelease: defaults missing fields instead of crashing', () => {
  const release = recordToRelease({ id: 'rec1', fields: {} });
  assert.equal(release.artist, '');
  assert.deepEqual(release.genre, []);
  assert.equal(release.density, null);
  assert.equal(release.hearts, 0);
  assert.equal(release.source, 'community');
});

test('releaseToFields: omits empty optional fields rather than sending blanks', () => {
  const fields = releaseToFields({ artist: 'A', title: 'B', genre: [] });
  assert.ok(!('Release Date' in fields));
  assert.ok(!('Label' in fields));
  assert.ok(!('Descriptor: Density' in fields));
  assert.ok(!('Spotify URL' in fields));
  assert.ok(!('Added By' in fields));
  assert.equal(fields['Source'], 'community');
  assert.equal(fields['Hearts'], 0);
});

// ---- Spotify embed ----

test('spotifyEmbedUrl: parses open.spotify.com links with and without tracking params', () => {
  assert.equal(
    spotifyEmbedUrl('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv'),
    'https://open.spotify.com/embed/album/4LH4d3cOWNNsVw41Gqt2kv'
  );
  assert.equal(
    spotifyEmbedUrl('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv?si=abc123'),
    'https://open.spotify.com/embed/album/4LH4d3cOWNNsVw41Gqt2kv'
  );
  assert.equal(
    spotifyEmbedUrl('https://open.spotify.com/track/4LH4d3cOWNNsVw41Gqt2kv'),
    'https://open.spotify.com/embed/track/4LH4d3cOWNNsVw41Gqt2kv'
  );
});

test('spotifyEmbedUrl: parses spotify: URIs', () => {
  assert.equal(
    spotifyEmbedUrl('spotify:album:4LH4d3cOWNNsVw41Gqt2kv'),
    'https://open.spotify.com/embed/album/4LH4d3cOWNNsVw41Gqt2kv'
  );
});

test('spotifyEmbedUrl: returns null for empty or unrecognized input', () => {
  assert.equal(spotifyEmbedUrl(''), null);
  assert.equal(spotifyEmbedUrl(null), null);
  assert.equal(spotifyEmbedUrl('https://example.com/not-spotify'), null);
});

// ---- similarity ----

test('jaccard: empty/empty is 0, identical sets is 1, disjoint is 0, partial overlap', () => {
  assert.equal(jaccard([], []), 0);
  assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  assert.equal(jaccard(['a'], ['b']), 0);
  assert.equal(jaccard(['a', 'b'], ['b', 'c']), 1 / 3);
});

test('descriptorScore: missing density/motion is neutral, not a crash', () => {
  const a = { texture: ['Glacial/Smooth'], tone: ['Warm'], character: [], density: null, motion: null };
  const b = { texture: ['Glacial/Smooth'], tone: ['Warm'], character: [], density: null, motion: null };
  const score = descriptorScore(a, b);
  assert.ok(score > 0);
  assert.ok(Number.isFinite(score));
});

test('scoreSimilarity: identical releases score higher than releases sharing nothing', () => {
  const base = {
    id: '1', artist: 'A', label: 'Kranky', releaseDate: '2026-01-01',
    genre: ['Drone / Textural'], texture: ['Glacial/Smooth'], tone: ['Warm'],
    character: ['Static/Drone-based'], density: 2, motion: 1,
  };
  const twin = { ...base, id: '2', artist: 'B' };
  const stranger = {
    id: '3', artist: 'C', label: 'Room40', releaseDate: '2020-01-01',
    genre: ['Dub / Textural Techno'], texture: ['Gritty/Distorted'], tone: ['Cold'],
    character: ['Rhythmic-pulse'], density: 5, motion: 5,
  };
  assert.ok(scoreSimilarity(base, twin) > scoreSimilarity(base, stranger));
});

test('scoreSimilarity: same label alone contributes a bonus', () => {
  const a = { id: '1', artist: 'A', label: 'Kranky', releaseDate: '2026-01-01', genre: [], texture: [], tone: [], character: [], density: null, motion: null };
  const sameLabel = { id: '2', artist: 'B', label: 'kranky', releaseDate: '2020-01-01', genre: [], texture: [], tone: [], character: [], density: null, motion: null };
  const diffLabel = { id: '3', artist: 'C', label: 'Room40', releaseDate: '2020-01-01', genre: [], texture: [], tone: [], character: [], density: null, motion: null };
  assert.ok(scoreSimilarity(a, sameLabel) > scoreSimilarity(a, diffLabel));
});

test('similarReleases: excludes self and same-artist releases, sorts descending, respects limit', () => {
  const target = { id: '1', artist: 'zakè', label: 'PitP', releaseDate: '2026-01-01', genre: ['Drone / Textural'], texture: ['Glacial/Smooth'], tone: ['Warm'], character: ['Static/Drone-based'], density: 2, motion: 1 };
  const sameArtistOther = { id: '2', artist: 'zakè', label: 'PitP', releaseDate: '2026-02-01', genre: ['Drone / Textural'], texture: ['Glacial/Smooth'], tone: ['Warm'], character: ['Static/Drone-based'], density: 2, motion: 1 };
  const closeMatch = { id: '3', artist: 'rhubiqs', label: 'PitP', releaseDate: '2026-02-01', genre: ['Drone / Textural'], texture: ['Glacial/Smooth'], tone: ['Warm'], character: ['Static/Drone-based'], density: 2, motion: 1 };
  const farMatch = { id: '4', artist: 'Someone Else', label: 'Room40', releaseDate: '2010-01-01', genre: ['Dub / Textural Techno'], texture: ['Gritty/Distorted'], tone: ['Cold'], character: ['Rhythmic-pulse'], density: 5, motion: 5 };
  const all = [target, sameArtistOther, closeMatch, farMatch];

  const results = similarReleases(target, all, { minScore: 0 });
  assert.equal(results.length, 2); // excludes target + same-artist
  assert.equal(results[0].release.id, '3'); // closeMatch ranks first
  assert.ok(results[0].score >= results[1].score);

  const limited = similarReleases(target, all, { minScore: 0, limit: 1 });
  assert.equal(limited.length, 1);
});

test('similarReleases: minScore filters out weak matches', () => {
  const target = { id: '1', artist: 'A', label: 'X', releaseDate: '2026-01-01', genre: [], texture: [], tone: [], character: [], density: null, motion: null };
  const noOverlap = { id: '2', artist: 'B', label: 'Y', releaseDate: '2000-01-01', genre: ['Something'], texture: ['Gritty/Distorted'], tone: ['Cold'], character: [], density: null, motion: null };
  const results = similarReleases(target, [target, noOverlap], { minScore: 0.99 });
  assert.equal(results.length, 0);
});

test('moreFromArtist: same-artist only, excludes self, sorted newest first', () => {
  const target = { id: '1', artist: 'zakè', releaseDate: '2026-04-01' };
  const older = { id: '2', artist: 'zakè', releaseDate: '2026-01-01' };
  const newer = { id: '3', artist: 'zakè', releaseDate: '2026-06-01' };
  const other = { id: '4', artist: 'rhubiqs', releaseDate: '2026-05-01' };
  const results = moreFromArtist(target, [target, older, newer, other]);
  assert.deepEqual(results.map(r => r.id), ['3', '2']);
});
