# Emberline

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/robbyensoe/emberline/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/robbyensoe/emberline/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original flight game for the make.fun bounty
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057).

**The dawn mail run.** You fly the Kestrel, a little ember-orange mail plane, on the first
run of the day along a volcanic coast: sea glittering to port, ridge and lava river to
starboard, Mount Cinder smoking on the horizon. The run is three legs — Ember Bay, the
Ash Reach, and the Cinder Bay Approach. Thread the glowing dawn rings to score and build
a combo multiplier up to ×5; clip a rock spire or a storm cell and you lose hull, and
three hits put her down. On the last leg the Cinder Bay strip lights up ahead: line up
on the centreline, come in low and slow, and touch down to deliver the mail for a
landing bonus.

It is a chase view with a lit cockpit: an attitude indicator that banks with you,
altimeter, airspeed and compass gauges under the windscreen, and a heading tape with
altitude, speed and heading readouts up top. The next ring — or the strip — is always
marked, so the run is flown by eye, the way the screenshots show it.

**Play:** arrow keys / WASD or the mouse to steer, SHIFT to boost, Space or click to
start and restart, P pauses. Sound is synthesized live with WebAudio (engine, wind,
ring chimes); there are no audio files and no network requests. The game is plain
static files under `game/` and plays offline in a desktop browser.

**Run it locally:**

```
node serve.ts          # serves game/ at http://localhost:8080
```

**Hand it in (what the harness runs):**

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library in `vendor/`. The screenshots are
real renders of the game's own deterministic scenes (`?shot=cover|play|approach|end&seed=1`),
taken in a browser at 1280x720.

MIT licensed. Built by robbyensoe with Muse.
