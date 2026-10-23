// smooth_toggle.js
// I <details class="smooth-toggle"> si aprono e si chiudono animando l'altezza del contenuto.
// Il browser nasconde il contenuto appena `open` sparisce, quindi la chiusura intercetta il click
// sul summary, anima fino a 0 e solo alla fine toglie `open`.
document.addEventListener('DOMContentLoaded', () => {
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.smooth-toggle').forEach(details => {
    const content = details.querySelector('.smooth-content');
    const summary = details.querySelector('summary');
    if (!content || !summary) return;

    let closing = false;
    let timer = 0;

    // fine dell'animazione: chiude davvero, oppure lascia l'altezza libera
    const settle = () => {
      clearTimeout(timer);
      if (closing) {
        closing = false;
        details.open = false;
      } else if (details.open) {
        content.style.height = 'auto'; // permette contenuto dinamico
      }
    };
    // nel caso transitionend non arrivi (transizione interrotta, scheda in background)
    const settleLater = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 450);
    };

    // stato chiuso: niente altezza, niente padding verticale
    const collapse = () => {
      content.style.height = '0';
      content.style.opacity = '0';
      content.style.paddingTop = '0';
      content.style.paddingBottom = '0';
    };

    const expand = () => {
      // padding verticali come nel CSS, così scrollHeight li include
      content.style.paddingTop = '';
      content.style.paddingBottom = '';
      if (reduced) {
        content.style.height = 'auto';
        content.style.opacity = '1';
        return;
      }
      content.style.height = content.scrollHeight + 'px';
      content.style.opacity = '1';
      settleLater();
    };

    content.style.overflow = 'hidden';
    if (details.open) {
      content.style.height = 'auto';
      content.style.opacity = '1';
    } else {
      collapse();
    }

    // fine dell'animazione dell'altezza (non quelle di opacità/padding né quelle dei figli)
    content.addEventListener('transitionend', (e) => {
      if (e.target === content && e.propertyName === 'height') settle();
    });

    summary.addEventListener('click', (e) => {
      if (!details.open || reduced) return; // apertura: ci pensa l'evento toggle
      e.preventDefault();

      if (closing) {                        // ripensamento durante la chiusura: si riapre
        closing = false;
        expand();
        return;
      }

      const h = content.getBoundingClientRect().height;
      if (h === 0) { details.open = false; return; }
      closing = true;
      content.style.height = h + 'px';
      content.getBoundingClientRect();      // il browser registra l'altezza di partenza
      collapse();
      settleLater();
    });

    details.addEventListener('toggle', () => {
      if (details.open) expand();
      else { closing = false; clearTimeout(timer); collapse(); }
    });
  });
});
