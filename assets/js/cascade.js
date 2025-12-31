 // CONFIG
  const CASCADE_CHILD_DELAY = 80;     // ms stagger per i figli .reveal.cascade > *
  const IO_THRESHOLD = 0.12;          // soglia intersectionRatio per considerare "in viewport"
  const WAIT_AFTER_LOADER_MS = 60;    // micro-delay dopo che il loader ha finito
  const EXTRA_CLEANUP_PADDING = 150;
  const debug = true;                 // metti true per vedere i log (tu l'hai già messo true)

  function log(...args) { if (debug) console.log('[reveal-io]', ...args); }

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // parse "700ms" / "0.7s" -> ms
  function parseTimeToMs(s) {
    if (!s) return 0;
    return Math.max(...s.split(',').map(x => x.trim()).map(x => {
      if (x.endsWith('ms')) return parseFloat(x);
      if (x.endsWith('s')) return parseFloat(x) * 1000;
      const n = parseFloat(x); return Number.isFinite(n) ? n : 0;
    }));
  }

  // calcola cleanup timeout dinamico
  function getCleanupTimeoutMs(selectorRoot = '.reveal') {
    let max = 0;
    try {
      document.querySelectorAll(selectorRoot).forEach(root => {
        const csRoot = getComputedStyle(root);
        const rootMax = parseTimeToMs(csRoot.transitionDuration) + parseTimeToMs(csRoot.transitionDelay);
        max = Math.max(max, rootMax);
        if (root.classList.contains('cascade')) {
          Array.from(root.children).forEach((child, i) => {
            const cs = getComputedStyle(child);
            const childMax = parseTimeToMs(cs.transitionDuration) + parseTimeToMs(cs.transitionDelay) + (i * CASCADE_CHILD_DELAY);
            max = Math.max(max, childMax);
          });
        }
      });
    } catch (e) { log('err getCleanup', e); }
    return Math.ceil(max) + EXTRA_CLEANUP_PADDING;
  }

  // check se il loader è visibile/finito
  function loaderAlreadyFinished() {
    const loader = document.getElementById('page-loader');
    if (!loader) {
      // fallback: body.loading rimosso o document ready complete
      return !document.body.classList.contains('loading') || document.readyState === 'complete';
    }
    const cs = getComputedStyle(loader);
    return loader.classList.contains('hidden') || loader.classList.contains('done') || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0;
  }

  function forceRepaint(el) { if (!el) return; el.getBoundingClientRect(); }

  // attiva reveal (single o cascade) e segna data-revealdone
  function activateReveal(el) {
    if (!el || el.dataset.revealDone === 'true') return;
    if (prefersReduced) {
      el.classList.add('active');
      el.dataset.revealDone = 'true';
      return;
    }
    if (el.classList.contains('cascade')) {
      Array.from(el.children).forEach((ch, i) => ch.style.transitionDelay = `${i * CASCADE_CHILD_DELAY}ms`);
      forceRepaint(el);
      requestAnimationFrame(() => {
        el.classList.add('active');
        el.dataset.revealDone = 'true';
      });
    } else {
      requestAnimationFrame(() => {
        el.classList.add('active');
        el.dataset.revealDone = 'true';
      });
    }
  }

  // cleanup inline delays
  function scheduleCleanup() {
    const t = getCleanupTimeoutMs();
    log('cleanup timeout (ms):', t);
    setTimeout(() => {
      document.querySelectorAll('.reveal.cascade > *').forEach(ch => ch.style.transitionDelay = '');
      log('cleanup: transitionDelay rimossi');
    }, t);
  }

  // --- MAIN: crea IntersectionObserver ma NON osserva ancora gli elementi ---
  let io = null;
  function createObserver() {
    if (io) return io;
    io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const el = entry.target;
        // GUARD: se il loader non è ancora finito, ignoro questa entry
        if (!loaderAlreadyFinished()) {
          log('entry ignorata perché loader ancora visibile', el);
          return;
        }
        // considera "entrato" solo se intersecting e oltre la soglia
        if (entry.isIntersecting && entry.intersectionRatio >= IO_THRESHOLD) {
          log('intersection -> activate', el);
          activateReveal(el);
          observer.unobserve(el);
        }
      });
    }, {
      threshold: IO_THRESHOLD
    });
    return io;
  }

  // osserva tutti gli elementi .reveal (chiamare SOLO dopo che loader è finito)
  function observeAllReveals() {
    const items = Array.from(document.querySelectorAll('.reveal'));
    if (!items.length) { log('observeAllReveals: nessun .reveal trovato'); return; }
    const observer = createObserver();
    items.forEach(it => {
      if (it.dataset.revealDone === 'true') return;
      observer.observe(it);
    });
    scheduleCleanup();
    // esegui un check immediato per attivare gli elementi già visibili ora che loader è finito
    // (non ci fidiamo soltanto dell'IO perché alcune browser non triggerano subito)
    requestAnimationFrame(() => {
      items.forEach(it => {
        if (it.dataset.revealDone === 'true') return;
        const rect = it.getBoundingClientRect();
        const visible = rect.top < (window.innerHeight || document.documentElement.clientHeight) && rect.bottom > 0;
        if (visible) {
          log('hit-check: elemento già visibile -> activate', it);
          activateReveal(it);
          try { createObserver().unobserve(it); } catch(e) {}
        }
      });
    });
  }

  // Hook: aspetta che il page-loader sia finito, poi inizia a osservare
  function hookToLoaderFinish() {
    // se già finito -> avvia subito
    if (loaderAlreadyFinished()) {
      log('loader già finito -> avvio observer tra', WAIT_AFTER_LOADER_MS, 'ms');
      setTimeout(observeAllReveals, WAIT_AFTER_LOADER_MS);
      return;
    }

    // ascolta evento custom che il tuo finishPageLoader dispatcha
    window.addEventListener('page-loader-finished', () => {
      log('ricevuto page-loader-finished -> avvio observer tra', WAIT_AFTER_LOADER_MS, 'ms');
      setTimeout(observeAllReveals, WAIT_AFTER_LOADER_MS);
    }, { once: true });

    // fallback ulteriore
    window.addEventListener('load', () => {
      log('fallback window.load ricevuto -> avvio observer tra', WAIT_AFTER_LOADER_MS, 'ms');
      setTimeout(observeAllReveals, WAIT_AFTER_LOADER_MS);
    }, { once: true });
  }

  // Inizializza
  document.addEventListener('DOMContentLoaded', hookToLoaderFinish);

})();
