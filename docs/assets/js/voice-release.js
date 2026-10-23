/* Release page: hero voice, scroll-driven architecture, language crossfades,
   listening room and the sound dock. Visuals work without audio support and
   settle into discrete states when reduced motion is requested. */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const V = window.HumaneVoice;
  const supported = Boolean(V && V.supported);
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const HERO = "awe_tenderness_en_reference";
  const SUNRISE = ["awe_tenderness_en_reference", "awe_tenderness_de_reference", "awe_tenderness_fr_reference", "awe_tenderness_es_reference", "awe_tenderness_nl_prompt_only"];
  const MONO = '"Spline Sans Mono", ui-monospace, monospace';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOutBack = (t) => 1 + 2.6 * Math.pow(t - 1, 3) + 1.6 * Math.pow(t - 1, 2);
  function hash(a, b) {
    let h = Math.imul(a + 11, 374761393) ^ Math.imul(b + 7, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const rgbCache = new Map();
  function toRgb(hex) {
    let value = rgbCache.get(hex);
    if (!value) {
      const n = parseInt(hex.slice(1), 16);
      value = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, value);
    }
    return value;
  }
  const css = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha, 0, 1).toFixed(3)})`;
  const C = {
    bone: toRgb("#eae6df"), mute: toRgb("#9b9baa"), amber: toRgb("#ddb27a"), rose: toRgb("#e4998b"),
    pink: toRgb("#ff6f91"), violet: toRgb("#b4a6ff"), blue: toRgb("#91a8ff")
  };
  const STOPS = [C.amber, C.rose, C.pink, C.violet, C.blue];
  function ramp(t) {
    const x = clamp(t, 0, 1) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(x));
    return STOPS[i].map((channel, k) => Math.round(channel + (STOPS[i + 1][k] - channel) * (x - i)));
  }
  const CODE_COLORS = Array.from({ length: 12 }, (_, row) => ramp(row / 11));

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

  function roundedPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (w <= 0 || h <= 0) return;
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else ctx.rect(x, y, w, h);
  }

  function diamond(ctx, x, y, a, b) {
    ctx.beginPath();
    ctx.moveTo(x - a, y);
    ctx.lineTo(x, y - b);
    ctx.lineTo(x + a, y);
    ctx.lineTo(x, y + b);
    ctx.closePath();
  }

  function glowDot(ctx, x, y, r, rgb, alpha) {
    if (alpha <= .01) return;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    glow.addColorStop(0, css(rgb, .4 * alpha));
    glow.addColorStop(1, css(rgb, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = css(rgb, alpha);
    ctx.fill();
  }

  function text(ctx, value, x, y, options) {
    ctx.font = `${options.size}px ${MONO}`;
    ctx.textAlign = options.align || "center";
    ctx.textBaseline = options.baseline || "middle";
    ctx.fillStyle = css(options.color || C.mute, options.alpha);
    ctx.fillText(value, x, y);
  }

  /* ---------- Reveal and counters ---------- */

  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (reducedQuery.matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    items.forEach((item) => observer.observe(item));
  }

  function initCounters() {
    if (reducedQuery.matches || !("IntersectionObserver" in window)) return;
    document.querySelectorAll("[data-count]").forEach((element) => {
      const target = parseFloat(element.dataset.count);
      const decimals = Number(element.dataset.decimals || 0);
      const suffix = element.dataset.suffix || "";
      const format = (value) => value.toFixed(decimals) + suffix;
      element.textContent = format(0);
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now) => {
          const t = clamp((now - start) / 1500, 0, 1);
          element.textContent = format(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: .6 });
      observer.observe(element);
    });
  }

  /* ---------- Hero: a breathing line that becomes the voice ---------- */

  class Hero {
    constructor(section) {
      this.canvas = section.querySelector("[data-hero-wave]");
      this.button = section.querySelector("[data-hero-toggle]");
      this.title = section.querySelector("[data-hero-title]");
      this.sub = section.querySelector("[data-hero-sub]");
      this.caption = section.querySelector("[data-hero-caption]");
      this.mix = 0;
      this.visible = true;
      this.frame = 0;
      if (supported) {
        this.button.hidden = false;
        section.querySelector("[data-hero-fallback]").hidden = true;
        this.button.addEventListener("click", () => this.toggle());
        this.button.addEventListener("pointerenter", () => V.load(HERO).catch(() => {}), { once: true });
        V.onChange(() => this.sync());
        V.onFrame(() => {
          this.renderCaption();
          if (reducedQuery.matches) this.kick();
        });
        this.sync();
      }
      new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.kick(); }).observe(section);
      new ResizeObserver(() => this.kick()).observe(this.canvas);
    }

    toggle() {
      if (V.state.playing || V.state.loading) V.pause({ user: true });
      else V.play(HERO, { owner: "hero", at: V.state.id === HERO ? V.state.offset : 0 });
    }

    sync() {
      const state = V.state;
      const busy = state.playing || state.loading;
      this.button.setAttribute("aria-pressed", String(busy));
      if (state.loading) {
        this.title.textContent = "Loading the voice…";
      } else if (busy) {
        const clip = V.info(state.id);
        this.title.textContent = "Pause";
        this.sub.textContent = `${clip.language.native} · scroll on, the voice follows`;
      } else {
        this.title.textContent = state.id === HERO && state.offset > 0 ? "Resume" : "Hear it first";
        this.sub.textContent = "35 sec · English · headphones on";
      }
      this.renderCaption();
      this.kick();
    }

    renderCaption() {
      V.renderCaption(this.caption, V.state.id || HERO, V.time(), V.state.playing);
    }

    kick() {
      if (!this.frame && this.visible) this.frame = requestAnimationFrame((now) => this.draw(now));
    }

    draw(now) {
      this.frame = 0;
      const state = V ? V.state : { playing: false, id: null };
      const id = state.id || HERO;
      if (reducedQuery.matches && V) {
        V.drawOverview(this.canvas, id, { progress: state.id ? V.time() : -1, pitch: 6, bar: 3 });
        return;
      }
      const { ctx, width, height } = fitCanvas(this.canvas);
      ctx.clearRect(0, 0, width, height);
      const playing = supported && state.playing;
      this.mix += ((playing ? 1 : 0) - this.mix) * .07;
      const t = V ? V.time() : 0;
      const duration = V ? V.info(id).duration : 0;
      const pitch = width < 640 ? 5 : 6;
      const bar = Math.max(2, pitch * .45);
      const pps = width < 640 ? 64 : 92;
      const center = width * .5;
      const mid = height * .5;
      for (let x = pitch / 2; x < width; x += pitch) {
        const dt = (x - center) / pps;
        const tb = t + dt;
        const idle = (.17 + .1 * Math.sin(x * .011 + now * .0012) + .06 * Math.sin(x * .029 - now * .0019) + .04 * Math.sin(x * .07 + now * .003)) * (.8 + .2 * Math.sin(now * .0007));
        const real = V ? V.level(id, tb) : 0;
        const amp = idle * (1 - this.mix) + real * this.mix;
        const h = Math.max(2, amp * height * .9);
        const edge = smooth(0, .1, x / width) * smooth(0, .1, (width - x) / width);
        const live = this.mix > .02 && tb >= 0 && tb <= duration;
        const rgb = live ? toRgb(V.colorAt(id, tb)) : ramp(x / width * .9);
        const alpha = (dt <= 0 ? .9 : .9 - .62 * this.mix) * edge;
        ctx.fillStyle = css(rgb, alpha);
        roundedPath(ctx, x - bar / 2, mid - h / 2, bar, h, bar / 2);
        ctx.fill();
      }
      if (this.mix > .05) {
        ctx.fillStyle = css(C.bone, .75 * this.mix);
        ctx.fillRect(center - .5, height * .06, 1, height * .88);
        glowDot(ctx, center, height * .06, 3, C.bone, this.mix);
      }
      this.kick();
    }
  }

  /* ---------- Architecture: one canvas, a camera that pans through five stages ---------- */

  const TOKENS = [
    { text: "Wait.", row: 0, color: C.bone },
    { text: "Look", row: 0, color: C.bone },
    { text: "at", row: 0, color: C.bone },
    { text: "the", row: 0, color: C.bone },
    { text: "sky.", row: 0, color: C.bone },
    { text: "breathless awe", row: 1, color: C.amber },
    { text: "then, quiet tenderness", row: 1, color: C.rose },
    { text: "speaker", row: 2, color: C.blue, wave: true }
  ];
  const ROW_LABELS = ["TEXT", "PERFORMANCE DIRECTION", "VOICE REFERENCE · OPTIONAL"];

  // Each stage has finished its own animation here, just before the camera moves on.
  const SETTLE = [0, 1.22, 2.22, 3.22, 4];

  function camera(S) {
    const s = clamp(S, 0, 4);
    const k = Math.min(3, Math.floor(s));
    return k + smooth(k + .22, k + .78, s);
  }

  class Architecture {
    constructor(track) {
      this.track = track;
      this.stage = track.querySelector(".vr-arch__stage");
      this.canvas = track.querySelector("[data-arch-canvas]");
      this.steps = track.querySelector(".vr-arch__steps");
      this.cards = [...track.querySelectorAll(".vr-step")];
      this.rail = [...track.querySelectorAll("[data-rail]")];
      this.fill = track.querySelector("[data-arch-fill]");
      this.hud = track.querySelector("[data-arch-hud]");
      this.playButton = track.querySelector("[data-arch-play]");
      this.caption = track.querySelector("[data-arch-caption]");
      this.S = 0;
      this.view = 0;
      this.visible = false;
      this.frame = 0;
      this.last = 0;
      this.current = -1;
      this.hudText = "";
      this.tokens = null;
      track.archStage = this;
      new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.kick(); }, { rootMargin: "120px 0px" }).observe(track);
      new ResizeObserver(() => { this.layout(); this.kick(); }).observe(this.stage);
      if (document.fonts) document.fonts.ready.then(() => { this.tokens = null; this.kick(); });
      if (supported) {
        this.playButton.hidden = false;
        this.playButton.addEventListener("click", () => this.togglePlay());
        V.onChange(() => this.syncButton());
        V.onFrame((t) => this.onAudioFrame(t));
      }
      this.layout();
      this.update();
    }

    layout() {
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      if (!w || !h) return;
      this.wide = w >= 900;
      const top = 70;
      if (this.wide) {
        const card = this.cards[0].querySelector(".vr-step__card");
        const x = Math.min(card.getBoundingClientRect().right + 36, w * .5);
        this.box = { x, y: top + 10, w: w - x - Math.max(24, w * .03), h: h - top - 90 };
      } else {
        this.box = { x: 16, y: top, w: w - 32, h: Math.max(180, h * .46 - top) };
      }
      this.size = Math.min(this.box.w / 1.45, this.box.h);
      this.spacing = this.box.w * .64;
      this.tokens = null;
    }

    progress() {
      const ref = innerHeight * (this.wide ? .5 : .74);
      const top = this.steps.getBoundingClientRect().top;
      // offsetTop is relative to the positioned steps container and ignores the card's transform.
      const centers = this.cards.map((step) => {
        const card = step.querySelector(".vr-step__card");
        return top + card.offsetTop + card.offsetHeight / 2;
      });
      const n = centers.length - 1;
      if (ref <= centers[0]) return Math.max(-1, (ref - centers[0]) / innerHeight);
      for (let k = 0; k < n; k++) if (ref < centers[k + 1]) return k + (ref - centers[k]) / (centers[k + 1] - centers[k]);
      return Math.min(n + .7, n + (ref - centers[n]) / innerHeight);
    }

    update() {
      this.S = this.progress();
      const stage = clamp(Math.round(this.S), 0, 4);
      if (stage !== this.current) {
        this.current = stage;
        this.cards.forEach((card, i) => card.classList.toggle("is-current", i === stage));
        this.rail.forEach((link, i) => {
          link.classList.toggle("is-active", i === stage);
          if (i === stage) link.setAttribute("aria-current", "step");
          else link.removeAttribute("aria-current");
        });
      }
      this.fill.style.setProperty("--p", clamp(this.S / 4, 0, 1).toFixed(4));
      this.kick();
    }

    kick() {
      if (!this.frame && this.visible) this.frame = requestAnimationFrame((now) => this.tick(now));
    }

    tick(now) {
      this.frame = 0;
      const dt = Math.min(250, now - (this.last || now));
      this.last = now;
      const reduced = reducedQuery.matches;
      const target = reduced ? SETTLE[clamp(Math.round(this.S), 0, 4)] : this.S;
      this.view = reduced ? target : this.view + (target - this.view) * (1 - Math.exp(-dt / 110));
      this.draw(reduced ? 0 : now / 1000);
      if (!reduced) this.kick();
    }

    togglePlay() {
      if (V.state.playing || V.state.loading) V.pause({ user: true });
      else V.play(HERO, { at: 0, owner: "arch" });
    }

    syncButton() {
      const busy = V.state.playing || V.state.loading;
      this.playButton.setAttribute("aria-pressed", String(busy));
      this.playButton.textContent = busy ? "❚❚ Pause the voice" : "▶ Hear the output";
      if (!V.state.playing) this.caption.textContent = "";
      this.kick();
    }

    onAudioFrame(t) {
      if (this.current >= 4 && V.state.playing) V.renderCaption(this.caption, V.state.id, t, true);
      if (reducedQuery.matches) this.kick();
    }

    towerGeom() {
      const a = this.size * .36;
      return { a, b: a * .42, gap: Math.min(9, this.size * .58 / 36) };
    }
    plateY(i, cy, geo) { return cy + 17.5 * geo.gap - i * geo.gap; }
    dotX(j, x1, geo) { return x1 + lerp(-geo.a * .7, geo.a * .7, j / (TOKENS.length - 1)); }
    cellGeom() { const h = clamp(this.size * .06, 13, 24); return { h, w: h * 2.4, gap: h * .3 }; }
    gridGeom(g) {
      const cs = clamp(this.size * .042, 7, 15);
      const gap = Math.max(2, cs * .25);
      const pitch = cs + gap;
      const cols = Math.max(10, Math.min(28, Math.floor(this.box.w * .74 / pitch)));
      const x3 = g.X(3);
      return { cs, gap, pitch, cols, x3, x: x3 - cols * pitch / 2, y: g.cy - 6 * pitch };
    }

    layoutTokens(ctx) {
      let fs = clamp(this.size * .046, 11, 15);
      const measure = () => {
        ctx.font = `${fs}px ${MONO}`;
        const pad = fs * .85;
        return TOKENS.map((token) => {
          const textWidth = ctx.measureText(token.text).width;
          return { textWidth, w: textWidth + pad * 2 + (token.wave ? fs * 2.4 : 0) };
        });
      };
      let sizes = measure();
      const rowWidth = (r) => TOKENS.reduce((sum, token, j) => sum + (token.row === r ? sizes[j].w + fs * .6 : 0), 0);
      const widest = Math.max(rowWidth(0), rowWidth(1), rowWidth(2));
      if (widest > this.box.w * .94) {
        fs = Math.max(9, fs * this.box.w * .94 / widest);
        sizes = measure();
      }
      const gap = fs * .6;
      const rowY = [-.27, 0, .27].map((v) => v * this.size * 1.05);
      const layout = [];
      [0, 1, 2].forEach((r) => {
        const members = TOKENS.map((token, j) => j).filter((j) => TOKENS[j].row === r);
        const total = members.reduce((sum, j) => sum + sizes[j].w, 0) + gap * (members.length - 1);
        let x = -total / 2;
        members.forEach((j) => {
          layout[j] = { dx: x + sizes[j].w / 2, dy: rowY[r], w: sizes[j].w, h: fs * 2.2, textWidth: sizes[j].textWidth };
          x += sizes[j].w + gap;
        });
      });
      this.tokens = { layout, fs, rowY };
    }

    draw(t) {
      const { ctx, width, height } = fitCanvas(this.canvas);
      ctx.clearRect(0, 0, width, height);
      if (!this.box) this.layout();
      if (!this.box) return;
      const S = this.view;
      const box = this.box;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const cam = this.spacing * camera(S);
      const g = {
        ctx, S, t, cx, cy, width, height, size: this.size, box,
        X: (k, dx = 0) => cx + k * this.spacing + dx - cam,
        fade: (x) => 1 - smooth(box.w * .4, box.w * .82, Math.abs(x - cx))
      };
      this.drawBackdrop(g, cam);
      this.drawTower(g);
      this.drawInputs(g);
      this.drawTalker(g);
      this.drawFrames(g);
      this.drawSpeech(g);
      this.updateHud(S);
    }

    drawBackdrop({ ctx, width, height }, cam) {
      const step = 28;
      const offset = -(cam * .25) % step;
      ctx.fillStyle = "rgba(234,230,223,.05)";
      for (let x = offset; x < width; x += step) {
        for (let y = 14; y < height; y += step) ctx.fillRect(x, y, 1.2, 1.2);
      }
    }

    drawInputs(g) {
      const { ctx, S, t, cy, X, fade } = g;
      if (S > 1.3) return;
      if (!this.tokens) this.layoutTokens(ctx);
      const { layout, fs, rowY } = this.tokens;
      const geo = this.towerGeom();
      const x0 = X(0);
      const x1 = X(1);
      const groupAlpha = fade(x0);
      const labelAlpha = groupAlpha * (1 - smooth(.05, .35, S)) * smooth(-.8, -.35, S);
      if (labelAlpha > .01) {
        ROW_LABELS.forEach((label, r) => text(ctx, label, x0, cy + rowY[r] - fs * 2.2, { size: Math.max(9, fs * .72), alpha: .9 * labelAlpha }));
      }
      ctx.font = `${fs}px ${MONO}`;
      TOKENS.forEach((token, j) => {
        const L = layout[j];
        const appear = smooth(-.8 + j * .04, -.4 + j * .04, S);
        const m = smooth(.06 + j * .035, .6 + j * .035, S);
        const px = x0 + L.dx;
        const py = cy + L.dy + Math.sin(t * .9 + j * 1.7) * 3 * (1 - m);
        const chipAlpha = appear * (1 - smooth(0, .35, m)) * groupAlpha;
        if (chipAlpha > .01) this.chip(ctx, px, py, L, token, chipAlpha, appear);
        if (m > 0 && m < 1) {
          const tx = this.dotX(j, x1, geo);
          const ty = this.plateY(0, cy, geo);
          const qx = (px + tx) / 2;
          const qy = Math.min(py, ty) - this.size * .22;
          const bx = (1 - m) * (1 - m) * px + 2 * (1 - m) * m * qx + m * m * tx;
          const by = (1 - m) * (1 - m) * py + 2 * (1 - m) * m * qy + m * m * ty;
          glowDot(ctx, bx, by, 3.2, token.color, smooth(.1, .45, m) * Math.max(g.fade(bx), .25));
        }
      });
    }

    chip(ctx, x, y, L, token, alpha, pop) {
      const fs = this.tokens.fs;
      const scale = .85 + .15 * pop;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      roundedPath(ctx, -L.w / 2, -L.h / 2, L.w, L.h, L.h / 2);
      ctx.fillStyle = css(token.color, .08 * alpha);
      ctx.fill();
      ctx.setLineDash(token.wave ? [3, 3] : []);
      ctx.strokeStyle = css(token.color, .55 * alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css(token.color, alpha);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fs}px ${MONO}`;
      if (token.wave) {
        const startX = -L.w / 2 + fs * .85;
        for (let k = 0; k < 6; k++) {
          const bh = (Math.sin(k * 1.9 + 1) * .5 + .6) * L.h * .45;
          ctx.fillRect(startX + k * fs * .3, -bh / 2, 1.6, bh);
        }
        ctx.fillText(token.text, -L.w / 2 + fs * .85 + fs * 2.4 + L.textWidth / 2 - fs * .3, 1);
      } else {
        ctx.fillText(token.text, 0, 1);
      }
      ctx.restore();
    }

    drawTower(g) {
      const { ctx, S, t, cy, X, fade, size } = g;
      if (S < -.3 || S > 2.7) return;
      const geo = this.towerGeom();
      const x1 = X(1);
      const alpha = fade(x1);
      const L = 36 * clamp((S - .8) / .42, 0, 1);
      this.layer = L;
      if (alpha < .01) return;
      for (let i = 0; i < 36; i++) {
        const appear = smooth(.1 + i * .009, .45 + i * .009, S) * alpha;
        if (appear < .01) continue;
        const y = this.plateY(i, cy, geo) + (1 - appear) * 10;
        const lit = i < L;
        const near = Math.max(0, 1 - Math.abs(i + .5 - L) / 2.5);
        const rgb = ramp(.62 + .38 * i / 35);
        diamond(ctx, x1, y, geo.a, geo.b);
        ctx.fillStyle = lit ? css(rgb, (.05 + .2 * near) * appear) : css(C.blue, .015 * appear);
        ctx.fill();
        ctx.strokeStyle = lit ? css(rgb, (.3 + .55 * near) * appear) : css(C.mute, .15 * appear);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const arrived = TOKENS.map((token, j) => smooth(.06 + j * .035, .6 + j * .035, S) >= 1);
      const front = this.plateY(Math.min(L, 35), cy, geo);
      const dotAlpha = alpha * (1 - smooth(1.6, 2.1, S));
      TOKENS.forEach((token, j) => {
        if (!arrived[j]) return;
        const x = this.dotX(j, x1, geo);
        if (L > 0) {
          ctx.strokeStyle = css(token.color, .35 * dotAlpha);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, this.plateY(0, cy, geo));
          ctx.lineTo(x, front);
          ctx.stroke();
        }
        glowDot(ctx, x, front, 3.2, token.color, dotAlpha);
      });
      if (L > .2 && dotAlpha > .01) {
        const bucket = Math.floor(L * 1.4) + Math.floor(t * 1.5);
        for (let k = 0; k < 4; k++) {
          const a = Math.floor(hash(bucket, k) * TOKENS.length);
          const b = (a + 1 + Math.floor(hash(k, bucket) * (TOKENS.length - 1))) % TOKENS.length;
          if (!arrived[a] || !arrived[b]) continue;
          const xa = this.dotX(a, x1, geo);
          const xb = this.dotX(b, x1, geo);
          const pulse = .4 + .6 * Math.abs(Math.sin(t * 2.2 + k));
          ctx.strokeStyle = css(C.violet, .6 * pulse * dotAlpha);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xa, front);
          ctx.quadraticCurveTo((xa + xb) / 2, front - Math.abs(xb - xa) * .45 - 8, xb, front);
          ctx.stroke();
        }
      }
      const labelSize = Math.max(10, size * .03);
      if (L > 0 && S < 1.9) {
        const label = `layer ${Math.max(1, Math.ceil(L))} / 36`;
        ctx.font = `${labelSize}px ${MONO}`;
        // Flip the label to the left of the stack when it would leave the stage.
        const right = x1 + geo.a + 22 + ctx.measureText(label).width < g.box.x + g.box.w;
        ctx.fillStyle = css(C.bone, .5 * alpha);
        ctx.fillRect(right ? x1 + geo.a + 6 : x1 - geo.a - 16, front, 10, 1);
        text(ctx, label, right ? x1 + geo.a + 22 : x1 - geo.a - 22, front, { size: labelSize, align: right ? "left" : "right", color: C.bone, alpha: .85 * alpha });
      }
      text(ctx, "semantic backbone", x1, this.plateY(0, cy, geo) + geo.b + 22, { size: labelSize, alpha: .8 * alpha * smooth(.3, .7, S) });
    }

    drawTalker(g) {
      const { ctx, S, t, cy, X, fade, size } = g;
      if (S < .9 || S > 3.4) return;
      const geo = this.towerGeom();
      const tx = X(2, -size * .22);
      const ty = cy;
      const a2 = size * .16;
      const b2 = a2 * .42;
      const q = smooth(1.25, 1.75, S);
      if (q > 0 && q < 1) {
        const sx = X(1);
        const sy = this.plateY(35, cy, geo) - geo.b * .3;
        const ey = ty - b2;
        const mx = (sx + tx) / 2;
        const my = Math.min(sy, ey) - size * .2;
        ctx.strokeStyle = css(C.pink, .28 * (1 - q * .5));
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, tx, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let k = 7; k >= 0; k--) {
          const e = clamp(q - k * .025, 0, 1);
          const bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * tx;
          const by = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * ey;
          glowDot(ctx, bx, by, 4.5 - k * .45, C.pink, (1 - k / 8) * .9);
        }
      }
      const alpha = fade(tx) * smooth(1.05, 1.5, S);
      if (alpha > .01) {
        const glow = .5 + .5 * Math.sin(t * 2.4);
        for (let k = 2; k >= 0; k--) {
          diamond(ctx, tx, ty + k * 4, a2, b2);
          ctx.fillStyle = css(C.pink, (k === 0 ? .12 + .14 * glow * smooth(1.7, 1.8, S) : .05) * alpha);
          ctx.fill();
          ctx.strokeStyle = css(C.pink, (k === 0 ? .9 : .35) * alpha);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        text(ctx, "local talker", tx, ty + b2 + 26, { size: Math.max(10, size * .03), alpha: .8 * alpha });
      }
      const n = 12 * clamp((S - 1.72) / .5, 0, 1);
      this.codes = n;
      const m = smooth(2.22, 2.78, S);
      if (n <= 0 || m >= 1) return;
      const cell = this.cellGeom();
      const grid = this.gridGeom(g);
      const colX = X(2, size * .2);
      const top = cy - (12 * cell.h + 11 * cell.gap) / 2;
      const labelAlpha = 1 - smooth(0, .4, m);
      if (labelAlpha > .01 && alpha > .01) {
        const ax = colX - cell.w / 2 - 34;
        ctx.strokeStyle = css(C.pink, .6 * alpha * labelAlpha);
        ctx.beginPath();
        ctx.moveTo(tx + a2 + 6, ty);
        ctx.lineTo(ax, ty);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, ty);
        ctx.lineTo(ax - 5, ty - 3);
        ctx.lineTo(ax - 5, ty + 3);
        ctx.closePath();
        ctx.fillStyle = css(C.pink, .6 * alpha * labelAlpha);
        ctx.fill();
      }
      for (let k = 0; k < 12 && k < n; k++) {
        const pop = easeOutBack(clamp(n - k, 0, 1));
        const ax = colX;
        const ay = top + k * (cell.h + cell.gap) + cell.h / 2;
        const gx = grid.x + grid.cs / 2;
        const gy = grid.y + k * grid.pitch + grid.cs / 2;
        const x = lerp(ax, gx, m);
        const y = lerp(ay, gy, m);
        const w = lerp(cell.w, grid.cs, m) * pop;
        const h = lerp(cell.h, grid.cs, m) * pop;
        const a = fade(x);
        roundedPath(ctx, x - w / 2, y - h / 2, w, h, lerp(5, 2, m));
        ctx.fillStyle = css(CODE_COLORS[k], lerp(.22, .8, m) * a);
        ctx.fill();
        ctx.strokeStyle = css(CODE_COLORS[k], .9 * a * labelAlpha);
        ctx.stroke();
        if (labelAlpha > .01) {
          const live = k === Math.floor(n) && n < 12;
          const value = Math.floor(hash(k, live ? Math.floor(t * 18) : 3) * 1024);
          text(ctx, String(value).padStart(4, "0"), x, y + .5, { size: clamp(cell.h * .5, 9, 12), color: C.bone, alpha: a * labelAlpha * pop });
          text(ctx, `C${k + 1}`, x - w / 2 - 8, y + .5, { size: clamp(cell.h * .45, 9, 11), align: "right", alpha: .8 * a * labelAlpha });
        }
      }
      if (n > 1 && labelAlpha > .01) {
        const lineX = colX + cell.w / 2 + 10;
        const y0 = top + cell.h / 2;
        const y1 = top + (Math.min(12, Math.ceil(n)) - 1) * (cell.h + cell.gap) + cell.h / 2;
        ctx.strokeStyle = css(C.bone, .35 * alpha * labelAlpha);
        ctx.beginPath();
        ctx.moveTo(lineX, y0);
        ctx.lineTo(lineX, y1);
        ctx.stroke();
        for (let k = 0; k < Math.min(12, Math.ceil(n)); k++) {
          ctx.fillStyle = css(C.bone, .6 * alpha * labelAlpha);
          ctx.fillRect(lineX - 1.5, top + k * (cell.h + cell.gap) + cell.h / 2 - 1.5, 3, 3);
        }
      }
    }

    drawFrames(g) {
      const { ctx, S, t, fade } = g;
      if (S < 2.15) return;
      const grid = this.gridGeom(g);
      const m = smooth(2.22, 2.78, S);
      const F = m >= 1 ? 12 + (grid.cols * 12 - 12) * clamp((S - 2.8) / .42, 0, 1) : 0;
      this.filled = F;
      const flowing = S > 3.3;
      const playing = supported && V.state.playing;
      const phase = flowing ? t * (playing ? 12.5 : 4) : 0;
      const shift = phase % 1;
      const prismLeft = g.X(4, -this.size * .34) - Math.max(10, this.size * .045) / 2 - 4;
      const outline = .08 * smooth(2.5, 2.9, S);
      for (let c = 0; c < grid.cols; c++) {
        const x = grid.x + (c + (flowing ? shift : 0)) * grid.pitch;
        if (flowing && x + grid.cs > prismLeft) continue;
        const a = fade(x + grid.cs / 2) * (flowing ? smooth(0, grid.pitch * 2, prismLeft - x) : 1);
        if (a < .01) continue;
        const id = c - Math.floor(phase);
        for (let r = 0; r < 12; r++) {
          const index = c * 12 + r;
          const y = grid.y + r * grid.pitch;
          if (!flowing && index >= F) {
            if (outline > 0) {
              ctx.strokeStyle = css(C.mute, outline * a);
              ctx.strokeRect(x + .5, y + .5, grid.cs - 1, grid.cs - 1);
            }
            continue;
          }
          const pop = flowing ? 1 : clamp(F - index, 0, 1);
          const brightness = .35 + .65 * hash(id, r);
          const s = grid.cs * (.6 + .4 * pop);
          roundedPath(ctx, x + (grid.cs - s) / 2, y + (grid.cs - s) / 2, s, s, 2);
          ctx.fillStyle = css(CODE_COLORS[r], brightness * a * (.4 + .6 * pop));
          ctx.fill();
        }
      }
      const axisAlpha = smooth(2.6, 3, S) * (1 - smooth(3.2, 3.5, S)) * fade(grid.x3);
      if (axisAlpha > .01) {
        const ay = grid.y + 12 * grid.pitch + 8;
        const size = Math.max(9, this.size * .026);
        for (let c = 0; c <= grid.cols; c++) {
          const x = grid.x + c * grid.pitch - grid.gap / 2;
          ctx.fillStyle = css(C.mute, .6 * axisAlpha);
          ctx.fillRect(x, ay, 1, c % 5 === 0 ? 6 : 3);
          if (c % 5 === 0 && c < grid.cols) text(ctx, `${c * 80} ms`, x + 3, ay + 9, { size, align: "left", baseline: "top", alpha: .7 * axisAlpha });
        }
        const full = Math.max(1, Math.floor(F / 12));
        const bx = grid.x + (full - 1) * grid.pitch - 3;
        ctx.strokeStyle = css(C.bone, .75 * axisAlpha);
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + .5, grid.y - 4.5, grid.cs + 6, 12 * grid.pitch + 2);
        const labelX = clamp(bx + grid.cs / 2 + 3, grid.x + 60, grid.x + grid.cols * grid.pitch - 60);
        text(ctx, "1 frame · 12 codes · 80 ms", labelX, grid.y - 16, { size, color: C.bone, alpha: .85 * axisAlpha });
      }
    }

    drawSpeech(g) {
      const { ctx, S, t, cy, X, fade, size, box } = g;
      if (S < 2.9) return;
      const appear = smooth(3.25, 3.75, S);
      if (appear < .01) return;
      const grid = this.gridGeom(g);
      const px = X(4, -size * .34);
      const ph = 12 * grid.pitch * 1.25;
      const pw = Math.max(10, size * .045);
      const alpha = appear * fade(px);
      const halo = ctx.createRadialGradient(px, cy, 0, px, cy, ph * .7);
      halo.addColorStop(0, css(C.pink, .16 * alpha));
      halo.addColorStop(1, css(C.pink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(px - ph, cy - ph, ph * 2, ph * 2);
      const stroke = ctx.createLinearGradient(0, cy - ph / 2, 0, cy + ph / 2);
      stroke.addColorStop(0, css(C.amber, alpha));
      stroke.addColorStop(.5, css(C.pink, alpha));
      stroke.addColorStop(1, css(C.blue, alpha));
      roundedPath(ctx, px - pw / 2, cy - ph / 2, pw, ph, pw / 2);
      ctx.fillStyle = css(C.bone, .05 * alpha);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
      const labelSize = Math.max(10, size * .03);
      text(ctx, "MOSS decoder", px, cy - ph / 2 - 16, { size: labelSize, color: C.bone, alpha: .85 * alpha });
      text(ctx, "frozen", px, cy + ph / 2 + 16, { size: labelSize, alpha: .7 * alpha });

      const state = V ? V.state : null;
      const playing = supported && state.playing;
      const id = playing ? state.id : HERO;
      const duration = V ? V.info(id).duration : 35;
      const now = playing ? V.time() : (t * .9) % duration;
      const x0 = px + pw / 2 + 8;
      const x1 = box.x + box.w;
      const pps = clamp(box.w * .12, 50, 110);
      const amp = Math.min(box.h * .36, ph * .62);
      for (let x = x0; x < x1; x += 4) {
        const tb = now - (x - x0) / pps;
        const level = V ? V.level(id, tb) : .25 + .2 * Math.sin(x * .05 + t * 3);
        const edge = smooth(0, 30, x - x0) * (1 - smooth(x1 - 70, x1, x));
        const h = Math.max(1.5, level * amp * 2);
        const rgb = V ? toRgb(V.colorAt(id, clamp(tb, 0, duration))) : C.rose;
        roundedPath(ctx, x, cy - h / 2, 2.2, h, 1.1);
        ctx.fillStyle = css(rgb, (playing ? .95 : .4) * edge * appear);
        ctx.fill();
      }
      text(ctx, playing ? "48 kHz · mono · live" : "48 kHz · mono", x0 + 12, cy + amp + 18, { size: labelSize, align: "left", alpha: .75 * appear });
    }

    updateHud(S) {
      const stage = clamp(Math.round(S), 0, 4);
      let value;
      if (stage === 0) value = "Input · text + direction + optional voice";
      else if (stage === 1) value = `Layer ${Math.max(1, Math.ceil(this.layer || 0))} / 36 · hidden 2,560 · 32 heads · 8 KV`;
      else if (stage === 2) value = `Codebook C${clamp(Math.ceil(this.codes || 0), 1, 12)} / 12 · 1,024 entries each`;
      else if (stage === 3) {
        const filled = Math.floor(this.filled || 0);
        value = `${filled} decisions · ${Math.floor(filled / 12) * 80} ms of audio · 150 per second`;
      } else value = supported && V.state.playing ? `Decoding · ${V.formatTime(V.time())} · 48 kHz mono` : "48 kHz mono · press play to hear it";
      if (value !== this.hudText) {
        this.hudText = value;
        this.hud.textContent = value;
      }
    }
  }

  /* ---------- Languages: scroll changes the language, sound follows the sentence ---------- */

  class Languages {
    constructor(track) {
      this.track = track;
      this.stops = [...track.querySelectorAll("[data-lang-stop]")];
      this.fill = track.querySelector("[data-langs-fill]");
      this.lines = [...track.querySelectorAll(".vr-line")];
      this.texts = this.lines.map((line) => line.querySelector(".vr-line__text"));
      this.mode = track.querySelector("[data-europe-mode]");
      this.sentenceLabel = track.querySelector("[data-europe-sentence]");
      this.prev = track.querySelector("[data-sentence-prev]");
      this.next = track.querySelector("[data-sentence-next]");
      const playerRoot = track.querySelector("[data-voice-player]");
      this.player = playerRoot && playerRoot.voicePlayer;
      this.index = -1;
      this.sentence = 0;
      track.querySelector(".vr-langs").hidden = false;
      if (supported) track.querySelector(".vr-europe__player").hidden = false;
      this.prev.addEventListener("click", () => this.step(-1));
      this.next.addEventListener("click", () => this.step(1));
      V.onFrame(() => this.render());
      V.onChange(() => this.render());
      this.update();
    }

    get id() { return SUNRISE[Math.max(0, this.index)]; }

    progress() {
      const rect = this.track.getBoundingClientRect();
      return clamp(-rect.top / Math.max(1, rect.height - innerHeight), 0, 1);
    }

    update() {
      // Outside the section, keep the last language so leaving it never switches the voice.
      const rect = this.track.getBoundingClientRect();
      const middle = innerHeight * .5;
      if (this.index >= 0 && (rect.top > middle || rect.bottom < middle)) return;
      const p = this.progress();
      this.fill.style.setProperty("--p", p.toFixed(4));
      const index = Math.min(SUNRISE.length - 1, Math.floor(p * SUNRISE.length));
      if (index !== this.index) this.setLanguage(index);
    }

    setLanguage(index) {
      this.index = index;
      this.stops.forEach((stop, i) => {
        stop.classList.toggle("is-active", i === index);
        stop.classList.toggle("is-past", i < index);
      });
      this.lines.forEach((line, i) => line.classList.toggle("is-active", i === index));
      const clip = V.info(this.id);
      this.mode.textContent = `${clip.language.native} · ${clip.mode === "reference" ? "with voice reference" : "prompt only, no voice reference"}`;
      if (this.player) this.player.select(this.id);
      this.texts.forEach((element) => { delete element.dataset.key; });
      this.render();
    }

    currentSentence() {
      const state = V.state;
      if (SUNRISE.includes(state.id) && (state.playing || state.offset > 0)) return V.sentenceAt(state.id, V.time());
      return this.sentence;
    }

    render() {
      if (this.index < 0) return;
      const s = this.currentSentence();
      if (SUNRISE.includes(V.state.id) && V.state.playing) this.sentence = s;
      const label = `Sentence ${s + 1} / 5`;
      if (this.sentenceLabel.textContent !== label) this.sentenceLabel.textContent = label;
      this.prev.disabled = s === 0;
      this.next.disabled = s === 4;
      SUNRISE.forEach((id, i) => {
        const element = this.texts[i];
        const state = V.state;
        if (i === this.index && state.id === id && (state.playing || state.offset > 0)) {
          V.renderCaption(element, id, V.time(), state.playing);
          return;
        }
        const key = "text:" + id + ":" + s;
        if (element.dataset.key === key) return;
        element.dataset.key = key;
        element.words = null;
        const clip = V.info(id);
        const bounds = clip.sentences[s];
        element.textContent = clip.words.slice(bounds.from, bounds.to + 1).map((word) => word.text).join(" ");
      });
    }

    step(delta) {
      const s = clamp(this.currentSentence() + delta, 0, 4);
      this.sentence = s;
      if (supported) {
        if (V.state.id === this.id && V.state.playing) V.seek(V.sentenceStart(this.id, s));
        else V.cue(this.id, s === 0 ? 0 : V.sentenceStart(this.id, s));
      }
      this.render();
    }
  }

  /* ---------- Sound zones: what plays where, once sound is on ---------- */

  class Zones {
    constructor(arch, languages) {
      this.arch = arch;
      this.languages = languages;
      this.elements = [...document.querySelectorAll("[data-zone]")];
      this.zone = null;
    }

    compute() {
      const y = innerHeight * .5;
      for (const element of this.elements) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= y && rect.bottom > y) {
          const zone = element.dataset.zone;
          if (zone === "arch") return this.arch && this.arch.S >= 3.45 ? "arch-out" : "arch";
          return zone;
        }
      }
      return "none";
    }

    update() {
      const zone = this.compute();
      if (zone === this.zone) return;
      this.zone = zone;
      this.apply(false);
    }

    apply(fromDock) {
      V.setDuck(this.zone === "arch");
      if (!V.soundOn && !fromDock) return;
      const state = V.state;
      let target = null;
      if (this.zone === "hero" || this.zone === "arch-out" || (fromDock && this.zone === "arch")) target = HERO;
      else if (this.zone === "europe" && this.languages) target = this.languages.id;
      else if (fromDock) target = state.id || HERO;
      if (!target || (state.id === target && (state.playing || state.loading))) return;
      let at = 0;
      if (state.id === target) at = state.offset;
      else if (SUNRISE.includes(state.id) && SUNRISE.includes(target) && (state.playing || state.offset > 0)) at = V.sentenceStart(target, V.sentenceAt(state.id, V.time()));
      else if (this.zone === "europe" && this.languages.sentence > 0) at = V.sentenceStart(target, this.languages.sentence);
      V.play(target, { at, owner: "zone", fade: .7 });
    }
  }

  class Dock {
    constructor(element, zones, watch) {
      this.element = element;
      this.zones = zones;
      this.button = element.querySelector("[data-dock-toggle]");
      this.title = element.querySelector("[data-dock-title]");
      this.sub = element.querySelector("[data-dock-sub]");
      this.bars = [...element.querySelectorAll(".vr-dock__eq i")];
      element.hidden = false;
      this.button.addEventListener("click", () => this.toggle());
      // Show once the hero's own play button has scrolled away; step aside for the footer links.
      let pastHero = false;
      let atFooter = false;
      const place = () => element.classList.toggle("is-visible", pastHero && !atFooter);
      new IntersectionObserver(([entry]) => {
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        place();
      }).observe(watch);
      const footer = document.querySelector(".site-footer");
      if (footer) {
        new IntersectionObserver(([entry]) => {
          atFooter = entry.isIntersecting;
          place();
        }).observe(footer);
      }
      V.onChange(() => this.sync());
      V.onFrame((t) => this.levels(t));
      this.sync();
    }

    toggle() {
      if (V.state.playing || V.state.loading) V.pause({ user: true });
      else if (V.soundOn) V.setSound(false);
      else {
        V.unlock();
        this.zones.apply(true);
      }
    }

    sync() {
      const state = V.state;
      const on = V.soundOn;
      this.button.setAttribute("aria-pressed", String(on));
      if (state.loading) {
        this.title.textContent = "Loading the voice…";
        this.sub.textContent = "One moment";
      } else if (state.playing) {
        const clip = V.info(state.id);
        this.title.textContent = clip.sceneInfo.title;
        this.sub.textContent = `${clip.language.native} · ${clip.mode === "reference" ? "voice reference" : "prompt only"} · tap to stop`;
      } else if (on) {
        this.title.textContent = "Sound on";
        this.sub.textContent = "The next voice starts as you scroll";
      } else {
        this.title.textContent = "Sound off";
        this.sub.textContent = "Tap to hear the model as you scroll";
      }
      if (!state.playing) this.bars.forEach((bar) => bar.style.setProperty("--l", "0"));
    }

    levels(t) {
      if (!V.state.playing) return;
      const level = V.level(V.state.id, t);
      this.bars.forEach((bar, i) => {
        const value = clamp(level * (.65 + .45 * Math.sin(i * 1.7 + t * 9)) + .08, 0, 1);
        bar.style.setProperty("--l", value.toFixed(3));
      });
    }
  }

  function initScenes() {
    document.querySelectorAll(".vr-scene").forEach((scene) => {
      const playerRoot = scene.querySelector("[data-voice-player]");
      const scripts = [...scene.querySelectorAll("[data-script-lang]")];
      const download = scene.querySelector("[data-download]");
      const apply = (clip) => {
        scripts.forEach((block) => { block.hidden = scripts.length > 1 && block.dataset.scriptLang !== clip.lang; });
        download.href = clip.src;
        download.textContent = `Download ${clip.language.name}${clip.mode === "prompt" ? ", prompt only" : ""} (MP3) ↓`;
      };
      playerRoot.addEventListener("voice:select", (event) => apply(event.detail));
      if (playerRoot.voicePlayer) apply(V.info(playerRoot.voicePlayer.id));
    });
  }

  /* ---------- Boot ---------- */

  initReveal();
  initCounters();
  const heroElement = document.querySelector(".vr-hero");
  if (heroElement) new Hero(heroElement);
  const archElement = document.querySelector("[data-arch]");
  const arch = archElement ? new Architecture(archElement) : null;
  const languagesElement = document.querySelector("[data-europe]");
  const languages = languagesElement && V ? new Languages(languagesElement) : null;
  const zones = supported ? new Zones(arch, languages) : null;
  const dockElement = document.querySelector("[data-dock]");
  if (supported && dockElement && heroElement) new Dock(dockElement, zones, heroElement.querySelector(".vr-hero__actions"));
  if (supported) initScenes();

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (arch) arch.update();
      if (languages) languages.update();
      if (zones) zones.update();
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // Enhancement changes section heights; settle deep links once layout is final.
  if (location.hash.length > 1) {
    const align = () => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    };
    if (document.readyState === "complete") requestAnimationFrame(align);
    else addEventListener("load", () => requestAnimationFrame(align), { once: true });
  }
}());
