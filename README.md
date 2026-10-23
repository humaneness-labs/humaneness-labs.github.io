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
`docs/blog/humaneness-performancenet/` and
`docs/blog/humaneness-voice-large-1-3-alpha/`. These pages use the shared site
fonts plus `docs/assets/css/blog.css` and `docs/assets/js/blog.js`; no build step
or third-party embed is required.

The walkthroughs show all steps when JavaScript is unavailable. With JavaScript,
readers can select a step or start a timed walkthrough; animations respect the
reduced-motion preference. Audio uses native players, loads on demand, and plays
one example at a time. The nine distinct supplied MP3s are hosted under
`docs/assets/audio/voice-large-1-3-alpha/` (the duplicate Dutch attachment is
included once). Waveform illustrations use amplitude samples from those files.

When editing shared CSS or JavaScript, update the `?v=` content hashes in HTML
references so returning visitors receive the updated assets.
