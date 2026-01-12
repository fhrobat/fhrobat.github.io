(function () {

  // SKIP LOADER SE ARRIVO DAL BACK-LINK
  if (sessionStorage.getItem('skip-home-loader') === 'true') {
    sessionStorage.removeItem('skip-home-loader');

    const loaderEl = document.getElementById('page-loader');
    if (loaderEl) {
      loaderEl.classList.add('hidden');
      loaderEl.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove('loading');
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');

    window.dispatchEvent(new CustomEvent('page-loader-finished'));
    return;
  }

  // ===============================
  // SKIP LOADER SU BACK/FORWARD
  // ===============================

  const navEntry = performance.getEntriesByType('navigation')[0];
  const isBackForward = navEntry && navEntry.type === 'back_forward';

  // Se torniamo da back/forward cache, ripristina stato e NON avviare loader
  window.addEventListener('pageshow', function (event) {
    if (event.persisted || isBackForward) {
      const loaderEl = document.getElementById('page-loader');
      if (loaderEl) {
        loaderEl.classList.add('hidden');
        loaderEl.setAttribute('aria-hidden', 'true');
      }

      document.body.classList.remove('loading');
      document.documentElement.classList.remove('no-scroll');
      document.body.classList.remove('no-scroll');

      window.dispatchEvent(new CustomEvent('page-loader-finished'));
    }
  });

  // Blocca esecuzione iniziale se back/forward
  if (isBackForward) {
    return;
  }

  // ===============================
  // CONFIG: tieni sincronizzati con SCSS
  // ===============================

  const pulseDuration = 700; // ms
  const pulseCount = 2;     // pulsazioni

  // ===============================
  // LOCK / UNLOCK SCROLL
  // ===============================

  function lockPageScroll() {
    document.documentElement.classList.add('no-scroll');
    document.body.classList.add('no-scroll');
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');
  }

  // ===============================
  // INIT
  // ===============================

  document.body.classList.add('loading');
  lockPageScroll();

  // ===============================
  // FINISH LOADER (pubblica)
  // ===============================

  if (typeof window.finishPageLoader !== 'function') {
    window.finishPageLoader = function finishPageLoader() {
      const loaderEl = document.getElementById('page-loader');
      if (loaderEl) {
        loaderEl.classList.add('hidden');
        loaderEl.setAttribute('aria-hidden', 'true');
      }

      unlockPageScroll();
      document.body.classList.remove('loading');

      window.dispatchEvent(new CustomEvent('page-loader-finished'));
    };
  }

  // ===============================
  // LOAD COMPLETE → WAIT PULSE
  // ===============================

  function onLoadFinish() {
    const delay = pulseDuration * pulseCount;
    setTimeout(() => {
      if (typeof window.finishPageLoader === 'function') {
        window.finishPageLoader();
      }
    }, delay);
  }

  if (document.readyState === 'complete') {
    onLoadFinish();
  } else {
    window.addEventListener('load', onLoadFinish, { once: true });
  }

  // ===============================
  // REDUCED MOTION FALLBACK
  // ===============================

  if (
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    const loaderEl = document.getElementById('page-loader');
    if (loaderEl) {
      loaderEl.classList.add('hidden');
      loaderEl.setAttribute('aria-hidden', 'true');
    }

    unlockPageScroll();
    document.body.classList.remove('loading');

    window.dispatchEvent(new CustomEvent('page-loader-finished'));
  }

})();
