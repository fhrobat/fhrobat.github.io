// fall_chars.js
document.addEventListener('DOMContentLoaded', () => {
  const BTN_ID = 'trigger-fall';
  const selectors = 'h1,h2,h3,h4,h5,h6,p,li'; // elementi da "splitter" in caratteri
  const MAX_CHARS = 2000; // sicurezza performance: non splittare pagine enormi
  const FALL_DELAY = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-stagger')) || 18;
  const GROUP_STAGGER = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--group-stagger')) || 180;
  const RESET_AFTER = 3000; // ms prima di iniziare la risalita
  let running = false;
  let timers = [];

  // funzione per convertire un nodo testo in spans per carattere
  function splitTextNode(node) {
    const text = node.nodeValue;
    if (!text || !text.trim()) return null; // evita nodi vuoti o solo spazi (meglio gestire spazi esternamente)

    const frag = document.createDocumentFragment();
    for (let ch of text) {
      const span = document.createElement('span');
      span.className = 'fall-char';
      // preserva spazi come caratteri visibili con &nbsp; behaviour — useremo ' ' but CSS white-space:pre
      span.textContent = ch;
      frag.appendChild(span);
    }
    return frag;
  }

  // wrap: per ogni elemento selezionato, sostituisci i text nodes con span per char
  function wrapChars() {
    const elements = Array.from(document.querySelectorAll(selectors));
    let totalChars = 0;
    for (const el of elements) {
      // non splittare elementi vuoti o con only children elements
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      // se non ci sono text nodes skip
      if (textNodes.length === 0) continue;

      // calcola chars count
      const charCount = textNodes.reduce((s, n) => s + n.nodeValue.length, 0);
      if (totalChars + charCount > MAX_CHARS) {
        // stop se superiamo limite globale per performance
        console.warn('fall_chars: limite massimo caratteri raggiunto, skipping remaining elements.');
        break;
      }
      totalChars += charCount;

      // sostituisci ogni nodo testo con fragment di span per char
      for (const tn of textNodes) {
        // evita splittare solo whitespace (ma preserva spazi singoli)
        if (!tn.nodeValue) continue;
        const frag = splitTextNode(tn);
        if (frag) tn.parentNode.replaceChild(frag, tn);
      }
    }
  }

  // costruisci elenco di span in document order
  function collectChars() {
    return Array.from(document.querySelectorAll('.fall-char'));
  }

  // raggruppa gli span secondo il tipo del loro genitore (headings, paragraphs, list items, others)
  function groupByParent(chars) {
    const groups = { headings: [], paragraphs: [], listitems: [], others: [] };
    chars.forEach(ch => {
      const p = ch.closest('h1,h2,h3,h4,h5,h6');
      if (p) { groups.headings.push(ch); return; }
      const pg = ch.closest('p');
      if (pg) { groups.paragraphs.push(ch); return; }
      const li = ch.closest('li');
      if (li) { groups.listitems.push(ch); return; }
      groups.others.push(ch);
    });
    return groups;
  }

  // pulizia timers
  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  // sequenza di caduta (stagger per carattere)
  function fallSequence(chars) {
    chars.forEach((ch, i) => {
      // rota casuale
      const rot = (Math.random() * 30 + 5) * (Math.random() < 0.5 ? -1 : 1);
      ch.style.setProperty('--r', rot + 'deg');
      const t = setTimeout(() => {
        ch.classList.remove('char-rise-active');
        // trigger fall
        ch.classList.add('char-fall-active');
      }, i * FALL_DELAY);
      timers.push(t);
    });
  }

  // risalita: applichiamo rise per i gruppi in ordine con group staggering,
  // e all'interno di ciascun gruppo risaliamo i caratteri con lo stesso FALL_DELAY
  function riseGroupsInOrder(grouped) {
    const order = [grouped.headings, grouped.paragraphs, grouped.listitems, grouped.others];
    let baseOffset = 0;
    order.forEach((arr) => {
      if (!arr || arr.length === 0) {
        baseOffset += GROUP_STAGGER;
        return;
      }
      const t = setTimeout(() => {
        arr.forEach((ch, i) => {
          const tt = setTimeout(() => {
            // rimuovi class fall e applica rise
            ch.classList.remove('char-fall-active');
            // trigger reflow to reset animation if necessary
            void ch.offsetWidth;
            ch.classList.add('char-rise-active');
          }, i * FALL_DELAY);
          timers.push(tt);
        });
      }, baseOffset);
      timers.push(t);
      baseOffset += (arr.length * FALL_DELAY) + GROUP_STAGGER;
    });

    // cleanup after all done
    const cleanupT = setTimeout(() => {
      const all = collectChars();
      all.forEach(ch => {
        ch.classList.remove('char-rise-active', 'char-fall-active');
        ch.style.removeProperty('--r');
      });
      running = false;
    }, baseOffset + 1200);
    timers.push(cleanupT);
  }

  function fallAndReturn() {
    if (running) return;
    running = true;
    clearTimers();
    document.documentElement.classList.add('falling-mode');

    const chars = collectChars();
    if (chars.length === 0) {
      running = false;
      document.documentElement.classList.remove('falling-mode');
      return;
    }

    // fase caduta in ordine documentale (carattere per carattere)
    fallSequence(chars);

    // dopo RESET_AFTER ms iniziamo la risalita per gruppi
    const tRise = setTimeout(() => {
      const grouped = groupByParent(chars);
      riseGroupsInOrder(grouped);
      // togli falling-mode subito (pointer restore) — gli elementi avranno animazioni ma interazione ok
      document.documentElement.classList.remove('falling-mode');
    }, RESET_AFTER);
    timers.push(tRise);
  }

  // inizializza: wrap chars (solo una volta)
  wrapChars();

  // tasto trigger (assicurati di avere un elemento con id BTN_ID)
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => {
    if (!running) fallAndReturn();
  });

  // opzionale: scorciatoia tastiera 'f'
  document.addEventListener('keydown', e => {
    if (e.key === 'f' && !running) fallAndReturn();
  });

  // pulizia on unload
  window.addEventListener('beforeunload', () => clearTimers());
});
