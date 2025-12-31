(function () {
  // === CONFIG ===
  const pulseDuration = 1100; // ms (deve corrispondere a loader-pulse)
  const pulseCount = 2;       // quante pulsazioni mostrare prima di nascondere
  const cascadeDelayStep = 90; // ms tra elementi cascade

  // Imposta loading flag subito
  document.body.classList.add('loading');

  // --- finishPageLoader: rimuove loader e rilascia observer ---
  if (typeof window.finishPageLoader !== 'function') {
    window.finishPageLoader = function finishPageLoader() {
      const loaderEl = document.getElementById('page-loader');
      if (loaderEl) {
        loaderEl.classList.add('hidden');
        loaderEl.setAttribute('aria-hidden', 'true');
      }
      // togli flag loading: ora l'observer potrà reagire
      document.body.classList.remove('loading');

      // dispatch evento per eventuali listener
      window.dispatchEvent(new CustomEvent('page-loader-finished'));
    };
  }

  // Quando la pagina ha finito il caricamento, aspetta pulseCount pulsazioni e chiama finishPageLoader
  function onLoadFinish() {
    const delay = pulseDuration * pulseCount;
    setTimeout(() => {
      if (typeof window.finishPageLoader === 'function') window.finishPageLoader();
    }, delay);
  }

  if (document.readyState === 'complete') {
    // se già caricato
    onLoadFinish();
  } else {
    window.addEventListener('load', onLoadFinish, { once: true });
  }

  // --- IntersectionObserver SETUP ---
  // Se preferenze ridotte: attiva tutto e non osservare
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    // fallback
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  // helper cascade init/clear
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

  // fully visible check (geometric)
  function isFullyVisibleRect(rect) {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.top >= 0 && rect.bottom <= vh;
  }

  // Build thresholds for smoother observer events
  function buildThresholdList(steps = 20) {
    const list = [];
    for (let i = 0; i <= steps; i++) list.push(i / steps);
    return list;
  }

  // main observer callback
  const observer = new IntersectionObserver((entries) => {
    // if loading, ignore events
    if (document.body.classList.contains('loading')) return;

    entries.forEach(entry => {
      const el = entry.target;
      const ratio = entry.intersectionRatio;

      // fully out if ratio === 0
      const completelyOut = ratio === 0;
      const rect = entry.boundingClientRect;
      const fullyVisible = isFullyVisibleRect(rect);

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

      // partial: toggle off but keep cascade initialized (avoid flicker)
      if (el.classList.contains('active')) el.classList.remove('active');
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: buildThresholdList(20)
  });

  // observe all reveals
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // handle dynamic details (if you use them)
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

  // run a one-off check after loader finito
  function runRevealCheck() {
    document.querySelectorAll('.reveal').forEach(el => {
      const rect = el.getBoundingClientRect();
      const fullyVisible = isFullyVisibleRect(rect);
      if (fullyVisible) {
        if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
          [...el.children].forEach((child, i) => child.style.transitionDelay = `${i * cascadeDelayStep}ms`);
          el.dataset.cascadeInitialized = '1';
        }
        el.classList.add('active');
      } else {
        // opzionale: rimuovi active su quelli parziali
        // el.classList.remove('active');
      }
    });
  }

  // ascolta l'evento che abbiamo dispatchato in finishPageLoader()
  window.addEventListener('page-loader-finished', () => {
    // piccolo delay per lasciare tempo al layout di stabilizzarsi
    setTimeout(runRevealCheck, 20);
  });

  // (opzionale) se vuoi che l'observer non parta finché loader attivo,
  // potresti callare observer.observe dopo finishPageLoader invece di sopra.
})();
