// name_matrix.js
// The name alternates with two matrices, [Francesco] and [Hrobat].
// Hovering the matrices assembles their product, term by term; leaving restores them.
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title'); // assicurati id corretto
  if (!el) return;

  const originalText = el.textContent;

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
  const terms = F.map((row) => H[0].map((_, j) => row.map((f, k) => f + H[k][j])));
  const N_TERMS = F.length * H[0].length * F[0].length;
  const ENTRY_W = 3 * 2 + 2; // "FH+ro+aa"

  // testo del prodotto con solo i primi `shown` termini (ordine: riga, colonna, k)
  function productText(shown) {
    let left = shown;
    return terms.map((row, i) => {
      const entries = row.map((t) => {
        const take = Math.max(0, Math.min(t.length, left));
        left -= take;
        return t.slice(0, take).join('+').padEnd(ENTRY_W, ' ');
      });
      return `${OPEN[i]} ${entries.join('  ')} ${CLOSE[i]}`;
    }).join('\n');
  }

  /* -------- timing (ms) -------- */
  const DELAY_BEFORE = 5000; // attesa prima di mostrare le matrici
  const SHOW_TIME   = 5000; // durata delle matrici
  const FADE_TIME   = 300;  // deve matchare il CSS transition in ms
  const TERM_TIME   = 55;   // un termine del prodotto
  const AFTER_HOVER = 2500; // matrici ancora visibili dopo che il mouse se ne va

  let mode = 'name';        // 'name' | 'matrix' | 'product'
  let hovering = false;

  /* -------- helper fade (usiamo transition in CSS, qui solo opacità) -------- */
  function swapText(newText, newMode) {
    el.style.opacity = '0';
    // attendi FADE_TIME ms (coerente con CSS) e poi sostituisci
    setTimeout(() => {
      el.textContent = newText;
      el.style.opacity = '1';
      mode = newMode;
      if (newMode === 'matrix' && hovering) startProduct();
    }, FADE_TIME);
  }

  /* -------- prodotto al passaggio del mouse -------- */
  let assembleTimer = null;

  function startProduct() {
    mode = 'product';
    let shown = 0;
    clearInterval(assembleTimer);
    el.textContent = productText(0);
    assembleTimer = setInterval(() => {
      shown += 1;
      el.textContent = productText(shown);
      if (shown >= N_TERMS) { clearInterval(assembleTimer); assembleTimer = null; }
    }, TERM_TIME);
  }

  function stopProduct() {
    clearInterval(assembleTimer);
    assembleTimer = null;
    el.textContent = matrixText;
    mode = 'matrix';
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
