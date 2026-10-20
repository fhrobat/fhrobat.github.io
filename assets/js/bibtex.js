// "BibTeX" badges: copy the entry stored in the hidden <pre class="bib-src"> of the same item.
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.bib-copy');
  if (!btn) return;
  const src = btn.closest('li') && btn.closest('li').querySelector('.bib-src');
  if (!src) return;
  // remove the indentation the entry has inside the HTML
  const lines = src.textContent.split('\n').filter((l) => l.trim());
  const indent = Math.min(...lines.map((l) => l.match(/^ */)[0].length));
  const text = lines.map((l) => l.slice(indent)).join('\n');
  const done = (msg) => {
    btn.textContent = msg;
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'BibTeX'; btn.classList.remove('copied'); }, 1600);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => done('Copied ✓'), () => done('Copy failed'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done('Copied ✓'); } catch (e) { done('Copy failed'); }
    ta.remove();
  }
});
