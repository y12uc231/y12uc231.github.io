const heading = document.querySelector('#opening-line');
if (heading) {
  const quotes = [...heading.querySelectorAll('.opening-quote')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const PERIOD = 7000, FADE = 400;
  let index = 0, timer = 0, swapTimer = 0;
  let paused = false, visible = false, hovered = heading.matches(':hover'), focused = heading.contains(document.activeElement);
  const canRun = () => quotes.length > 1 && !paused && visible && !hovered && !focused &&
    !document.hidden && !reduced.matches;

  function cancel() {
    clearTimeout(timer); clearTimeout(swapTimer);
    timer = swapTimer = 0;
    quotes[index].classList.remove('is-leaving', 'is-entering');
  }
  function schedule() {
    cancel();
    if (canRun()) timer = setTimeout(advance, PERIOD - FADE);
  }
  function advance() {
    timer = 0;
    if (!canRun()) return;
    const current = quotes[index];
    current.classList.add('is-leaving');
    swapTimer = setTimeout(() => {
      swapTimer = 0;
      if (!canRun()) { cancel(); return; }
      current.hidden = true; current.inert = true;
      current.classList.remove('is-leaving');
      index = (index + 1) % quotes.length;
      const next = quotes[index];
      next.classList.add('is-entering');
      next.hidden = false; next.inert = false;
      next.getBoundingClientRect();
      next.classList.remove('is-entering');
      timer = setTimeout(advance, PERIOD - FADE);
    }, FADE);
  }
  heading.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') { hovered = true; schedule(); }
  });
  heading.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  heading.addEventListener('focusin', () => { focused = true; schedule(); });
  heading.addEventListener('focusout', () => {
    queueMicrotask(() => { focused = heading.contains(document.activeElement); schedule(); });
  });
  document.addEventListener('sk-motion-change', event => { paused = event.detail.paused; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  new IntersectionObserver(entries => {
    const next = entries[0].isIntersecting;
    if (visible !== next) { visible = next; schedule(); }
  }).observe(heading);
  schedule();
}
