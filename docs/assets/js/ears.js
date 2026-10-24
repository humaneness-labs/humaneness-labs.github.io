/* Introducing Humaneness Labs / Humaneness Ears: hero ring of the 192 outputs,
   the scroll-driven forward pass, and an explorer over every measured output.
   Output names and correlations come from ears-data.js (the model card). */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const DATA = window.HumanenessEars || { outputs: [], bursts: [] };
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function hash(a, b) {
    let h = Math.imul(a + 23, 374761393) ^ Math.imul(b + 3, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const FAMILIES = {
    emonet: { name: "EmoNet emotions", color: "#e4998b" },
    voicenet: { name: "VoiceNet dimensions", color: "#91a8ff" },
    delivery: { name: "Genuineness & blend", color: "#ddb27a" },
    empathic: { name: "Empathic Insight extras", color: "#b4a6ff" },
    audiobox: { name: "AudioBox Aesthetics", color: "#8fd6c8" },
    dnsmos: { name: "DNSMOS", color: "#7fc4e8" },
    bursts: { name: "Vocal-burst count", color: "#ff6f91" },
    voiceclap: { name: "VoiceCLAP attributes", color: "#a9b2d6" }
  };
  const EMONET_GROUPS = [
    ["Positive / Approach", "#ddb27a"],
    ["Cognitive / Epistemic", "#8fd6c8"],
    ["Negative / Distress", "#91a8ff"],
    ["Hostile / Aversive", "#ff6f91"],
    ["Low-arousal / Altered / Appetitive", "#b4a6ff"]
  ];
  const outputs = DATA.outputs.map(([index, key, name, family, group, n, baseR, mediumR]) => ({ index, key, name, family, group, n, baseR, mediumR }));

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

  /* ---------- Reveal, counters and the scroll-lit paragraph ---------- */

  function onVisible(element, callback, threshold) {
    if (!("IntersectionObserver" in window)) { callback(); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      callback();
    }, { threshold: threshold || .15 });
    observer.observe(element);
  }

  function initReveal() {
    document.querySelectorAll("[data-reveal]").forEach((item) => {
      if (reducedQuery.matches) item.classList.add("is-in");
      else onVisible(item, () => item.classList.add("is-in"), .12);
    });
  }

  function initCounters() {
    if (reducedQuery.matches) return;
    document.querySelectorAll("[data-count]").forEach((element) => {
      const target = Number(element.dataset.count);
      element.textContent = "0";
      onVisible(element, () => {
        const start = performance.now();
        const step = (now) => {
          const t = clamp((now - start) / 1400, 0, 1);
          element.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, .6);
    });
  }

  class Scrub {
    constructor(element) {
      this.element = element;
      const words = element.textContent.trim().split(/\s+/);
      element.textContent = "";
      this.words = words.map((word) => {
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = word;
        element.append(span, " ");
        return span;
      });
      this.lit = -1;
    }

    update() {
      const rect = this.element.getBoundingClientRect();
      const progress = reducedQuery.matches ? 1 : clamp((innerHeight * .88 - rect.top) / (rect.height + innerHeight * .4), 0, 1);
      const lit = Math.round(progress * this.words.length);
      if (lit === this.lit) return;
      this.lit = lit;
      this.words.forEach((word, i) => word.classList.toggle("is-lit", i < lit));
    }
  }

  /* ---------- Hero ring: one tick per output, length from its measured agreement ---------- */

  function initRing(canvas) {
    if (!canvas || !outputs.length) return;
    let visible = true;
    let frame = 0;
    const families = Object.keys(FAMILIES);
    const gaps = families.length;
    const slots = outputs.length + gaps * 3;
    const angles = [];
    let slot = 0;
    let previous = outputs[0].family;
    outputs.forEach((output) => {
      if (output.family !== previous) { slot += 3; previous = output.family; }
      angles.push((slot / slots) * Math.PI * 2 - Math.PI / 2);
      slot += 1;
    });

    function draw(now) {
      frame = 0;
      const { ctx, width, height } = fitCanvas(canvas);
      ctx.clearRect(0, 0, width, height);
      const t = reducedQuery.matches ? 0 : now / 1000;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2;
      const inner = radius * .5;
      const spin = t * .03;
      outputs.forEach((output, i) => {
        const a = angles[i] + spin;
        const breath = .06 * Math.sin(t * 1.3 + i * .37) + .04 * Math.sin(t * .7 + i * .11);
        const length = radius * .36 * (.35 + .65 * (output.mediumR || 0)) * (1 + breath);
        const x0 = cx + Math.cos(a) * inner;
        const y0 = cy + Math.sin(a) * inner;
        ctx.strokeStyle = FAMILIES[output.family].color;
        ctx.globalAlpha = .85;
        ctx.lineWidth = Math.max(1.2, radius * .012);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(cx + Math.cos(a) * (inner + length), cy + Math.sin(a) * (inner + length));
        ctx.stroke();
      });
      // The incoming sound: a closed waveform circling the centre.
      ctx.globalAlpha = .9;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "#eae6df";
      ctx.beginPath();
      for (let k = 0; k <= 180; k++) {
        const a = (k / 180) * Math.PI * 2;
        const wobble = Math.sin(a * 9 + t * 2.4) * .05 + Math.sin(a * 23 - t * 3.1) * .025 + Math.sin(a * 4 + t) * .03;
        const r = inner * (.78 + wobble * (.6 + .4 * Math.sin(t * .9)));
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (!reducedQuery.matches && visible) frame = requestAnimationFrame(draw);
    }

    const kick = () => { if (!frame) frame = requestAnimationFrame(draw); };
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick(); }).observe(canvas);
    new ResizeObserver(kick).observe(canvas);
    kick();
  }

  /* ---------- Forward pass board ---------- */

  // An illustrative speech envelope shared by the waveform, spectrogram and burst frames.
  function envelope(x) {
    const syllables = Math.abs(Math.sin(x * Math.PI * 15.5)) ** .7;
    const phrase = (x > .03 && x < .44) || (x > .52 && x < .95) ? 1 : .05;
    return clamp(syllables * phrase * (.5 + .3 * Math.sin(x * 9 + 1) + .2 * Math.sin(x * 31)), 0, 1);
  }

  class Pass {
    constructor(track) {
      this.track = track;
      this.stage = track.querySelector(".ea-pass__stage");
      this.board = track.querySelector("[data-board]");
      this.steps = track.querySelector(".ea-pass__steps");
      this.cards = [...track.querySelectorAll(".ea-step")];
      this.rail = [...track.querySelectorAll("[data-rail]")];
      this.fill = track.querySelector("[data-pass-fill]");
      this.wave = track.querySelector("[data-wave]");
      this.mel = track.querySelector("[data-mel]");
      this.frames = track.querySelector("[data-frames]");
      this.current = -1;
      this.visible = false;
      this.loop = 0;
      this.stageStart = performance.now();
      this.build();
      new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.kick(); }).observe(track);
      new ResizeObserver(() => { this.layout(); this.melImage = null; this.kick(); }).observe(this.stage);
      this.layout();
    }

    build() {
      this.board.querySelectorAll("[data-layers]").forEach((list) => {
        const count = Number(list.dataset.layers);
        for (let i = 0; i < count; i++) {
          const layer = document.createElement("li");
          layer.style.setProperty("--g", (.25 + .7 * hash(i, count)).toFixed(3));
          layer.style.setProperty("--n", String(i));
          list.append(layer);
        }
      });

      const emotions = this.board.querySelector("[data-emotions]");
      const profile = { Amusement: .82, Embarrassment: .64, Teasing: .48, Interest: .38, Elation: .3, Confusion: .22 };
      let n = 0;
      EMONET_GROUPS.forEach(([group, color], g) => {
        if (g > 0) emotions.append(Object.assign(document.createElement("i"), { className: "is-gap" }));
        outputs.filter((o) => o.family === "emonet" && o.group === group).forEach((output) => {
          const bar = document.createElement("i");
          bar.style.setProperty("--c", color);
          bar.style.setProperty("--v", (profile[output.name] || .04 + .12 * hash(output.index, 7)).toFixed(3));
          bar.style.setProperty("--n", String(n++));
          emotions.append(bar);
        });
      });
      const legend = this.board.querySelector("[data-emotion-legend]");
      EMONET_GROUPS.forEach(([group, color]) => {
        const item = document.createElement("span");
        item.style.setProperty("--c", color);
        item.textContent = group.split(" / ")[0];
        legend.append(item);
      });

      const dots = this.board.querySelector("[data-dots]");
      outputs.forEach((output) => {
        const dot = document.createElement("i");
        dot.style.setProperty("--c", FAMILIES[output.family].color);
        dot.style.setProperty("--n", String(output.index));
        dots.append(dot);
      });
      const families = this.board.querySelector("[data-families]");
      Object.entries(FAMILIES).forEach(([key, family]) => {
        const item = document.createElement("span");
        item.style.setProperty("--c", family.color);
        item.innerHTML = `${family.name}<b>${outputs.filter((o) => o.family === key).length}</b>`;
        families.append(item);
      });

      this.board.querySelectorAll("[data-vector]").forEach((strip) => {
        const count = Number(strip.dataset.vector);
        for (let i = 0; i < count; i++) {
          const cell = document.createElement("b");
          cell.style.setProperty("--h", hash(i, count).toFixed(3));
          cell.style.setProperty("--v", hash(count, i).toFixed(3));
          cell.style.setProperty("--n", String(i));
          strip.append(cell);
        }
      });
    }

    layout() {
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      if (!w || !h) return;
      this.wide = w >= 900;
      let area;
      if (this.wide) {
        const card = this.cards[0].querySelector(".ea-step__card").getBoundingClientRect();
        const x = Math.min(card.right + 40, w * .5);
        area = { x, y: 80, w: w - x - Math.max(24, w * .03), h: h - 112 };
      } else {
        area = { x: 16, y: 60, w: w - 32, h: h * .5 - 64 };
      }
      const ratio = 8 / 7;
      const bw = Math.min(area.w, area.h * ratio);
      const bh = bw / ratio;
      Object.assign(this.board.style, { left: area.x + (area.w - bw) / 2 + "px", top: area.y + (area.h - bh) / 2 + "px", width: bw + "px", height: bh + "px" });
    }

    progress() {
      const ref = innerHeight * (this.wide ? .5 : .74);
      const top = this.steps.getBoundingClientRect().top;
      // offsetTop is relative to the positioned steps container and ignores the card's transform.
      const centers = this.cards.map((step) => {
        const card = step.querySelector(".ea-step__card");
        return top + card.offsetTop + card.offsetHeight / 2;
      });
      const n = centers.length - 1;
      if (ref <= centers[0]) return Math.max(-1, (ref - centers[0]) / innerHeight);
      for (let k = 0; k < n; k++) if (ref < centers[k + 1]) return k + (ref - centers[k]) / (centers[k + 1] - centers[k]);
      return Math.min(n + .6, n + (ref - centers[n]) / innerHeight);
    }

    update() {
      const S = this.progress();
      const stage = clamp(Math.round(S), 0, 4);
      this.fill.style.setProperty("--p", clamp(S / 4, 0, 1).toFixed(4));
      if (stage === this.current) return;
      this.current = stage;
      this.stageStart = performance.now();
      this.board.dataset.stage = String(stage);
      this.cards.forEach((card, i) => card.classList.toggle("is-current", i === stage));
      this.rail.forEach((link, i) => {
        link.classList.toggle("is-active", i === stage);
        if (i === stage) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
      this.kick();
    }

    kick() {
      if (!this.loop && this.visible) this.loop = requestAnimationFrame((now) => this.draw(now));
    }

    draw(now) {
      this.loop = 0;
      const reduced = reducedQuery.matches;
      const elapsed = (now - this.stageStart) / 1000;
      if (this.current === 0) {
        // A playhead sweeps a three-second clip; the spectrogram appears behind it.
        const head = reduced ? 1 : (elapsed / 3.2) % 1.15;
        this.drawWave(clamp(head, 0, 1));
        this.drawMel(clamp(head, 0, 1));
      }
      if (this.current === 4) this.drawFrames(reduced ? 1 : clamp(elapsed / 1.4, 0, 1));
      const animating = !reduced && this.visible && (this.current === 0 || (this.current === 4 && elapsed < 1.5));
      if (animating) this.kick();
    }

    drawWave(head) {
      const { ctx, width, height } = fitCanvas(this.wave);
      ctx.clearRect(0, 0, width, height);
      const mid = height / 2;
      for (let x = 0; x < width; x += 3) {
        const u = x / width;
        const amp = envelope(u) * (.55 + .45 * Math.abs(Math.sin(u * 410))) * height * .46;
        ctx.fillStyle = u <= head ? "rgba(143,214,200,.9)" : "rgba(155,155,170,.25)";
        ctx.fillRect(x, mid - Math.max(1, amp), 2, Math.max(2, amp * 2));
      }
      ctx.fillStyle = "rgba(234,230,223,.85)";
      ctx.fillRect(Math.round(head * width), 0, 1, height);
    }

    drawMel(head) {
      const { ctx, width, height } = fitCanvas(this.mel);
      if (!this.melImage) {
        const cols = 150;
        const rows = 80;
        const off = document.createElement("canvas");
        off.width = cols;
        off.height = rows;
        const octx = off.getContext("2d");
        const image = octx.createImageData(cols, rows);
        for (let c = 0; c < cols; c++) {
          const u = c / cols;
          const e = envelope(u);
          const f1 = 14 + 8 * Math.sin(u * 23);
          const f2 = 34 + 10 * Math.sin(u * 17 + 2);
          for (let r = 0; r < rows; r++) {
            const bin = rows - 1 - r;
            const harmonic = .5 + .5 * Math.cos(bin * 1.9);
            const formants = Math.exp(-(((bin - f1) / 6) ** 2)) + .7 * Math.exp(-(((bin - f2) / 8) ** 2)) + .25 * Math.exp(-bin / 18);
            const v = clamp(e * formants * (.55 + .45 * harmonic) + .06 * hash(c, r), 0, 1);
            const i = (r * cols + c) * 4;
            image.data[i] = 16 + v * 127;
            image.data[i + 1] = 16 + v * 198;
            image.data[i + 2] = 24 + v * 176;
            image.data[i + 3] = 255;
          }
        }
        octx.putImageData(image, 0, 0);
        this.melImage = off;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#11131b";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * head, height);
      ctx.clip();
      ctx.drawImage(this.melImage, 0, 0, width, height);
      ctx.restore();
    }

    drawFrames(progress) {
      const { ctx, width, height } = fitCanvas(this.frames);
      ctx.clearRect(0, 0, width, height);
      const count = 150;
      const pitch = width / count;
      const events = [[.22, .36], [.61, .7]];
      for (let i = 0; i < count; i++) {
        const u = (i + .5) / count;
        if (u > progress) break;
        const inside = events.some(([a, b]) => u >= a && u <= b);
        const edge = events.reduce((m, [a, b]) => Math.max(m, 1 - Math.min(Math.abs(u - a), Math.abs(u - b)) * 30), 0);
        const p = inside ? .78 + .2 * hash(i, 1) : clamp(.04 + .1 * hash(i, 2) + .35 * Math.max(0, edge), 0, .45);
        const h = p * height;
        ctx.fillStyle = p >= .5 ? "rgba(255,111,145,.9)" : "rgba(155,155,170,.35)";
        ctx.fillRect(i * pitch + pitch * .15, height - h, pitch * .7, h);
      }
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(234,230,223,.45)";
      ctx.beginPath();
      ctx.moveTo(0, height * .5);
      ctx.lineTo(width, height * .5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(234,230,223,.6)";
      ctx.font = `${Math.max(9, width * .016)}px "Spline Sans Mono", monospace`;
      ctx.fillText("0.5", width - ctx.measureText("0.5").width, height * .5 - 6);
    }
  }

  /* ---------- Explorer over all 192 outputs ---------- */

  function initExplorer(root) {
    if (!root || !outputs.length) return;
    root.hidden = false;
    const tiles = root.querySelector("[data-tiles]");
    const filters = root.querySelector("[data-filters]");
    const fields = {
      family: root.querySelector("[data-detail-family]"),
      name: root.querySelector("[data-detail-name]"),
      key: root.querySelector("[data-detail-key]"),
      base: root.querySelector("[data-detail-base]"),
      medium: root.querySelector("[data-detail-medium]"),
      n: root.querySelector("[data-detail-n]"),
      summary: root.querySelector("[data-summary]")
    };
    const detail = root.querySelector("[data-detail]");
    let model = "medium";
    let filter = "all";
    let selected = null;
    const buttons = [];
    const blocks = {};

    Object.entries(FAMILIES).forEach(([key, family]) => {
      const members = outputs.filter((o) => o.family === key);
      const block = document.createElement("div");
      block.className = "ea-family";
      block.style.setProperty("--c", family.color);
      block.setAttribute("role", "listitem");
      block.innerHTML = `<p><b>${family.name}</b> · ${members.length}</p>`;
      const grid = document.createElement("div");
      members.forEach((output) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "ea-tile";
        tile.style.setProperty("--c", family.color);
        tile.output = output;
        tile.addEventListener("mouseenter", () => show(output));
        tile.addEventListener("focus", () => show(output));
        tile.addEventListener("click", () => { select(tile); });
        grid.append(tile);
        buttons.push(tile);
      });
      block.append(grid);
      tiles.append(block);
      blocks[key] = block;

      const chip = document.createElement("button");
      chip.type = "button";
      chip.dataset.filter = key;
      chip.style.setProperty("--c", family.color);
      chip.setAttribute("aria-pressed", "false");
      chip.innerHTML = `${family.name} <b>${members.length}</b>`;
      filters.append(chip);
    });
    const all = document.createElement("button");
    all.type = "button";
    all.dataset.filter = "all";
    all.setAttribute("aria-pressed", "true");
    all.innerHTML = `All <b>${outputs.length}</b>`;
    filters.prepend(all);

    const format = (value) => (value == null ? "—" : value.toFixed(2));
    const valueOf = (output) => (model === "medium" ? output.mediumR : output.baseR);

    function paint() {
      buttons.forEach((tile) => {
        const r = valueOf(tile.output);
        // Most correlations sit between 0.2 and 0.95: stretch that span for contrast (see the scale legend).
        tile.style.setProperty("--r", clamp(((r || 0) - .2) / .75, .06, 1).toFixed(3));
        tile.setAttribute("aria-label", `${tile.output.name}, ${FAMILIES[tile.output.family].name}, ${model} r ${format(r)}`);
      });
      Object.entries(blocks).forEach(([key, block]) => block.classList.toggle("is-dim", filter !== "all" && filter !== key));
      const pool = outputs.filter((o) => filter === "all" || o.family === filter).map(valueOf).filter((v) => v != null).sort((a, b) => a - b);
      const median = pool.length ? pool[Math.floor(pool.length / 2)] : null;
      fields.summary.textContent = `${model === "medium" ? "Medium" : "Base"} · median r ${format(median)} across ${pool.length} ${filter === "all" ? "outputs" : FAMILIES[filter].name}.`;
    }

    function show(output) {
      const family = FAMILIES[output.family];
      detail.style.setProperty("--c", family.color);
      fields.family.textContent = output.group ? `${family.name} · ${output.group}` : family.name;
      fields.name.textContent = output.name;
      fields.key.textContent = output.key;
      fields.base.textContent = format(output.baseR);
      fields.medium.textContent = format(output.mediumR);
      fields.n.textContent = output.n.toLocaleString("en");
    }

    function select(tile) {
      if (selected) selected.classList.remove("is-selected");
      selected = tile;
      tile.classList.add("is-selected");
      show(tile.output);
    }

    root.querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => {
      model = button.dataset.model;
      root.querySelectorAll("[data-model]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      paint();
    }));
    filters.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;
      filter = chip.dataset.filter;
      filters.querySelectorAll("[data-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === chip)));
      paint();
    });
    tiles.addEventListener("mouseleave", () => { if (selected) show(selected.output); });

    paint();
    select(buttons.find((tile) => tile.output.key === "emo_Amusement") || buttons[0]);
  }

  function initBurstCloud(list) {
    if (!list) return;
    list.querySelectorAll("li").forEach((item, i) => item.style.setProperty("--n", String(i)));
    if (reducedQuery.matches) list.classList.add("is-in");
    else onVisible(list, () => list.classList.add("is-in"), .2);
  }

  /* ---------- Boot ---------- */

  initReveal();
  initCounters();
  initRing(document.querySelector("[data-ring]"));
  initExplorer(document.querySelector("[data-explorer]"));
  initBurstCloud(document.querySelector("[data-burst-cloud]"));
  const scrubs = [...document.querySelectorAll("[data-scrub]")].map((element) => new Scrub(element));
  const passElement = document.querySelector("[data-pass]");
  const pass = passElement && outputs.length ? new Pass(passElement) : null;

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      scrubs.forEach((scrub) => scrub.update());
      if (pass) pass.update();
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
