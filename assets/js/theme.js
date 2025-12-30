<script>
(function() {
  const STORAGE_KEY = 'appearance'; // 'dark' | 'light' | 'auto'
  const body = document.body;
  const btn = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');

  if (!btn || !icon) return;

  // Legge scelta salvata
  const saved = localStorage.getItem(STORAGE_KEY);

  // Imposta l'attributo 'a' sul body (fallback su 'auto' se niente)
  function applyAttribute(value) {
    body.setAttribute('a', value);
    updateButtonUI(value);
  }

  // Determina stato effettivo dark (tenendo conto di 'auto')
  function isEffectiveDark(attrValue) {
    if (attrValue === 'dark') return true;
    if (attrValue === 'light') return false;
    // auto -> controlla preferenza sistema
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Aggiorna icona / aria-pressed / label del bottone
  function updateButtonUI(attrValue) {
    const dark = isEffectiveDark(attrValue);
    btn.setAttribute('aria-pressed', String(dark));
    // Icona e testo (personalizza se vuoi)
    icon.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Passa a light (doppio click = auto)' : 'Passa a dark (doppio click = auto)';
  }

  // Inizializza: se saved -> usa saved, altrimenti usa 'auto'
  applyAttribute(saved === 'dark' || saved === 'light' ? saved : 'auto');

  // Click = INVERTI modalità (salvando la scelta manuale)
  btn.addEventListener('click', () => {
    const currentAttr = body.getAttribute('a') || 'auto';
    const currentlyDark = isEffectiveDark(currentAttr);
    const newAttr = currentlyDark ? 'light' : 'dark'; // inverti rispetto all'effettivo
    localStorage.setItem(STORAGE_KEY, newAttr);
    applyAttribute(newAttr);
  });

  // Doppio click = TORNA AD AUTO (rimuove la scelta salvata)
  btn.addEventListener('dblclick', () => {
    localStorage.removeItem(STORAGE_KEY);
    applyAttribute('auto');
  });

  // (Opzionale) Se l'utente cambia la preferenza di sistema, aggiorna UI quando siamo in 'auto'
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener ? mq.addEventListener('change', (e) => {
      const currentAttr = body.getAttribute('a') || 'auto';
      if (currentAttr === 'auto') updateButtonUI('auto');
    }) : mq.addListener((e) => {
      const currentAttr = body.getAttribute('a') || 'auto';
      if (currentAttr === 'auto') updateButtonUI('auto');
    });
  }
})();
</script>
