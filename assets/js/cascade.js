(function() {
  // Se il browser non supporta IntersectionObserver, fallback semplice
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px', // entra poco prima di essere completamente visibile
    threshold: 0.08
  };

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;

        // Se è un container cascade, applichiamo delay progressivo ai figli
        if (el.classList.contains('cascade')) {
          const children = Array.from(el.children);
          children.forEach((child, i) => {
            // delay crescente (es. 80ms per elemento)
            const delay = i * 90; 
            child.style.transitionDelay = `${delay}ms`;
          });
        }

        el.classList.add('active');
        // opzionale: smettiamo di osservare per non ri-triggerare
        obs.unobserve(el);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // Opzionale: se vuoi che l'apertura di <details> faccia apparire i contenuti interni
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details.tagName.toLowerCase() === 'details' && details.open) {
      const content = details.querySelector('.smooth-content');
      if (content) {
        // aggiungi reveal se non presente
        if (!content.classList.contains('reveal')) {
          content.classList.add('reveal');
          // osserva il nuovo elemento
          revealObserver.observe(content);
        }
      }
    }
  }, true);
})();
