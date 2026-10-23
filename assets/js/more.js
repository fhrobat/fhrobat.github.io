// "More" links: open the full section page in a dialog over the home page.
// With a modifier key, a middle click or without JavaScript they stay ordinary links.
{
  const dialog = document.createElement('dialog');
  dialog.className = 'more-dialog';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'more-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  const frame = document.createElement('iframe');
  dialog.append(close, frame);

  let opener = null;

  // runs once per opening, whether the dialog was closed by a button, the backdrop or Escape
  const cleanup = () => {
    if (!document.body.classList.contains('more-open')) return;
    document.body.classList.remove('more-open');
    frame.src = 'about:blank'; // stops the videos of the page inside
    if (opener) opener.focus();
  };
  const shut = () => { dialog.close(); cleanup(); };

  close.addEventListener('click', shut);
  // a click on the dark backdrop lands on the dialog itself
  dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener('close', cleanup);

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.more-link');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof dialog.showModal !== 'function') return;
    e.preventDefault();
    opener = a;
    frame.title = a.dataset.title || 'More';
    frame.src = a.href;
    if (!dialog.isConnected) document.body.appendChild(dialog);
    dialog.showModal();
    document.body.classList.add('more-open');
  });
}
