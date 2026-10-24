// La linea della home: si colora di blu scuro fin dove si è arrivati scorrendo (60% dello schermo),
// e ogni tappa che la linea ha raggiunto diventa piena (classe "on").
(function () {
  var spine = document.querySelector('.spine');
  if (!spine) return;
  var stops = [].slice.call(spine.querySelectorAll('.st'));
  var marks = stops.map(function (st) { return st.querySelector(':scope > .mk'); });
  var top = 0, queued = false;

  function y(el) { return el.getBoundingClientRect().top + el.offsetHeight / 2; }

  function update() {
    queued = false;
    var s = spine.getBoundingClientRect();
    top = y(marks[0]) - s.top;
    spine.style.setProperty('--top', top + 'px');
    // la linea piena finisce alla penultima tappa (il radar); fino ai minigiochi è tratteggiata
    var last = stops[stops.length - 1], before = y(marks[marks.length - 2]);
    spine.style.setProperty('--end', (s.bottom - before) + 'px');
    spine.style.setProperty('--tail', (last.getBoundingClientRect().top - before) + 'px');
    var reach = window.innerHeight * 0.6 - s.top;
    // in fondo alla pagina la linea arriva comunque fino all'ultima tappa
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) reach = Infinity;
    spine.style.setProperty('--fill', Math.max(0, Math.min(reach, s.height) - top) + 'px');
    stops.forEach(function (st, i) { st.classList.toggle('on', y(marks[i]) - s.top <= reach); });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  // le sezioni che si aprono e le animazioni d'ingresso spostano le tappe
  if (window.ResizeObserver) new ResizeObserver(queue).observe(spine);
  spine.addEventListener('transitionend', queue);
  update();
})();
