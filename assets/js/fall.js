// fall_chars_sync.full.js
document.addEventListener('DOMContentLoaded', () => {
  // CONFIG
  const BTN_ID = 'trigger-fall';
  const SPLIT_SELECTORS = '#gravity-zone'; // selettore principale
  const MAX_CHARS = 4000; // safety cap
  const RESET_AFTER = 3000; // rimane per riferimento ma NON usato se riseTriggerDelay = fallEndEst

  // STATO
  let running = false;
  let timers = [];
  const originals = new Map();

  // UTILITY
  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  // legge variabili CSS tipo "--char-fall-duration: 1600" in modo robusto
  function cssVarNumber(varName, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return fallback;
    const m = raw.match(/-?\d+/);
    if (!m) return fallback;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? fallback : n;
  }

  // CONTEGGIO TESTO RICORSIVO (per MAX_CHARS prima di mutare il DOM)
  function countTextCharsRecursively(node) {
    let count = 0;
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const txt = child.nodeValue || '';
        count += txt.length;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName && child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
        count += countTextCharsRecursively(child);
      }
    });
    return count;
  }

  // Sostituisce i text node sotto `node` con span per carattere (mutazione reale)
  function replaceTextNodesWithSpans(node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(txtNode) {
        if (!txtNode.nodeValue) return NodeFilter.FILTER_REJECT;
        // evita contenuti in tag script/style/noscript
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

    textNodes.forEach(textNode => {
      const text = textNode.nodeValue || '';
      if (text.length === 0) return;
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(text)) {
        const span = document.createElement('span');
        span.className = 'fall-char';
        span.textContent = (ch === ' ') ? '\u00A0' : ch;
        frag.appendChild(span);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  // PREPARA I CONTAINER: conta, salva innerHTML e sostituisce text nodes
  function prepareChars(selectors) {
    const elements = Array.from(document.querySelectorAll(selectors));
    if (!elements.length) {
      console.warn('[fall_chars] selettore non ha trovato elementi:', selectors);
      return { success: false, total: 0, processed: [] };
    }

    let total = 0;
    const processed = [];

    for (const el of elements) {
      // skip se dentro header/nav/footer
      if (el.closest && el.closest('header,nav,footer')) {
        console.log('[fall_chars] salto elemento dentro header/nav/footer', el);
        continue;
      }
      const c = countTextCharsRecursively(el);
      if (c === 0) {
        console.log('[fall_chars] elemento senza testo (0 chars):', el);
        continue;
      }
      total += c;
      processed.push(el);
      if (total > MAX_CHARS) {
        console.warn('[fall_chars] MAX_CHARS superato durante il conteggio. Tot=', total, 'MAX=', MAX_CHARS);
        return { success: false, total: 0, processed: [] };
      }
    }

    if (processed.length === 0) {
      console.warn('[fall_chars] nessun elemento processabile trovato dopo filtro.');
      return { success: false, total: 0, processed: [] };
    }

    // effettua la trasformazione vera e propria
    processed.forEach(el => {
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      replaceTextNodesWithSpans(el);
    });

    console.log('[fall_chars] preparazione completata. Caratteri totali:', total, 'elementi:', processed.length);
    return { success: true, total, processed };
  }

  // raccoglie tutti gli span creati
  function collectChars() {
    return Array.from(document.querySelectorAll('.fall-char'));
  }

  // POP per-char (piccolo delay random) e poi FALL simultanea; ritorna stima durata caduta (ms)
  function popThenFallAll(chars) {
    if (!chars.length) return 0;
    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    const popDuration = cssVarNumber('--char-pop-duration', 180);
    const fallDuration = cssVarNumber('--char-fall-duration', 1600);

    const popDelays = chars.map(() => Math.floor(Math.random() * POP_MAX_DELAY));

    chars.forEach((ch, i) => {
      const d = popDelays[i];
      const t = setTimeout(() => {
        ch.classList.add('char-pop');
      }, d);
      timers.push(t);
    });

    const maxPopDelay = Math.max(...popDelays);
    const maxPopEnd = maxPopDelay + popDuration + 20;

    const tFall = setTimeout(() => {
      // trigger della caduta per tutti insieme
      chars.forEach(ch => {
        const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1);
        ch.style.setProperty('--r', rot + 'deg');
        ch.classList.remove('char-pop');
        void ch.offsetWidth; // force reflow
        ch.classList.remove('char-rise-active');
        ch.classList.add('char-fall-active');
      });
    }, maxPopEnd);
    timers.push(tFall);

    return maxPopEnd + fallDuration;
  }

  // RISALITA simultanea; ritorna durata stimata (ms)
  function riseAllTogether(chars) {
    const riseDur = cssVarNumber('--char-rise-duration', 900);
    chars.forEach(ch => {
      ch.classList.remove('char-fall-active');
      void ch.offsetWidth;
      ch.classList.add('char-rise-active');
    });
    return riseDur;
  }

  // ORCHESTRATORE
  function doFallSync() {
    if (running) {
      console.log('[fall_chars] già in esecuzione');
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

    const chars = collectChars();
    if (!chars.length) {
      console.warn('[fall_chars] .fall-char non trovati dopo split');
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    console.log('[fall_chars] chars raccolti:', chars.length);

    // stima durata fino alla fine della caduta
    const fallEndEst = popThenFallAll(chars);

    // --------- QUI LA MODIFICA RICHIESTA ----------
    // la risalita partirà esattamente quando la caduta stimata termina
    const riseTriggerDelay = fallEndEst;
    // ---------------------------------------------

    const tRise = setTimeout(() => {
      const riseDur = riseAllTogether(chars);
      const tCleanup = setTimeout(() => {
        // ripristina innerHTML originale
        for (const [el, html] of originals.entries()) {
          el.innerHTML = html;
        }
        originals.clear();

        // pulizia eventuale
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

    console.log('[fall_chars] stima durata caduta (ms):', fallEndEst, 'rise trigger (ms):', riseTriggerDelay);
  }

  // BIND UI e debug
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  // esposizione per debug / testing
  window.__fall_chars_sync = doFallSync;
  window.addEventListener('beforeunload', () => clearTimers());
});
