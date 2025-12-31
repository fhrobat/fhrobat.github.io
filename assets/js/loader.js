(function () {
  // CONFIG
  const pulseDuration = 1100;  // ms -> deve corrispondere all'animazione CSS
  const pulseCount = 2;        // quante pulsazioni aspettare
  const cascadeDelayStep = 90; // ms per ogni figlio in cascade

  // Immediately mark page as loading to stop reveals
  document.body.classList.add('loading');
  // Also lock scroll
  function lockPageScroll() {
    document.documentElement.classList.add('no-scroll');
    document.body.classList.add('no-scroll');
  }
  function unlockPageScroll() {
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');
  }
  lockPageScroll();

  // Ensure finishPageLoader exists
  if (typeof window.finishPageLoader !== 'function') {
    window.finishPageLoader = function finishPageLoader() {
      const loaderEl = document.getElementById('page-loader');
      if (loaderEl) {
        loaderEl.classList.add('hidden');
        loaderEl.setAttribute('aria-hidden', 'true');
      }
      // unlock page scrolling first
      unlockPageScroll();
      // now allow observer to react
      document.body.classList.remove('loading');
      // dispatch an event for post-loader actions
      window.dispatchEvent(new CustomEvent('page-loader-finished'));
    };
  }

  // On window load, wait pulseCount * pulseDuration and then finish
  function onLoadFinish() {
    const delay = pulseDuration * pulseCount;
    setTimeout(() => {
      if (typeof window.finishPageLoader === 'function') window.finishPageLoader();
    }, delay);
  }
  if (document.readyState === 'complete') onLoadFinish();
  else window.addEventListener('load', onLoadFinish, { once: true });

  // If user prefers reduced motion, skip reveals
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    // also hide loader immediately
    if (typeof window.finishPageLoader === 'function') window.finishPageLoader();
    return;
  }

  // IntersectionObserver helper functions
  function initCascade(el) {
    if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
      [...el.children].forEach((child, i) => {
        child.style.transitionDelay = `${i * cascadeDelayStep}ms`;
      });
      el.dataset.cascadeInitialized = '1';
    }
  }
  function clearCascade(el) {
    if (el.classList.contains('cascade') && el.dataset.cascadeInitialized) {
      [...el.children].forEach(child => child.style.transitionDelay = '');
      delete el.dataset.cascadeInitialized;
    }
  }
  function isFullyVisibleRect(rect) {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.top >= 0 && rect.bottom <= vh;
  }
  function buildThresholdList(steps = 20) {
    const list = [];
    for (let i = 0; i <= steps; i++) list.push(i / steps);
    return list;
  }

  // Setup observer
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    // if loader still active, ignore all reveals
    if (document.body.classList.contains('loading')) return;

    entries.forEach(entry => {
      const el = entry.target;
      const ratio = entry.intersectionRatio;
      const rect = entry.boundingClientRect;
      const fullyVisible = isFullyVisibleRect(rect);
      const completelyOut = ratio === 0;

      if (fullyVisible) {
        initCascade(el);
        el.classList.add('active');
        return;
      }

      if (completelyOut) {
        el.classList.remove('active');
        clearCascade(el);
        return;
      }

      // partially visible: remove active but keep cascade init (to avoid flicker)
      if (el.classList.contains('active')) el.classList.remove('active');
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: buildThresholdList(20)
  });

  // Observe existing reveals
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Handle dynamic <details> content
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details && details.tagName && details.tagName.toLowerCase() === 'details') {
      const content = details.querySelector('.smooth-content');
      if (content) {
        if (!content.classList.contains('reveal')) content.classList.add('reveal');
        observer.observe(content);
      }
    }
  }, true);

  // After loader finished, run a one-off check to activate already-visible reveals
  function runRevealCheck() {
    document.querySelectorAll('.reveal').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (isFullyVisibleRect(rect)) {
        if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
          [...el.children].forEach((child, i) => child.style.transitionDelay = `${i * cascadeDelayStep}ms`);
          el.dataset.cascadeInitialized = '1';
        }
        el.classList.add('active');
      }
    });
  }
  window.addEventListener('page-loader-finished', () => {
    // small timeout to allow layout stabilization
    setTimeout(runRevealCheck, 20);
  });

})();
