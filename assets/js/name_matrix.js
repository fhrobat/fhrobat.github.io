document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title');
  if (!el) return;

  const originalText = el.textContent;

  const matrixFrancesco =
`⎡ F  r  a ⎤
⎢ n  c  e ⎥
⎣ s  c  o ⎦`;

  const matrixHRobat =
`⎡ H  r ⎤
⎢ o  b ⎥
⎣ a  t ⎦`;

  const matrixText = `${matrixFrancesco}\n\n${matrixHRobat}`;

  function swapText(newText) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = newText;
      el.style.opacity = '1';
    }, 300);
  }

  /* ---- FISSIAMO L'ALTEZZA MASSIMA (anti-salto) ---- */
  el.textContent = matrixText;
  el.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const fixedHeight = el.offsetHeight + 'px';
    el.style.height = fixedHeight;

    el.textContent = originalText;
    el.style.visibility = 'visible';

    /* ---- TIMELINE ---- */
    setTimeout(() => {
      swapText(matrixText);

      setTimeout(() => {
        swapText(originalText);
      }, 10000);

    }, 10000);
  });
});
