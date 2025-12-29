// fall_chars_min.js
document.addEventListener('DOMContentLoaded', () => {
  // CONFIG
  const BTN_ID = 'trigger-fall';
  const SPLIT_SELECTORS = '#gravity-zone';
  const MAX_CHARS = 4000;

  // STATO
  let running = false;
  let timers = [];
  const originals = new Map();

  // HELPERS
  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  function cssVarNumber(varName, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return fallback;
    const m = raw.match(/-?\d+/);
    if (!m) return fallback;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? fallback : n;
  }

  // SEMPLICE CONTEGGIO PER TESTO (textContent è leggero)
  function countTextCharsSimple(node) {
    return (node.textContent || '').length;
  }

  // SOSTITUISCE I TEXT NODE CON SPAN PER CARATTERE
  // Assegna inline --pop-delay per char (riduce timers JS)
  function replaceTextNodesWithSpans(root, popMaxDelay) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(txtNode) {
        if (!txtNode.nodeValue || !txtNode.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let p = txtNode.parentNode;
        while (p) {
          if (p.nodeType === Node.ELEMENT_NODE) {
            const tg = p.tagName && p.tagName.toLowerCase();
            if (tg === 'script' || tg === 'style' || tg === 'noscript') return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const textNode of textNodes) {
      const text = textNode.nodeValue || '';
      if (text.length === 0) continue;
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(text)) {
        const span = document.createElement('span');
        span.className = 'fall-char';
        span.textContent = ch;
        // assegna delay casuale inline: usiamo percentuale del popMaxDelay
        const d = Math.floor(Math.random() * popMaxDelay);
        span.style.setProperty('--pop-delay', d + 'ms');
        frag.appendChild(span);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  // PREPARA I CONTAINER: conta, salva innerHTML e sostituisce text nodes
  function prepareChars(selectors) {
    const elements = Array.from(document.querySelectorAll(selectors));
    if (!elements.length) return { success: false, total: 0, processed: [] };

    let total = 0;
    const processed = [];

    for (const el of elements) {
      const c = countTextCharsSimple(el);
      if (c === 0) continue;
      total += c;
      processed.push(el);
      if (total > MAX_CHARS) {
        // abort se troppo grande
        return { success: false, total: 0, processed: [] };
      }
    }

    if (processed.length === 0) return { success: false, total: 0, processed: [] };

    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    processed.forEach(el => {
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      replaceTextNodesWithSpans(el, POP_MAX_DELAY);
    });

    return { success: true, total, processed };
  }

  function collectChars() {
    return Array.from(document.querySelectorAll('.fall-char'));
  }

  // orchestratore semplificato
  function doFallSync() {
    if (running) return;
    running = true;
    clearTimers();
    document.documentElement.classList.add('falling-mode');

    const prep = prepareChars(SPLIT_SELECTORS);
    if (!prep.success || prep.total === 0) {
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

    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    const popDuration = cssVarNumber('--char-pop-duration', 180);
    const fallDuration = cssVarNumber('--char-fall-duration', 1600);
    const riseDur = cssVarNumber('--char-rise-duration', 900);

    // aggiunge la classe di pop a tutti i char (CSS leggerà --pop-delay)
    for (const ch of chars) {
      ch.classList.add('char-pop');
    }

    // calcola max pop delay a partire dallo stile inline (se presente), altrimenti POP_MAX_DELAY
    let maxPopDelay = 0;
    for (const ch of chars) {
      const raw = ch.style.getPropertyValue('--pop-delay');
      const parsed = raw ? parseInt(raw.replace('ms',''), 10) : NaN;
      if (!Number.isNaN(parsed) && parsed > maxPopDelay) maxPopDelay = parsed;
    }
    if (maxPopDelay === 0) maxPopDelay = POP_MAX_DELAY;

    // unico timeout per attivare la caduta dopo il pop
    const fallTriggerDelay = maxPopDelay + popDuration + 20;
    const tFall = setTimeout(() => {
      for (const ch of chars) {
        const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1);
        ch.style.setProperty('--r', rot + 'deg');
        ch.classList.remove('char-pop');
        // forzare reflow minimo
        void ch.offsetWidth;
        ch.classList.add('char-fall-active');
      }
    }, fallTriggerDelay);
    timers.push(tFall);

    // programma il rise dopo la caduta completa
    const totalToRise = fallTriggerDelay + fallDuration;
    const tRiseAndCleanup = setTimeout(() => {
      // rise insieme
      for (const ch of chars) {
        ch.classList.remove('char-fall-active');
        void ch.offsetWidth;
        ch.classList.add('char-rise-active');
      }

      // cleanup dopo il rise
      const tCleanup = setTimeout(() => {
        for (const [el, html] of originals.entries()) {
          el.innerHTML = html;
        }
        originals.clear();
        // rimuovo eventuali classi/residue
        for (const ch of chars) {
          ch.classList.remove('char-pop','char-fall-active','char-rise-active');
          ch.style.removeProperty('--r');
          ch.style.removeProperty('--pop-delay');
        }
        document.documentElement.classList.remove('falling-mode');
        running = false;
        clearTimers();
      }, riseDur + 50);

      timers.push(tCleanup);
    }, totalToRise);
    timers.push(tRiseAndCleanup);
  }

  // BIND UI minimale
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  // pulizia se lascia la pagina (opzionale)
  window.addEventListener('beforeunload', () => clearTimers());
});
