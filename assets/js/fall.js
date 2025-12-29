document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('trigger-fall');
  const selector = '.fallable';
  const FALL_DELAY = 80;     // ms between items during fall
  const RESET_AFTER = 3000;  // ms to wait before starting the rise (3s)
  const GROUP_STAGGER = 120; // ms between groups when rising (headings -> paragraphs -> others)

  let running = false;
  let timeouts = [];

  function clearTimers() {
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
  }

  function getGroups(elems) {
    // headings (h1..h6), then paragraphs, then list items, then the rest
    const isHeading = el => /^H[1-6]$/.test(el.tagName);
    const isParagraph = el => el.tagName === 'P';
    const isListItem = el => el.tagName === 'LI';

    const headings = [];
    const paras = [];
    const lists = [];
    const others = [];

    elems.forEach(el => {
      if (isHeading(el)) headings.push(el);
      else if (isParagraph(el)) paras.push(el);
      else if (isListItem(el)) lists.push(el);
      else others.push(el);
    });

    return { headings, paras, lists, others };
  }

  function fallSequence(elems) {
    elems.forEach((el, i) => {
      const rot = (Math.random() * 30 + 5) * (Math.random() < 0.5 ? -1 : 1);
      el.style.setProperty('--r', rot + 'deg');

      const t = setTimeout(() => {
        // ensure rise class removed in case of mid-state
        el.classList.remove('rise-active');
        // trigger fall
        el.classList.add('fall-active');
      }, i * FALL_DELAY);
      timeouts.push(t);
    });
  }

  function riseSequence(elems) {
    // elems is an array in the order we want them to rise
    elems.forEach((el, idx) => {
      const t = setTimeout(() => {
        // remove fall class in case animation still present, then add rise
        el.classList.remove('fall-active');
        // force reflow to reset animation if needed
        // eslint-disable-next-line no-unused-expressions
        void el.offsetWidth;
        el.classList.add('rise-active');
      }, idx * FALL_DELAY);
      timeouts.push(t);
    });
  }

  function fallAndReturn() {
    if (running) return;
    running = true;
    clearTimers();

    const all = Array.from(document.querySelectorAll(selector));
    if (all.length === 0) {
      running = false;
      return;
    }

    // Phase 1: fall in document order (visual naturalness)
    fallSequence(all);

    // Phase 2: after RESET_AFTER, rise in grouped order:
    // headings first, then paragraphs, then list-items, then others.
    const tRiseStart = setTimeout(() => {
      // compute groups
      const groups = getGroups(all);

      // sequence groups: headings -> paragraphs -> lists -> others
      const groupOrder = [groups.headings, groups.paras, groups.lists, groups.others];

      // for each group, schedule its riseSequence with increasing offset
      let offset = 0;
      groupOrder.forEach((groupArr, gi) => {
        if (!groupArr || groupArr.length === 0) {
          offset += GROUP_STAGGER; // small spacing even if empty
          return;
        }
        const tGroup = setTimeout(() => {
          riseSequence(groupArr);
        }, offset);
        timeouts.push(tGroup);

        // increase offset so next group starts after this group has had some time
        offset += (groupArr.length * FALL_DELAY) + GROUP_STAGGER;
      });

      // final cleanup after last rise ends (safe buffer)
      const totalEstimated = offset + 1200;
      const tCleanup = setTimeout(() => {
        all.forEach(el => {
          el.classList.remove('rise-active', 'fall-active');
          el.style.removeProperty('--r');
        });
        running = false;
      }, totalEstimated);
      timeouts.push(tCleanup);

    }, RESET_AFTER);
    timeouts.push(tRiseStart);
  }

  // attach handlers
  btn?.addEventListener('click', fallAndReturn);

  // optional keyboard shortcut (key "f")
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' && !running) fallAndReturn();
  });

  // cleanup when leaving
  window.addEventListener('beforeunload', () => clearTimers());
});
