// fall_chars_sync.clean.js
document.addEventListener('DOMContentLoaded', () => {
  const BTN_ID = 'trigger-fall';
  const SPLIT_SELECTORS = '#gravity-zone';
  const MAX_CHARS = 4000;

  let running = false;
  let timers = [];
  const originals = new Map();

  function clearTimers() {
    for (let t of timers) clearTimeout(t);
    timers.length = 0;
  }

  function cssVarNumber(varName, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName) || '';
    const m = raw.match(/-?\d+/);
    if (!m) return fallback;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function countTextCharsRecursively(node) {
    let count = 0;
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        count += (child.nodeValue || '').length;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName && child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
        count += countTextCharsRecursively(child);
      }
    });
    return count;
  }

  function replaceTextNodesWithSpans(node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(txtNode) {
        if (!txtNode.nodeValue) return NodeFilter.FILTER_REJECT;
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

    for (let textNode of textNodes) {
      const text = textNode.nodeValue || '';
      if (text.length === 0) continue;
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(text)) {
        const span = document.createElement('span');
        span.className = 'fall-char';
        span.textContent = (ch === ' ') ? '\u00A0' : ch;
        frag.appendChild(span);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function prepareChars(selectors) {
    const elements = Array.from(document.querySelectorAll(selectors));
    if (!elements.length) return { success: false, total: 0, processed: [] };

    let total = 0;
    const processed = [];

    for (const el of elements) {
      const c = countTextCharsRecursively(el);
      if (c === 0) continue;
      total += c;
      processed.push(el);
      if (total > MAX_CHARS) return { success: false, total: 0, processed: [] };
    }

    if (processed.length === 0) return { success: false, total: 0, processed: [] };

    for (const el of processed) {
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      replaceTextNodesWithSpans(el);
    }

    return { success: true, total, processed };
  }

  function collectChars() {
    return document.querySelectorAll('.fall-char');
  }

  function getZoneBottom() {
    const zone = document.querySelector(SPLIT_SELECTORS);
    const zr = zone ? zone.getBoundingClientRect() : null;
    // se gravity-zone esiste usiamo il suo bottom, altrimenti viewport
    return zr ? zr.bottom : window.innerHeight;
  }

  function setPerCharVarsForPop(ch) {
    const shakeX = Math.random() * 0.75 + 0.75; // 2..4px (modifica se vuoi più ampiezza)
    ch.style.setProperty('--shake-x', shakeX.toFixed(1) + 'px');
  }

  function setPerCharVarsForFall(ch, zoneBottom) {
    const r = ch.getBoundingClientRect();
    // distanza: fino al bottom della zona + extra random (così spariscono bene)
    const extra = 80 + Math.random() * 140; // 80..220px
    const y = (zoneBottom - r.top) + extra;

    const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1);

    ch.style.setProperty('--y', y.toFixed(1) + 'px');
    ch.style.setProperty('--r', rot.toFixed(1) + 'deg');
  }

  // ✅ evita "void ch.offsetWidth" per ogni char (quello crea scatti)
  function batchToggleAnimation(chars, removeClasses, addClass) {
    // 1) rimuovi tutto in batch
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      ch.classList.remove(...removeClasses);
    }

    // 2) in next frame aggiungi la classe (riparte pulito senza reflow per-elemento)
    requestAnimationFrame(() => {
      // doppio rAF aiuta Safari/Chrome a “stabilizzare” il layout
      requestAnimationFrame(() => {
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i];
          if (!ch) continue;
          ch.classList.add(addClass);
        }
      });
    });
  }

  function popThenFallAll(chars) {
    if (!chars || !chars.length) return 0;

    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    const popDuration   = cssVarNumber('--char-pop-duration', 220);
    const fallDuration  = cssVarNumber('--char-fall-duration', 1700);

    const popDelays = Array.from(chars, () => Math.floor(Math.random() * POP_MAX_DELAY));

    popDelays.forEach((d, i) => {
      timers.push(setTimeout(() => {
        const ch = chars[i];
        if (!ch) return;
        setPerCharVarsForPop(ch);
        ch.classList.add('char-pop');
      }, d));
    });

    const maxPopDelay = Math.max(...popDelays);
    const maxPopEnd = maxPopDelay + popDuration + 30;

    timers.push(setTimeout(() => {
      const zoneBottom = getZoneBottom();

      // prepara variabili per fall e pulisci classi in batch
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (!ch) continue;
        setPerCharVarsForFall(ch, zoneBottom);
      }

      batchToggleAnimation(chars, ['char-pop', 'char-rise-active', 'char-fall-active'], 'char-fall-active');
    }, maxPopEnd));

    return maxPopEnd + fallDuration;
  }

  function riseAllTogether(chars) {
    const riseDur = cssVarNumber('--char-rise-duration', 900);

    // 1) metti subito RISE (così non c’è mai un frame “a zero”)
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      ch.classList.add('char-rise-active');
    }

    // 2) nel frame dopo togli FALL
    requestAnimationFrame(() => {
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (!ch) continue;
        ch.classList.remove('char-fall-active');
      }
    });

    return riseDur;
  }

  function cleanupAfter(chars) {
    for (const [el, html] of originals.entries()) {
      try { el.innerHTML = html; } catch (e) {}
    }
    originals.clear();

    // pulizia residui
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      ch.classList.remove('char-pop','char-fall-active','char-rise-active');
      ch.style && ch.style.removeProperty('--r');
      ch.style && ch.style.removeProperty('--y');
      ch.style && ch.style.removeProperty('--pop-shake');
      ch.style && ch.style.removeProperty('--pop-rot');
      ch.style && ch.style.removeProperty('--shake-x');
    }

    clearTimers();
    document.documentElement.classList.remove('falling-mode');
    running = false;
  }

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

    const charsNodeList = collectChars();
    if (!charsNodeList || charsNodeList.length === 0) {
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    const chars = Array.prototype.slice.call(charsNodeList);

    const fallEndEst = popThenFallAll(chars);

    timers.push(setTimeout(() => {
      const riseDur = riseAllTogether(chars);
      timers.push(setTimeout(() => {
        cleanupAfter(chars);
      }, riseDur + 60));
    }, fallEndEst));
  }

  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  window.addEventListener('beforeunload', () => {
    clearTimers();
    originals.clear();
    running = false;
  });
});
