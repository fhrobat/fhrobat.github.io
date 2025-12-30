(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

      const fullyVisible =
        entry.boundingClientRect.top >= 0 &&
        entry.boundingClientRect.bottom <= window.innerHeight;

      if (fullyVisible) {
        if (!el.classList.contains('active')) {
          // inizializza cascade una sola volta
          if (el.classList.contains('cascade') && !el.dataset.cascadeInit) {
            [...el.children].forEach((child, i) => {
              child.style.transitionDelay = `${i * 90}ms`;
            });
            el.dataset.cascadeInit = '1';
          }
          el.classList.add('active');
        }
      } else {
        el.classList.remove('active');
      }
    });
  }, {
    threshold: [0, 1]
  });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();
