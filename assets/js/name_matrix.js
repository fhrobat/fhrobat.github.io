// name_matrix.js
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('#name_title');
  if (!el) return;

  const original = el.textContent;

  // matrici testuali (monospaced implicit via whitespace: pre)
  const matrixFrancesco =
`⎡ F  r  a ⎤
⎢ n  c  e ⎥
⎣ s  c  o ⎦`;

  const matrixHrobat =
`⎡ H  r ⎤
⎣ o  b ⎦
  a  t`;

  const matrixText = `${matrixFrancesco}\n\n${matrixHrobat}`;

  // helper per transizione smooth
  function swapText(newText) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = newText;
      el.style.opacity = '1';
    }, 300);
  }

  // timeline
  setTimeout(() => {
    swapText(matrixText);

    // torna al nome originale dopo 2 secondi
    setTimeout(() => {
      swapText(original);
    }, 2000);

  }, 5000);
});
