// theme-toggle.js (o dentro home.js)

const STORAGE_KEY = 'appearance';

// localStorage throws when the browser blocks site data
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const body = document.body;
const toggle = document.getElementById('theme-toggle');
const icon = document.getElementById('theme-icon');

if (toggle) {

  // ritorna true se il tema effettivo è dark
  const isSystemDark = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isEffectiveDark = (value) => {
    if (value === 'dark') return true;
    if (value === 'light') return false;
    return isSystemDark(); // auto
  };

  const updateIcon = (value) => {
    const dark = isEffectiveDark(value);
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
  };

  const apply = (value) => {
    body.setAttribute('a', value);
    updateIcon(value);
  };

  // inizializzazione
  const saved = store.get(STORAGE_KEY);
  apply(saved === 'dark' || saved === 'light' ? saved : 'auto');

  // click = inverti
  toggle.addEventListener('click', () => {
    const current = body.getAttribute('a') || 'auto';
    const darkNow = isEffectiveDark(current);
    const next = darkNow ? 'light' : 'dark';

    store.set(STORAGE_KEY, next);
    apply(next);
  });

  // doppio click = torna ad auto
  toggle.addEventListener('dblclick', () => {
    store.remove(STORAGE_KEY);
    apply('auto');
  });

  // se cambia il tema di sistema e siamo in auto, aggiorna icona
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if ((body.getAttribute('a') || 'auto') === 'auto') {
        updateIcon('auto');
      }
    });
  }
}
