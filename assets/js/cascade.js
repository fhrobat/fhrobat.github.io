(function() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;
      const ratio = entry.intersectionRatio;

      // init internal state object
      if (!el._revealState) el._revealState = {};

      // funzione per inizializzare cascade (solo per far partire i delay)
      function initCascade() {
        if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
          [...el.children].forEach((child, i) => {
            child.style.transitionDelay = `${i * 90}ms`;
            // assicurati che partano dalla condizione iniziale (opacità 0/transform)
          });
          el.dataset.cascadeInitialized = '1';
        }
      }

      // funzione per pulire cascade (rimuove i delay inline e flag)
      function clearCascade() {
        if (el.classList.contains('cascade') && el.dataset.cascadeInitialized) {
          [...el.children].forEach(child => {
            child.style.transitionDelay = '';
          });
          delete el.dataset.cascadeInitialized;
        }
      }

      // Se l'elemento è COMPLETELY inside viewport (quasi 1)
      const fullyVisible = ratio >= 0.5;
      // Se l'elemento è COMPLETELY out (zero intersezione)
      const completelyOut = ratio === 0;

      if (fullyVisible) {
        // inizializza cascade la prima volta e mostra
        initCascade();
        el.classList.add('active');
        return;
      }

      if (completelyOut) {
        // elemento completamente fuori: rimuovo active e pulisco i delay
        el.classList.remove('active');
        clearCascade();
        return;
      }

      // in tutti gli altri casi (parzialmente visibile / bordo)
      // rimuoviamo active ma NON puliamo la cascade: così non perdi i delay
      // (così se torni rapidamente non ottieni flicker; se invece esci completamente, sopra puliamo)
      if (el.classList.contains('active')) {
        el.classList.remove('active');
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: buildThresholdList()
  });

  function buildThresholdList() {
    const steps = 20;
    const list = [];
    for (let i = 0; i <= steps; i++) list.push(i/steps);
    return list;
  }

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // dettagli dinamici (se usi <details>)
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details.tagName && details.tagName.toLowerCase() === 'details') {
      const content = details.querySelector('.smooth-content');
      if (content) {
        if (!content.classList.contains('reveal')) content.classList.add('reveal');
        observer.observe(content);
      }
    }
  }, true);

})();
