(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-walkthrough]').forEach(walk => {
    const panels = [...walk.querySelectorAll('.walk-panel')];
    const steps = [...walk.querySelectorAll('[data-step]')];
    const play = walk.querySelector('[data-play]');
    const previous = walk.querySelector('[data-prev]');
    const next = walk.querySelector('[data-next]');
    const status = walk.querySelector('[data-status]');
    let current = 0;
    let timer;
    function stop() {
      clearInterval(timer);
      timer = undefined;
      walk.classList.remove('is-playing');
      play.textContent = 'Play walkthrough';
      play.setAttribute('aria-pressed', 'false');
    }
    function show(index) {
      current = index;
      panels.forEach((panel, i) => { panel.hidden = i !== current; });
      steps.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
      status.textContent = `${current + 1} / ${panels.length} · ${steps[current].dataset.label}`;
      previous.disabled = current === 0;
      next.disabled = current === panels.length - 1;
    }
    steps.forEach((button, i) => button.addEventListener('click', () => { stop(); show(i); }));
    previous.addEventListener('click', () => { stop(); show(Math.max(0, current - 1)); });
    next.addEventListener('click', () => { stop(); show(Math.min(panels.length - 1, current + 1)); });
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      if (current === panels.length - 1) show(0);
      walk.classList.add('is-playing');
      play.textContent = 'Pause walkthrough';
      play.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => {
        if (current === panels.length - 1) { stop(); return; }
        show(current + 1);
      }, 9000);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    reducedMotion.addEventListener('change', stop);
    walk.querySelectorAll('[data-enhanced]').forEach(el => { el.hidden = false; });
    walk.classList.add('is-ready');
    show(0);
  });

  const gallery = document.querySelector('[data-audio-gallery]');
  if (gallery) {
    const filters = gallery.querySelector('[data-filters]');
    const language = gallery.querySelector('select[data-language]');
    const mode = gallery.querySelector('select[data-mode]');
    const cards = [...gallery.querySelectorAll('.audio-card')];
    function filter() {
      let count = 0;
      cards.forEach(card => {
        const matches = (language.value === 'all' || card.dataset.language === language.value)
          && (mode.value === 'all' || card.dataset.mode === mode.value);
        card.hidden = !matches;
        if (matches) count++;
        else card.querySelector('audio').pause();
      });
      gallery.querySelector('[data-count]').textContent = `${count} ${count === 1 ? 'example' : 'examples'}`;
      gallery.querySelector('[data-empty]').hidden = count !== 0;
    }
    filters.hidden = false;
    language.addEventListener('change', filter);
    mode.addEventListener('change', filter);
    filter();
  }

  const audioElements = [...document.querySelectorAll('audio')];
  audioElements.forEach(audio => {
    const card = audio.closest('.audio-card');
    audio.addEventListener('play', () => {
      audioElements.forEach(other => { if (other !== audio) other.pause(); });
      card?.classList.add('is-playing');
    });
    ['pause', 'ended'].forEach(event => audio.addEventListener(event, () => card?.classList.remove('is-playing')));
    audio.addEventListener('error', () => {
      const message = audio.parentElement.querySelector('.audio-error');
      if (message) message.hidden = false;
    });
  });
  // Collapsing the progressively enhanced steps changes the position of deep links.
  // Align once fonts and layout have settled, including direct links to the gallery.
  async function alignDeepLink() {
    if (!['#listen', '#walkthrough'].includes(window.location.hash)) return;
    if (document.fonts) await document.fonts.ready;
    requestAnimationFrame(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }
  if (document.readyState === 'complete') alignDeepLink();
  else window.addEventListener('load', alignDeepLink, { once: true });
})();
