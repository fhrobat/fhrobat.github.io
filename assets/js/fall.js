// fall_chars_sync.fixed.js
document.addEventListener('DOMContentLoaded', () => {
  const BTN_ID = 'trigger-fall';
  const SPLIT_SELECTORS = '#gravity-zone'; // selettore principale
  const MAX_CHARS = 4000; // safety cap
  const RESET_AFTER = 3000; // ms prima di iniziare la risalita (from start of fall)

  let running = false;
  let timers = [];
  const originals = new Map();

  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  function cssVarNumber(varName, fallback) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!val) return fallback;
    // strip non-digit prefix/suffix (e.g. "1600ms") and parse int base 10
    const m = val.match(/-?\d+/);
    if (!m) return fallback;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? fallback : n;
  }

  // Replace direct text nodes of el with spans per character
  function splitElementText(el) {
    if (!originals.has(el)) originals.set(el, el.innerHTML);
    const childNodes = Array.from(el.childNodes);
    let total = 0;

    for (const node of childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const text = node.nodeValue;
      if (!text) continue;
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(text)) {
        const span = document.createElement('span');
        span.className = 'fall-char';
        span.textContent = (ch === ' ') ? '\u00A0' : ch; // preserve spaces
        frag.appendChild(span);
      }
      node.parentNode.replaceChild(frag, node);
      total += text.length;
    }
    return total;
  }

  function prepareChars(selectors) {
    const elements = Array.from(document.querySelectorAll(selectors));
    let total = 0;
    const processed = [];
    for (const el of elements) {
      // skip if inside header/nav/footer
      if (el.closest && el.closest('header,nav,footer')) continue;
      const count = splitElementText(el);
      if (count > 0) {
        total += count;
        processed.push(el);
      }
      if (total > MAX_CHARS) {
        console.warn('[fall_chars] MAX_CHARS superato, effettuo rollback');
        processed.forEach(p => {
          if (originals.has(p)) p.innerHTML = originals.get(p);
          originals.delete(p);
        });
        return { success: false, total: 0, processed: [] };
      }
    }
    return { success: true, total, processed };
  }

  function collectChars() {
    return Array.from(document.querySelectorAll('.fall-char'));
  }

  function popThenFallAll(chars) {
    if (!chars.length) return 0;
    // fetch timings from CSS variables with safe fallbacks
    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    const popDuration = cssVarNumber('--char-pop-duration', 180);
    const fallDuration = cssVarNumber('--char-fall-duration', 1600);

    // per-char random pop delay
    const popDelays = chars.map(() => Math.floor(Math.random() * POP_MAX_DELAY));
    // schedule pops
    chars.forEach((ch, i) => {
      const d = popDelays[i];
      const t = setTimeout(() => {
        ch.classList.add('char-pop');
      }, d);
      timers.push(t);
    });

    // compute when last pop finishes
    const maxPopDelay = Math.max(...popDelays);
    const maxPopEnd = maxPopDelay + popDuration + 20;

    // at that moment, start all falls together
    const tFall = setTimeout(() => {
      // set rotation var and trigger fall class for all chars simultaneously
      chars.forEach(ch => {
        const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1);
        ch.style.setProperty('--r', rot + 'deg');
        ch.classList.remove('char-pop');
        // force reflow before adding fall
        void ch.offsetWidth;
        ch.classList.remove('char-rise-active');
        ch.classList.add('char-fall-active');
      });
    }, maxPopEnd);
    timers.push(tFall);

    // return estimated time (ms) from start of pop to end of fall
    return maxPopEnd + fallDuration;
  }

  function riseAllTogether(chars) {
    const riseDur = cssVarNumber('--char-rise-duration', 900);
    chars.forEach(ch => {
      ch.classList.remove('char-fall-active');
      // force reflow
      void ch.offsetWidth;
      ch.classList.add('char-rise-active');
    });
    return riseDur;
  }

  function doFallSync() {
    if (running) {
      console.log('[fall_chars] già in esecuzione, ignoro trigger');
      return;
    }
    running = true;
    clearTimers();

    document.documentElement.classList.add('falling-mode');

    const prep = prepareChars(SPLIT_SELECTORS);
    if (!prep.success || prep.total === 0) {
      console.warn('[fall_chars] nessun carattere processato o superato limite');
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    console.log('[fall_chars] caratteri processati:', prep.total);

    const chars = collectChars();
    if (!chars.length) {
      console.warn('[fall_chars] non ho trovato span .fall-char dopo split');
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    // POP then FALL — otteniamo una stima della durata totale della caduta
    const fallEndEst = popThenFallAll(chars);

    // choose when to rise: qui uso RESET_AFTER (dal tuo codice) — puoi invece usare fallEndEst
    const riseTriggerDelay = RESET_AFTER; // oppure: Math.min(RESET_AFTER, fallEndEst)
    const tRise = setTimeout(() => {
      const riseDur = riseAllTogether(chars);
      const tCleanup = setTimeout(() => {
        // restore original DOM content to remove spans
        for (const [el, html] of originals.entries()) {
          el.innerHTML = html;
        }
        originals.clear();

        // cleanup any inline styles/classes
        chars.forEach(ch => {
          ch.classList.remove('char-pop','char-fall-active','char-rise-active');
          ch.style.removeProperty('--r');
        });

        document.documentElement.classList.remove('falling-mode');
        running = false;
        clearTimers();
        console.log('[fall_chars] ciclo completato e DOM ripristinato');
      }, riseDur + 50);
      timers.push(tCleanup);
    }, riseTriggerDelay);
    timers.push(tRise);

    // debug info
    console.log('[fall_chars] stima durata caduta (ms):', fallEndEst,
                'rise trigger in (ms):', riseTriggerDelay);
  }

  // bind trigger button/key
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });

  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  window.__fall_chars_sync = doFallSync;
  window.addEventListener('beforeunload', () => clearTimers());
});
