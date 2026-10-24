# Humaneness Labs

Public website for [Humaneness Labs](https://humaneness-labs.github.io/).

The site is a lightweight static build with no framework or runtime dependencies. GitHub Pages publishes the contents of [`docs/`](docs/) from the `main` branch.

## Local preview

From the repository root:

```sh
cd docs
python3 -m http.server 4173
```

Then open <http://127.0.0.1:4173/>.

## Research journal

The journal lives at `docs/blog/index.html`, with standalone release pages in
`docs/blog/`. These pages use the shared site fonts plus
`docs/assets/css/blog.css`; no build step or third-party embed is required.

| Release | Page | Status |
| --- | --- | --- |
| 01 · Humaneness Labs + Humaneness Ears | `docs/blog/introducing-humaneness-labs/` | Published |
| 02 · Humaneness PerformanceNet | `docs/blog/humaneness-performancenet/` | Hidden |
| 03 · Humaneness Voice Large 1.3 Alpha | `docs/blog/humaneness-voice-large-1-3-alpha/` | Hidden |

Hidden releases are unlisted: no public page links to them, and they carry
`<meta name="robots" content="noindex">`. To publish one, add its card to
`docs/blog/index.html` (and the homepage if wanted), remove the `noindex` line,
and update its date, which still reads 23 October 2026.

### Release 01: Humaneness Labs and Humaneness Ears

`docs/assets/css/ears.css` and `docs/assets/js/ears.js` drive the hero ring,
the scroll-through forward pass and the explorer of all 192 outputs.
`docs/assets/js/ears-data.js` is generated from the
[model card](https://huggingface.co/laion/humaneness-ears-base-medium) and
LAION's EmoNet/VoiceNet taxonomies: every output's exact key, readable name,
family and held-out Pearson r for Base and Medium, plus the 53 burst classes.
Regenerate it if the card changes:

```sh
python3 tools/extract_ears_outputs.py docs/assets/js/ears-data.js
```

The ring on the homepage release card is a static SVG built from the same data
(one tick per output, length from Medium's r).

### PerformanceNet release

`docs/assets/css/performancenet.css` and `docs/assets/js/performancenet.js` turn
the scene study into a sticky board that changes state as each step card
scrolls past (character, intention, beats, vocabulary, evidence). The library
section draws one mark per field or cell of each reference system, so the
portraits match the published counts. Without JavaScript the steps read as
plain cards; with reduced motion the board switches states without animating.

### Voice Large 1.3 Alpha release

The release page is a scroll story built from three scripts:

- `docs/assets/js/voice-clips.js` — generated data: a 25 Hz loudness envelope
  and phrase timings for each of the eleven MP3s in
  `docs/assets/audio/voice-large-1-3-alpha/`.
- `docs/assets/js/voice.js` — one shared Web Audio engine (crossfades, ducking,
  sentence-synced language switching) and the waveform players with live
  captions. Also used by the release card on the homepage.
- `docs/assets/js/voice-release.js` — the page itself: the hero voice line, the
  canvas architecture that assembles as you scroll, the language section, the
  listening room and the sound dock.

Sound is opt-in: nothing plays until the reader presses play or turns sound on.
After that, sections can start, duck or crossfade voices as the reader scrolls,
and pausing turns scroll-driven sound off again. Without JavaScript every step,
script and native audio player is still shown; with reduced motion the
architecture settles into five still states.

Phrase timings are aligned to pauses detected in the audio, so captions are
approximate. After changing clips or scene scripts, regenerate the data (needs
`ffmpeg`):

```sh
python3 tools/analyze_voice_clips.py docs docs/assets/js/voice-clips.js
```

### Cache busting

After editing any CSS or JavaScript, refresh the `?v=` content hashes in every
HTML reference so returning visitors receive the updated assets:

```sh
python3 tools/stamp_assets.py
```
