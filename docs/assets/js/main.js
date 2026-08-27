(function () {
  "use strict";

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.remove("no-js");
  root.classList.add("js");

  const fixedCanvas = document.querySelector("#living-line");
  const demoCanvas = document.querySelector("#voice-line");
  const fixedLine = fixedCanvas && window.LivingLine ? new window.LivingLine(fixedCanvas, {
    amplitude: 22,
    breathPeriod: 4500,
    hesitation: true,
    distraction: true,
    pointer: true,
    fixed: true
  }) : null;
  const demoLine = demoCanvas && window.LivingLine ? new window.LivingLine(demoCanvas, {
    amplitude: 16,
    breathPeriod: 5200,
    hesitation: false,
    distraction: true,
    pointer: false
  }) : null;
  if (demoLine) demoLine.setMood("calm");

  const titleLines = document.querySelectorAll("[data-hero-line]");
  let wordIndex = 0;
  titleLines.forEach((line) => {
    const pause = line.hasAttribute("data-pause") ? 320 : 0;
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = "";
    words.forEach((word, index) => {
      const span = document.createElement("span");
      const humanDelay = 70 * wordIndex * (.8 + Math.random() * .6) + pause;
      span.className = "hero-word";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--word-delay", humanDelay + "ms");
      span.textContent = word;
      line.appendChild(span);
      wordIndex += 1;
      if (index === words.length - 1) span.style.marginRight = "0";
    });
  });
  requestAnimationFrame(() => document.querySelectorAll(".hero-word").forEach((word) => word.classList.add("is-in")));

  const revealItems = document.querySelectorAll("[data-reveal]");
  if (reduced || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-in"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: .15 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  document.querySelectorAll("[data-mood]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-mood]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      if (demoLine) demoLine.setMood(button.dataset.mood);
    });
  });

  document.querySelectorAll("[data-email]").forEach((link) => {
    const address = link.dataset.user + "@" + link.dataset.domain;
    link.href = "mailto:" + address;
    link.textContent = address;
  });

  function prepareLineColorText() {
    const targets = [];
    const roots = document.querySelectorAll(".site-header, main, .site-footer");
    roots.forEach((contentRoot) => {
      const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          if (parent.closest("script, style, canvas, .brand-mark")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part || /^\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
            return;
          }
          const word = document.createElement("span");
          word.className = "line-color-word";
          word.textContent = part;
          targets.push(word);
          fragment.appendChild(word);
        });
        node.replaceWith(fragment);
      });
    });
    return targets;
  }

  if (fixedLine) fixedLine.setTextTargets(prepareLineColorText());

  const soul = document.querySelector("#soul");
  if (soul && fixedLine) {
    const soulObserver = new IntersectionObserver((entries) => {
      fixedLine.setSoul(entries[0].intersectionRatio >= .6);
    }, { threshold: [.59, .6, .61] });
    soulObserver.observe(soul);
  }

  const contact = document.querySelector("#contact");
  if (contact && fixedLine) {
    let docked = false;
    const contactObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.intersectionRatio >= .35) docked = true;
      else if (entry.intersectionRatio <= .15 && entry.boundingClientRect.top > 0) docked = false;
      fixedLine.setDocked(docked);
    }, { threshold: [.15, .35] });
    contactObserver.observe(contact);
  }

}());
