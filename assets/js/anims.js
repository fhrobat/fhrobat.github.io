// Paper animations: they play only while on screen (not under reduced motion),
// and a click or Enter/Space pauses and resumes them.
{
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = document.querySelectorAll('li.has-anim > video.paper-anim');

  const label = (v) => { v.title = v.paused ? 'Play animation' : 'Pause animation'; };

  const io = 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (!isIntersecting) v.pause();
      else if (!v.dataset.stopped) v.play().catch(() => {});
      label(v);
    });
  });

  videos.forEach((v) => {
    if (reduced) {
      v.dataset.stopped = '1';
      v.preload = 'metadata'; // shows the first frame
    }
    if (io) io.observe(v);
    v.tabIndex = 0;
    v.setAttribute('role', 'button');
    label(v);
    const toggle = () => {
      if (v.paused) { delete v.dataset.stopped; v.play().catch(() => {}); }
      else { v.dataset.stopped = '1'; v.pause(); }
      label(v);
    };
    v.addEventListener('click', toggle);
    v.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    v.addEventListener('play', () => label(v));
    v.addEventListener('pause', () => label(v));
  });
}
