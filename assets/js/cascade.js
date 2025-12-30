(function() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  // thresholds array per migliore stabilità
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: [0, 0.02, 0.05, 0.15, 0.4, 1]
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;
      const ratio = entry.intersectionRatio;

      // Hysteresis: entra sopra 0.15, esci sotto 0.05
      const shouldEnter = ratio >= 0.15;
      const shouldExit = ratio <= 0.05;

      if (shouldEnter) {
        // applica stagger solo la PRIMA volta (evita ri-impostazioni continue)
        if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
          const children = Array.from(el.children);
          children.forEach((child, i) => {
            const delay = i * 90;
            child.style.transitionDelay = `${delay}ms`;
          });
          el.dataset.cascadeInitialized = '1';
        }

        if (!el.classList.contains('active')) {
          el.classList.add('active');
        }
      } else if (shouldExit) {
        // rimuovi active; non rimuoviamo subito i transitionDelay per evitare flicker
        if (el.classList.contains('active')) {
          el.classList.remove('active');
        }
        // opzionale: se vuoi pulire i delay per risettare rigidamente la cascata,
        // fallo con un piccolo debounce (qui rimuoviamo subito solo se vuoi)
        if (el.classList.contains('cascade') && el.dataset.cascadeInitialized === '1' && el.dataset.clearOnExit === 'true') {
          const children = Array.from(el.children);
          children.forEach(child => child.style.transitionDelay = '');
          delete el.dataset.cascadeInitialized;
        }
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // gestiamo <details> dinamici come prima
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details.tagName.toLowerCase() === 'details') {
      const content = details.querySelector('.smooth-content');
      if (content) {
        if (!content.classList.contains('reveal')) content.classList.add('reveal');
        revealObserver.observe(content);
      }
    }
  }, true);
})();
