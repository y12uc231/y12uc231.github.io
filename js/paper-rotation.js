const research = document.querySelector('#research');
if (research) {
  const stage = research.querySelector('.paper-rotation');
  const groups = [...stage.querySelectorAll('.paper-set')];
  const button = research.querySelector('.papers-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const HOLD = 5000, FADE = 320;
  let index = 0, timer = 0, swapTimer = 0;
  let hovered = research.matches(':hover'), focused = false;
  let visible = false, paused = false;

  const canRotate = () => groups.length > 1 && visible && !document.hidden &&
    !reduced.matches && !paused && !hovered && !focused &&
    !research.contains(document.activeElement) && !groups[index].querySelector('details[open]') &&
    !research.querySelector('.publication-details').open;

  function cancel() {
    clearTimeout(timer);
    clearTimeout(swapTimer);
    timer = swapTimer = 0;
    // Restore the same links if someone starts reading during a fade.
    groups[index].classList.remove('is-leaving', 'is-entering');
  }

  function schedule() {
    cancel();
    button.hidden = reduced.matches || groups.length < 2;
    button.textContent = paused ? 'Resume' : 'Pause';
    button.setAttribute('aria-label', paused ? 'Resume paper rotation' : 'Pause paper rotation');
    if (canRotate()) timer = setTimeout(advance, HOLD);
  }

  function advance() {
    timer = 0;
    if (!canRotate()) return;
    const current = groups[index];
    current.classList.add('is-leaving');
    swapTimer = setTimeout(() => {
      swapTimer = 0;
      if (!canRotate()) { cancel(); return; }
      current.hidden = true;
      current.inert = true;
      current.classList.remove('is-leaving');
      index = (index + 1) % groups.length;
      const next = groups[index];
      next.classList.add('is-entering');
      next.hidden = false;
      next.inert = false;
      next.getBoundingClientRect();
      next.classList.remove('is-entering');
      timer = setTimeout(advance, HOLD);
    }, FADE);
  }

  research.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') { hovered = true; schedule(); }
  });
  research.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  research.addEventListener('focusin', () => { focused = true; schedule(); });
  research.addEventListener('focusout', () => {
    queueMicrotask(() => { focused = research.contains(document.activeElement); schedule(); });
  });
  // Native Details events do not bubble; capture preserves any open paper.
  research.addEventListener('toggle', schedule, true);
  button.addEventListener('click', () => { paused = !paused; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  new IntersectionObserver(entries => {
    const next = entries[0].isIntersecting;
    if (visible !== next) { visible = next; schedule(); }
  }, {threshold: 0}).observe(stage);
  schedule();
}
