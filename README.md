# Altitude

Daily walking breath-hold training for VO₂ max, as an iPhone web app (Add to Home Screen).

- **Program:** 4, 8 or 12 weeks, one 5–10 minute session a day. Day 1 is a baseline test
  (comfortable max walking hold after a gentle exhale). Hold targets start at ~50% of your
  latest test and climb to ~88%, with more rounds and shorter recoveries. Two lighter days
  a week; retest at the end (and halfway for 8/12 weeks). Missed days just shift the end date.
- **Pocket mode:** each session is mixed into one audio track (voice + upbeat generated
  music), so it keeps playing with the screen locked. Lock-screen / AirPods controls work.
- **Baseline test:** tap your earbuds once when you release the hold to record the time, or
  enter the last number you heard.

## Install on iPhone

1. Open the GitHub Pages URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open Altitude from your home screen.

## Project layout

| Path | What it is |
| --- | --- |
| `js/program.js` | Progression rules (session kinds, hold targets, rounds, recovery) |
| `js/script.js` | Builds each session's timeline: voice cues, visual phases, music energy |
| `js/audio.js` | Synthesizes the music and mixes music + voice into one WAV |
| `js/app.js` | UI, storage (localStorage), player, progress |
| `js/art.js` | Illustrations (Sunny the mascot, scenery) and icons |
| `fonts/` | Nunito (bundled for offline use, SIL Open Font License) |
| `audio/voice/` | Pre-generated voice cues (Kokoro TTS, voice `af_heart`) |
| `tools/gen_voice.py` | Regenerates the voice cues |
| `icons/logo.svg` | App icon source (ribbon "A" peak + sun/breath orb) |
| `tools/render_icons.mjs` | Renders the icon PNGs from `logo.svg` |

No build step: it's static files. To run locally: `python3 -m http.server` and open
`http://localhost:8000`.

## Safety

Never practice breath holds in or near water, while driving, or anywhere fainting would be
dangerous. Stop and breathe if you feel dizzy or unwell. Check with a doctor first if you
are pregnant or have heart, lung, blood-pressure, seizure or panic conditions.
