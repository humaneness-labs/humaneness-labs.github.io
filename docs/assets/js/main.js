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

  const soul = document.querySelector("#soul");
  if (soul && fixedLine) {
    const soulObserver = new IntersectionObserver((entries) => {
      fixedLine.setSoul(entries[0].intersectionRatio >= .6);
    }, { threshold: [.59, .6, .61] });
    soulObserver.observe(soul);
  }

  const hero = document.querySelector("#hero");
  const header = document.querySelector(".site-header");
  if (hero && header) {
    const headerObserver = new IntersectionObserver((entries) => {
      header.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }, { rootMargin: "-12% 0px 0px" });
    headerObserver.observe(hero);
  }
}());
