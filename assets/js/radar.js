// NLA radar: a line that scrolls through today's news (arXiv, blogs, NA Digest, conferences, positions,
// a classic post) and one panel per source. The data is radar.json, rebuilt every morning by fetch_radar.py.
{
  const box = document.getElementById('radar');
  if (box) start(box);

  function start(box) {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ticker = box.querySelector('.rd-ticker');
    const track = box.querySelector('.rd-track');
    const tabs = box.querySelector('.rd-tabs');
    const panel = box.querySelector('.rd-panel');
    const updated = box.querySelector('.rd-updated');
    const src = box.dataset.src;
    let data = null;
    let jobKind = 'all';
    let nlaOnly = true;
    let classicShift = 0;

    // ---------- helpers ----------
    const el = (tag, attrs = {}, ...kids) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else e.setAttribute(k, v);
      }
      for (const k of kids) if (k != null) e.append(k);
      return e;
    };
    const link = (url, label, cls) => url
      ? el('a', { href: url, target: '_blank', rel: 'noopener', class: cls || '', text: label })
      : el('span', { class: cls || '', text: label });
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = (iso) => {
      if (!iso || iso.length < 10) return iso || '';
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      return d + ' ' + MONTHS[m - 1] + ' ' + y;
    };
    const span = (a, b) => {
      if (!b || a === b) return day(a);
      const [ya, ma] = a.split('-'), [yb, mb] = b.split('-');
      if (ya === yb && ma === mb) return Number(a.slice(8)) + '–' + day(b);
      return day(a) + ' – ' + day(b);
    };
    // arXiv titles keep their LaTeX: drop the dollars and the most common commands
    const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε',
      varepsilon: 'ε', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', pi: 'π', sigma: 'σ', Sigma: 'Σ', theta: 'θ',
      omega: 'ω', Omega: 'Ω', infty: '∞', ell: 'ℓ', times: '×', leq: '≤', geq: '≥', approx: '≈', to: '→' };
    const tex = (s) => s.replace(/\$|\\[()[\]]/g, '')
      .replace(/\\(mathcal|mathbb|mathrm|mathbf|text|operatorname)\{([^}]*)\}/g, '$2')
      .replace(/\\([A-Za-z]+)/g, (m, w) => GREEK[w] || w)
      .replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    const dayIndex = () => Math.floor(Date.now() / 86400000);

    // ---------- the scrolling line ----------
    function tickerItems() {
      const out = [];
      // the newest post of each blog, numerical analysis blogs first
      const blogs = [...(data.blogs || [])].sort((x, y) => (x.tier || 1) - (y.tier || 1) || y.date.localeCompare(x.date));
      const seen = new Set();
      for (const b of blogs) {
        if (seen.has(b.source)) continue;
        seen.add(b.source);
        out.push({ tag: b.source, text: b.title, url: b.url, when: b.date, tier: b.tier || 1 });
      }
      (data.arxiv || []).slice(0, 4).forEach((a) => out.push({ tag: 'arXiv', text: tex(a.title), url: a.url }));
      const d = data.digest || {};
      if (d.url) out.push({ tag: 'NA Digest', text: d.date + ': ' + (d.topics || []).slice(0, 2).join('; '), url: d.url });
      const ilas = (data.community || []).find((c) => c.source === 'ILAS-NET');
      if (ilas) out.push({ tag: 'ILAS-NET', text: ilas.title, url: ilas.url });
      (data.events || []).filter((e) => e.nla).slice(0, 2)
        .forEach((e) => out.push({ tag: 'conference', text: e.title + ', ' + span(e.start, e.end), url: e.url }));
      const c = classic();
      if (c) out.push({ tag: 'classic', text: c.source + ': ' + c.title, url: c.url });
      // mixing sources so the line does not show five blog posts in a row; arXiv opens the line
      const mixed = [];
      const buckets = new Map([['arXiv', []], ['blog', []]]);
      for (const it of out) {
        const k = it.tag === 'arXiv' ? 'arXiv' : it.when ? 'blog' : it.tag;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(it);
      }
      while ([...buckets.values()].some((b) => b.length)) {
        for (const b of buckets.values()) if (b.length) mixed.push(b.shift());
      }
      return mixed;
    }

    function buildTicker() {
      const items = tickerItems();
      if (!items.length) return;
      track.textContent = '';
      // two copies one after the other: the line loops without a jump
      for (let copy = 0; copy < 2; copy++) {
        const run = el('span', { class: 'rd-run' });
        if (copy) run.setAttribute('aria-hidden', 'true');
        for (const it of items) {
          const a = link(it.url, it.text, 'rd-item');
          if (copy && a.tagName === 'A') a.tabIndex = -1;
          run.append(el('span', { class: 'rd-chip' },
            el('span', { class: 'rd-tag', text: it.tag }), ' ', a));
        }
        track.append(run);
      }
      ticker.hidden = false;
      if (reduced) { ticker.classList.add('static'); return; }
      // about 45 pixels per second, whatever the length of the line
      requestAnimationFrame(() => {
        const w = track.firstChild.getBoundingClientRect().width;
        track.style.animationDuration = Math.max(30, w / 45) + 's';
        track.classList.add('run');
      });
    }

    // ---------- panels ----------
    function classic() {
      const pool = data.classics || [];
      if (!pool.length) return null;
      // the same post for everybody on the same day, alternating Higham and Moler
      const higham = pool.filter((c) => c.source === 'Nick Higham');
      const moler = pool.filter((c) => c.source !== 'Nick Higham');
      const n = dayIndex() + classicShift;
      const list = (n % 2 && moler.length) || !higham.length ? moler : higham;
      return list[Math.floor(n / 2) % list.length];
    }

    // ---------- conferences: deadlines, calendar, map ----------
    const KIND = { minisymposium: 'minisymposia', contributed: 'abstracts', grants: 'grants',
      registration: 'registration', other: 'deadline' };
    const KCOLOR = { minisymposium: '#0b47d1', contributed: '#009e73', grants: '#d55e00',
      registration: '#cc79a7', other: '#595959' };
    const todayIso = () => new Date().toISOString().slice(0, 10);
    const daysTo = (iso) => Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86400000);
    const countdown = (iso) => { const n = daysTo(iso); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; };
    const SVG = 'http://www.w3.org/2000/svg';
    const svg = (tag, attrs = {}, ...kids) => {
      const e = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      for (const k of kids) if (k != null) e.append(k);
      return e;
    };
    // one small shape per kind of deadline, so the calendar reads also without colours
    function mark(type, x, y) {
      const c = KCOLOR[type] || KCOLOR.other, r = 5;
      if (type === 'minisymposium') return svg('path', { d: `M${x} ${y - r}L${x + r} ${y + r - 1}L${x - r} ${y + r - 1}Z`, fill: c });
      if (type === 'contributed') return svg('circle', { cx: x, cy: y, r: r - 0.5, fill: c });
      if (type === 'grants') return svg('path', { d: `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`, fill: c });
      if (type === 'registration') return svg('rect', { x: x - r + 1, y: y - r + 1, width: 2 * r - 2, height: 2 * r - 2, fill: c });
      return svg('circle', { cx: x, cy: y, r: r - 1, fill: 'white', stroke: c, 'stroke-width': 2 });
    }
    function legend() {
      const p = el('p', { class: 'rd-note rd-legend' });
      p.append(el('span', {}, el('i', { class: 'rd-bar', 'aria-hidden': 'true' }), ' conference'));
      for (const k of Object.keys(KIND)) {
        const s = svg('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' }, mark(k, 6, 6));
        p.append(' ', el('span', {}, s, ' ' + KIND[k]));
      }
      return p;
    }

    // the calendar shows one period at a time: a week, a month, 3 or 6 months, a year; the arrows move by one period
    const RANGES = [['week', 'week'], ['month', 'month'], ['3m', '3 months'], ['6m', '6 months'], ['1y', '1 year']];
    let calRange = '6m';
    let calShift = 0;
    const DAY = 86400000;

    function period() {
      const now = new Date();
      const y = now.getUTCFullYear(), m = now.getUTCMonth();
      if (calRange === 'week') {
        const monday = Date.UTC(y, m, now.getUTCDate() - (now.getUTCDay() + 6) % 7) + calShift * 7 * DAY;
        return { t0: monday, t1: monday + 7 * DAY, unit: 'day' };
      }
      const n = { month: 1, '3m': 3, '6m': 6, '1y': 12 }[calRange];
      return { t0: Date.UTC(y, m + calShift * n, 1), t1: Date.UTC(y, m + (calShift + 1) * n, 1), unit: n === 1 ? 'day' : 'month' };
    }

    function periodLabel(t0, t1) {
      const a = new Date(t0), b = new Date(t1 - DAY);
      if (calRange === 'week') return day(a.toISOString()) + ' – ' + day(b.toISOString());
      const ma = MONTHS[a.getUTCMonth()] + ' ' + a.getUTCFullYear(), mb = MONTHS[b.getUTCMonth()] + ' ' + b.getUTCFullYear();
      return ma === mb ? ma : ma + ' – ' + mb;
    }

    function calendar(confs) {
      const box = el('div', { class: 'rd-calbox' });
      const bar = el('div', { class: 'rd-calbar' });
      const label = el('span', { class: 'rd-calperiod', 'aria-live': 'polite' });
      const body = el('div', { class: 'rd-calwrap' });
      const btn = (text, aria, fn) => {
        const b = el('button', { type: 'button', class: 'rd-filter', 'aria-label': aria, text });
        b.addEventListener('click', fn);
        return b;
      };
      const ranges = el('span', { class: 'rd-ranges', role: 'group', 'aria-label': 'Period' });
      for (const [k, txt] of RANGES) {
        const b = btn(txt, 'Show ' + txt, () => { calRange = k; calShift = 0; draw(); });
        b.dataset.range = k;
        ranges.append(b, ' ');
      }
      bar.append(btn('‹', 'Previous period', () => { calShift -= 1; draw(); }),
        btn('today', 'Back to today', () => { calShift = 0; draw(); }),
        btn('›', 'Next period', () => { calShift += 1; draw(); }), ' ', label, ranges);
      box.append(bar, body);

      function draw() {
        for (const b of ranges.children) b.setAttribute('aria-pressed', String(b.dataset.range === calRange));
        const { t0, t1, unit } = period();
        label.textContent = periodLabel(t0, t1);
        const t = (iso) => Date.parse(iso);
        // only the conferences with something in this period: the conference itself or one of its deadlines
        const rows = confs.filter((c) => (t(c.start) < t1 && t(c.end || c.start) + DAY > t0) ||
          (c.deadlines || []).some((d) => t(d.date) >= t0 && t(d.date) < t1));
        body.textContent = '';
        if (!rows.length) { body.append(el('p', { class: 'rd-note', text: 'Nothing in this period.' })); return; }
        const W = 860, NW = 185, LW = 262, ROW = 24, TOP = 26, R = W - 10;   // name, dates, then the period
        const H = TOP + rows.length * ROW + 6;
        const x = (ms) => LW + (Math.min(Math.max(ms, t0), t1) - t0) / (t1 - t0) * (R - LW);
        const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rd-cal', role: 'img',
          'aria-label': 'Conferences and deadlines, ' + label.textContent });
        // the grid: days (week and month) or months, with labels that fit
        if (unit === 'day') {
          const days = Math.round((t1 - t0) / DAY);
          for (let k = 0; k <= days; k++) {
            const ms = t0 + k * DAY, d = new Date(ms), xm = x(ms);
            const monday = d.getUTCDay() === 1;
            root.append(svg('line', { x1: xm, x2: xm, y1: TOP - 6, y2: H, class: monday ? 'rd-year' : 'rd-month' }));
            if (k < days && (days <= 7 || monday || d.getUTCDate() === 1)) {
              const txt = days <= 7 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate() : String(d.getUTCDate());
              root.append(svg('text', { x: xm + 3, y: TOP - 10, class: 'rd-mlabel' }, txt));
            }
          }
        } else {
          const n = Math.round((t1 - t0) / (30.44 * DAY));
          const first = new Date(t0);
          for (let k = 0; k <= n; k++) {
            const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + k, 1)), xm = x(d.getTime());
            root.append(svg('line', { x1: xm, x2: xm, y1: TOP - 6, y2: H, class: d.getUTCMonth() === 0 ? 'rd-year' : 'rd-month' }));
            if (k < n) {
              const name = n <= 6 ? MONTHS[d.getUTCMonth()] : MONTHS[d.getUTCMonth()].slice(0, 1);
              const year = d.getUTCMonth() === 0 || k === 0 ? ' ' + String(d.getUTCFullYear()).slice(2) : '';
              root.append(svg('text', { x: xm + 3, y: TOP - 10, class: 'rd-mlabel' }, name + year));
            }
          }
        }
        rows.forEach((c, i) => {
          const y = TOP + i * ROW + ROW / 2;
          if (i % 2) root.append(svg('rect', { x: 0, y: y - ROW / 2, width: W, height: ROW, class: 'rd-stripe' }));
          const name = svg('text', { x: 4, y: y + 4, class: 'rd-clabel' }, (c.short || c.name).slice(0, 26));
          root.append(c.url ? svg('a', { href: c.url, target: '_blank', rel: 'noopener' }, name) : name);
          // when the conference takes place, always in view (also when it is outside the period)
          const when = new Date(c.start);
          root.append(svg('text', { x: NW, y: y + 4, class: 'rd-mlabel' },
            when.getUTCDate() + ' ' + MONTHS[when.getUTCMonth()] + ' ' + String(when.getUTCFullYear()).slice(2)));
          const s0 = t(c.start), s1 = t(c.end || c.start) + DAY;
          if (s0 < t1 && s1 > t0) {
            const xs = x(s0), xe = Math.max(xs + 4, x(s1));
            root.append(svg('rect', { x: xs, y: y - 6, width: xe - xs, height: 12, rx: 3, class: 'rd-cbar' },
              svg('title', {}, (c.name || c.short) + ', ' + span(c.start, c.end) + (c.city ? ', ' + c.city : ''))));
          }
          for (const d of c.deadlines || []) {
            const td = t(d.date);
            if (td < t0 || td >= t1) continue;
            const m = mark(d.type, x(td + DAY / 2), y);
            m.append(svg('title', {}, KIND[d.type] + ': ' + day(d.date) + (d.date >= todayIso() ? ' (' + countdown(d.date) + ')' : '') + ' – ' + (d.label || '')));
            root.append(m);
          }
        });
        if (Date.now() >= t0 && Date.now() < t1) {
          const xt = x(Date.now());
          root.append(svg('line', { x1: xt, x2: xt, y1: TOP - 6, y2: H, class: 'rd-today' }));
        }
        body.append(root);
      }
      draw();
      return box;
    }

    function worldMap(confs) {
      const pins = confs.filter((c) => c.lat != null && c.lon != null);
      const wrap = el('div', { class: 'rd-map' });
      const cv = el('canvas', { 'aria-hidden': 'true' });
      const caption = el('p', { class: 'rd-note rd-mapcap', text: 'Hover or focus a place to see its conferences.' });
      wrap.append(cv);
      // the view fits the pins, with some margin, keeping a 2:1 shape
      let la0 = Math.min(...pins.map((p) => p.lat)) - 10, la1 = Math.max(...pins.map((p) => p.lat)) + 10;
      let lo0 = Math.min(...pins.map((p) => p.lon)) - 18, lo1 = Math.max(...pins.map((p) => p.lon)) + 18;
      if (lo1 - lo0 < 70) { const m = (lo0 + lo1) / 2; lo0 = m - 35; lo1 = m + 35; }
      if ((lo1 - lo0) / (la1 - la0) > 2.2) { const m = (la0 + la1) / 2, h = (lo1 - lo0) / 4.4; la0 = m - h; la1 = m + h; }
      else { const m = (lo0 + lo1) / 2, w = (la1 - la0) * 1.1; lo0 = m - w; lo1 = m + w; }
      la0 = Math.max(-60, la0); la1 = Math.min(80, la1);
      const P = (lat, lon) => [(lon - lo0) / (lo1 - lo0), (la1 - lat) / (la1 - la0)];
      // places with more than one conference get one pin
      const places = new Map();
      for (const c of pins) {
        const k = (c.city || '') + '|' + c.lat.toFixed(1) + '|' + c.lon.toFixed(1);
        if (!places.has(k)) places.set(k, { c0: c, list: [] });
        places.get(k).list.push(c);
      }
      for (const { c0, list } of places.values()) {
        const [u, v] = P(c0.lat, c0.lon);
        const text = (c0.city ? c0.city + ': ' : '') + list.map((c) => (c.short || c.name) + ' (' + span(c.start, c.end) + ')').join('; ');
        const pin = el('a', { class: 'rd-pin', href: list[0].url || '#', target: '_blank', rel: 'noopener', 'aria-label': text },
          el('span', { class: 'rd-pinlabel', text: list.map((c) => c.short || c.name).join(', ') }));
        pin.style.left = (u * 100) + '%';
        pin.style.top = (v * 100) + '%';
        const say = () => { caption.textContent = text; };
        pin.addEventListener('mouseenter', say);
        pin.addEventListener('focus', say);
        wrap.append(pin);
      }
      // dotted land, drawn once the mask is loaded and the panel has a size
      const img = new Image();
      img.onload = () => requestAnimationFrame(() => {
        const w = wrap.clientWidth, h = Math.round(w / 2), dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!w) return;
        cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
        const m = document.createElement('canvas');
        m.width = img.width; m.height = img.height;
        const mg = m.getContext('2d');
        mg.drawImage(img, 0, 0);
        const px = mg.getImageData(0, 0, m.width, m.height).data;
        const g = cv.getContext('2d');
        g.scale(dpr, dpr);
        g.fillStyle = '#012a4a';
        g.globalAlpha = 0.28;
        const gap = 6;
        for (let y = gap / 2, row = 0; y < h; y += gap, row++) {
          for (let xx = row % 2 ? gap : gap / 2; xx < w; xx += gap) {
            const lat = la1 - y / h * (la1 - la0), lon = lo0 + xx / w * (lo1 - lo0);
            const mx = Math.floor(((lon + 180) / 360 % 1 + 1) % 1 * m.width), my = Math.floor((90 - lat) / 180 * m.height);
            if (my >= 0 && my < m.height && px[(my * m.width + mx) * 4] > 127) g.fillRect(xx - 1.2, y - 1.2, 2.4, 2.4);
          }
        }
      });
      img.src = box.dataset.mask || 'assets/timeline/land.png';
      wrap.style.aspectRatio = '2 / 1';
      return el('div', {}, wrap, caption);
    }

    const PANELS = {
      arxiv() {
        const list = data.arxiv || [];
        const ol = el('ol', { class: 'rd-list' });
        for (const a of list) {
          ol.append(el('li', {}, link(a.url, tex(a.title)), el('span', { class: 'rd-meta', text: ' ' + (a.authors || []).join(', ') })));
        }
        return [
          el('p', { class: 'rd-note', text: list.length
            ? 'New in math.NA today, picked automatically for linear algebra (' + list.length + ').'
            : 'Nothing new in math.NA today (arXiv does not announce on weekends).' }),
          ol,
          el('p', { class: 'rd-note' }, link('https://arxiv.org/list/math.NA/new', 'All of math.NA today'))];
      },
      blogs() {
        // numerical analysis blogs first, then the general mathematics ones
        const out = [];
        for (const [tier, head] of [[1, 'Numerical analysis'], [2, 'Also worth reading']]) {
          const ul = el('ul', { class: 'rd-list' });
          for (const b of (data.blogs || []).filter((x) => (x.tier || 1) === tier)) {
            ul.append(el('li', {}, el('span', { class: 'rd-date', text: day(b.date) }),
              el('span', {}, el('b', { text: b.source + ': ' }), link(b.url, b.title))));
          }
          if (ul.children.length) out.push(el('p', { class: 'rd-note rd-sub', text: head }), ul);
        }
        return out;
      },
      digest() {
        const d = data.digest || {};
        // the topics of the issue, grouped: positions, events and calls, books and journals, the rest
        // positions first: "Naval Postgraduate School" is a job, not a school
        const GROUPS = [['Positions', /position|postdoc|ph\.?d|professor|faculty|lecturer|fellowship|chair|job/i],
          ['Events and calls', /conference|workshop|symposi|school|meeting|seminar|call for|congress|webinar/i],
          ['Books and journals', /book|journal|contents|special issue|issue|volume|vol\./i],
          ['Other', /./]];
        const groups = GROUPS.map(([head]) => ({ head, items: [] }));
        for (const t of d.topics || []) groups[GROUPS.findIndex(([, rx]) => rx.test(t))].items.push(t);
        const topics = el('div', { class: 'rd-topics' });
        // shown with events first: positions have their own tab too
        for (const g of [groups[1], groups[2], groups[0], groups[3]]) {
          if (!g.items.length) continue;
          const ul = el('ul');
          g.items.forEach((t) => ul.append(el('li', { text: t })));
          topics.append(el('p', { class: 'rd-note rd-sub', text: g.head + ' (' + g.items.length + ')' }), ul);
        }
        const out = [el('p', { class: 'rd-note rd-sub', text: 'NA Digest' }),
          el('p', { class: 'rd-note' }, 'Latest issue: ', link(d.url, (d.issue || 'NA Digest') + ', ' + (d.date || '')),
            ', edited by David Bindel and Alex Townsend.'), topics];
        // the linear algebra list (ILAS-NET) and the Pisa numerical analysis group
        for (const name of ['ILAS-NET', 'NumPi Pisa']) {
          const items = (data.community || []).filter((c) => c.source === name);
          if (!items.length) continue;
          const list = el('ul', { class: 'rd-list' });
          for (const c of items) list.append(el('li', {}, el('span', { class: 'rd-date', text: day(c.date) }), link(c.url, c.title)));
          out.push(el('p', { class: 'rd-note rd-sub' }, link(items[0].home, name)), list);
        }
        return out;
      },
      events() {
        const confs = data.conferences || [];
        const out = [];

        // the next deadlines, with a countdown
        const next = [];
        for (const c of confs) for (const d of c.deadlines || []) if (d.date >= todayIso()) next.push({ c, d });
        next.sort((a, b) => a.d.date.localeCompare(b.d.date));
        if (next.length) {
          const ul = el('ul', { class: 'rd-list rd-deadlines' });
          for (const { c, d } of next.slice(0, 8)) {
            ul.append(el('li', {}, el('span', { class: 'rd-date', text: countdown(d.date) }),
              el('span', {}, el('i', { class: 'rd-dl', 'data-type': d.type, 'aria-hidden': 'true' }),
                el('b', { text: KIND[d.type] + ' ' }), link(d.url || c.url, c.short || c.name),
                el('span', { class: 'rd-meta', text: ' ' + day(d.date) }))));
          }
          out.push(el('p', { class: 'rd-note rd-sub', text: 'Next deadlines' }), ul);
        }
        if (confs.length) out.push(el('p', { class: 'rd-note rd-sub', text: 'Calendar' }), calendar(confs), legend());
        if (confs.some((c) => c.lat != null)) out.push(el('p', { class: 'rd-note rd-sub', text: 'Where' }), worldMap(confs));

        // everything else announced on the NA Digest
        const all = data.events || [];
        const list = nlaOnly ? all.filter((e) => e.nla) : all;
        const toggle = el('button', { type: 'button', class: 'rd-filter', 'aria-pressed': String(nlaOnly),
          text: nlaOnly ? 'show all numerical analysis events' : 'show only linear algebra' });
        toggle.addEventListener('click', () => { nlaOnly = !nlaOnly; show('events'); });
        const ul = el('ul', { class: 'rd-list' });
        for (const e of list) {
          ul.append(el('li', {}, el('span', { class: 'rd-date', text: span(e.start, e.end) }),
            el('span', {}, link(e.url, e.title), el('span', { class: 'rd-meta', text: ' ' + e.category }))));
        }
        out.push(el('p', { class: 'rd-note rd-sub', text: 'Announced on the NA Digest' }),
          el('p', { class: 'rd-note' }, toggle), ul);
        return out;
      },
      jobs() {
        const all = data.jobs || [];
        const kinds = ['all', ...new Set(all.map((j) => j.kind))];
        const bar = el('p', { class: 'rd-note rd-kinds' });
        for (const k of kinds) {
          const b = el('button', { type: 'button', class: 'rd-filter', 'aria-pressed': String(k === jobKind), text: k });
          b.addEventListener('click', () => { jobKind = k; show('jobs'); });
          bar.append(b, ' ');
        }
        const list = all.filter((j) => jobKind === 'all' || j.kind === jobKind)
          .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
        const ul = el('ul', { class: 'rd-list' });
        for (const j of list) {
          ul.append(el('li', {}, el('span', { class: 'rd-date', text: j.deadline ? day(j.deadline) : 'open' }),
            el('span', {}, link(j.url, j.title), el('span', { class: 'rd-meta', text: ' ' + j.kind }))));
        }
        return [el('p', { class: 'rd-note', text: 'Open positions from the NA Digest, by deadline. ' }), bar, ul];
      },
      classic() {
        const c = classic();
        if (!c) return [el('p', { class: 'rd-note', text: 'No classic today.' })];
        const next = el('button', { type: 'button', class: 'rd-filter', text: 'another one' });
        next.addEventListener('click', () => { classicShift += 1; show('classic'); });
        return [el('p', { class: 'rd-classic' }, link(c.url, c.title)),
          el('p', { class: 'rd-note', text: c.source + ', ' + c.date + '. ' }, next),
          el('p', { class: 'rd-note', text: c.source === 'Nick Higham'
            ? 'From the "What Is" series by Nick Higham (1961–2024).'
            : 'From Cleve’s Corner by Cleve Moler (1939–2026), creator of MATLAB.' })];
      }
    };

    let open = null;
    function show(name) {
      open = name;
      panel.textContent = '';
      panel.classList.toggle('tall', name === 'events');
      panel.append(...PANELS[name]());
      panel.hidden = false;
      panel.setAttribute('aria-labelledby', 'rd-tab-' + name);
      for (const b of tabs.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    }
    function hide() {
      open = null;
      panel.hidden = true;
      for (const b of tabs.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', 'false');
    }

    for (const b of tabs.querySelectorAll('[role=tab]')) {
      b.id = 'rd-tab-' + b.dataset.tab;
      b.addEventListener('click', () => (open === b.dataset.tab ? hide() : show(b.dataset.tab)));
    }

    // ---------- data ----------
    function render() {
      const counts = { arxiv: (data.arxiv || []).length, events: (data.events || []).filter((e) => e.nla).length,
        jobs: (data.jobs || []).length };
      for (const b of tabs.querySelectorAll('[role=tab]')) {
        const n = counts[b.dataset.tab];
        if (n) b.dataset.count = n;
      }
      const when = new Date(data.updated);
      updated.textContent = isNaN(when) ? '' : 'updated ' + day(data.updated.slice(0, 10));
      tabs.hidden = false;
      buildTicker();
    }

    // the data is downloaded when the radar is about to come into view
    // at the top of the home page: the button that leads down here (with today's arXiv count) and,
    // next to the news, the four nearest conference deadlines
    function renderTop() {
      const next = document.querySelector('.rd-jump-next');
      const n = (data.arxiv || []).length;
      if (next) next.textContent = n ? ' · ' + n + ' new on arXiv today' : '';
      const list = document.querySelector('.rd-next-list');
      if (!list) return;
      const soon = [];
      for (const c of data.conferences || []) {
        if (c.source !== 'curated') continue;      // only the verified ones, and not every early-bird registration
        for (const d of c.deadlines || []) if (d.date >= todayIso() && d.type !== 'registration') soon.push({ c, d });
      }
      soon.sort((a, b) => a.d.date.localeCompare(b.d.date));
      list.textContent = '';
      for (const { c, d } of soon.slice(0, 4)) {
        list.append(el('li', {}, el('span', { class: 'news-date', text: countdown(d.date) }),
          el('span', {}, el('i', { class: 'rd-dl', 'data-type': d.type, 'aria-hidden': 'true' }),
            link(d.url || c.url, (c.short || c.name) + ' ' + KIND[d.type]))));
      }
      if (!soon.length) list.append(el('li', {}, el('span', { class: 'rd-note', text: 'No deadlines in sight.' })));
    }
    // links to #radar can also open one of its tabs
    let wantTab = null;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-radar-open]');
      if (!a) return;
      const tab = a.dataset.radarOpen;
      if (data) { if (open !== tab) show(tab); } else wantTab = tab;
    });

    // the data is downloaded after the page has loaded (the button needs the next deadline)
    let loading = null;
    const load = () => loading || (loading = fetch(src, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { data = d; render(); renderTop(); if (wantTab) show(wantTab); })
      .catch(() => { updated.textContent = 'the radar is offline for now'; }));
    if (document.readyState === 'complete') setTimeout(load, 300);
    else window.addEventListener('load', () => setTimeout(load, 300), { once: true });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
      }, { rootMargin: '400px 0px' });
      io.observe(box);
    }
  }
}
