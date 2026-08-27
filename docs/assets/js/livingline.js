(function () {
  "use strict";

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(pointer: fine)").matches;
  const instances = [];
  let frame = 0;
  let last = 0;

  const moods = {
    calm: { amplitude: 16, period: 5200, noise: 1, hesitate: 0, distractionMin: 22000, distractionMax: 35000, recovery: 1200 },
    distracted: { amplitude: 19, period: 3800, noise: 1.4, hesitate: 0, distractionMin: 4000, distractionMax: 7000, recovery: 1200 },
    hesitant: { amplitude: 20, period: 4500, noise: 1, hesitate: 1, hesitationMin: 3000, hesitationMax: 5000, distractionMin: 26000, distractionMax: 36000, recovery: 1800 }
  };

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function ease(value) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);
  }

  function loop(now) {
    const delta = Math.min(34, now - (last || now));
    last = now;
    let active = false;
    instances.forEach((line) => {
      if (line.nearViewport || line.fixed) {
        line.update(now, delta);
        active = true;
      }
    });
    if (active && !document.hidden) frame = requestAnimationFrame(loop);
    else frame = 0;
  }

  function start() {
    if (!frame && !reducedQuery.matches && !document.hidden) {
      last = 0;
      frame = requestAnimationFrame(loop);
    }
  }

  class LivingLine {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.options = Object.assign({ amplitude: 22, breathPeriod: 4500, hesitation: true, distraction: true, pointer: true, opacity: 1, fixed: false }, options);
      this.fixed = this.options.fixed;
      this.nearViewport = this.fixed;
      this.baseAmplitude = this.options.amplitude;
      this.current = { amplitude: this.options.amplitude, period: this.options.breathPeriod, noise: 1, opacity: this.options.opacity };
      this.target = Object.assign({}, this.current);
      this.pointer = { x: -999, y: -999, lift: 0 };
      this.simTime = 0;
      this.soul = false;
      this.hesitationStart = 0;
      this.nextHesitation = performance.now() + randomBetween(6000, 14000);
      this.distractionStart = 0;
      this.nextDistraction = performance.now() + randomBetween(15000, 30000);
      this.distractionDuration = 8000;
      this.mood = null;
      this.moodConfig = null;
      this.resize = this.resize.bind(this);
      this.onPointer = this.onPointer.bind(this);
      addEventListener("resize", this.resize, { passive: true });
      if (this.options.pointer && finePointer) addEventListener("pointermove", this.onPointer, { passive: true });
      this.observer = new IntersectionObserver((entries) => {
        this.nearViewport = entries[0].isIntersecting;
        if (this.nearViewport) start();
      }, { rootMargin: "20%" });
      this.observer.observe(canvas);
      instances.push(this);
      this.resize();
      if (reducedQuery.matches) this.render(1200, 0);
      else start();
    }

    onPointer(event) {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = Math.min(devicePixelRatio || 1, 1.5);
      this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.render(performance.now(), 0);
    }

    setMood(name) {
      if (!moods[name]) return;
      this.mood = name;
      this.moodConfig = moods[name];
      this.target.amplitude = this.moodConfig.amplitude;
      this.target.period = this.moodConfig.period;
      this.target.noise = this.moodConfig.noise;
      this.nextHesitation = performance.now() + randomBetween(this.moodConfig.hesitationMin || 9000, this.moodConfig.hesitationMax || 14000);
      this.nextDistraction = performance.now() + randomBetween(this.moodConfig.distractionMin, this.moodConfig.distractionMax);
      if (reducedQuery.matches) this.render(performance.now(), 0);
      else start();
    }

    setSoul(isSoul) {
      this.soul = isSoul;
      if (isSoul) {
        this.target.opacity = 1;
        this.target.period = 6000;
        this.target.amplitude = 26;
        this.hesitationStart = 0;
      }
    }

    update(now, delta) {
      if (this.fixed && !this.soul) {
        const progress = Math.min(1, scrollY / (innerHeight * 1.2));
        this.target.opacity = 1 - progress * .75;
        this.target.amplitude = this.baseAmplitude * (1 - progress * .5);
        this.target.period = this.options.breathPeriod;
      }
      const lerp = 1 - Math.pow(.985, delta);
      Object.keys(this.current).forEach((key) => {
        this.current[key] += (this.target[key] - this.current[key]) * lerp;
      });
      this.render(now, delta);
    }

    hesitation(now) {
      const config = this.moodConfig;
      const enabled = this.soul ? false : (config ? config.hesitate : this.options.hesitation);
      if (!enabled) return { amplitude: 1, speed: 1 };
      const min = config ? config.hesitationMin : 6000;
      const max = config ? config.hesitationMax : 14000;
      const recovery = config ? config.recovery : 1200;
      if (!this.hesitationStart && now >= this.nextHesitation) this.hesitationStart = now;
      if (!this.hesitationStart) return { amplitude: 1, speed: 1 };
      const elapsed = now - this.hesitationStart;
      if (elapsed < 700) {
        const amount = ease(elapsed / 700);
        return { amplitude: 1 - amount * .75, speed: 1 - amount * .7 };
      }
      if (elapsed < 700 + recovery) {
        const amount = ease((elapsed - 700) / recovery);
        return { amplitude: .25 + amount * .75, speed: .3 + amount * .7 };
      }
      this.hesitationStart = 0;
      this.nextHesitation = now + randomBetween(min, max);
      return { amplitude: 1, speed: 1 };
    }

    distraction(now, x) {
      const config = this.moodConfig;
      const enabled = this.options.distraction || (config && config.distractionMin < 10000);
      if (!enabled || this.soul) return 0;
      const min = config ? config.distractionMin : 15000;
      const max = config ? config.distractionMax : 30000;
      if (!this.distractionStart && now >= this.nextDistraction) this.distractionStart = now;
      if (!this.distractionStart) return 0;
      const progress = (now - this.distractionStart) / this.distractionDuration;
      if (progress >= 1) {
        this.distractionStart = 0;
        this.nextDistraction = now + randomBetween(min, max);
        return 0;
      }
      const center = this.width * progress;
      const envelope = Math.sin(Math.PI * progress);
      const sigma = this.width * .06;
      return -this.current.amplitude * 1.6 * envelope * Math.exp(-Math.pow(x - center, 2) / (2 * sigma * sigma));
    }

    render(now, delta) {
      const context = this.context;
      if (!context || !this.width || !this.height) return;
      const hesitation = reducedQuery.matches ? { amplitude: 1, speed: 0 } : this.hesitation(now);
      this.simTime += (delta / 1000) * hesitation.speed;
      const t = reducedQuery.matches ? ({ calm: .3, distracted: 1.7, hesitant: 3.4 }[this.mood] || .8) : this.simTime;
      const period = this.current.period || 4500;
      const breath = reducedQuery.matches ? .72 : .55 + .45 * Math.sin((now / period) * Math.PI * 2);
      const rect = this.canvas.getBoundingClientRect();
      const pointerX = this.pointer.x - rect.left;
      const proximity = finePointer ? Math.max(0, 1 - Math.abs(this.pointer.y - (rect.top + this.height / 2)) / 120) : 0;
      this.pointer.lift += (proximity * this.current.amplitude * .85 - this.pointer.lift) * .08;
      const mid = this.height / 2;
      const path = new Path2D();
      for (let i = 0; i <= 140; i += 1) {
        const x = this.width * i / 140;
        const normalized = x / this.width;
        const taper = Math.pow(Math.sin(Math.PI * normalized), .8);
        const speed = this.current.noise;
        const noise = .6 * Math.sin(normalized * 5.7 + t * .7 * speed) + .3 * Math.sin(normalized * 14.5 - t * .4 * speed) + .15 * Math.sin(normalized * 32 + t * 1.3 * speed);
        const cursor = this.pointer.lift * Math.exp(-Math.pow(x - pointerX, 2) / (2 * 72 * 72));
        const y = mid + this.current.amplitude * breath * hesitation.amplitude * taper * noise + this.distraction(now, x) - cursor;
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      context.clearRect(0, 0, this.width, this.height);
      const gradient = context.createLinearGradient(0, 0, this.width, 0);
      gradient.addColorStop(0, "#e4998b");
      gradient.addColorStop(1, "#ddb27a");
      const pulse = reducedQuery.matches ? 1 : .92 + .08 * Math.sin((now / period) * Math.PI * 2);
      context.strokeStyle = gradient;
      context.globalAlpha = .06 * this.current.opacity;
      context.lineWidth = 6;
      context.stroke(path);
      context.globalAlpha = .9 * pulse * this.current.opacity;
      context.lineWidth = 1.25;
      context.stroke(path);
      context.globalAlpha = 1;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else start();
  });

  reducedQuery.addEventListener("change", () => location.reload());
  window.LivingLine = LivingLine;
}());
