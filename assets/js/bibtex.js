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
    ta.readOnly = true;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'; // no scroll jump on iOS
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    done(ok ? 'Copied ✓' : 'Copy failed');
    ta.remove();
  }
});
