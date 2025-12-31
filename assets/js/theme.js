(function() {
  const STORAGE_KEY = 'appearance'; // valori possibili: 'dark' | 'light' | 'auto'
  const body = document.body;
  const btn = document.getElementById('theme-toggle');

  if (!btn) return; // niente da fare se il bottone non esiste

  // Applica l'attributo 'a' sul body
  function applyAttribute(value) {
    body.setAttribute('a', value);
    updateButtonUI(value);
  }

  // Determina se la modalità effettiva è dark (considera 'auto')
  function isEffectiveDark(attrValue) {
    if (attrValue === 'dark') return true;
    if (attrValue === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Aggiorna UI del bottone (icon, aria-pressed, title)
  function updateButtonUI(attrValue) {
    const dark = isEffectiveDark(attrValue);
    btn.setAttribute('aria-pressed', String(dark));
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Passa a light (doppio click = auto)' : 'Passa a dark (doppio click = auto)';
  }

  // Inizializza dal localStorage (fallback 'auto')
  const saved = localStorage.getItem(STORAGE_KEY);
  applyAttribute(saved === 'dark' || saved === 'light' ? saved : 'auto');

  // Click = inverte e salva
  btn.addEventListener('click', () => {
    const currentAttr = body.getAttribute('a') || 'auto';
    const currentlyDark = isEffectiveDark(currentAttr);
    const newAttr = currentlyDark ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, newAttr);
    applyAttribute(newAttr);
  });

  // Doppio click = torna ad 'auto' (rimuovi scelta)
  btn.addEventListener('dblclick', () => {
    localStorage.removeItem(STORAGE_KEY);
    applyAttribute('auto');
  });

  // Se l'utente cambia preferenza di sistema, aggiorna UI quando siamo in 'auto'
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const currentAttr = body.getAttribute('a') || 'auto';
      if (currentAttr === 'auto') updateButtonUI('auto');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
  }
})();
