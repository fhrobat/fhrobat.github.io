(function () {
  // CONFIG
  const CASCADE_CHILD_DELAY = 80;     // ms stagger per i figli .reveal.cascade > *
  const IO_THRESHOLD = 0.12;          // quanto "entrato" deve essere per considerarlo visibile
  const DEFAULT_WAIT_AFTER_LOADER_MS = 500; // attesa dopo evento loader (puoi aumentare se serve)
  const EXTRA_CLEANUP_PADDING = 150;  // padding ms per cleanup inline styles
  const debug = true;                // true per log in console

  function log(...args) { if (debug) console.log('[reveal-io]', ...args); }

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Parse "700ms" / "0.7s" / "0.2s, 0.3s" -> ritorna massimo in ms
  function parseTimeToMs(timeStr) {
    if (!timeStr) return 0;
    return Math.max(...timeStr.split(',').map(s => s.trim()).map(s => {
      if (s.endsWith('ms')) return parseFloat(s);
      if (s.endsWith('s')) return parseFloat(s) * 1000;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }));
  }

  // Calcola tempo massimo transition-duration+delay per cleanup dinamico (considera stagger inline)
  function getCleanupTimeoutMs(selectorRoot = '.reveal') {
    let max = 0;
    try {
      document.querySelectorAll(selectorRoot).forEach(root => {
        const csRoot = getComputedStyle(root);
        const rootMax = parseTimeToMs(csRoot.transitionDuration) + parseTimeToMs(csRoot.transitionDelay);
        max = Math.max(max, rootMax);

        if (root.classList.contains('cascade')) {
          const children = Array.from(root.children);
          children.forEach((child, i) => {
            const cs = getComputedStyle(child);
            const childMax = parseTimeToMs(cs.transitionDuration) + parseTimeToMs(cs.transitionDelay) + (i * CASCADE_CHILD_DELAY);
            max = Math.max(max, childMax);
          });
        }
      });
    } catch (e) {
      log('errore getCleanupTimeoutMs', e);
    }
    return Math.ceil(max) + EXTRA_CLEANUP_PADDING;
  }

  // Forza repaint
  function forceRepaint(el) { if (!el) return; el.getBoundingClientRect(); }

  // Attiva reveal (single element) o cascade (container)
  function activateReveal(el) {
    if (!el) return;
    if (el.dataset.revealDone === 'true') return; // già attivato

    if (prefersReduced) {
      el.classList.add('active');
      el.dataset.revealDone = 'true';
      return;
    }

    if (el.classList.contains('cascade')) {
      const children = Array.from(el.children);
      children.forEach((child, i) => {
        child.style.transitionDelay = `${i * CASCADE_CHILD_DELAY}ms`;
      });
      forceRepaint(el);
      requestAnimationFrame(() => {
        el.classList.add('active');
        el.dataset.revealDone = 'true';
      });
    } else {
      // singolo elemento
      requestAnimationFrame(() => {
        el.classList.add('active');
        el.dataset.revealDone = 'true';
      });
    }
  }

  // cleanup inline delays (dopo che le transizioni sono finite)
  function scheduleCleanup() {
    const timeout = getCleanupTimeoutMs();
    log('cleanup timeout (ms):', timeout);
    setTimeout(() => {
      document.querySelectorAll('.reveal.cascade > *').forEach(ch => {
        ch.style.transitionDelay = '';
      });
      log('cleanup: transitionDelay rimossi');
    }, timeout);
  }

  // MAIN: crea IntersectionObserver e osserva tutte le .reveal
  function startObserver() {
    if (prefersReduced) {
      // utenti con preferenze ridotte -> attiva tutto subito (una sola volta)
      document.querySelectorAll('.reveal').forEach(el => {
        if (el.dataset.revealDone !== 'true') {
          el.classList.add('active');
          el.dataset.revealDone = 'true';
        }
      });
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        const el = entry.target;
        // consideriamo "entrato" solo se è intersecting e supera la threshold
        if (entry.isIntersecting && entry.intersectionRatio >= IO_THRESHOLD) {
          log('intersection -> activate', el);
          activateReveal(el);
          obs.unobserve(el); // run once per elemento
        }
      });
    }, {
      threshold: IO_THRESHOLD
      // puoi aggiungere rootMargin se vuoi anticipare l'entrata: e.g. '0px 0px -10% 0px'
    });

    const items = Array.from(document.querySelectorAll('.reveal'));
    if (!items.length) {
      log('Nessun .reveal trovato da osservare');
      return;
    }

    items.forEach(it => {
      // se già attivato (es. markup server-side) skip
      if (it.dataset.revealDone === 'true') return;
      observer.observe(it);
    });

    // pulisci eventuali transitionDelay dopo durata dinamica
    scheduleCleanup();
  }

  // Controlla se il loader è già finito (se lo script viene caricato dopo)
  function loaderAlreadyFinished() {
    const loader = document.getElementById('page-loader');
    if (!loader) {
      return !document.body.classList.contains('loading') || document.readyState === 'complete';
    }
    const cs = getComputedStyle(loader);
    return loader.classList.contains('hidden') || loader.classList.contains('done') || cs.display === 'none' || cs.opacity === '0' || cs.visibility === 'hidden';
  }

  // Hook: aspetta che il page-loader sia finito, poi avvia observer
  function hookToLoaderFinish() {
    if (loaderAlreadyFinished()) {
      log('loader già finito -> avvio observer');
      setTimeout(startObserver, DEFAULT_WAIT_AFTER_LOADER_MS);
      return;
    }

    window.addEventListener('page-loader-finished', () => {
      log('ricevuto page-loader-finished -> avvio observer');
      setTimeout(startObserver, DEFAULT_WAIT_AFTER_LOADER_MS);
    }, { once: true });

    // fallback: window.load
    window.addEventListener('load', () => {
      log('fallback window.load -> avvio observer');
      setTimeout(startObserver, DEFAULT_WAIT_AFTER_LOADER_MS);
    }, { once: true });
  }

  // init
  document.addEventListener('DOMContentLoaded', hookToLoaderFinish);
})();
