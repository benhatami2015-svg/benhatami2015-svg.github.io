(() => {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  const indicator = document.querySelector('#pullRefreshIndicator');
  const label = indicator.querySelector('span');
  let startY = 0;
  let distance = 0;
  let tracking = false;
  let refreshing = false;
  const threshold = 88;

  function atTop() {
    return Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop, 0) <= 2;
  }

  function reset() {
    indicator.style.height = '0px';
    indicator.classList.remove('refreshing');
    label.textContent = '↓ Pull down to refresh';
    distance = 0;
  }

  window.addEventListener('touchstart', event => {
    if (refreshing || event.touches.length !== 1 || !atTop()) return;
    if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"], dialog[open]')) return;
    tracking = true;
    startY = event.touches[0].clientY;
    distance = 0;
  }, { passive: true });

  window.addEventListener('touchmove', event => {
    if (!tracking || refreshing || event.touches.length !== 1) return;
    if (!atTop()) {
      tracking = false;
      reset();
      return;
    }
    const delta = event.touches[0].clientY - startY;
    if (delta <= 0) {
      tracking = false;
      reset();
      return;
    }
    if (delta > 8 && event.cancelable) event.preventDefault();
    distance = delta;
    indicator.style.height = `${Math.min(68, delta * 0.62)}px`;
    label.textContent = delta >= threshold ? '↑ Release to refresh' : '↓ Pull down to refresh';
  }, { passive: false });

  function finishGesture() {
    if (!tracking) return;
    tracking = false;
    if (distance >= threshold) {
      refreshing = true;
      indicator.classList.add('refreshing');
      indicator.style.height = '58px';
      label.textContent = 'Refreshing…';
      window.setTimeout(() => window.location.reload(), 120);
    } else {
      reset();
    }
  }

  window.addEventListener('touchend', finishGesture, { passive: true });
  window.addEventListener('touchcancel', () => {
    tracking = false;
    if (!refreshing) reset();
  }, { passive: true });
})();

