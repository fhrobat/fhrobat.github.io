// name_matrix.js
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title'); // assicurati id corretto
  if (!el) return;

  const originalText = el.textContent;

  // --- definisci matrici come array di righe ---
  const matrixFrancesco = [
    '⎡ F  r  a ⎤',
    '⎢ n  c  e ⎥',
    '⎣ s  c  o ⎦'
  ];

  const matrixHrobat = [
    '⎡ H  r ⎤',
    '⎢ o  b ⎥',
    '⎣ a  t ⎦'
  ];

  const GAP = '    '; // spazio tra le matrici

  // --- funzione che costruisce il testo affiancato riga-per-riga ---
  function buildMatrixText(fr, hr, gap) {
    const rows = Math.max(fr.length, hr.length);
    // calcola larghezza delle righe hr per padding
    const hrWidths = hr.map(r => r.length);
    const maxHrWidth = Math.max(...hrWidths, 0);

    const paddedHr = [];
    for (let i = 0; i < rows; i++) {
      const row = hr[i] || '';
      // se la riga non esiste, creane una di spazi della stessa lunghezza delle righe HR
      const padLen = Math.max(0, maxHrWidth - row.length);
      paddedHr[i] = row + ' '.repeat(padLen);
    }

    const out = [];
    for (let i = 0; i < rows; i++) {
      const left = fr[i] || ' '.repeat(fr[0]?.length || 0);
      const right = paddedHr[i] || ''.padEnd(maxHrWidth, ' ');
      out.push(left + gap + right);
    }
    return out.join('\n');
  }

  const matrixText = buildMatrixText(matrixFrancesco, matrixHrobat, GAP);

  /* -------- timing (ms) -------- */
  const DELAY_BEFORE = 5000; // attesa prima di mostrare le matrici
  const SHOW_TIME   = 5000; // durata delle matrici
  const FADE_TIME   = 300;  // deve matchare il CSS transition in ms

  /* -------- helper fade (usiamo transition in CSS, qui solo opacità) -------- */
  function swapText(newText) {
    el.style.opacity = '0';
    // attendi FADE_TIME ms (coerente con CSS) e poi sostituisci
    setTimeout(() => {
      el.textContent = newText;
      el.style.opacity = '1';
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

    /* -------- LOOP robusto con timer references -------- */
    let timerA = null;
    let timerB = null;
    let stopped = false;

    function scheduleNext() {
      if (stopped) return;
      timerA = setTimeout(() => {
        swapText(matrixText);

        timerB = setTimeout(() => {
          swapText(originalText);
          // riprogramma il ciclo
          scheduleNext();
        }, SHOW_TIME);

      }, DELAY_BEFORE);
    }

    // avvia
    scheduleNext();

    // pulizia quando l'utente abbandona / tab cambia per evitare timer zombie
    function cleanup() {
      stopped = true;
      if (timerA) { clearTimeout(timerA); timerA = null; }
      if (timerB) { clearTimeout(timerB); timerB = null; }
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
        scheduleNext();
      }
    });
  });
});
