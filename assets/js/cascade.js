(function() {
  // Rispetta preferenze utente
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    // Se preferisce ridurre le animazioni, mostra tutto e termina.
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  // Fallback semplice per browser vecchi
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.08
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

      if (entry.isIntersecting) {
        // Elemento entra: applichiamo active e, se cascade, impostiamo delay ai figli
        if (el.classList.contains('cascade')) {
          const children = Array.from(el.children);
          children.forEach((child, i) => {
            const delay = i * 90; // 90ms per step (modifica se vuoi)
            child.style.transitionDelay = `${delay}ms`;
          });
        }

        el.classList.add('active');
      } else {
        // Elemento esce: rimuoviamo active e puliamo i delay inline
        el.classList.remove('active');

        if (el.classList.contains('cascade')) {
          const children = Array.from(el.children);
          children.forEach(child => {
            child.style.transitionDelay = ''; // rimuove il delay inline
          });
        }
      }
    });
  }, observerOptions);

  // Osserva tutti gli elementi .reveal
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // Se apri i <details>, vogliamo che il contenuto (se ha .reveal) venga osservato anche se era aggiunto dinamicamente
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details.tagName.toLowerCase() === 'details') {
      const content = details.querySelector('.smooth-content');
      if (content) {
        // aggiungi reveal se non presente
        if (!content.classList.contains('reveal')) content.classList.add('reveal');
        // se è già osservato non succede nulla; altrimenti iniziamo ad osservarlo
        // (observer.observe su elemento già osservato non crea duplicati)
        revealObserver.observe(content);
      }
    }
  }, true);
})();
