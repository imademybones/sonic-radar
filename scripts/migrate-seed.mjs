#!/usr/bin/env node
// One-time migration of the ambient-radar-v3.html prototype's seed data
// into the Sonic Radar Airtable base. Not part of the deployed app — run
// locally with a personal Airtable token, not routed through the Worker.
//
// Usage:
//   AIRTABLE_TOKEN=pat... node scripts/migrate-seed.mjs [--base appXXXXXXXXXXXXXX] [--dry-run]
//
// Descriptor tags (Texture/Tone/Character/Density/Motion) are intentionally
// left blank here — see CLAUDE.md "Descriptor tagging pass" for why that's
// a separate, reviewed step rather than something this script guesses at.

import { legacyMonthYearToIso } from '../lib/pure.js';

const GENRE_LABELS = {
  drone: 'Drone / Textural',
  field: 'Field / Electroacoustic',
  dark: 'Dark / Hauntological',
  dub: 'Dub / Textural Techno',
  kosmische: 'Kosmische / Space',
};

// Verbatim from ambient-radar-v3.html's seedAlbums, minus the source:"curated"
// marker (reapplied uniformly below).
export const seedAlbums = [
  { artist:"Chris Watson", title:"Planet Ocean", date:"Jan 2026", label:"Touch", genre:["field","drone"], note:"17 aquatic field recordings across one unbroken hour — Watson celebrates 30 years on the Touch imprint. Oceans, coasts and tidal environments from the Sea of Cortez to the Arctic, each location sonically distinct. Both a conservation argument and a masterclass in listening. Bandcamp New & Notable, Feb 2026." },
  { artist:"Concrete Husband", title:"Where The Ashes Glow", date:"Jan 2026", label:"NNA Tapes", genre:["field","dark"], note:"NYC-based Carlos Aguilar merges conservatory flute technique with field recordings, breath and percussion into an unbroken sonic architecture. Earlier works split between microtonal bedroom ambient and driving rhythm; here both impulses fuse into a single ritualistic material. Chamber electronics as urban dislocation." },
  { artist:"zakè", title:"Cantus for Winter in Six Parts", date:"Jan 2026", label:"Past Inside the Present", genre:["drone","field"], note:"Six-part analog drone suite rooted in Midwest seasonal cycles. Soft analog hiss, legato cello, spectral field recordings in the backdrop. Wandering fallow landscapes while dreaming of their renewal. zakè's intuitive approach to ambient drone at its most intimate." },
  { artist:"Brendon Moeller", title:"Shadow Language", date:"Jan 2026", label:"Samurai Music", genre:["dark","dub"], note:"15-track ambient dub and autonomic LP — heavyweight dub techno chords collide with D&B pressure and dubstep snarl, delivered with devastating restraint and meditative warmth. Majestic dub chords of 'Driftform' create a through-line across Moeller's extensive catalogue." },
  { artist:"Luís Fernandes + Pierce Warnecke", title:"Culatra", date:"Jan 2026", label:"Room40", genre:["field","drone"], note:"Room40 release from the Portuguese-French duo. Electroacoustic field compositions with frosty, textural detail — sounds so visual, easy to see frozen breath and cold air throughout." },
  { artist:"Ryan J Raffa & Sam Prekop", title:"Only Came To Say Goodbye", date:"Jan 2026", label:"Crash Symbols", genre:["kosmische","drone"], note:"Sea and Cake veteran Prekop joins Taipei hardware tinkerer Raffa. Analog sputters and lithe sequencing on West Virginia DIY label Crash Symbols. Transportive kosmische." },
  { artist:"Wil Bolton & David Cordero", title:"How to Make Sense of Downtime", date:"Feb 2026", label:"Home Normal", genre:["drone","field"], note:"Debut collaboration between UK ambient veteran Bolton and Spanish composer Cordero — one of two special collaborations released on Home Normal in February 2026, the label's final year of regular physical releases. Eight pieces of guitar-led textural drift. Mastered by Ian Hawgood." },
  { artist:"Rafael Anton Irisarri", title:"Points of Inaccessibility", date:"Feb 2026", label:"Black Knoll Editions", genre:["drone","dark"], note:"Bowed-guitar drone improvisations inside the former Pieter Baan Centre — a forensic psychiatric prison in Utrecht. Four movements of cinematic pull, grainy reverb and floating frequencies. Abul Mogard (editing), Karen Vogt (vocal loops), mastered by Stephan Mathieu. Irisarri's 20th LP." },
  { artist:"KMRU", title:"Kin", date:"Feb 2026", label:"Editions Mego", genre:["field","dark"], note:"Kenya-born, Berlin-based sonic designer returns to Editions Mego. Contorted digital textures with Fennesz feature on 'Blurred'. Dedicated to late Editions Mego founder Peter Rehberg. Blistering and meditative — field recording as memorial." },
  { artist:"Maria BC", title:"Marathon", date:"Feb 2026", label:"Sacred Bones", genre:["drone","dark"], note:"Third LP on Sacred Bones. Pitchfork 7.4, Metacritic 78, Quietus Album of the Week. Ambient and hauntological with a folk undertow — emotionally precise and slowly devastating." },
  { artist:"zakè & rhubiqs", title:"Hild", date:"Feb 2026", label:"Zakè Drone Recordings", genre:["drone"], note:"First collaboration between zakè (Zach Frizzell) and UK's rhubiqs (Tom Squires). Transcontinental deep drone, spacious piano and immersive texture — alternately colossal and weightless. Both artists have released with Germany's Affin label." },
  { artist:"Brendon Moeller", title:"Sprawl Circuitry", date:"Feb 2026", label:"Delsin", genre:["dub","drone"], note:"Six deep techno steppers on Delsin. Dub-informed structures dissolve into abstract electronic space — music that does not demand attention but steadily absorbs it. Functional, immersive, quietly hypnotic. An album for extended listening sessions." },
  { artist:"Gafael", title:"Syren", date:"Feb 2026", label:"enmossed", genre:["dub","drone"], note:"Welsh artist Matthew Ridgway on North Carolina's enmossed. Dub techno revival suited to forest wandering rather than clubs — twitchy chord stabs, crackling static, aquatic samples. Better for green spaces than dance floors." },
  { artist:"Ian Hawgood", title:"Piano Works", date:"Mar 2026", label:"Home Normal", genre:["drone","field"], note:"Recordings made in a Catford family home in 2003–04 using a childhood piano, a Boss DD delay pedal and a Sony ECM mic — simple, one-take pieces finally given their proper release. Mum and dogs audible in the background. Intimate, unguarded, tender. Part of Home Normal's final-year release programme." },
  { artist:"Laurel Halo", title:"Midnight Zone (Original Soundtrack)", date:"Mar 2026", label:"Hyperdub", genre:["drone","dark"], note:"Score to Julian Charrière's film about a jeopardised Pacific region rich with metals. TransAcoustic piano, violin, viol da gamba and Montage 8 recorded at Yamaha's Manhattan studio. Bottomless drones that harness the unsettling essence of freefall." },
  { artist:"Colleen", title:"Libres antes del final", date:"Mar 2026", label:"Thrill Jockey", genre:["drone","dark"], note:"Cécile Schott confronted a fear of swimming in the open Mediterranean — inspiring fathomless sonics. Re-amped Moog Matriarch captured at Casa Montjuic, cresting in serrated waves. Desire to escape suffering before death. Uneasy and arresting." },
  { artist:"Ben Glas", title:"music* *?", date:"Mar 2026", label:"Room40", genre:["drone","field"], note:"Room40 release — seven untitled tracks that unfold like a single immersive experience. Impossibly massive structures and vast, bleached-empty layers of carefully crafted ambience. Piano pieces act as brief reminders of familiar spaces before drifting back into expanse." },
  { artist:"David Shea", title:"Meditations", date:"Mar 2026", label:"Independent", genre:["field","drone"], note:"Melbourne-based composer's Buddhist practice informs this meditation. Octet of singing bowls, sheng, vibraphone and Heart Sutra readings. Cosmic and probing — the avant-garde underground of Shea's New York years filtered through contemplative practice." },
  { artist:"Félicia Atkinson & Christina Vantzou", title:"Reflections Vol. 3: Water Poems", date:"Apr 2026", label:"RVNG Intl.", genre:["field","drone"], note:"RVNG Intl.'s Reflections series. Atkinson and Vantzou pay homage to coastal homes in France and Greece. Spectral talking, aqueous burbles, delicate piano and lush hums — with John Also Bennett's lap steel. The current drifts to an uneasy place." },
  { artist:"Alex Zhang Hungtai", title:"Dras", date:"Apr 2026", label:"Shelter Press", genre:["drone","dark"], note:"Recorded at Saint Joseph Oratory basilica in Montréal — cavernous sonics. Atonal drones that bare fangs. The former Dirty Beaches composer now operates entirely in avant-garde and film scoring territory." },
  { artist:"Ben Seretan & John Thayer", title:"Sunbeam of No Illusion", date:"Apr 2026", label:"AKP Recordings", genre:["drone","kosmische"], note:"Hudson Valley duo. Fender Rhodes loops supporting modular squiggles, sliding swells and creaky white noise. Title borrowed from Emerson/Whitman dialogue — repurposes new age for a melancholy era." },
  { artist:"Pan•American", title:"Fly the Ocean in a Silver Plane", date:"Apr 2026", label:"kranky", genre:["drone","kosmische"], note:"Mark Nelson (Labradford) returns to kranky. Shimmering electronics and slippery guitar — air travel as metaphor for mystery and death, descending from the heavens." },
  { artist:"Foote/Dickow", title:"High Cube", date:"Apr 2026", label:"Geographic North", genre:["dub","dark"], note:"Former Fontanelle/Nudge members Brian Foote and Paul Dickow, each jam limited to five vintage pieces of gear and a 60-minute clock. Frosty echoes to vibrant blocky beats — glitch revival at its most playful and purposeful." },
  { artist:"Hoavi", title:"Architectonics", date:"Apr 2026", label:"Peak Oil", genre:["dub","field"], note:"Between blown-out dub techno and gamelan-inspired sounds — dub techno of T++ meets Uwalmassa's DIVISI62 label aesthetic. 'Triad of Becoming' hits with confounding double-time drums; 'Shadows of the Limits' is a warming bass-hit sound bath. Quietus April album of the month." },
  { artist:"zakè, Ossa & ASC", title:"Microliths and Momentary Drifts", date:"Apr 2026", label:"Past Inside the Present", genre:["drone","dark"], note:"First full-length collaboration from the trio of zakè, Ossa (Kaiton Slusher) and ASC (James Clements). Two artists from your priority list, one record. Deep atmospheric immersion across alternating Microlith and Momentary Drift movements." },
  { artist:"zakè", title:"HH", date:"Apr 2026", label:"Zakè Drone Recordings", genre:["drone"], note:"Deeply personal album — four pieces of glacial synth layers created during time spent in hospital rooms. 'Pieces of my heart, heard through the sounds of HH. For my wife.' Holding each moment close. Mastered at Ambient Mountain House by James Bernard." },
  { artist:"Kreng", title:"Wormhole", date:"May 2026", label:"Miasmah", genre:["dark","drone"], note:"First new album from the Belgian composer (Pepijn Caudron) in nearly a decade — last heard on Miasmah with the grief-laden The Summoner. Seven pieces of filmic dark ambient that pull the listener into suspense and ominous tension from the first bar. A wormhole into an outer realm of the unknown." },
  { artist:"Werner Dafeldecker & Lawrence English", title:"Fathom Tides", date:"May 2026", label:"Hallow Ground", genre:["field","drone"], note:"Second album together on Hallow Ground, following 2023's Tropic of Capricorn. Seven pieces built from English's coastal field recordings — eroding coastlines, river systems and glacial transformation — extensively reworked by Dafeldecker's electronics. A patient, immersive sound world that reflects on time beyond human measure." },
  { artist:"Eluvium", title:"Virga III", date:"May 2026", label:"Temporary Residence", genre:["drone","field"], note:"Third installment in Matthew Cooper's Virga series — the first in nearly five years. Inspired by minor green spaces, culverts and miniature biological ecosystems within daily life. An almost divine reprieve from the ominous sprawl of Virga II, rooted in microbiological observation." },
  { artist:"Abul Mogard & Rafael Anton Irisarri", title:"Where Light Pauses in the Silence of the Sun", date:"Jun 2026", label:"Black Knoll Editions", genre:["drone","dark"], note:"Second collaborative LP from Mogard and Irisarri — emerging from a three-day residency at Morphine Raum, Berlin. Cellist Martina Bertoni on two tracks. Irisarri: 'At moments I genuinely couldn't tell if a sound was coming from me or from Abul. It stopped feeling like two people making decisions.' Due June 26." },
];

