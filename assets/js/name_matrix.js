document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title');
  if (!el) return;

  const originalText = el.textContent;

  /* -------- matrici -------- */
  const matrixFrancesco =
`⎡ F  r  a ⎤
⎢ n  c  e ⎥
⎣ s  c  o ⎦`;

  const matrixHRobat =
`⎡ H  r ⎤
⎢ o  b ⎥
⎣ a  t ⎦`;

  const matrixText = `${matrixFrancesco}  ${matrixHRobat}`;

  /* -------- timing (ms) -------- */
  const DELAY_BEFORE = 5000; // attesa prima di mostrare le matrici
  const SHOW_TIME   = 5000; // durata delle matrici
  const FADE_TIME   = 300;  // deve matchare il CSS

  /* -------- helper fade -------- */
  function swapText(newText) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = newText;
      el.style.opacity = '1';
    }, FADE_TIME);
  }

  /* -------- fissiamo altezza massima (anti-salto) -------- */
  el.textContent = matrixText;
  el.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const fixedHeight = el.offsetHeight + 'px';
    el.style.height = fixedHeight;

    el.textContent = originalText;
    el.style.visibility = 'visible';

    /* -------- LOOP -------- */
    function loop() {
      // dopo 5s → mostra matrici
      setTimeout(() => {
        swapText(matrixText);

        // dopo 2s → torna testo normale
        setTimeout(() => {
          swapText(originalText);

          // richiama il loop
          loop();

        }, SHOW_TIME);

      }, DELAY_BEFORE);
    }

    // avvio
    loop();
  });
});
