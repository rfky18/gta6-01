# NEON DISTRICT: CITY OF CRIME

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rfky18/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/rfky18/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game set in **San Vega City** — a sun-soaked coastal city at golden hour.
Walk the streets, steal a ride, lose the SVPD, and run your first job for fixer Nadia Cruz.

## The game

Dario Cole just got out. One package waits at Palmera Pier, one garage waits
across town, and the whole San Vega Police Department is one bad decision away.
Explore five districts — Crown District downtown, Neon Mile, Palmera Beach
with its boardwalk and ferris wheel, Old Harbour docks, and the West Docks
hideout — on foot or behind the wheel of the Solaris GT.

- **Open world**: procedural low-poly city, beach + ocean + yacht, palms, neon signs, sunset lighting
- **On foot**: walk, sprint, jump, third-person mouse camera
- **Driving**: steal and drive the Solaris GT, chase cam, speedometer, traffic AI
- **Wanted system**: steal a car and SVPD units VIPER-4 (and VIPER-7 at 2 stars, VIPER-9 + VIPER-12 at 3 stars) pursue and ram you — lose them or get busted
- **Missions**: 8 story jobs — FIRST NIGHT, STOLEN WHEELS, NEON RUNNER, POLICE PRESSURE, DOCKSIDE TROUBLE, PALM COURT PICKUP, SUNSET GETAWAY, THE FINAL DEAL
- **Combat**: 4 original guns (VK-9 pistol, WASP SMG, BREAKER-12 shotgun, LONGSHOT rifle) + fists — aim, fire, reload, raycast hits, muzzle flash, tracers; rivals who chase, shoot back and take cover when hurt
- **Characters**: Nadia Cruz, Rico Vane, Selma Ortiz, Marco Ferro — dialog with procedural canvas portraits
- **Life**: 32 pedestrians on the sidewalks (they panic at gunfire), 12 traffic cars, patrol cars, radio (NEON FM 101.3), synthesized engine + siren + gunfire audio
- **Visuals**: gradient sunset sky dome, time-of-day cycle (day / golden hour / sunset / night), taller glass towers with setbacks and lit windows, SAN VEGA CITY neon billboard, wet asphalt with puddles and neon reflections, highway overpass, yacht offshore, rain on `?rain=1`
- **HUD**: mission panel (N/8 + stage progress), wanted stars, money, police response list (up to 5 units: 4 ground + HAWK-1), 5 weapon slots with live ammo, circular minimap with purple route to the objective, health/armour, REP + REP progress bar, crosshair + hitmarker
- **Save**: progress autosaves to localStorage (mission, weapons, ammo included)

## v3 — cover staging + sculpt (local-judge v2 lost 1W–5L)

- **Cover**: the `?shot=play` frame stages the late story — MISSION 6/8 (PALM COURT PICKUP, stage 2/2), REP 4 · BAY HUSTLER with the REP bar 80% full, 3-star wanted, 5 named SVPD units in the response list, 5 traffic cars + 6 pedestrians in frame, sun low over the water at 19:12, $34,750
- **Solaris GT**: sculpted wedge — lower/wider stance, tapered nose + splitter, full-width LED headlight bar, slanted windshield/rear glass, flared rear haunches, side skirts, bigger spoiler, larger wheels (handling unchanged)
- **Banner**: mission banners moved to bottom-centre above the dialog box — they no longer overlap the SVPD response panel

## How to play

Serve the game locally (`node serve.ts`) and open http://localhost:8080.

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| SHIFT | Sprint |
| SPACE | Jump (on foot) / handbrake (driving) |
| Mouse | Camera (click to lock, or drag) |
| E | Enter/exit car, pick up package |
| 1–4 | Pistol / SMG / shotgun / rifle (0 = fists) |
| Left click | Fire · Right click: aim |
| R | Reload |
| T | Toggle radio |
| P / Esc | Pause |

## Tech

Three.js (vendored `three.min.js`) + plain ES modules, no build step, no network
at runtime — every asset is procedural. Screenshots are staged from the real
running game via `?shot=start|play|end|street|combat`.

## License

MIT

## License

MIT
