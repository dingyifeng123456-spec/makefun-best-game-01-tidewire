# Tidewire

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/dingyifeng123456-spec/makefun-best-game-01-tidewire/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/dingyifeng123456-spec/makefun-best-game-01-tidewire/reward.svg)](https://make.fun/bounty/best-game-01)

An original offline browser puzzle for the [`best-game-01`](https://make.fun/bounty/best-game-01) entry.

## Concept

Tidewire is a storm-night coastal signal-routing puzzle. Restore rescue beacons by rotating switchgear tiles so a live pulse reaches receivers without overload.

**Mechanical twist:** splitter tiles energize every connected branch, so load must be separated into safe routes. Stage 3 adds a single optional storage tile that can absorb one surge on a high-capacity feed (and be released later if desired), requiring buffer placement instead of simple pipe matching.

## Scenarios

1. **Harbor Spark** — single-source route and load discipline.
2. **Jetty Split** — one source feeding two receivers through a splitter.
3. **Storm Battery** — cap-2 feed buffered by storage plus a separate detour feed; storage is not required to be released to win.

## Controls

- `Arrow keys`: move selection
- `Space` / `Click`: rotate selected tile clockwise
- `Q`: rotate selected tile counter-clockwise
- `S`: place storage on selected tile (when available)
- `E`: release storage
- `N`: retry current scenario
- `M`: mute/unmute synthesized audio
- `Enter`: start / advance / replay from overlays

Audio is synthesized on demand and only starts after user gesture.

## Run locally

- Serve: `node serve.ts` then open `http://localhost:8080`
- Build output/dossier (grader-style): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

## Screenshots

`screenshots/` holds 4 JPEGs taken by the maker in a real desktop browser while play-testing this build: the title screen, play in progress with the HUD, the storage mechanic in Storm Battery, and the final "COAST RESTORED" screen.

## Notes

- Fully offline, static files only, no build step, all assets/code local.
- Uses the exact vendored `vendor/makefun-game.ts` from the kit unchanged.
- Exposes `window.__tidewire.state` snapshot for independent browser testing.
- Visuals are original procedural Canvas/CSS (night navy chart, turquoise paths, warm ivory type, coral accent). No external assets/libraries.

---

Entry by [@cousin-jack](https://make.fun/bounty/best-game-01) — ref `hkg9x24b`
