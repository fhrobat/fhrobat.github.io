// name_matrix.js
// The name alternates with two matrices, [Francesco] and [Hrobat].
// Hovering the matrices assembles their product: every letter flies to its place with a light
// trail; leaving plays the animation backwards.
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title'); // assicurati id corretto
  if (!el) return;

  const originalText = el.textContent;
  // i lettori di schermo leggono sempre il nome, non le matrici
  el.setAttribute('aria-label', originalText.trim());
  // niente animazione per chi preferisce meno movimento
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // --- le due matrici, entrata per entrata ---
  const F = [['F', 'r', 'a'], ['n', 'c', 'e'], ['s', 'c', 'o']]; // 3x3
  const H = [['H', 'r'], ['o', 'b'], ['a', 't']];                // 3x2

  const OPEN = ['⎡', '⎢', '⎣'];
  const CLOSE = ['⎤', '⎥', '⎦'];
  const GAP = '    '; // spazio tra le matrici

  const matRows = (M) => M.map((row, i) => `${OPEN[i]} ${row.join('  ')} ${CLOSE[i]}`);

  const matrixText = matRows(F)
    .map((row, i) => row + GAP + matRows(H)[i])
    .join('\n');


  // --- prodotto F*H: l'entrata (i,j) è  F[i][0]H[0][j] + F[i][1]H[1][j] + F[i][2]H[2][j] ---
  // Costruiamo il testo del prodotto ricordando, per ogni lettera, da dove viene nelle matrici.
  const LEFT_W = matRows(F)[0].length + GAP.length;   // dove inizia la matrice H in ogni riga
  const srcF = (i, k) => i * (matrixText.indexOf('\n') + 1) + 2 + 3 * k;
  const srcH = (k, j) => k * (matrixText.indexOf('\n') + 1) + LEFT_W + 2 + 3 * j;

  const flights = [];   // { src, dst, order }: una lettera che vola da src a dst (indici nel testo)
  const pluses = [];    // { dst, order }
  let productText = '';
  let order = 0;
  F.forEach((row, i) => {
    let line = OPEN[i] + ' ';
    H[0].forEach((_, j) => {
      if (j > 0) line += '  ';
      row.forEach((f, k) => {
        if (k > 0) { pluses.push({ dst: productText.length + line.length, order }); line += '+'; }
        flights.push({ src: srcF(i, k), dst: productText.length + line.length, order });
        flights.push({ src: srcH(k, j), dst: productText.length + line.length + 1, order });
        line += f + H[k][j];
        order += 1;
      });
    });
    productText += line + ' ' + CLOSE[i] + (i < F.length - 1 ? '\n' : '');
  });

  /* -------- animazione: le lettere volano al loro posto, con una scia leggera -------- */
  const STAGGER = 45;     // ritardo tra un termine e il successivo (ms)
  const FLIGHT = 650;     // durata del volo di una lettera (ms)
  const TRAIL = [[45, 0.28], [90, 0.16], [135, 0.08]]; // [ritardo, opacità] delle copie-scia
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const BACK_RATE = 1.8;  // il ritorno è un po' più veloce dell'andata

  let layer = null;       // contenitore delle lettere animate
  let anims = [];         // tutte le animazioni attive (si invertono all'uscita del mouse)
  let token = 0;          // invalida i "finished" di animazioni vecchie

  // posizione (relativa a el) di ogni carattere di `text`, misurata sul testo vero
  function measure(text) {
    el.textContent = text;
    const node = el.firstChild;
    const base = el.getBoundingClientRect();
    const range = document.createRange();
    const pos = [];
    for (let n = 0; n < text.length; n++) {
      if (text[n] === '\n' || text[n] === ' ') { pos.push(null); continue; }
      range.setStart(node, n);
      range.setEnd(node, n + 1);
      const r = range.getBoundingClientRect();
      pos.push({ x: r.left - base.left, y: r.top - base.top });
    }
    return pos;
  }

  function glyph(ch, p) {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;white-space:pre;`;
    layer.appendChild(s);
    return s;
  }

  function fade(node, from, to, delay, duration) {
    anims.push(node.animate([{ opacity: from }, { opacity: to }],
      { duration, delay, easing: 'ease', fill: 'both' }));
  }

  function buildLayer() {
    const src = measure(matrixText);
    const dst = measure(productText);
    el.textContent = '';
    el.style.position = 'relative';
    layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    el.appendChild(layer);
    anims = [];

    const last = order - 1;
    // le matrici di partenza svaniscono mentre le lettere partono
    for (let n = 0; n < matrixText.length; n++) {
      if (!src[n]) continue;
      fade(glyph(matrixText[n], src[n]), 1, 0, 0, 350 + STAGGER * last);
    }
    // parentesi del prodotto
    for (let n = 0; n < productText.length; n++) {
      if (dst[n] && '⎡⎢⎣⎤⎥⎦'.includes(productText[n])) {
        fade(glyph(productText[n], dst[n]), 0, 1, 150, 500);
      }
    }
    // i "+" compaiono quando il loro termine è arrivato
    pluses.forEach(({ dst: d, order: o }) => {
      fade(glyph('+', dst[d]), 0, 1, o * STAGGER + FLIGHT * 0.7, 250);
    });
    // le lettere in volo, ognuna con la sua scia
    flights.forEach(({ src: s, dst: d, order: o }) => {
      const dx = src[s].x - dst[d].x;
      const dy = src[s].y - dst[d].y;
      const ch = productText[d];
      const path = [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }];
      const delay = o * STAGGER;
      anims.push(glyph(ch, dst[d]).animate(path,
        { duration: FLIGHT, delay, easing: EASE, fill: 'both' }));
      TRAIL.forEach(([lag, alpha]) => {
        const ghost = glyph(ch, dst[d]);
        anims.push(ghost.animate(
          [{ transform: path[0].transform, opacity: 0 },
           { transform: path[0].transform, opacity: alpha, offset: 0.05 },
           { transform: 'translate(0, 0)', opacity: 0 }],
          { duration: FLIGHT, delay: delay + lag, easing: EASE, fill: 'both' }));
      });
    });
  }

  function teardown() {
    token += 1;
    anims.forEach((a) => a.cancel());
    anims = [];
    if (layer) { layer.remove(); layer = null; }
  }

  function startProduct() {
    mode = 'product';
    token += 1;
    if (layer) {                      // stava tornando indietro: riparte in avanti da dov'è
      anims.forEach((a) => { a.updatePlaybackRate(1); a.play(); });
      return;
    }
    buildLayer();
  }

  function stopProduct() {
    mode = 'matrix';
    if (!layer) { el.textContent = matrixText; return; }
    const my = ++token;
    anims.forEach((a) => { a.updatePlaybackRate(-BACK_RATE); a.play(); });
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (my !== token) return;       // nel frattempo il mouse è tornato
      teardown();
      el.textContent = matrixText;
    }).catch(() => {});
  }

  /* -------- timing (ms) -------- */
  const DELAY_BEFORE = 5000; // attesa prima di mostrare le matrici
  const SHOW_TIME   = 5000; // durata delle matrici
  const FADE_TIME   = 300;  // deve matchare il CSS transition in ms
  const AFTER_HOVER = 2500; // matrici ancora visibili dopo che il mouse se ne va

  let mode = 'name';        // 'name' | 'matrix' | 'product'
  let hovering = false;

  /* -------- helper fade (usiamo transition in CSS, qui solo opacità) -------- */
  function swapText(newText, newMode) {
    el.style.opacity = '0';
    // attendi FADE_TIME ms (coerente con CSS) e poi sostituisci
    setTimeout(() => {
      teardown();
      el.textContent = newText;
      el.style.opacity = '1';
      mode = newMode;
      if (newMode === 'matrix' && hovering) startProduct();
    }, FADE_TIME);
  }


  /* -------- fissiamo altezza massima (anti-salto) -------- */
  // metti temporaneamente la matrice per misurare altezza
  el.textContent = matrixText;
  el.style.visibility = 'hidden'; // misurabile ma non visibile

  requestAnimationFrame(() => {
    const fixedHeight = el.offsetHeight + 'px';
    el.style.height = fixedHeight;
    // ripristina testo originale e rendi visibile
    el.textContent = originalText;
    el.style.visibility = 'visible';

    // la dimensione del font segue la larghezza della finestra: rimisura quando cambia
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth || mode !== 'name') return;
      lastWidth = window.innerWidth;
      el.style.height = '';
      el.textContent = matrixText;
      const h = el.offsetHeight;
      el.textContent = originalText;
      el.style.height = h + 'px';
    });

    /* -------- LOOP robusto con timer references -------- */
    let timerA = null;
    let timerB = null;
    let stopped = false;

    function clearTimers() {
      if (timerA) { clearTimeout(timerA); timerA = null; }
      if (timerB) { clearTimeout(timerB); timerB = null; }
    }

    function backToName(after) {
      timerB = setTimeout(() => {
        timerB = null;
        if (hovering) return;           // si torna al nome solo quando il mouse se ne va
        swapText(originalText, 'name');
        // riprogramma il ciclo
        scheduleNext();
      }, after);
    }

    function scheduleNext() {
      if (stopped) return;
      timerA = setTimeout(() => {
        timerA = null;
        swapText(matrixText, 'matrix');
        backToName(SHOW_TIME);
      }, DELAY_BEFORE);
    }

    // avvia
    scheduleNext();

    el.addEventListener('mouseenter', () => {
      hovering = true;
      if (mode === 'matrix') startProduct();
    });

    el.addEventListener('mouseleave', () => {
      hovering = false;
      if (mode === 'product') stopProduct();
      if (mode !== 'matrix' || stopped) return;
      // le matrici restano un attimo, poi il ciclo riprende
      if (timerB) clearTimeout(timerB);
      backToName(AFTER_HOVER);
    });

    // pulizia quando l'utente abbandona / tab cambia per evitare timer zombie
    function cleanup() {
      stopped = true;
      clearTimers();
    }

    window.addEventListener('pagehide', cleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // pausa quando pagina nascosta
        cleanup();
      } else {
        // riprendi: rilancia il loop solo se non già attivo
        if (!stopped) return;
        stopped = false;
        if (mode === 'name') scheduleNext();
        else if (!hovering) backToName(SHOW_TIME);
      }
    });
  });
});
