(function () {

  // il loader si vede solo alla prima visita della sessione
  // (sessionStorage lancia un errore se il browser blocca i dati del sito)
  let skip = false;
  try {
    skip = sessionStorage.getItem('skip-home-loader') === 'true' ||
      sessionStorage.getItem('home-loader-shown') === 'true';
    sessionStorage.removeItem('skip-home-loader');
    sessionStorage.setItem('home-loader-shown', 'true');
  } catch (e) {}

  // SKIP LOADER SE ARRIVO DAL BACK-LINK (o se l'utente preferisce meno animazioni)
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (skip || reducedMotion) {

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
  const pulseCount = 1;     // pulsazioni
  const maxWait = 1500;     // ms: non aspettare oltre immagini lente o script di terze parti

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

  // il loader resta almeno una pulsazione, e chiude al load della pagina o dopo maxWait
  const started = performance.now();
  let finished = false;

  function onLoadFinish() {
    if (finished) return;
    finished = true;
    const delay = Math.max(0, pulseDuration * pulseCount - (performance.now() - started));
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
    setTimeout(onLoadFinish, maxWait);
  }

})();
