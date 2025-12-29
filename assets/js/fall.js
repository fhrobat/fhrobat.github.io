// fall_chars_sync.js
document.addEventListener('DOMContentLoaded', () => {
  const BTN_ID = 'trigger-fall';
  // Seleziona cosa splittare; per esempio: '#gravity-zone' o 'main'
  // Esempio: per far cadere tutto dentro #gravity-zone (puoi mettere id in <p> o container)
  const SPLIT_SELECTORS = '#gravity-zone'; // <-- METTI QUI il tuo selettore (es. '#gravity-zone' o 'main')
  const MAX_CHARS = 4000; // safety cap
  const POP_MAX_DELAY = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-pop-max-delay')) || 120;
  const RESET_AFTER = 3000; // ms prima di iniziare la risalita

  let running = false;
  let timers = [];
  const originals = new Map();

  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  // SPLIT: replace text nodes with spans per carattere
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
      // skip header/nav/footer for safety
      if (el.closest && el.closest('header,nav,footer')) continue;
      const count = splitElementText(el);
      if (count > 0) {
        total += count;
        processed.push(el);
      }
      if (total > MAX_CHARS) {
        // rollback
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

  // fase pop per-lettera con piccoli delay casuali; poi tutte cadono insieme
  function popThenFallAll(chars) {
    // pop per char con random delay (ma we will trigger fall for ALL at same startTime)
    const popDelays = chars.map(() => Math.floor(Math.random() * POP_MAX_DELAY));
    const popDuration = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-pop-duration')) || 180;

    // schedule pops
    chars.forEach((ch, i) => {
      const d = popDelays[i];
      const t = setTimeout(() => {
        ch.classList.add('char-pop');
      }, d);
      timers.push(t);
    });

    // compute when last pop finishes
    const maxPopEnd = Math.max(...popDelays) + popDuration + 20;

    // at that moment, start all falls together
    const tFall = setTimeout(() => {
      // set rotation var and trigger fall class for all chars simultaneously
      chars.forEach(ch => {
        const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1); // larger rotation during fall
        ch.style.setProperty('--r', rot + 'deg');
        ch.classList.remove('char-pop');
        // ensure no rise class present then add fall
        ch.classList.remove('char-rise-active');
        ch.classList.add('char-fall-active');
      });
    }, maxPopEnd);
    timers.push(tFall);

    return maxPopEnd + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-fall-duration')) || 1600);
  }

  // risalita: tutti insieme con rimbalzo
  function riseAllTogether(chars) {
    // remove any fall classes and add rise for all simultaneously
    chars.forEach(ch => {
      ch.classList.remove('char-fall-active');
      void ch.offsetWidth;
      ch.classList.add('char-rise-active');
    });
    // estimated duration from CSS variable
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-rise-duration')) || 900;
  }

  // orchestrator
  function doFallSync() {
    if (running) return;
    running = true;
    clearTimers();

    // disable scrolling & interactions
    document.documentElement.classList.add('falling-mode');

    const prep = prepareChars(SPLIT_SELECTORS);
    if (!prep.success || prep.total === 0) {
      // fallback: nothing to do or too many chars -> remove falling-mode and exit
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    const chars = collectChars();
    if (!chars.length) {
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    // POP then FALL all together. get duration until fall end
    const fallEndEst = popThenFallAll(chars);

    // after RESET_AFTER ms from start of fall, trigger rise together
    const tRise = setTimeout(() => {
      const riseDur = riseAllTogether(chars);

      // cleanup after rise complete
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

        // restore interactions/scroll
        document.documentElement.classList.remove('falling-mode');
        running = false;
        clearTimers();
      }, riseDur + 50);
      timers.push(tCleanup);

    }, RESET_AFTER);
    timers.push(tRise);
  }

  // wire up trigger
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });

  // optional key
  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  // expose for debug
  window.__fall_chars_sync = doFallSync;

  // cleanup on unload
  window.addEventListener('beforeunload', () => clearTimers());
});
