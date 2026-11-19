// NEON DISTRICT: CITY OF CRIME (gta6-01) — authored entry: the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, three.min.js vendored under game/vendor/, no network request at runtime), and the
// program hands it in. It copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
// v2 entry: 8 story missions, 4 guns + combat AI, procedural character
// portraits, time-of-day lighting and the wet-sunset Ocean Boulevard cover.
// v3 entry: late-story cover staging (MISSION 6/8, REP 4 BAY HUSTLER, 3-star
// heat, 5-unit SVPD response), sculpted Solaris GT wedge, lower sun,
// mission banner moved clear of the police panel.
// v4 entry: MISSION 7/8 SUNSET GETAWAY cover (Rico Vane), REP XP numbers
// (1.960 / 2.400 XP), mission timer 2:40 + PAR BONUS +$650, combat staged
// at REP 4, warm orange sun, textured road, varied building windows,
// sculpt pass 2 on the Solaris GT (steeper wedge, brighter headlights).
const ENTRY_VERSION = 'v6 — C3 deciders: sculpted Solaris GT rear (sloped decklid, bright full-width tail bar, angled corner clusters, reverse lamps, chrome quad exhausts, flared haunches, valance + spoiler endplates), crisp road (3D lane dashes + edge lines + zebra, tiled asphalt overlay on Ocean Boulevard, shortened wet streaks, anisotropy 8), layered facades (bigger lit windows + floor bands, shopfront base + cornice + pilaster fins), re-staged end shot (Dario walks down the x=60 avenue into the sunset, dressed figure, traffic parked clear)';
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
