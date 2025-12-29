(function () {
  function openContent(content) {
    content.style.height = content.scrollHeight + 'px';
    content.style.opacity = '1';
    function onEnd() {
      content.style.height = 'auto';
      content.removeEventListener('transitionend', onEnd);
    }
    content.addEventListener('transitionend', onEnd);
  }

  function closeContent(content) {
    // forziamo altezza corrente prima di animare a 0
    const cur = content.scrollHeight;
    content.style.height = cur + 'px';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.height = '0';
        content.style.opacity = '0';
      });
    });
  }

  function toggleDetails(details) {
    const content = details.querySelector('.smooth-content');
    if (!content) return;
    if (details.open) {
      // chiudi
      details.open = false;
      closeContent(content);
      details.setAttribute('aria-expanded', 'false');
    } else {
      // apri
      details.open = true;
      openContent(content);
      details.setAttribute('aria-expanded', 'true');
    }
  }

  function initDetails(details) {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.smooth-content');
    if (!summary || !content) return;

    // assicurati stili base
    content.style.overflow = 'hidden';
    content.style.opacity = details.hasAttribute('open') ? '1' : '0';
    content.style.height = details.hasAttribute('open') ? 'auto' : '0';
    details.setAttribute('role', 'group');

    // rimuoviamo possibili doppi handler: non fare affidamento su toggle nativo
    // Gestiamo click e keyboard su summary (accessibile)
    summary.setAttribute('tabindex', '0'); // assicurare focus
    summary.setAttribute('role', 'button');
    summary.setAttribute('aria-controls', content.id || '');
    details.setAttribute('aria-expanded', details.hasAttribute('open') ? 'true' : 'false');

    // Click handler
    summary.addEventListener('click', (e) => {
      // preveniamo il comportamento nativo e gestiamo tutto noi
      e.preventDefault();
      toggleDetails(details);
    });

    // Support keyboard (Enter / Space)
    summary.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDetails(details);
      }
    });

    // Se il details viene aperto/chiuso da codice esterno, gestiamo comunque l'animazione:
    // (listener su "toggle" è utile per sincronizzare stati esterni)
    details.addEventListener('toggle', () => {
      // Se è stato aperto da codice esterno, ripristiniamo l'animazione
      if (details.open) {
        // apri con animazione (ma evita doppia animazione se già aperto)
        if (getComputedStyle(content).height === '0px' || content.style.height === '0px') {
          openContent(content);
        } else {
          content.style.height = 'auto';
          content.style.opacity = '1';
        }
      } else {
        if (getComputedStyle(content).height !== '0px') {
          closeContent(content);
        }
      }
      details.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    });
  }

  function initAll() {
    document.querySelectorAll('.smooth-toggle').forEach(initDetails);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