export function toAirtableFields(album) {
  const now = Date.now();
  return {
    'Artist': album.artist,
    'Title': album.title,
    'Label': album.label || undefined,
    'Release Date': legacyMonthYearToIso(album.date) || undefined,
    'Genre': (album.genre || []).map(code => GENRE_LABELS[code] || code),
    'Notes': album.note || undefined,
    'Source': 'curated',
    'Listened': false,
    'Rating': 0,
    'Added At': now,
    'Updated At': now,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const baseIdx = args.indexOf('--base');
  const baseId = baseIdx !== -1 ? args[baseIdx + 1] : process.env.SONIC_RADAR_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const tableName = process.env.SONIC_RADAR_TABLE_NAME || 'Releases';

  if (!baseId) {
    console.error('Missing base id — pass --base appXXXXXXXXXXXXXX or set SONIC_RADAR_BASE_ID.');
    process.exit(1);
  }

  const records = seedAlbums.map(a => ({ fields: toAirtableFields(a) }));

  if (dryRun) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  if (!token) {
    console.error('Missing AIRTABLE_TOKEN. Use --dry-run to just print the payload instead.');
    process.exit(1);
  }

  // Airtable caps writes at 10 records per request.
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: batch }),
    });
    if (!res.ok) {
      console.error(`Batch ${i / 10 + 1} failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(`Batch ${i / 10 + 1}: inserted ${batch.length} records.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
