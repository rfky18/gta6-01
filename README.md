# NEON DISTRICT: CITY OF CRIME

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rfky18/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/rfky18/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game set in **San Vega City** — a sun-soaked coastal city at golden hour.
Walk the streets, steal a ride, lose the SVPD, and run your first job for fixer Nadia Cruz.

## The game

Dario Cole just got out. One package waits at Palmera Pier, one garage waits
across town, and the whole San Vega Police Department is one bad decision away.
Explore three districts — Crown District downtown, Neon Mile, and Palmera Beach
with its boardwalk and ferris wheel — on foot or behind the wheel of the Solaris GT.

- **Open world**: procedural low-poly city, beach + ocean, palms, neon signs, sunset lighting
- **On foot**: walk, sprint, jump, third-person mouse camera
- **Driving**: steal and drive the Solaris GT, chase cam, speedometer, traffic AI
- **Wanted system**: steal a car and SVPD unit VIPER-4 pursues and rams you — lose them or get busted
- **Mission**: FIRST NIGHT — pick up the package at the pier, bring it home, get paid
- **Life**: pedestrians on the sidewalks, patrol cars, radio (NEON FM 101.3), synthesized engine + siren audio
- **HUD**: mission panel, wanted stars, money, police response list, circular minimap, health/armour, REP
- **Save**: progress autosaves to localStorage

## How to play

Serve the game locally (`node serve.ts`) and open http://localhost:8080.

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| SHIFT | Sprint |
| SPACE | Jump (on foot) / handbrake (driving) |
| Mouse | Camera (click to lock, or drag) |
| E | Enter/exit car, pick up package |
| P / Esc | Pause |
| R | Toggle radio |

## Tech

Three.js (vendored `three.min.js`) + plain ES modules, no build step, no network
at runtime — every asset is procedural. Screenshots are staged from the real
running game via `?shot=start|play|end|street`.

## License

MIT
