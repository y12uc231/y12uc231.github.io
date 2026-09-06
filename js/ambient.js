/* A decorative field of connections: no content or navigation depends on it. */
(() => {
  const scene = document.querySelector('.ambient-background');
  const canvas = scene?.querySelector('canvas');
  const toggle = document.querySelector('.motion-toggle');
  const ctx = canvas?.getContext('2d');
  if (!ctx || !toggle) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const storageKey = 'sk-background-motion-paused';
  let paused = false;
  try { paused = localStorage.getItem(storageKey) === 'true'; } catch { /* Optional preference. */ }
  let width = 1, height = 1;
  let frame = 0, resizeFrame = 0, previous = 0, lastDraw = 0, elapsed = 0;
  let pointerX = 0, pointerY = 0, scroll = 0;
  let smoothX = 0, smoothY = 0, smoothScroll = 0;
  const running = () => !paused && !reducedMotion.matches && !document.hidden;

  function point(t, strand, side, phase) {
    const band = Math.min(250, width * 0.24);
    const direction = side ? -1 : 1;
    const origin = side ? width - band * 0.11 : band * 0.05;
    const arc = Math.sin(t * Math.PI * 2 + phase + side * 1.9);
    const spread = 0.15 + 0.85 * Math.sin(t * Math.PI * 1.4 - phase * 0.35) ** 2;
    return [
      origin + direction * band * (arc * 0.32 + strand * spread * 0.56)
        + Math.sin(t * 8 + strand * 2 + phase) * band * 0.08 + smoothX * 12,
      t * (height + 100) - 50 + smoothY * 9 - smoothScroll * 24,
    ];
  }
  function trace(strand, side, phase, start = 0, end = 1) {
    const steps = Math.max(3, Math.ceil((end - start) * 52));
    ctx.beginPath();
    for (let n = 0; n <= steps; n++) {
      const [x, y] = point(start + (end - start) * n / steps, strand, side, phase);
      if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  function drawField(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 0.75;
    const phase = time * 0.045 + smoothScroll * 0.65;
    for (let side = 0; side < 2; side++) {
      for (let n = 0; n < 25; n++) {
        const strand = n / 24 * 2 - 1;
        const opacity = 0.08 + (1 - Math.abs(strand)) * 0.07;
        ctx.strokeStyle = side ? `rgba(49,88,201,${opacity})` : `rgba(8,124,116,${opacity})`;
        trace(strand, side, phase);
      }
      // A short, quiet highlight passes along a connection; there are no flashing nodes.
      const position = (time * 0.025 + side * 0.46) % 1;
      const fade = Math.sin(position * Math.PI) ** 2;
      ctx.strokeStyle = side ? `rgba(49,88,201,${fade * 0.2})` : `rgba(8,124,116,${fade * 0.18})`;
      ctx.lineWidth = 1.1;
      trace(0.25, side, phase, Math.max(0, position - 0.055), Math.min(1, position + 0.055));
      ctx.lineWidth = 0.75;
    }
  }
  function tick(timestamp) {
    frame = 0;
    if (!running()) return;
    elapsed += previous ? Math.min(timestamp - previous, 64) / 1000 : 0;
    previous = timestamp;
    if (timestamp - lastDraw >= 1000 / 30) {
      smoothX += (pointerX - smoothX) * 0.045;
      smoothY += (pointerY - smoothY) * 0.045;
      smoothScroll += (scroll - smoothScroll) * 0.045;
      drawField(elapsed);
      lastDraw = timestamp;
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    toggle.hidden = reducedMotion.matches;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    if (running() && !frame) {
      previous = 0;
      frame = requestAnimationFrame(tick);
    } else if (!running()) {
      cancelAnimationFrame(frame);
      frame = previous = 0;
      drawField(elapsed);
    }
  }
  function updateScroll() {
    const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scroll = Math.max(0, Math.min(1, scrollY / range));
  }
  function resize() {
    resizeFrame = 0;
    width = innerWidth;
    height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    updateScroll();
    drawField(elapsed);
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, String(paused)); } catch { /* Keep it for this visit. */ }
    sync();
  });
  addEventListener('scroll', updateScroll, { passive: true });
  addEventListener('resize', () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
  }, { passive: true });
  addEventListener('pointermove', event => {
    if (!running() || !finePointer.matches || event.pointerType === 'touch') return;
    pointerX = event.clientX / Math.max(1, width) - 0.5;
    pointerY = event.clientY / Math.max(1, height) - 0.5;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  resize();
  sync();
})();
