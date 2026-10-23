/* PerformanceNet release page: the scroll-driven scene study, a paragraph that
   lights up as it is read, and field portraits for the four reference systems.
   Without JavaScript every step and description stays readable in order. */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function hash(a, b) {
    let h = Math.imul(a + 17, 374761393) ^ Math.imul(b + 5, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
      const target = Number(element.dataset.count);
      element.textContent = "0";
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now) => {
          const t = clamp((now - start) / 1400, 0, 1);
          element.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: .6 });
      observer.observe(element);
    });
  }

  /* ---------- A paragraph that lights up word by word as it scrolls past ---------- */

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

  /* ---------- Scene study: one board, five states, driven by the step cards ---------- */

  class Study {
    constructor(track) {
      this.stage = track.querySelector(".pn-study__stage");
      this.board = track.querySelector("[data-board]");
      this.steps = track.querySelector(".pn-study__steps");
      this.cards = [...track.querySelectorAll(".pn-step")];
      this.rail = [...track.querySelectorAll("[data-rail]")];
      this.fill = track.querySelector("[data-study-fill]");
      this.current = -1;
      this.S = 0;
      this.board.querySelectorAll(".pn-obligations li, .pn-makeup li").forEach((item) => item.style.setProperty("--n", [...item.parentElement.children].indexOf(item)));
      new ResizeObserver(() => this.layout()).observe(this.stage);
      this.layout();
    }

    layout() {
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      if (!w || !h) return;
      this.wide = w >= 900;
      let area;
      if (this.wide) {
        const card = this.cards[0].querySelector(".pn-step__card").getBoundingClientRect();
        const x = Math.min(card.right + 40, w * .5);
        area = { x, y: 80, w: w - x - Math.max(24, w * .03), h: h - 112 };
      } else {
        area = { x: 16, y: 60, w: w - 32, h: h * .5 - 64 };
      }
      const ratio = 8 / 7;
      const bw = Math.min(area.w, area.h * ratio);
      const bh = bw / ratio;
      Object.assign(this.board.style, {
        left: area.x + (area.w - bw) / 2 + "px",
        top: area.y + (area.h - bh) / 2 + "px",
        width: bw + "px",
        height: bh + "px"
      });
    }

    progress() {
      const ref = innerHeight * (this.wide ? .5 : .74);
      const top = this.steps.getBoundingClientRect().top;
      // offsetTop is relative to the positioned steps container and ignores the card's transform.
      const centers = this.cards.map((step) => {
        const card = step.querySelector(".pn-step__card");
        return top + card.offsetTop + card.offsetHeight / 2;
      });
      const n = centers.length - 1;
      if (ref <= centers[0]) return Math.max(-1, (ref - centers[0]) / innerHeight);
      for (let k = 0; k < n; k++) if (ref < centers[k + 1]) return k + (ref - centers[k]) / (centers[k + 1] - centers[k]);
      return Math.min(n + .6, n + (ref - centers[n]) / innerHeight);
    }

    update() {
      this.S = this.progress();
      const stage = clamp(Math.round(this.S), 0, 4);
      this.fill.style.setProperty("--p", clamp(this.S / 4, 0, 1).toFixed(4));
      if (stage === this.current) return;
      this.current = stage;
      this.board.dataset.stage = String(stage);
      this.cards.forEach((card, i) => card.classList.toggle("is-current", i === stage));
      this.rail.forEach((link, i) => {
        link.classList.toggle("is-active", i === stage);
        if (i === stage) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
    }
  }

  /* ---------- Field portraits: one mark per field or cell in each reference ---------- */

  function marks(container, count, className, set) {
    const wrap = document.createElement("div");
    wrap.className = className;
    for (let i = 0; i < count; i++) {
      const mark = document.createElement("i");
      set(mark, i);
      wrap.append(mark);
    }
    container.append(wrap);
    return wrap;
  }

  function initLensArt() {
    const emo = document.querySelector('[data-lens-art="emo"]');
    if (emo) {
      // 40 labels across, 8 cells each: 320 intensity–expression cells.
      marks(emo, 320, "pn-cells", (mark, i) => {
        const column = i % 40;
        const row = Math.floor(i / 40);
        mark.style.setProperty("--v", ((1 - row / 7) * (.55 + .45 * hash(column, row))).toFixed(3));
        mark.style.setProperty("--d", (column * 9 + row * 26).toString());
      });
    }
    const voice = document.querySelector('[data-lens-art="voice"]');
    if (voice) {
      marks(voice, 57, "pn-bars", (mark, i) => {
        const v = .18 + .82 * Math.abs(Math.sin(i * .41) * .62 + Math.sin(i * .17 + 1.3) * .38);
        mark.style.setProperty("--v", clamp(v, .12, 1).toFixed(3));
        mark.style.setProperty("--d", (i * 14).toString());
      });
    }
    const perf = document.querySelector('[data-lens-art="perf"]');
    if (perf) {
      const wrap = document.createElement("div");
      wrap.className = "pn-fields";
      perf.append(wrap);
      // 79 ordinal fields as levels, then three categorical capture fields.
      marks(wrap, 82, "pn-fields__ordinal", (mark, i) => {
        if (i >= 79) mark.className = "is-categorical";
        mark.style.setProperty("--v", (.2 + .8 * hash(i, 4)).toFixed(3));
        mark.style.setProperty("--d", (i * 9).toString());
      });
      // Eight separate observer-impression scales.
      marks(wrap, 8, "pn-fields__scales", (mark, i) => {
        mark.style.setProperty("--v", (.15 + .7 * hash(i, 9)).toFixed(3));
        mark.style.setProperty("--d", (700 + i * 80).toString());
      });
    }
  }

  /* ---------- Boot ---------- */

  initReveal();
  initCounters();
  initLensArt();
  const scrubs = [...document.querySelectorAll("[data-scrub]")].map((element) => new Scrub(element));
  const studyElement = document.querySelector("[data-study]");
  const study = studyElement ? new Study(studyElement) : null;

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      scrubs.forEach((scrub) => scrub.update());
      if (study) study.update();
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
