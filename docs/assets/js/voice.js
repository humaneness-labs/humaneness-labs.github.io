/* Humaneness Voice: shared playback engine and waveform players.
   One Web Audio graph per page, so a single tap unlocks crossfades, ducking and
   scroll-triggered playback (iOS included). Visuals read the precomputed
   envelopes and phrase timings in voice-clips.js instead of an analyser. */
(function () {
  "use strict";

  const clipData = window.HumaneVoiceClips || {};
  const script = document.currentScript;
  const audioBase = new URL("../audio/voice-large-1-3-alpha/", script ? script.src : location.href).href;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const supported = Boolean(AudioCtx && window.fetch && window.Promise);

  const LANGUAGES = {
    en: { name: "English", native: "English" },
    de: { name: "German", native: "Deutsch" },
    fr: { name: "French", native: "Français" },
    nl: { name: "Dutch", native: "Nederlands" }
  };

  // Beats follow the scene descriptions; `from` is the first sentence of each beat.
  const SCENES = {
    awe_tenderness: {
      title: "Sunrise above the clouds",
      beats: [
        { from: 0, label: "Breathless awe", color: "#ddb27a" },
        { from: 2, label: "A little vulnerability", color: "#91a8ff" },
        { from: 3, label: "Quiet, shared tenderness", color: "#e4998b" }
      ]
    },
    betrayal_resolve: {
      title: "The name on the project",
      beats: [
        { from: 0, label: "Polite restraint", color: "#a9b2d6" },
        { from: 1, label: "Hurt", color: "#91a8ff" },
        { from: 2, label: "Bitterness", color: "#ff6f91" },
        { from: 3, label: "Self-respecting resolve", color: "#ddb27a" }
      ]
    },
    amusement_embarrassment: {
      title: "The accidental presentation",
      beats: [
        { from: 0, label: "Conversational storytelling", color: "#a9b2d6" },
        { from: 2, label: "Embarrassed laughter", color: "#ff6f91" },
        { from: 4, label: "Affectionate amusement", color: "#ddb27a" }
      ]
    }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function formatTime(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function decodeEnvelope(text) {
    const raw = atob(text);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /* ---------- Clip metadata ---------- */

  const infoCache = new Map();

  function info(id) {
    if (infoCache.has(id)) return infoCache.get(id);
    const data = clipData[id];
    const match = id && id.match(/^(.+)_(en|de|fr|nl)_(reference|prompt_only)$/);
    if (!data || !match) return null;
    const words = [];
    data.phrases.forEach(([t0, t1, text, sentence]) => {
      const tokens = text.split(/\s+/).filter(Boolean);
      const total = tokens.reduce((sum, word) => sum + word.length + 1, 0);
      let acc = 0;
      tokens.forEach((word) => {
        const start = t0 + (t1 - t0) * acc / total;
        acc += word.length + 1;
        words.push({ text: word, t0: start, t1: t0 + (t1 - t0) * acc / total, s: sentence });
      });
    });
    const sentences = [];
    words.forEach((word, index) => {
      const sentence = sentences[word.s] || (sentences[word.s] = { index: word.s, t0: word.t0, from: index });
      sentence.t1 = word.t1;
      sentence.to = index;
    });
    const clip = {
      id,
      scene: match[1],
      sceneInfo: SCENES[match[1]],
      lang: match[2],
      language: LANGUAGES[match[2]],
      mode: match[3] === "reference" ? "reference" : "prompt",
      duration: data.duration,
      rate: data.envRate,
      env: decodeEnvelope(data.env),
      words,
      sentences,
      src: audioBase + id + ".mp3"
    };
    infoCache.set(id, clip);
    return clip;
  }

  function level(id, t) {
    const clip = info(id);
    if (!clip || t < 0 || t > clip.duration) return 0;
    const x = t * clip.rate;
    const i = Math.floor(x);
    const a = clip.env[i] || 0;
    const b = clip.env[i + 1] || 0;
    return (a + (b - a) * (x - i)) / 255;
  }

  function wordIndexAt(id, t) {
    const words = info(id).words;
    let lo = 0;
    let hi = words.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].t0 <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
  }

  function sentenceAt(id, t) {
    const index = wordIndexAt(id, t + .05);
    return index < 0 ? 0 : info(id).words[index].s;
  }

  function sentenceStart(id, sentence) {
    const clip = info(id);
    const target = clip.sentences[clamp(sentence, 0, clip.sentences.length - 1)];
    return Math.max(0, target.t0 - .12);
  }

  function beatFor(id, sentence) {
    const beats = info(id).sceneInfo.beats;
    let beat = beats[0];
    beats.forEach((candidate) => { if (candidate.from <= sentence) beat = candidate; });
    return beat;
  }

  const colorAt = (id, t) => beatFor(id, sentenceAt(id, t)).color;

  /* ---------- Playback engine ---------- */

  const DUCK_LEVEL = .3;
  let context = null;
  let master = null;
  let voice = null;
  let playToken = 0;
  let soundOn = false;
  const buffers = new Map();
  const listeners = new Set();
  const frameListeners = new Set();
  const state = { id: null, playing: false, loading: false, offset: 0, owner: null, error: null };

  function ensureContext() {
    if (!context && supported) {
      context = new AudioCtx();
      master = context.createGain();
      master.connect(context.destination);
      // Let Safari play Web Audio while the ring/silent switch is on.
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (error) { /* optional */ }
    }
    return context;
  }

  function unlock() {
    if (ensureContext() && context.state !== "running") context.resume();
  }

  function load(id) {
    if (!buffers.has(id)) {
      ensureContext();
      const promise = fetch(info(id).src)
        .then((response) => {
          if (!response.ok) throw new Error("Audio request failed");
          return response.arrayBuffer();
        })
        .then((bytes) => new Promise((resolve, reject) => context.decodeAudioData(bytes, resolve, reject)));
      promise.catch(() => buffers.delete(id));
      buffers.set(id, promise);
    }
    return buffers.get(id);
  }

  function time() {
    if (!state.id) return 0;
    if (state.playing && voice) return Math.min(info(state.id).duration, voice.offset + context.currentTime - voice.startedAt);
    return state.offset;
  }

  // One failing component must not stall playback visuals for the rest of the page.
  function notify(set, ...args) {
    set.forEach((fn) => {
      try { fn(...args); } catch (error) { setTimeout(() => { throw error; }); }
    });
  }

  function emit() {
    notify(listeners, state, soundOn);
    requestFrame();
  }

  let frameId = 0;
  function frame() {
    frameId = 0;
    notify(frameListeners, time(), state);
    if (state.playing || state.loading) frameId = requestAnimationFrame(frame);
  }
  function requestFrame() { if (!frameId) frameId = requestAnimationFrame(frame); }

  function fadeOut(target, seconds) {
    if (!target) return;
    const now = context.currentTime;
    target.gain.gain.cancelScheduledValues(now);
    target.gain.gain.setValueAtTime(target.gain.gain.value, now);
    target.gain.gain.linearRampToValueAtTime(0, now + seconds);
    try { target.source.stop(now + seconds + .02); } catch (error) { /* already stopped */ }
  }

  async function play(id, options = {}) {
    if (!supported || !info(id)) return;
    unlock();
    const token = ++playToken;
    const at = options.at != null ? options.at : (state.id === id && !state.playing ? state.offset : 0);
    Object.assign(state, { loading: true, error: null });
    soundOn = true;
    emit();
    let buffer;
    try {
      buffer = await load(id);
    } catch (error) {
      if (token === playToken) Object.assign(state, { loading: false, error: id });
      emit();
      return;
    }
    if (token !== playToken) return;
    const fade = options.fade != null ? options.fade : .45;
    fadeOut(voice, fade);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + Math.max(.02, fade));
    source.connect(gain);
    gain.connect(master);
    const offset = clamp(at, 0, Math.max(0, buffer.duration - .1));
    source.start(0, offset);
    voice = { id, source, gain, startedAt: context.currentTime, offset };
    source.onended = () => {
      if (!voice || voice.source !== source) return;
      voice = null;
      Object.assign(state, { playing: false, offset: 0 });
      emit();
    };
    Object.assign(state, { id, playing: true, loading: false, offset, owner: options.owner || null });
    emit();
  }

  function pause(options = {}) {
    playToken++;
    if (state.playing) {
      state.offset = time();
      fadeOut(voice, .12);
      voice = null;
    }
    state.playing = false;
    state.loading = false;
    if (options.user) soundOn = false;
    emit();
  }

  function cue(id, at) {
    if (state.playing) return;
    Object.assign(state, { id, offset: at || 0 });
    emit();
  }

  function seek(t) {
    if (state.playing) play(state.id, { at: t, fade: .06, owner: state.owner });
    else { state.offset = clamp(t, 0, info(state.id).duration); emit(); }
  }

  function toggle(id, options = {}) {
    if (state.id === id && (state.playing || state.loading)) pause({ user: true });
    else play(id, options);
  }

  function setDuck(on) {
    if (!master) return;
    master.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, context.currentTime, .4);
  }

  function setSound(on) {
    soundOn = on;
    if (!on) pause();
    else emit();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.playing) pause();
  });

  // Glows and accents across the page follow the emotional beat being spoken.
  let lastBeat = "";
  frameListeners.add((t) => {
    if (!state.playing) return;
    const color = colorAt(state.id, t);
    if (color === lastBeat) return;
    lastBeat = color;
    document.documentElement.style.setProperty("--beat-color", color);
  });

  /* ---------- Drawing helpers ---------- */

  function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function fitCanvas(canvas) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  const peakCache = new Map();
  function peaks(id, count) {
    const key = id + ":" + count;
    if (peakCache.has(key)) return peakCache.get(key);
    const clip = info(id);
    const result = [];
    for (let i = 0; i < count; i++) {
      const from = Math.floor(i / count * clip.env.length);
      const to = Math.max(from + 1, Math.floor((i + 1) / count * clip.env.length));
      let max = 0;
      for (let j = from; j < to; j++) max = Math.max(max, clip.env[j]);
      result.push(max / 255);
    }
    peakCache.set(key, result);
    return result;
  }

  function roundBar(ctx, x, y, w, h) {
    const r = Math.min(w / 2, h / 2);
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h);
  }

  /* Static overview waveform with played / unplayed states, coloured by beat. */
  function drawOverview(canvas, id, options = {}) {
    const { ctx, width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const clip = info(id);
    if (!clip || !width) return;
    const pitch = options.pitch || 4;
    const barWidth = options.bar || 2;
    const count = Math.max(8, Math.floor(width / pitch));
    const values = peaks(id, count);
    const progress = options.progress != null ? options.progress : -1;
    const scrub = options.scrub != null ? options.scrub : -1;
    const live = options.live || 0;
    const mid = height / 2;
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count * clip.duration;
      const color = colorAt(id, t);
      const played = progress >= 0 && t <= progress;
      const near = progress >= 0 ? Math.max(0, 1 - Math.abs(t - progress) / .5) : 0;
      const amp = Math.max(.04, values[i]) * (1 + near * live * .35);
      const h = Math.max(2, Math.min(height, amp * height * .94));
      ctx.fillStyle = rgba(color, played ? .95 : (scrub >= 0 && t <= scrub ? .6 : .3));
      roundBar(ctx, i * pitch + (pitch - barWidth) / 2, mid - h / 2, barWidth, h);
    }
    if (progress > 0) {
      const x = progress / clip.duration * width;
      ctx.fillStyle = "rgba(234,230,223,.9)";
      ctx.fillRect(Math.round(x), 0, 1, height);
    }
  }

  /* ---------- Captions ---------- */

  function renderCaption(element, id, t, active) {
    const clip = info(id);
    if (!clip) return;
    const sentence = sentenceAt(id, t);
    const key = id + ":" + sentence;
    if (element.dataset.key !== key || !element.words) {
      element.dataset.key = key;
      element.lang = clip.lang;
      element.textContent = "";
      const bounds = clip.sentences[sentence];
      element.words = [];
      for (let i = bounds.from; i <= bounds.to; i++) {
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = clip.words[i].text;
        element.append(span, " ");
        element.words.push(span);
      }
      element.saidUpTo = -2;
      element.style.setProperty("--beat", beatFor(id, sentence).color);
    }
    const bounds = clip.sentences[sentence];
    const said = active || t > 0 ? wordIndexAt(id, t) - bounds.from : -1;
    if (said === element.saidUpTo) return;
    element.saidUpTo = said;
    element.words.forEach((span, i) => {
      span.classList.toggle("is-said", i < said || (i === said && !state.playing));
      span.classList.toggle("is-now", i === said && state.playing);
    });
  }

  /* ---------- Player component ---------- */

  class VoicePlayer {
    constructor(root) {
      this.root = root;
      this.variants = [...root.querySelectorAll("[data-variant]")];
      this.id = root.dataset.clip || (this.variants[0] && this.variants[0].dataset.variant);
      this.toggleButton = root.querySelector("[data-toggle]");
      this.wave = root.querySelector("[data-wave]");
      this.canvas = this.wave.querySelector("canvas");
      this.timeLabel = root.querySelector("[data-time]");
      this.caption = root.querySelector("[data-caption]");
      this.beatRow = root.querySelector("[data-beats]");
      this.scrub = -1;
      this.lastDraw = "";

      root.querySelectorAll("[data-enhanced]").forEach((element) => { element.hidden = false; });
      root.querySelectorAll("[data-fallback]").forEach((element) => { element.hidden = true; });
      root.classList.add("is-enhanced");

      this.toggleButton.addEventListener("click", () => this.toggle());
      this.toggleButton.addEventListener("pointerenter", () => this.prime(), { once: true });
      this.variants.forEach((button) => button.addEventListener("click", () => this.select(button.dataset.variant)));
      this.bindWave();

      listeners.add(() => this.sync());
      frameListeners.add((t) => this.render(t));
      new ResizeObserver(() => {
        this.lastDraw = "";
        // Keep the beat timeline under the waveform, whatever the button and time label widths.
        if (this.beatRow) {
          this.root.style.setProperty("--wave-left", this.wave.offsetLeft + "px");
          this.root.style.setProperty("--wave-width", this.wave.offsetWidth + "px");
        }
        this.render(this.time());
      }).observe(this.wave);
      this.select(this.id, { silent: true });
    }

    prime() {
      if (!supported) return;
      try { load(this.id); } catch (error) { /* fetched again on play */ }
    }

    active() { return state.id === this.id; }
    time() { return this.active() ? time() : 0; }

    toggle() { toggle(this.id, { owner: this }); }

    select(id, options = {}) {
      const previous = this.id;
      const wasActive = state.id === previous;
      const t = wasActive ? time() : 0;
      this.id = id;
      this.variants.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.variant === id)));
      if (!options.silent && wasActive && previous !== id) {
        const at = t > 0 ? sentenceStart(id, sentenceAt(previous, t)) : 0;
        if (state.playing || state.loading) play(id, { at, fade: .6, owner: this });
        else cue(id, at);
      }
      const clip = info(id);
      this.toggleButton.setAttribute("aria-label", `Play ${clip.sceneInfo.title} in ${clip.language.name}`);
      if (this.beatRow) this.renderBeats();
      this.root.dispatchEvent(new CustomEvent("voice:select", { detail: clip }));
      this.lastDraw = "";
      this.sync();
    }

    renderBeats() {
      const clip = info(this.id);
      const beats = clip.sceneInfo.beats;
      const startOf = (beat, i) => (i === 0 ? 0 : clip.sentences[Math.min(beat.from, clip.sentences.length - 1)].t0);
      this.beatRow.textContent = "";
      beats.forEach((beat, i) => {
        const start = startOf(beat, i);
        const end = i + 1 < beats.length ? startOf(beats[i + 1], i + 1) : clip.duration;
        const item = document.createElement("span");
        item.className = "vplayer__beat";
        item.style.setProperty("--x", (start / clip.duration * 100).toFixed(2) + "%");
        item.style.setProperty("--w", ((end - start) / clip.duration * 100).toFixed(2) + "%");
        item.style.setProperty("--beat", beat.color);
        item.textContent = beat.label;
        item.title = beat.label;
        this.beatRow.append(item);
      });
    }

    bindWave() {
      const toTime = (event) => {
        const rect = this.wave.getBoundingClientRect();
        return clamp((event.clientX - rect.left) / rect.width, 0, 1) * info(this.id).duration;
      };
      this.wave.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        this.wave.setPointerCapture(event.pointerId);
        this.scrub = toTime(event);
        this.render(this.time());
      });
      this.wave.addEventListener("pointermove", (event) => {
        if (this.scrub < 0) return;
        this.scrub = toTime(event);
        this.render(this.time());
      });
      const finish = (event) => {
        if (this.scrub < 0) return;
        const t = toTime(event);
        this.scrub = -1;
        this.seekTo(t);
      };
      this.wave.addEventListener("pointerup", finish);
      this.wave.addEventListener("pointercancel", () => { this.scrub = -1; this.render(this.time()); });
      this.wave.addEventListener("keydown", (event) => {
        const duration = info(this.id).duration;
        const now = this.time();
        const map = { ArrowLeft: now - 5, ArrowDown: now - 5, ArrowRight: now + 5, ArrowUp: now + 5, Home: 0, End: duration - .5 };
        if (event.key in map) {
          event.preventDefault();
          this.seekTo(clamp(map[event.key], 0, duration));
        } else if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          this.toggle();
        }
      });
    }

    seekTo(t) {
      if (this.active() && state.playing) seek(t);
      else play(this.id, { at: t, owner: this });
    }

    sync() {
      const busy = this.active() && (state.playing || state.loading);
      this.root.classList.toggle("is-playing", this.active() && state.playing);
      this.root.classList.toggle("is-loading", this.active() && state.loading);
      this.root.classList.toggle("has-error", state.error === this.id);
      if (state.error === this.id) this.root.querySelectorAll("[data-fallback]").forEach((element) => { element.hidden = false; });
      this.toggleButton.setAttribute("aria-pressed", String(busy));
      this.render(this.time());
    }

    render(t) {
      const clip = info(this.id);
      const active = this.active();
      const playing = active && state.playing;
      const progress = active && (playing || t > 0) ? t : -1;
      const live = playing ? level(this.id, t) : 0;
      const key = [this.id, progress.toFixed(2), this.scrub.toFixed(2), live.toFixed(2), this.canvas.clientWidth].join("|");
      if (key !== this.lastDraw) {
        this.lastDraw = key;
        drawOverview(this.canvas, this.id, { progress, scrub: this.scrub, live, pitch: +this.wave.dataset.pitch || 4, bar: +this.wave.dataset.bar || 2 });
      }
      const label = progress >= 0 ? `${formatTime(t)} / ${formatTime(clip.duration)}` : formatTime(clip.duration);
      if (this.timeLabel.textContent !== label) this.timeLabel.textContent = label;
      this.wave.setAttribute("aria-valuemax", String(Math.round(clip.duration)));
      this.wave.setAttribute("aria-valuenow", String(Math.round(Math.max(0, progress))));
      this.wave.setAttribute("aria-valuetext", `${formatTime(Math.max(0, progress))} of ${formatTime(clip.duration)}`);
      if (this.caption) renderCaption(this.caption, this.id, Math.max(0, progress), playing);
    }
  }

  function enhancePlayers(scope) {
    if (!supported) return [];
    return [...(scope || document).querySelectorAll("[data-voice-player]")].map((root) => {
      if (!root.voicePlayer) root.voicePlayer = new VoicePlayer(root);
      return root.voicePlayer;
    });
  }

  window.HumaneVoice = {
    supported,
    LANGUAGES,
    SCENES,
    info,
    level,
    sentenceAt,
    sentenceStart,
    wordIndexAt,
    beatFor,
    colorAt,
    formatTime,
    state,
    time,
    load,
    unlock,
    play,
    pause,
    cue,
    seek,
    toggle,
    setDuck,
    setSound,
    get soundOn() { return soundOn; },
    onChange(fn) { listeners.add(fn); },
    onFrame(fn) { frameListeners.add(fn); },
    drawOverview,
    renderCaption,
    fitCanvas,
    rgba,
    enhancePlayers,
    VoicePlayer
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhancePlayers());
  else enhancePlayers();
}());
