/*
  Timeline della home, "▶ play": il cartone animato a schermo intero.
  La timeline lo carica solo quando si preme play (sul sito: /assets/timeline/toon.js) e lo apre con
  TLToon.open(overlay, elementi <li> della timeline, { onClose }).
  Stile: solo contorni. Il personaggio è un pupazzo SVG: braccia e gambe sono "tubi" (un tratto scuro largo con sopra
  un tratto chiaro più stretto), la testa ha capelli, barba, occhi e bocca intercambiabili; ogni scena ne calcola la
  posa a ogni fotogramma. Ogni tappa diventa uno o più "atti", scelti da data-toon o dal tipo di tappa: gara -> compito
  in classe e podio, laurea -> corona d'alloro e voto, talk -> slide e pubblico, articolo -> laptop e animazione Manim,
  data-map -> aereo, treno o bici e arrivo davanti al monumento del posto, ecc.
  Tra una tappa e l'altra si chiude e si riapre il diaframma dei vecchi cartoni; tra due atti la camera fa una
  panoramica veloce (la tendina, se l'anno non cambia). Tutti i personaggi sono alla maniera dei Mii della Wii; il
  protagonista è pelato e ha il suo "colore preferito", il blu Oxford della maglietta.
  Si parte da un menu: "highlights" (le tappe con data-hl) o "the full story"; ogni periodo (scuola, Pisa, Oxford)
  si apre con il cartello del capitolo. Le scene che si ripetono cambiano ogni volta (articoli, talk, gare, lezioni,
  borse, campus). Suoni sintetizzati, spenti all'inizio; link diretti con #film=<data della tappa>; alla fine i
  bottoni verso articoli, email e Google Scholar; eventi su GoatCounter se la pagina lo carica.
*/
(function () {
  'use strict';
  if (window.TLToon) return;

  var NS = 'http://www.w3.org/2000/svg';
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var D2R = Math.PI / 180;

  // ---------------------------------------------------------------- strumenti
  function S(tag, a, parent) {
    var e = document.createElementNS(NS, tag);
    if (a) for (var k in a) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function G(parent, t) { return S('g', t ? { transform: t } : null, parent); }
  function P(parent, d, cls) { return S('path', { d: d, 'class': cls === undefined ? 'k' : cls }, parent); }
  function C(parent, x, y, r, cls) { return S('circle', { cx: x, cy: y, r: r, 'class': cls === undefined ? 'k' : cls }, parent); }
  function TX(parent, x, y, s, size, cls, anchor) {
    var e = S('text', { x: x, y: y, 'font-size': size, 'text-anchor': anchor || 'middle', 'class': 'tx' + (cls ? ' ' + cls : '') }, parent);
    e.textContent = s;
    return e;
  }
  function f1(x) { return String(Math.round(x * 10) / 10); }
  function tf(e, x, y, r, sx, sy) {
    var s = 'translate(' + f1(x) + ' ' + f1(y) + ')';
    if (r) s += ' rotate(' + f1(r) + ')';
    if (sx !== undefined && sx !== null) s += ' scale(' + sx.toFixed(3) + ' ' + (sy === undefined ? sx : sy).toFixed(3) + ')';
    e.setAttribute('transform', s);
  }
  function vis(e, on) { e.style.display = on ? '' : 'none'; }
  function alpha(e, a) { e.style.opacity = a >= 1 ? '' : String(Math.max(0, a).toFixed(3)); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function eOut(x) { x = clamp01(x); return 1 - (1 - x) * (1 - x) * (1 - x); }
  function eIn(x) { x = clamp01(x); return x * x * x; }
  function eIO(x) { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eBack(x) { x = clamp01(x); var c = 2.1; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function eBounce(x) {
    x = clamp01(x);
    var n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
    if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
    x -= 2.625 / d;
    return n * x * x + 0.984375;
  }
  function pop(t, a) { return eBack(seg(t, a, a + 0.35)); }
  function hop(t, a, b, h) { var k = seg(t, a, b); return -Math.sin(Math.PI * k) * h; }
  function rng(seed) {
    var s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }
  function dirv(a) { return [Math.sin(a * D2R), Math.cos(a * D2R)]; }
  function rect(x, y, w, h) { return 'M' + x + ' ' + y + ' h' + w + ' v' + h + ' h' + (-w) + ' Z'; }
  function rrect(x, y, w, h, r) {
    return 'M' + (x + r) + ' ' + y + ' h' + (w - 2 * r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + ' v' + (h - 2 * r) +
      ' a' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + r + ' h' + (2 * r - w) + ' a' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + (-r) +
      ' v' + (2 * r - h) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) + ' Z';
  }
  function circD(x, y, r) { return 'M' + (x - r) + ' ' + y + ' a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 Z'; }
  function starD(r1, r2, n) {
    var d = '';
    for (var i = 0; i < 2 * n; i++) {
      var a = (i * 180 / n - 90) * D2R, r = i % 2 ? r2 : r1;
      d += (i ? 'L' : 'M') + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r) + ' ';
    }
    return d + 'Z';
  }
  function poly(pts) { return 'M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L'); }
  function wrap(s, max) {
    var lines = [], cur = '';
    s.split(' ').forEach(function (w) {
      if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // testo su più righe che si può "scrivere a macchina": type(k) con k da 0 a 1
  function tlines(parent, x, y, lines, size, cls, anchor, lh) {
    var e = S('text', { x: x, y: y, 'font-size': size, 'text-anchor': anchor || 'middle', 'class': 'tx' + (cls ? ' ' + cls : '') }, parent);
    var spans = lines.map(function (l, i) { return S('tspan', { x: x, dy: i ? f1(size * (lh || 1.22)) : 0 }, e); });
    var total = lines.join('').length, last = -1;
    function type(k) {
      var n = Math.round(total * clamp01(k));
      if (n === last) return;
      last = n;
      lines.forEach(function (l, i) { spans[i].textContent = l.slice(0, Math.max(0, n)) || (i ? '' : ''); n -= l.length; });
    }
    type(1);
    return { el: e, type: type, n: lines.length };
  }

  // ---------------------------------------------------------------- il personaggio
  // Pupazzi alla maniera dei Mii della Wii: testa grande e tonda, occhi a ovale pieni con un riflesso, sopracciglia
  // corte, naso a "u", capelli pieni a caschetto, busto a campana, mani tonde e (quasi) niente collo.
  // Coordinate del pupazzo: origine a terra fra i piedi, y verso il basso (in su = negativo); è alto circa 320.
  // Il busto ruota attorno al bacino; gli angoli di braccia e gambe si misurano dalla verticale in giù, positivi
  // verso +x; il secondo angolo (gomito, ginocchio) è relativo al primo. La testa ha l'origine sul collo.
  var INK = 3.5;
  var FACE = 'M -50 -70 C -52 -106 -30 -124 0 -124 C 30 -124 52 -106 50 -70 C 49 -38 33 -8 0 -6 C -33 -8 -49 -38 -50 -70 Z';
  var EAR = 'M -47 -76 C -60 -80 -62 -56 -49 -53 Z';
  var BODY = 'M -22 -86 C -34 -86 -40 -80 -41 -70 L -45 -10 C -46 -1 -40 3 -32 3 L 32 3 C 40 3 46 -1 45 -10 L 41 -70 C 40 -80 34 -86 22 -86 Z';
  var BODY_L = {
    plain: 'M -16 -86 C -10 -79 10 -79 16 -86',
    tee: 'M -15 -86 C -9 -77 9 -77 15 -86',
    sweater: 'M -16 -86 C -10 -79 10 -79 16 -86 M -44 -8 L 44 -8 M -33 -8 L -33 2 M -20 -8 L -20 3 M -7 -8 L -7 3 M 7 -8 L 7 3 M 20 -8 L 20 3 M 33 -8 L 33 2'
  };
  var PANTS = 'M -36 -106 L 36 -106 L 37 -90 C 22 -86 6 -87 0 -91 C -6 -87 -22 -86 -37 -90 Z';
  var BROW = 'M -30 -84 Q -21 -89 -12 -85';
  var NOSE = 'M -5 -47 C -6 -40 6 -40 5 -47';
  var TEETH = 'M -13 -27.5 C -5 -25.5 5 -25.5 13 -27.5';
  var TONGUE = 'M 3 -27.4 C 3 -20 6 -18 9 -19 C 12 -20 12 -24 10 -27.6';
  var GLASSES = circD(-21, -64, 13) + ' ' + circD(21, -64, 13) + ' M -8 -66 Q 0 -70 8 -66 M -34 -66 L -49 -70 M 34 -66 L 49 -70';
  var MOUTH = {
    smile: ['M -12 -29 Q 0 -20 12 -29', 'l'],
    grin: ['M -16 -32 C -6 -29 6 -29 16 -32 C 13 -15 -13 -15 -16 -32 Z', 'k'],
    open: ['M -10 -31 Q 0 -29 10 -31 Q 8 -17 0 -17 Q -8 -17 -10 -31 Z', 'k'],
    o: ['M 0 -33 C 5 -33 7 -27 7 -24 C 7 -19 4 -17 0 -17 C -4 -17 -7 -19 -7 -24 C -7 -27 -5 -33 0 -33 Z', 'k'],
    flat: ['M -8 -27 Q 0 -26 8 -27', 'l'],
    tongue: ['M -9 -28 Q 0 -26 9 -28', 'l'],
    frown: ['M -10 -22 Q 0 -31 10 -22', 'l'],
    wavy: ['M -11 -26 Q -6 -30 -2 -26 Q 2 -22 6 -26 Q 9 -29 11 -27', 'l']
  };
  var TALK = ['open', 'smile', 'o', 'open', 'grin', 'flat'];
  // occhi: ovali pieni con un riflesso; chiusi, felici o storditi diventano un tratto
  var EYES = {
    open: { rx: 6.5, ry: 9.5 },
    wide: { rx: 7.5, ry: 11.5 },
    focus: { rx: 6.5, ry: 4.5 },
    closed: { lid: 'M -8 0 Q 0 5 8 0' },
    happy: { lid: 'M -8 3 Q 0 -6 8 3' },
    dizzy: { lid: 'M -5 -5 L 5 5 M 5 -5 L -5 5' }
  };

  // capelli, pieni: f davanti al viso, b dietro la testa, h il riflesso chiaro, g il riflesso sulla testa pelata
  function curly() {
    var p = [], q = [], i, a, d;
    for (i = 0; i <= 11; i++) { a = (165 + i * 210 / 11) * D2R; p.push([60 * Math.cos(a), -80 + 64 * Math.sin(a)]); }
    for (i = 0; i <= 7; i++) { var x = 54 - i * 108 / 7; q.push([x, -100 + 30 * Math.pow(x / 54, 2)]); }
    var all = p.concat(q);
    d = 'M ' + f1(all[0][0]) + ' ' + f1(all[0][1]);
    for (i = 1; i < all.length; i++) {
      var r = Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]) * 0.62;
      d += ' A ' + f1(r) + ' ' + f1(r) + ' 0 0 1 ' + f1(all[i][0]) + ' ' + f1(all[i][1]);
    }
    return d + ' Z';
  }
  function boom() {
    var d = '';
    for (var i = 0; i <= 18; i++) {
      var a = (160 + i * 220 / 18) * D2R, r = i % 2 ? 94 : 64;
      d += (i ? ' L ' : 'M ') + f1(r * Math.cos(a)) + ' ' + f1(-78 + r * Math.sin(a));
    }
    return d + ' C 40 -98 -40 -98 -60 -56 Z';
  }
  var PONY_F = 'M -51 -64 C -58 -104 -40 -138 0 -138 C 40 -138 58 -104 51 -64 C 48 -86 40 -100 26 -106 C 12 -98 -14 -100 -30 -108 C -42 -98 -48 -84 -51 -64 Z';
  var SHINE = 'M -28 -125 Q -9 -133 11 -130';
  var HAIR = {
    none: { f: '', g: 'M -33 -104 Q -24 -116 -6 -119 M -40 -94 L -38 -98' },
    mii: { f: 'M -54 -60 C -59 -100 -42 -138 0 -139 C 42 -138 59 -100 54 -60 C 51 -72 48 -84 42 -92 C 30 -91 16 -95 6 -106 C -6 -97 -24 -93 -44 -94 C -50 -84 -52 -72 -54 -60 Z', h: SHINE },
    short: { f: 'M -51 -62 C -58 -100 -42 -136 0 -136 C 42 -136 58 -100 51 -62 C 48 -84 42 -98 30 -102 C 18 -94 2 -97 -10 -106 C -20 -98 -36 -99 -44 -90 C -48 -82 -50 -72 -51 -62 Z', h: SHINE },
    spiky: { f: 'M -51 -62 C -56 -88 -54 -108 -42 -120 L -48 -138 L -26 -130 L -20 -150 L -4 -136 L 8 -152 L 16 -135 L 36 -146 L 34 -124 L 54 -126 L 46 -108 C 54 -96 54 -80 51 -62 C 48 -84 40 -98 26 -104 C 10 -100 -10 -100 -26 -104 C -40 -98 -48 -84 -51 -62 Z' },
    bob: { f: 'M -58 -26 C -68 -96 -46 -138 0 -138 C 46 -138 68 -96 58 -26 C 54 -22 48 -22 46 -26 C 50 -64 46 -90 32 -103 C 14 -96 -12 -98 -32 -110 C -46 -96 -50 -64 -46 -26 C -48 -22 -54 -22 -58 -26 Z', h: SHINE },
    pony: { f: PONY_F, b: 'M 34 -122 C 70 -128 84 -86 72 -52 C 68 -40 60 -42 62 -54 C 68 -80 62 -104 40 -106 Z', h: SHINE },
    bun: { f: PONY_F, b: circD(0, -148, 20), h: SHINE },
    curly: { f: curly() },
    bald: { f: 'M -51 -60 C -54 -78 -52 -92 -46 -102 C -42 -92 -42 -76 -43 -60 Z M 51 -60 C 54 -78 52 -92 46 -102 C 42 -92 42 -76 43 -60 Z' },
    boom: { f: boom() }
  };

  function tube(parent, w) {
    var g = G(parent);
    return { g: g, o: S('path', { 'class': 'tube-o', 'stroke-width': w + 2 * INK }, g), f: S('path', { 'class': 'tube-f', 'stroke-width': w }, g) };
  }
  function setTube(tb, pts) { var d = poly(pts); tb.o.setAttribute('d', d); tb.f.setAttribute('d', d); }
  // un tracciato fatto di soli M L C Q Z, scomposto una volta in comandi e coppie di numeri, poi piazzato a ogni
  // fotogramma in (x, y), specchiato se f = -1 e ruotato di r gradi attorno al punto
  function compile(d) {
    var tk = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g), out = [], i = 0;
    while (i < tk.length) {
      if (/[A-Za-z]/.test(tk[i])) out.push(tk[i++]);
      else { out.push([+tk[i], +tk[i + 1]]); i += 2; }
    }
    return out;
  }
  function place(cp, x, y, f, r) {
    var c = Math.cos(r * D2R), sn = Math.sin(r * D2R);
    return cp.map(function (q) {
      if (typeof q === 'string') return q;
      var dx = f * q[0], dy = q[1];
      return f1(x + dx * c - dy * sn) + ' ' + f1(y + dx * sn + dy * c);
    }).join(' ');
  }
  // scarpe da ginnastica: di fronte una cupola sulla suola, di profilo con la punta; l'origine è la caviglia
  var SHOE_FRONT = [compile('M -14 4 C -15 -5 -8 -9 0 -9 C 8 -9 15 -5 14 4 Z M -16 4 L 16 4 L 16 6 Q 16 8 14 8 L -14 8 Q -16 8 -16 6 Z'), compile('M -6 -3 L 6 -3 M -4 -6 L 4 -6')];
  var SHOE_SIDE = [compile('M -12 4 L -12 -4 C -12 -9 -5 -10 0 -9 L 8 -6 C 16 -5 22 -2 22 4 Z M -14 4 L 23 4 L 23 6 Q 23 8 21 8 L -12 8 Q -14 8 -14 6 Z'), compile('M 1 -7 L 5 -4 M 5 -8 L 9 -5')];
  function wrap180(d) { return ((d + 540) % 360 + 360) % 360 - 180; }
  // cinematica inversa a due segmenti: da spalla (o anca) s al punto t; restituisce [angolo, angolo relativo]
  function solve(s, t, l1, l2, bend) {
    var dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d));
    var base = Math.atan2(dx, dy) / D2R;
    var al = Math.acos(clamp01((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))) / D2R;
    var a1 = base + bend * al, e = dirv(a1), ex = s[0] + l1 * e[0], ey = s[1] + l1 * e[1];
    return [a1, Math.atan2(t[0] - ex, t[1] - ey) / D2R - a1];
  }

  function Rig(parent, o) {
    o = o || {};
    this.o = o;
    this.bl = 0.7 + Math.random() * 2.6;
    this.hl = [[0, 0], [0, 0]];
    this.st = { x: 0, y: 0, s: 1, dir: 1, hipY: -100, bob: 0, lean: 0 };
    this.cache = {};
    var r = this.root = G(parent), i;
    this.back = G(r);
    this.legs = [tube(r, 25), tube(r, 25)];
    this.shoes = [P(r, ''), P(r, '')];
    this.laces = [P(r, '', 'l thin'), P(r, '', 'l thin')];
    this.pants = P(r, PANTS);
    var t = this.torso = G(r);
    this.armsBack = G(t);
    setTube(tube(t, 22), [[0, -80], [0, -94]]);
    P(t, BODY, o.fav ? 'k fav' : 'k');
    P(t, BODY_L[o.shirt] || BODY_L.plain, o.fav ? 'l thin lt' : 'l thin');
    this.tAcc = G(t);
    var h = this.head = G(t);
    this.hairB = P(h, '', 'hair');
    this.ears = [G(h), G(h)];
    P(this.ears[0], EAR);
    P(G(this.ears[1], 'scale(-1 1)'), EAR);
    P(h, FACE);
    var ft = this.feat = G(h);
    this.eyes = [];
    for (i = 0; i < 2; i++) {
      var eg = G(ft, 'translate(' + (i ? 21 : -21) + ' -64)'), ee = G(eg);
      this.eyes.push({ g: ee, e: S('ellipse', { cx: 0, cy: 0, rx: 6.5, ry: 9.5, 'class': 'f' }, ee), s: C(ee, -2, -3.5, 2.2, 'pf'), l: P(eg, '', 'l') });
    }
    this.brows = [P(ft, BROW, 'l bold'), P(G(ft, 'scale(-1 1)'), BROW, 'l bold')];
    P(ft, NOSE, 'l');
    this.mouth = P(ft, '');
    this.teeth = P(ft, TEETH, 'l thin');
    this.tongue = P(ft, TONGUE);
    if (o.glasses) P(ft, GLASSES, 'l');
    this.hairG = G(h);
    this.hair = P(this.hairG, '', 'hair');
    this.shine = P(this.hairG, '', 'shine');
    this.setHair(o.hair || 'short');
    this.hAcc = G(h);
    this.armsFront = G(o.armLayer || t);
    this.arms = [this.mkArm(), this.mkArm()];
  }
  Rig.prototype.mkArm = function () {
    var g = G(this.armsFront);
    var tb = tube(g, 17);
    if (this.o.fav) tb.f.setAttribute('class', 'tube-f favs');
    return { g: g, tube: tb, cuff: P(g, '', this.o.fav ? 'l thin lt' : 'l thin'), slot: G(g), hand: C(g, 0, 0, 10) };
  };
  Rig.prototype.setHair = function (k) {
    if (this.cache.hair === k) return;
    this.cache.hair = k;
    var hs = HAIR[k] || HAIR.short;
    this.hair.setAttribute('d', hs.f);
    this.shine.setAttribute('d', hs.h || hs.g || '');
    this.shine.setAttribute('class', hs.g ? 'l thin glint' : 'shine');
    this.hairB.setAttribute('d', hs.b || '');
  };
  Rig.prototype.rootLocal = function (wx, wy) { var st = this.st; return [(wx - st.x) / (st.s * st.dir), (wy - st.y) / st.s]; };
  Rig.prototype.torsoLocal = function (wx, wy) {
    var st = this.st, r = this.rootLocal(wx, wy), y = r[1] - (st.hipY - st.bob), a = st.lean * D2R, c = Math.cos(a), s = Math.sin(a);
    return [r[0] * c + y * s, -r[0] * s + y * c];
  };
  Rig.prototype.toWorld = function (lx, ly) {
    var st = this.st, a = st.lean * D2R, c = Math.cos(a), s = Math.sin(a);
    var rx = lx * c - ly * s, ry = lx * s + ly * c + st.hipY - st.bob;
    return [st.x + rx * st.s * st.dir, st.y + ry * st.s];
  };
  Rig.prototype.handW = function (i) { return this.toWorld(this.hl[i][0], this.hl[i][1]); };
  Rig.prototype.headW = function () { return this.toWorld(0, -144); };
  Rig.prototype.topW = function () { return this.toWorld(0, -226); };
  Rig.prototype.set = function (p, T) {
    var o = this.o, sit = p.sit || 0, s = p.s, dir = p.dir || 1, turn = p.turn || 0, i, sd;
    var hipY = -100 + 38 * sit, th = 50 - 38 * sit, sh = 42, lean = p.lean || 0;
    var bob = (p.bob || 0) + (sit ? 0 : 0.9 * Math.sin((T || 0) * 2.3 + this.bl * 3));
    this.st = { x: p.x, y: p.y, s: s, dir: dir, hipY: hipY, bob: bob, lean: lean };
    var rootT = 'translate(' + f1(p.x) + ' ' + f1(p.y) + ') scale(' + (s * dir).toFixed(3) + ' ' + s.toFixed(3) + ')';
    this.root.setAttribute('transform', rootT);
    for (i = 0; i < 2; i++) {
      sd = i ? 1 : -1;
      // di profilo le anche si avvicinano, così camminando le gambe non si incrociano a X
      var hip = [sd * 15 * (1 - 0.75 * Math.min(1, Math.abs(turn))), hipY], lg = i ? p.lR : p.lL, fw = p.feet && p.feet[i];
      if (fw) lg = solve(hip, this.rootLocal(fw[0], fw[1]), th, sh, p.knee || 1);
      var d1 = dirv(lg[0]), d2 = dirv(lg[0] + lg[1]);
      var kn = [hip[0] + th * d1[0], hip[1] + th * d1[1]], an = [kn[0] + sh * d2[0], kn[1] + sh * d2[1]];
      // il tubo della gamba finisce dentro la scarpa, così la sua punta tonda non spunta sotto la suola
      setTube(this.legs[i], [hip, kn, [an[0] - 12 * d2[0], an[1] - 12 * d2[1]]]);
      var side = Math.abs(turn) > 0.45, sp = side ? SHOE_SIDE : SHOE_FRONT, fs = side && turn < 0 ? -1 : 1;
      var fr = side ? Math.max(-30, Math.min(30, -lg[1] * 0.6)) : 0, fx = an[0] + (side ? 0 : sd * 2);
      this.shoes[i].setAttribute('d', place(sp[0], fx, an[1], fs, fr));
      this.laces[i].setAttribute('d', place(sp[1], fx, an[1], fs, fr));
    }
    tf(this.pants, 0, hipY + 100);
    var torsoT = 'translate(0 ' + f1(hipY - bob) + ')' + (lean ? ' rotate(' + f1(lean) + ')' : '');
    this.torso.setAttribute('transform', torsoT);
    if (o.armLayer) this.armsFront.setAttribute('transform', rootT + ' ' + torsoT);

    // testa: con "turn" i lineamenti scivolano di lato e l'orecchio dietro sparisce
    tf(this.head, 0, -82, p.tilt || 0);
    tf(this.feat, turn * 9, 0);
    tf(this.hairG, turn * 2.5, 0);
    tf(this.ears[0], turn > 0 ? turn * 6 : 0, 0);
    tf(this.ears[1], turn < 0 ? turn * 6 : 0, 0);
    vis(this.ears[0], turn > -0.55);
    vis(this.ears[1], turn < 0.55);
    var ey = p.eyes || 'open';
    if ((ey === 'open' || ey === 'wide') && T !== undefined && (T + this.bl) % 3.7 < 0.12) ey = 'closed';
    var E = EYES[ey] || EYES.open, lk = p.look || [0, 0];
    for (i = 0; i < 2; i++) {
      var e = this.eyes[i];
      if (this.cache['e' + i] !== ey) {
        this.cache['e' + i] = ey;
        vis(e.g, !!E.rx);
        vis(e.l, !!E.lid);
        if (E.rx) {
          e.e.setAttribute('rx', E.rx);
          e.e.setAttribute('ry', E.ry);
          e.s.setAttribute('cy', f1(-E.ry * 0.38));
          vis(e.s, E.ry > 6);
        }
        e.l.setAttribute('d', E.lid || '');
      }
      if (E.rx) tf(e.g, lk[0] * 3, lk[1] * 2.5);
    }
    var bt = 'translate(0 ' + f1(-(p.brow || 0) * 5) + ') rotate(' + f1(p.browA || 0) + ' -21 -86)';
    this.brows[0].setAttribute('transform', bt);
    this.brows[1].setAttribute('transform', bt);
    var m = p.mouth || 'smile';
    if (m === 'talk') m = TALK[Math.floor((T || 0) * 9) % TALK.length];
    if (m === 'chew') m = Math.floor((T || 0) * 7) % 2 ? 'o' : 'flat';
    if (this.cache.m !== m) {
      this.cache.m = m;
      var md = MOUTH[m] || MOUTH.smile;
      this.mouth.setAttribute('d', md[0]);
      this.mouth.setAttribute('class', md[1]);
      vis(this.teeth, m === 'grin');
      vis(this.tongue, m === 'tongue');
    }

    // braccia: angoli (aL, aR), oppure un punto da raggiungere nel busto (tL, tR) o nella scena (wL, wR).
    // Gli angoli non saltano: inseguono la posa voluta (un decimo di secondo circa), così i cambi di posa sono
    // morbidi; dopo un salto nel tempo si allineano subito. Più chiamate nello stesso istante danno lo stesso risultato.
    if (T !== this.curT) { this.prevT = this.curT; this.prevA = this.outA; this.curT = T; this.outA = [null, null]; }
    var dt = T - this.prevT, follow = this.prevA && dt > 0 && dt < 0.25 ? 1 - Math.exp(-dt * 15) : 1;
    for (i = 0; i < 2; i++) {
      sd = i ? 1 : -1;
      var arm = this.arms[i], s0 = [sd * 34, -72], A = i ? p.aR : p.aL, w = i ? p.wR : p.wL, tg = i ? p.tR : p.tL;
      if (w) tg = this.torsoLocal(w[0], w[1]);
      if (tg) A = solve(s0, tg, 42, 40, i ? (p.bR === undefined ? 1 : p.bR) : (p.bL === undefined ? -1 : p.bL));
      else A = [A[0] + sd * 2.2 * Math.sin((T || 0) * 1.7 + this.bl + i), A[1] + sd * 3 * Math.sin((T || 0) * 1.7 + this.bl + i - 0.6)];
      var pa = this.prevA && this.prevA[i];
      if (pa && follow < 1) A = [pa[0] + wrap180(A[0] - pa[0]) * follow, pa[1] + wrap180(A[1] - pa[1]) * follow];
      this.outA[i] = A;
      var u = dirv(A[0]), v = dirv(A[0] + A[1]);
      var el = [s0[0] + 42 * u[0], s0[1] + 42 * u[1]], wr = [el[0] + 40 * v[0], el[1] + 40 * v[1]];
      setTube(arm.tube, [s0, el, wr]);
      var tee = o.shirt === 'tee', cv = tee ? u : v, cf = tee ? [s0[0] + 30 * u[0], s0[1] + 30 * u[1]] : [el[0] + 32 * v[0], el[1] + 32 * v[1]];
      arm.cuff.setAttribute('d', 'M' + f1(cf[0] - cv[1] * 10) + ' ' + f1(cf[1] + cv[0] * 10) + ' L' + f1(cf[0] + cv[1] * 10) + ' ' + f1(cf[1] - cv[0] * 10));
      var hx = wr[0] + 4 * v[0], hy = wr[1] + 4 * v[1], rot = i ? p.rR : p.rL;
      arm.hand.setAttribute('cx', f1(hx));
      arm.hand.setAttribute('cy', f1(hy));
      tf(arm.slot, hx, hy, rot === null || rot === undefined ? -(A[0] + A[1]) : rot);
      this.hl[i] = [hx, hy];
      var par = p.backArm === (i ? 'R' : 'L') ? this.armsBack : this.armsFront;
      if (arm.g.parentNode !== par) par.appendChild(arm.g);
    }
  };

  function pose(o) {
    var p = {
      x: 800, y: 700, s: 1.15, dir: 1, lean: 0, bob: 0, sit: 0, tilt: 0, turn: 0,
      aL: [-6, 8], aR: [6, -8], lL: [-2, 0], lR: [2, 0], eyes: 'open', look: [0, 0], mouth: 'smile', brow: 0, browA: 0
    };
    if (o) for (var k in o) p[k] = o[k];
    return p;
  }
  // camminata verso +x (con dir = -1 verso sinistra); k = ampiezza, 0 = fermo
  function walk(p, ph, k) {
    k = k === undefined ? 1 : k;
    var s = Math.sin(ph), c = Math.cos(ph);
    p.lL = [24 * s * k, -38 * Math.max(0, c) * k];
    p.lR = [-24 * s * k, -38 * Math.max(0, -c) * k];
    p.aL = [-6 - 24 * s * k, (6 + 22 * Math.max(0, -s)) * k];
    p.aR = [6 + 24 * s * k, (6 + 22 * Math.max(0, s)) * k];
    p.bob = (3 * Math.cos(2 * ph) + 1) * k;
    p.turn = 0.85 * k;
    return p;
  }
  // braccia in alto che "pompano" a turno, col gomito che si piega di più quando il pugno scende
  function cheer(p, T, k) {
    var a = Math.sin(T * 11), b = Math.sin(T * 11 + 2.4);
    p.aL = [lerp(p.aL[0], -146 + 9 * a, k), lerp(p.aL[1], -24 - 16 * Math.max(0, a), k)];
    p.aR = [lerp(p.aR[0], 146 + 9 * b, k), lerp(p.aR[1], 24 + 16 * Math.max(0, b), k)];
    p.wL = p.wR = p.tL = p.tR = null;
    return p;
  }
  function wave(p, T, k) {
    p.aR = [lerp(p.aR[0], 138 + 6 * Math.sin(T * 5.5), k), lerp(p.aR[1], 30 + 28 * Math.sin(T * 11), k)];
    p.wR = p.tR = null;
    return p;
  }

  var STYLES = ['short', 'spiky', 'bob', 'pony', 'bun', 'curly'];
  function folk(g, R, o) {
    var x = { hair: STYLES[Math.floor(R() * STYLES.length)], shirt: 'tee', glasses: R() < 0.25 };
    if (o) for (var k in o) x[k] = o[k];
    return new Rig(g, x);
  }
  function mkMe(g, o) {
    var x = { hair: 'none', shirt: 'plain', fav: true };
    if (o) for (var k in o) x[k] = o[k];
    return new Rig(g, x);
  }

  // pubblico visto da dietro: spalle, collo, testa e capelli; braccio alzato e mani che applaudono a richiesta
  var BACK = {
    short: 'M -49 -30 C -54 -72 -30 -90 0 -90 C 30 -90 54 -72 49 -30 C 38 -20 20 -16 0 -17 C -20 -16 -38 -20 -49 -30 Z',
    bob: 'M -54 -4 C -62 -70 -36 -92 0 -92 C 36 -92 62 -70 54 -4 C 30 4 -30 4 -54 -4 Z',
    pony: 'M -49 -34 C -54 -72 -30 -90 0 -90 C 30 -90 54 -72 49 -34 C 30 -24 -30 -24 -49 -34 Z M -9 -30 C -16 0 -8 24 0 36 C 8 24 16 0 9 -30 Z',
    bald: 'M -50 -44 C -48 -24 -30 -14 0 -14 C 30 -14 48 -24 50 -44 C 40 -34 20 -30 0 -30 C -20 -30 -40 -34 -50 -44 Z',
    curly: (function () {
      var d = '', i, pts = [];
      for (i = 0; i <= 10; i++) { var a = (170 + i * 200 / 10) * D2R; pts.push([54 * Math.cos(a), -42 + 54 * Math.sin(a)]); }
      d = 'M ' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
      for (i = 1; i < pts.length; i++) d += ' A 11 11 0 0 1 ' + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
      return d + ' C 30 -18 -30 -18 ' + f1(pts[0][0]) + ' ' + f1(pts[0][1]) + ' Z';
    })()
  };
  var BSTYLES = ['short', 'bob', 'curly', 'pony', 'bald', 'short', 'curly'];
  function backHead(parent, x, y, s, style, ph) {
    var g = G(parent), b = { g: g, x: x, y: y, s: s, ph: ph || 0 };
    P(g, rect(-15, 0, 30, 26));
    P(g, 'M -66 76 C -66 34 -42 18 0 18 C 42 18 66 34 66 76 Z');
    b.clap = G(g);
    b.ca = [tube(b.clap, 15), tube(b.clap, 15)];
    b.ch = [C(b.clap, 0, 0, 9), C(b.clap, 0, 0, 9)];
    b.cl = P(b.clap, 'M -24 -128 l -9 -9 M 24 -128 l 9 -9 M 0 -134 l 0 -12', 'l thin');
    vis(b.clap, false);
    b.arm = tube(g, 16);
    b.hand = C(g, 0, 0, 9.5);
    vis(b.arm.g, false); vis(b.hand, false);
    var h = b.h = G(g);
    P(h, 'M -44 -50 C -62 -54 -62 -28 -46 -26 Z');
    P(h, 'M 44 -50 C 62 -54 62 -28 46 -26 Z');
    C(h, 0, -42, 48);
    P(h, BACK[style] || BACK.short, 'hair');
    g.appendChild(b.arm.g);
    g.appendChild(b.hand);
    tf(g, x, y, 0, s);
    b.set = function (T, o) {
      o = o || {};
      tf(h, 0, -(o.bounce || 0), (o.nod || 0) * Math.sin(T * 5 + b.ph) * 4 + (o.tilt || 0));
      vis(b.arm.g, !!o.raise); vis(b.hand, !!o.raise);
      if (o.raise) {
        var wv = Math.sin(T * 9) * 6;
        setTube(b.arm, [[44, 34], [62, -40], [58 + wv, -112]]);
        b.hand.setAttribute('cx', f1(58 + wv)); b.hand.setAttribute('cy', -120);
      }
      vis(b.clap, !!o.clap);
      if (o.clap) {
        var d = 9 + 12 * Math.abs(Math.sin(T * 9 + b.ph));
        [-1, 1].forEach(function (sd, i) {
          setTube(b.ca[i], [[sd * 44, 36], [sd * 46, -40], [sd * d, -104]]);
          b.ch[i].setAttribute('cx', f1(sd * d)); b.ch[i].setAttribute('cy', -110);
        });
        alpha(b.cl, d < 13 ? 1 : 0);
      }
    };
    return b;
  }
  function audience(g, y, s, xs, seed) {
    var R = rng(seed || 7);
    return xs.map(function (x) { return backHead(g, x, y, s, BSTYLES[Math.floor(R() * BSTYLES.length)], R() * 6); });
  }

  // ---------------------------------------------------------------- oggetti di scena
  function ground(g, y, tufts) {
    P(g, 'M -500 ' + y + ' L 2100 ' + y, 'l');
    if (tufts) {
      var d = '';
      [-300, 60, 330, 1240, 1520, 1880].forEach(function (x) { d += 'M' + x + ' ' + y + ' l5 -11 l4 9 l5 -14 l4 16 '; });
      P(g, d, 'l thin');
    }
  }
  function wall(g, y) { P(g, 'M -500 ' + y + ' L 2100 ' + y, 'l thin'); }
  function cloud(g, x, y, s) {
    var c = G(g);
    P(c, 'M -62 14 C -80 14 -80 -10 -60 -10 C -62 -34 -30 -40 -18 -24 C -10 -50 34 -50 38 -22 C 56 -32 78 -16 66 4 C 80 8 76 14 64 14 Z');
    c.bx = x; c.by = y; c.bs = s;
    tf(c, x, y, 0, s);
    return c;
  }
  function clouds(g, seed, n) {
    var R = rng(seed), out = [];
    for (var i = 0; i < (n || 3); i++) out.push(cloud(g, 150 + R() * 1300, 100 + R() * 160, 0.5 + R() * 0.5));
    return out;
  }
  function drift(cl, T) { cl.forEach(function (c) { tf(c, c.bx + T * 14 * c.bs, c.by, 0, c.bs); }); }
  function sun(g, x, y, r) {
    var s = G(g, 'translate(' + x + ' ' + y + ')'), rays = G(s), d = '';
    for (var i = 0; i < 12; i++) {
      var a = i * 30 * D2R;
      d += 'M' + f1(Math.cos(a) * (r + 12)) + ' ' + f1(Math.sin(a) * (r + 12)) + ' L' + f1(Math.cos(a) * (r + 28)) + ' ' + f1(Math.sin(a) * (r + 28)) + ' ';
    }
    P(rays, d, 'l');
    C(s, 0, 0, r);
    return rays;
  }
  function bird(g) { return P(g, 'M -14 0 Q -7 -9 0 0 Q 7 -9 14 0', 'l thin'); }
  function windowFrame(g, x, y, w, h) {
    P(g, rect(x, y, w, h));
    P(g, 'M' + (x + w / 2) + ' ' + y + ' v' + h + ' M' + x + ' ' + (y + h / 2) + ' h' + w, 'l thin');
    P(g, 'M' + (x - 12) + ' ' + (y + h) + ' h' + (w + 24), 'l');
  }
  function clock(g, x, y, r) {
    var c = G(g, 'translate(' + x + ' ' + y + ')'), d = '';
    C(c, 0, 0, r);
    for (var i = 0; i < 12; i++) {
      var a = i * 30 * D2R, r1 = r - (i % 3 ? 7 : 12);
      d += 'M' + f1(Math.sin(a) * r1) + ' ' + f1(-Math.cos(a) * r1) + ' L' + f1(Math.sin(a) * (r - 4)) + ' ' + f1(-Math.cos(a) * (r - 4)) + ' ';
    }
    P(c, d, 'l thin');
    var hh = P(c, 'M0 0 L0 ' + -(r * 0.48), 'l bold'), mm = P(c, 'M0 0 L0 ' + -(r * 0.76), 'l');
    C(c, 0, 0, 4, 'f');
    return { set: function (m, h) { tf(mm, 0, 0, m); tf(hh, 0, 0, h); } };
  }
  // banco visto di fronte: piano in prospettiva (bordo dietro yb, davanti yf), pannello e gambe fino a terra
  function desk(g, cx, yb, yf, wb, wf, panel, floor) {
    var x0 = cx - wb / 2, x1 = cx + wb / 2, X0 = cx - wf / 2, X1 = cx + wf / 2;
    P(g, 'M' + (X0 + 14) + ' ' + (yf + panel) + ' L' + (X0 + 14) + ' ' + floor + ' M' + (X1 - 14) + ' ' + (yf + panel) + ' L' + (X1 - 14) + ' ' + floor, 'l bold');
    P(g, rect(X0, yf, wf, panel));
    P(g, 'M' + x0 + ' ' + yb + ' L' + x1 + ' ' + yb + ' L' + X1 + ' ' + yf + ' L' + X0 + ' ' + yf + ' Z');
  }
  function quadPt(q, u, v) {
    var a = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)], b = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)];
    return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)];
  }
  function quadD(q) { return poly(q) + ' Z'; }
  // riga di "scrittura a mano" su un foglio in prospettiva; set(k) la scopre, at(k) dà la punta della penna
  function scribble(g, q, v, seed) {
    var R = rng(seed), pts = [], N = 26;
    for (var i = 0; i <= N; i++) {
      var p = quadPt(q, 0.08 + 0.84 * i / N, v);
      pts.push([p[0], p[1] + Math.sin(i * 1.9 + R() * 2) * 1.6 - (i % 4 === 0 ? 1.4 : 0)]);
    }
    var e = S('path', { d: poly(pts), 'class': 'l thin', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g);
    return {
      set: function (k) { vis(e, k > 0.01); e.setAttribute('stroke-dashoffset', (1 - clamp01(k)).toFixed(3)); },
      at: function (k) { var x = clamp01(k) * N, i = Math.min(N - 1, Math.floor(x)), f = x - i; return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; }
    };
  }
  function bulb(g) {
    var b = G(g);
    P(b, 'M0 -66 L0 -80 M46 -50 L56 -60 M-46 -50 L-56 -60 M64 -16 L78 -16 M-64 -16 L-78 -16', 'l acc');
    P(b, 'M -13 10 C -15 0 -30 -8 -30 -28 C -30 -46 -16 -56 0 -56 C 16 -56 30 -46 30 -28 C 30 -8 15 0 13 10 Z');
    P(b, 'M -11 16 L 11 16 M -9 22 L 9 22 M -6 -2 L -4 -22 L 0 -12 L 4 -22 L 6 -2', 'l thin');
    tf(b, 0, 0, 0, 0);
    return b;
  }
  // il braccio i (0 sinistro, 1 destro) indica il punto (tx, ty) della scena, quasi teso;
  // jab (da 0 a 1) lo distende del tutto, per il colpetto quando compare qualcosa di nuovo
  function pointAt(rig, p, T, i, tx, ty, jab) {
    rig.set(p, T);
    var q = rig.torsoLocal(tx, ty), sx = i ? 34 : -34, a = Math.atan2(q[0] - sx, q[1] + 72) / D2R;
    var b = (i ? -1 : 1) * 16 * (1 - (jab || 0));
    if (i) p.aR = [a - b / 2, b]; else p.aL = [a - b / 2, b];
    rig.set(p, T);
  }
  var DROP = 'M 0 -11 C 4 -4 8 1 8 5 C 8 10 4 12 0 12 C -4 12 -8 10 -8 5 C -8 1 -4 -4 0 -11 Z';
  var HEART = 'M 0 10 C -18 -2 -14 -18 0 -8 C 14 -18 18 -2 0 10 Z';
  function bubble(g, txt) {
    var b = G(g);
    P(b, 'M -26 -32 C -26 -52 26 -52 26 -32 C 26 -14 8 -14 2 -14 L -10 0 L -6 -14 C -18 -15 -26 -20 -26 -32 Z');
    b.t = TX(b, 0, -22, txt, 26, 'b');
    tf(b, 0, 0, 0, 0);
    return b;
  }
  function rays(g, x, y) {
    var r = G(g, 'translate(' + x + ' ' + y + ')'), d = '';
    for (var i = 0; i < 30; i++) {
      var a = i * 12 * D2R;
      d += 'M' + f1(Math.cos(a) * 170) + ' ' + f1(Math.sin(a) * 170) + ' L' + f1(Math.cos(a) * 1100) + ' ' + f1(Math.sin(a) * 1100) + ' ';
    }
    var inner = P(r, d, 'l thin m');
    return { g: r, x: x, y: y, set: function (T) { tf(r, x, y, T * 6); } };
  }
  function medal(parent, kind, label) {
    var m = G(parent);
    P(m, 'M -21 -86 L -11 -86 L 3 -44 L -7 -44 Z');
    P(m, 'M 21 -86 L 11 -86 L -3 -44 L 7 -44 Z');
    var d = G(m, 'translate(0 -30)');
    C(d, 0, 0, 15, 'k ' + (kind === 'plain' ? '' : kind || 'gold'));
    C(d, 0, 0, 10.5, 'l thin');
    if (label) TX(d, 0, 4, label, label.length > 2 ? 8 : 10, 'b');
    return m;
  }
  function rosette(parent, label) {
    var r = G(parent), d = '';
    P(r, 'M -8 8 L -16 42 L -8 36 L -2 44 L 0 10 Z M 8 8 L 16 42 L 8 36 L 2 44 L 0 10 Z');
    for (var i = 0; i < 24; i++) {
      var a = i * 15 * D2R, rr = i % 2 ? 23 : 18;
      d += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr) + ' ';
    }
    P(r, d + 'Z', 'k gold');
    C(r, 0, 0, 13.5);
    TX(r, 0, 4, label, 11, 'b');
    return r;
  }
  function trophy(g) {
    var t = G(g);
    P(t, 'M -30 -112 C -54 -112 -54 -78 -22 -76 M 30 -112 C 54 -112 54 -78 22 -76', 'l bold');
    P(t, 'M -34 -120 L 34 -120 C 34 -84 18 -66 0 -66 C -18 -66 -34 -84 -34 -120 Z', 'k gold');
    P(t, 'M -6 -66 L -8 -40 L 8 -40 L 6 -66 Z');
    P(t, rect(-26, -40, 52, 16));
    P(G(t, 'translate(0 -96)'), starD(11, 5, 5), 'k');
    return t;
  }
  // coriandoli con le forme della timeline: f(t) li muove, t = secondi dallo scoppio
  var BITS = [circD(0, 0, 6), 'M0 -8 L8 0 L0 8 L-8 0 Z', 'M0 -8 L8 6 L-8 6 Z', starD(9, 4, 5), 'M-6 -6 h12 v12 h-12 Z'];
  function confetti(g, x, y, n, seed, rain) {
    var R = rng(seed), bits = [];
    for (var i = 0; i < n; i++) {
      bits.push({
        e: P(g, BITS[i % 5], i % 3 ? 'k' : 'k acc'),
        x: rain ? x + (R() - 0.5) * 1500 : x, y: rain ? y - R() * 300 : y,
        vx: rain ? (R() - 0.5) * 60 : (R() - 0.5) * 1100, vy: rain ? 120 + R() * 140 : -350 - R() * 650,
        r: R() * 360, vr: (R() - 0.5) * 700
      });
    }
    bits.forEach(function (b) { vis(b.e, false); });
    return function (t) {
      bits.forEach(function (b) {
        if (t <= 0 || t > 3.2) { vis(b.e, false); return; }
        vis(b.e, true);
        var px = b.x + b.vx * t / (1 + 1.2 * t), py = b.y + b.vy * t + (rain ? 40 : 520) * t * t;
        tf(b.e, px, py, b.r + b.vr * t, 1);
        alpha(b.e, 1 - seg(t, 2.2, 3.1));
      });
    };
  }
  function tree(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')');
    P(t, 'M -12 0 C -10 -40 -12 -80 -8 -110 L 8 -110 C 12 -80 10 -40 12 0 Z');
    P(t, 'M -70 -120 C -100 -130 -96 -186 -60 -186 C -60 -236 10 -250 26 -212 C 60 -230 102 -196 84 -160 C 110 -140 92 -100 60 -110 C 40 -86 -40 -90 -70 -120 Z');
    P(t, 'M -30 -150 q 10 -8 20 0 M 20 -170 q 10 -8 20 0', 'l thin');
    return t;
  }
  function palm(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '';
    P(t, 'M -8 0 C -2 -70 -10 -130 4 -190 L 18 -188 C 6 -130 14 -70 9 0 Z');
    for (var i = 1; i < 7; i++) d += 'M ' + f1(-6 + i * 1.5) + ' ' + (-i * 27) + ' l 14 -3 ';
    P(t, d, 'l thin');
    [[-150, 1], [-110, 1.1], [-60, 1], [-20, 0.9], [20, 1]].forEach(function (f) {
      P(G(t, 'translate(11 -190) rotate(' + f[0] + ') scale(' + f[1] + ')'), 'M 0 0 C 30 -20 80 -16 104 10 C 76 -4 36 -6 0 0 Z');
    });
    return t;
  }
  function signpost(g, x, y, name) {
    var t = G(g, 'translate(' + x + ' ' + y + ')'), size = name.length > 12 ? 19 : 26, w = name.length * size * 0.62 + 44;
    P(t, rect(-6, -186, 12, 186));
    P(t, 'M ' + f1(-w / 2) + ' -206 L ' + f1(w / 2 - 20) + ' -206 L ' + f1(w / 2) + ' -181 L ' + f1(w / 2 - 20) + ' -156 L ' + f1(-w / 2) + ' -156 Z');
    TX(t, -8, -173, name.toUpperCase(), size, 'b');
    return t;
  }
  function suitcase(g) {
    P(g, 'M -8 6 L -8 -2 L 8 -2 L 8 6', 'l');
    P(g, rrect(-30, 6, 60, 50, 6));
    P(g, 'M -16 6 v 50 M 16 6 v 50', 'l thin');
  }
  function mug(g, x, y) {
    var m = G(g, 'translate(' + x + ' ' + y + ')');
    P(m, 'M 16 -26 C 30 -26 30 -8 16 -8', 'l');
    P(m, 'M -16 -32 L 16 -32 L 14 0 L -14 0 Z');
    var st = P(m, '', 'l thin m');
    return function (T) {
      var d = '';
      for (var k = 0; k < 2; k++) {
        var x0 = -6 + k * 12, ph = T * 3 + k;
        d += 'M ' + x0 + ' -38 q ' + f1(6 * Math.sin(ph)) + ' -8 0 -16 q ' + f1(-6 * Math.sin(ph)) + ' -8 0 -16 ';
      }
      st.setAttribute('d', d);
    };
  }
  // corona d'alloro: foglie lungo la metà davanti di un'ellisse attorno alla testa, alternate verso l'alto e il basso
  function laurel(parent) {
    var g = G(parent), leaves = [];
    for (var i = 0; i < 14; i++) {
      var th = (2 + i * 176 / 13) * D2R, x = -60 * Math.cos(th), y = -108 + 15 * Math.sin(th);
      var ang = Math.atan2(15 * Math.cos(th), 60 * Math.sin(th)) / D2R;
      var lf = G(g), lg = G(lf, 'rotate(' + f1(ang + (i % 2 ? -42 : 42) + (i < 7 ? 180 : 0)) + ')');
      P(lg, 'M 0 0 C 9 -10 26 -10 34 0 C 26 10 9 10 0 0 Z', 'k acc');
      P(lg, 'M 4 0 L 28 0', 'l thin acc');
      tf(lf, x, y, 0, 0);
      lf.x = x; lf.y = y;
      leaves.push(lf);
    }
    return leaves;
  }
  function labCoat(parent) {
    var g = G(parent);
    P(g, 'M -40 -78 L -44 36 L 44 36 L 40 -78 C 33 -86 24 -88 16 -87 L 0 -42 L -16 -87 C -24 -88 -33 -86 -40 -78 Z');
    P(g, 'M -16 -87 L -8 -52 M 16 -87 L 8 -52 M 0 -42 L 0 36 M 18 -20 h 16 v 16 h -16', 'l thin');
    C(g, -6, -20, 2, 'f'); C(g, -6, 0, 2, 'f');
    return g;
  }
  function goggles(parent) {
    var g = G(parent), lens = 'M -36 -86 L -6 -86 Q -1 -86 -1 -80 L -1 -53 Q -1 -47 -7 -47 L -34 -47 Q -40 -47 -40 -53 L -40 -80 Q -40 -86 -36 -86 Z';
    P(g, 'M -40 -67 L -53 -70 M 40 -67 L 53 -70', 'l bold');
    P(g, lens, 'l');
    P(G(g, 'scale(-1 1)'), lens, 'l');
    P(g, 'M -1 -68 L 1 -68', 'l');
    return g;
  }

  // brillantini dorati a quattro punte che si accendono e si spengono attorno a un punto
  function sparkles(g, n, seed) {
    var R = rng(seed || 5), sp = [];
    for (var i = 0; i < n; i++) {
      sp.push({ e: P(g, 'M 0 -13 Q 1.6 -1.6 13 0 Q 1.6 1.6 0 13 Q -1.6 1.6 -13 0 Q -1.6 -1.6 0 -13 Z', 'spk'), a: R() * 6.28, r: 0.7 + R() * 0.55, ph: R() * 6.28, v: 0.7 + R() * 0.9 });
    }
    sp.forEach(function (q) { vis(q.e, false); });
    return function (T, x, y, k, rx, ry) {
      sp.forEach(function (q) {
        vis(q.e, k > 0.01);
        if (k <= 0.01) return;
        var tw = Math.max(0, Math.sin(T * 5 * q.v + q.ph)), an = q.a + T * 0.35;
        tf(q.e, x + Math.cos(an) * (rx || 160) * q.r, y + Math.sin(an) * (ry || 130) * q.r, T * 30, k * (0.25 + 0.95 * tw));
      });
    };
  }
  // matrice disegnata come griglia r x c di quadratini, centrata nell'origine; il tratto non si deforma se la si schiaccia
  function gridMat(g, r, c, cell) {
    var m = G(g), w = c * cell, h = r * cell, d = '', i;
    for (i = 1; i < r; i++) d += 'M ' + f1(-w / 2) + ' ' + f1(-h / 2 + i * cell) + ' h ' + w + ' ';
    for (i = 1; i < c; i++) d += 'M ' + f1(-w / 2 + i * cell) + ' ' + f1(-h / 2) + ' v ' + h + ' ';
    S('path', { d: rect(-w / 2, -h / 2, w, h), 'class': 'k', 'vector-effect': 'non-scaling-stroke' }, m);
    S('path', { d: d, 'class': 'l thin m', 'vector-effect': 'non-scaling-stroke' }, m);
    m.w = w; m.h = h;
    return m;
  }
  function schoolHouse(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '';
    P(t, 'M 0 -262 L 0 -322', 'l');
    P(t, 'M 0 -322 L 42 -310 L 0 -298 Z', 'k acc');
    P(t, rect(-210, -180, 420, 180));
    P(t, 'M -232 -180 L 0 -262 L 232 -180 Z');
    C(t, 0, -212, 22);
    P(t, 'M 0 -212 L 0 -226 M 0 -212 L 10 -212', 'l thin');
    [-150, -90, 90, 150].forEach(function (wx) { d += rect(wx - 20, -152, 40, 46) + ' ' + rect(wx - 20, -84, 40, 46) + ' '; });
    P(t, d, 'l thin');
    P(t, 'M -26 0 L -26 -64 A 26 26 0 0 1 26 -64 L 26 0', 'l');
    return t;
  }
  function lantern(g, x, y, s) {
    var l = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')');
    P(l, 'M 0 -60 L 0 -30', 'l thin');
    P(l, 'M -12 -24 C -40 -16 -40 24 -12 30 L 12 30 C 40 24 40 -16 12 -24 Z', 'k red');
    P(l, 'M 0 -24 L 0 30 M -14 -20 C -24 -6 -24 16 -14 28 M 14 -20 C 24 -6 24 16 14 28', 'l thin');
    P(l, 'M -14 -30 h 28 v 6 h -28 Z M -14 30 h 28 v 6 h -28 Z');
    P(l, 'M 0 36 L 0 56 M -4 56 L 4 56', 'l thin');
    return l;
  }
  // festoni: bandierine triangolari lungo una corda che pende di sag; le classi danno i colori a turno
  function bunting(g, x0, x1, y, sag, n, classes) {
    P(g, 'M ' + x0 + ' ' + y + ' Q ' + ((x0 + x1) / 2) + ' ' + (y + 2 * sag) + ' ' + x1 + ' ' + y, 'l thin');
    for (var k = 0; k < n; k++) {
      var u = (k + 0.5) / n, x = lerp(x0, x1, u), yy = y + 4 * sag * u * (1 - u);
      P(g, 'M ' + f1(x - 18) + ' ' + f1(yy) + ' L ' + f1(x + 18) + ' ' + f1(yy) + ' L ' + f1(x) + ' ' + f1(yy + 34) + ' Z', 'k ' + classes[k % classes.length]);
    }
  }
  function owl(g) {
    var o = G(g), wl = G(o), wr = G(o);
    P(wl, 'M -26 -20 C -70 -50 -84 -10 -60 6 C -50 -6 -36 -4 -26 0 Z');
    P(wr, 'M 26 -20 C 70 -50 84 -10 60 6 C 50 -6 36 -4 26 0 Z');
    P(o, 'M -8 32 L -10 42 M 8 32 L 10 42', 'l');
    P(o, 'M -30 -40 L -34 -66 L -16 -50 C -6 -54 6 -54 16 -50 L 34 -66 L 30 -40 C 40 -10 36 26 0 32 C -36 26 -40 -10 -30 -40 Z');
    C(o, -12, -32, 10); C(o, 12, -32, 10);
    C(o, -12, -32, 4.5, 'f'); C(o, 12, -32, 4.5, 'f');
    P(o, 'M -4 -20 L 4 -20 L 0 -12 Z', 'k gold');
    P(o, 'M -12 0 q 4 4 8 0 M 4 0 q 4 4 8 0 M -8 10 q 4 4 8 0', 'l thin');
    o.wl = wl; o.wr = wr;
    return o;
  }
  function paperPlane(g) {
    var pp = G(g);
    P(pp, 'M -50 -6 L 56 0 L -50 18 L -30 4 Z');
    P(pp, 'M -50 -6 L 56 0 L -40 -22 Z');
    P(pp, 'M -30 4 L 56 0', 'l thin');
    return pp;
  }
  function cameraProp(g) {
    var c = G(g);
    P(c, rect(-44, -32, 12, 8));
    P(c, rrect(-58, -26, 64, 42, 7));
    C(c, -26, -5, 13);
    C(c, -26, -5, 6, 'l thin');
    return c;
  }

  // ---------------------------------------------------------------- monumenti e luoghi
  function pisaTower(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ') rotate(4)'), d = '', i, k, cx;
    P(t, 'M -56 0 L -56 -300 L 56 -300 L 56 0 Z');
    for (i = 0; i <= 6; i++) d += 'M -62 ' + (-60 - i * 40) + ' L 62 ' + (-60 - i * 40) + ' ';
    P(t, d, 'l');
    d = '';
    for (i = 0; i < 6; i++) {
      var yb = -64 - i * 40, yt = yb - 30;
      for (k = -2; k <= 2; k++) { cx = k * 21; d += 'M' + (cx - 6) + ' ' + yb + ' L' + (cx - 6) + ' ' + (yt + 6) + ' A 6 6 0 0 1 ' + (cx + 6) + ' ' + (yt + 6) + ' L' + (cx + 6) + ' ' + yb + ' '; }
    }
    for (k = -1; k <= 1; k++) { cx = k * 34; d += 'M' + (cx - 11) + ' 0 L' + (cx - 11) + ' -36 A 11 11 0 0 1 ' + (cx + 11) + ' -36 L' + (cx + 11) + ' 0 '; }
    P(t, d, 'l thin');
    P(t, 'M -40 -300 L -40 -336 L 40 -336 L 40 -300 Z');
    d = 'M -46 -336 L 46 -336 ';
    for (k = -1; k <= 1; k++) { cx = k * 22; d += 'M' + (cx - 6) + ' -304 L' + (cx - 6) + ' -320 A 6 6 0 0 1 ' + (cx + 6) + ' -320 L' + (cx + 6) + ' -304 '; }
    P(t, d, 'l thin');
    return t;
  }
  function carovana(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '', i, k;
    P(t, 'M -330 0 L -330 -240 L 330 -240 L 330 0 Z');
    P(t, 'M -344 -240 L 344 -240 L 336 -254 L -336 -254 Z');
    for (i = 0; i < 3; i++) {
      for (k = -4; k <= 4; k++) {
        if (i === 2 && Math.abs(k) < 1) continue;
        var wx = k * 70, wy = -212 + i * 62;
        d += 'M' + (wx - 12) + ' ' + (wy + 36) + ' L' + (wx - 12) + ' ' + (wy + 10) + ' A 12 12 0 0 1 ' + (wx + 12) + ' ' + (wy + 10) + ' L' + (wx + 12) + ' ' + (wy + 36) + ' Z ';
      }
    }
    P(t, d, 'l thin');
    d = '';
    for (i = 0; i < 3; i++) for (k = -15; k <= 15; k++) d += 'M' + (k * 21) + ' ' + (-226 + i * 62) + ' l4 -4 l4 4 l-4 4 Z ';
    P(t, d, 'l thin m');
    P(t, 'M -22 -44 L -22 -86 A 22 22 0 0 1 22 -86 L 22 -44 Z');
    P(t, 'M -180 0 L -44 -44 L 44 -44 L 180 0', 'l');
    P(t, 'M -150 0 L -40 -36 M 150 0 L 40 -36', 'l thin');
    C(t, 0, -230, 13);
    return t;
  }
  function radcam(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '', k;
    P(t, rect(-160, -90, 320, 90));
    for (k = -3; k <= 3; k++) { var ax = k * 44; d += 'M' + (ax - 12) + ' 0 L' + (ax - 12) + ' -44 A 12 12 0 0 1 ' + (ax + 12) + ' -44 L' + (ax + 12) + ' 0 '; }
    P(t, d + 'M -160 -66 h 320', 'l thin');
    P(t, rect(-138, -200, 276, 110));
    d = '';
    for (k = -3; k <= 3; k++) { var cx = k * 42; d += 'M' + (cx - 5) + ' -196 L' + (cx - 5) + ' -94 M' + (cx + 5) + ' -196 L' + (cx + 5) + ' -94 '; }
    for (k = -3; k < 3; k++) { var wx = k * 42 + 21; d += rect(wx - 8, -170, 16, 30) + ' '; }
    P(t, d, 'l thin');
    P(t, 'M -148 -200 L 148 -200 L 148 -214 L -148 -214 Z');
    P(t, 'M -112 -214 C -112 -322 112 -322 112 -214 Z');
    P(t, 'M -62 -214 C -62 -280 -22 -300 0 -302 M 62 -214 C 62 -280 22 -300 0 -302 M 0 -214 L 0 -302', 'l thin');
    P(t, rect(-16, -336, 32, 36));
    P(t, 'M -20 -336 C -20 -354 20 -354 20 -336 Z');
    P(t, 'M 0 -349 L 0 -374', 'l');
    return t;
  }
  function spires(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')');
    P(t, 'M -700 0 L -700 -90 L -640 -90 L -640 -120 L -620 -120 L -620 -110 L -600 -110 L -600 -120 L -580 -120 L -580 -90 L -520 -90 L -520 -150 L -500 -260 L -480 -150 L -480 -90 L -400 -90 ' +
      'L -400 -130 C -400 -200 -280 -200 -280 -130 L -280 -90 L -200 -90 L -200 -180 L -150 -180 L -150 -210 L -130 -210 L -130 -180 L -120 -180 L -120 -90 L -40 -90 L -40 -160 L -20 -300 L 0 -160 L 0 -90 ' +
      'L 120 -90 L 120 -140 L 150 -140 L 150 -170 L 190 -200 L 230 -170 L 230 -140 L 260 -140 L 260 -90 L 340 -90 L 340 -170 L 360 -240 L 380 -170 L 380 -90 L 460 -90 L 460 -120 C 460 -170 560 -170 560 -120 L 560 -90 L 700 -90 L 700 0 Z');
    P(t, 'M -520 -150 h 40 M -40 -160 h 40 M 340 -170 h 40 M -340 -190 L -340 -214', 'l thin');
    return t;
  }
  function alps(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '';
    var pk = [[-700, -40], [-560, -190], [-470, -110], [-340, -290], [-200, -100], [-90, -220], [40, -70], [170, -270], [320, -100], [430, -200], [560, -80], [700, -40]];
    P(t, poly(pk) + ' L 700 0 L -700 0 Z');
    pk.forEach(function (p, i) { if (i && i < pk.length - 1 && p[1] < -150) d += 'M ' + (p[0] - 28) + ' ' + (p[1] + 38) + ' l 9 -7 l 10 9 l 9 -9 l 10 9 l 9 -6 '; });
    P(t, d, 'l thin');
    return t;
  }
  function waves(g, y0, rows, seed) {
    var R = rng(seed || 3), d = '';
    for (var i = 0; i < rows; i++) {
      var yy = y0 + i * 26;
      for (var x = -480 + R() * 60; x < 2080; x += 140 + R() * 120) d += 'M ' + f1(x) + ' ' + yy + ' q 14 -9 28 0 q 14 -9 28 0 ';
    }
    var w = P(g, d, 'l thin');
    return function (T) { tf(w, Math.sin(T * 1.3) * 10, 0); };
  }
  function sailboat(g, x, y, s) {
    var b = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')');
    P(b, 'M -60 0 L 60 0 L 44 22 L -44 22 Z');
    P(b, 'M 0 0 L 0 -130 L 52 -10 Z');
    P(b, 'M -4 -110 L -50 -10 L -4 -10 Z');
    return b;
  }
  function skyline(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '', R = rng(11);
    [[-520, 90, 150], [-420, 70, 230], [-340, 110, 180], [-220, 80, 260], [-130, 100, 200], [180, 90, 240], [280, 120, 170], [410, 80, 220], [500, 100, 140]].forEach(function (b) {
      P(t, rect(b[0], -b[2], b[1], b[2]));
      for (var yy = -b[2] + 18; yy < -14; yy += 26) for (var xx = b[0] + 14; xx < b[0] + b[1] - 14; xx += 22) if (R() < 0.7) d += rect(xx, yy, 8, 12) + ' ';
    });
    P(t, d, 'l thin');
    P(t, 'M -40 0 L -40 -300 L -26 -350 L -14 -420 L 14 -420 L 26 -350 L 40 -300 L 40 0 Z');
    P(t, 'M -14 0 L -14 -140 Q 0 -162 14 -140 L 14 0 M 0 -420 L 0 -470 M -40 -300 h 80 M -26 -350 h 52', 'l thin');
    palm(t, 620, 0, 1.2);
    return t;
  }
  function pontecoperto(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '', k;
    P(t, 'M -560 -60 L 560 -60 L 560 -40 L -560 -40 Z');
    for (k = -2; k <= 2; k++) { var ax = k * 210; d += 'M ' + (ax - 90) + ' 30 L ' + (ax - 90) + ' -10 A 90 50 0 0 1 ' + (ax + 90) + ' -10 L ' + (ax + 90) + ' 30 '; }
    P(t, d, 'l');
    d = '';
    for (k = -13; k <= 13; k++) d += 'M ' + (k * 40) + ' -60 L ' + (k * 40) + ' -130 ';
    P(t, d, 'l thin');
    P(t, 'M -580 -126 L 580 -126 L 560 -160 L -560 -160 Z');
    P(t, 'M -40 -60 L -40 -190 L 0 -230 L 40 -190 L 40 -60 Z');
    P(t, 'M 0 -230 L 0 -256 M -9 -246 h 18 M -14 -170 L -14 -130 A 14 14 0 0 1 14 -130 L 14 -170', 'l thin');
    return t;
  }
  function diamondRing(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '', k;
    P(t, 'M -400 0 L -400 -60 C -400 -150 400 -150 400 -60 L 400 0 Z');
    P(t, 'M -260 -64 C -260 -110 260 -110 260 -64 C 260 -40 -260 -40 -260 -64 Z');
    for (k = 0; k < 16; k++) {
      var a = k / 16 * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      d += 'M ' + f1(-c * 270) + ' ' + f1(-64 - sn * 44) + ' L ' + f1(-c * 390) + ' ' + f1(-60 - sn * 78) + ' ';
    }
    P(t, d, 'l thin');
    P(t, 'M -400 -30 h 800', 'l thin');
    return t;
  }
  function seaHills(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '';
    P(t, 'M -700 -60 C -560 -230 -380 -260 -240 -140 C -160 -80 -60 -80 0 -60 Z');
    [[-470, -214], [-410, -226], [-350, -210]].forEach(function (h) { d += rect(h[0], h[1], 26, 22) + ' M ' + (h[0] - 4) + ' ' + h[1] + ' l 17 -14 l 17 14 '; });
    P(t, d, 'l thin');
    return t;
  }
  function rolex(g, x, y, s) {
    var t = G(g, 'translate(' + x + ' ' + y + ') scale(' + s + ')'), d = '';
    P(t, 'M -540 0 L -540 -60 C -440 -60 -420 -130 -300 -130 C -190 -130 -170 -46 -60 -46 C 50 -46 70 -120 180 -120 C 290 -120 310 -66 420 -66 L 540 -66 L 540 0 Z');
    for (var k = -26; k <= 26; k++) d += 'M ' + (k * 20) + ' -6 L ' + (k * 20) + ' -30 ';
    P(t, d, 'l thin m');
    P(t, 'M -330 -118 C -330 -126 -270 -126 -270 -118 C -270 -110 -330 -110 -330 -118 Z M 150 -110 C 150 -118 210 -118 210 -110 C 210 -102 150 -102 150 -110 Z', 'l thin');
    return t;
  }
  function riviera(g) {
    P(g, 'M -500 560 L 2100 560', 'l');
    var sw = waves(g, 590, 4, 5);
    var sn = sun(g, 1180, 420, 46);
    sailboat(g, 520, 600, 0.6);
    palm(g, 1420, 700, 1.25);
    var v = G(g, 'translate(260 560)');
    P(v, rect(-90, -110, 180, 110));
    P(v, 'M -104 -110 L 0 -160 L 104 -110 Z');
    P(v, 'M -50 -30 L -50 -70 A 14 14 0 0 1 -22 -70 L -22 -30 Z M 22 -30 L 22 -70 A 14 14 0 0 1 50 -70 L 50 -30 Z', 'l thin');
    return function (T) { sw(T); tf(sn, 1180, 420, T * 8); };
  }
  // sfondo di arrivo per ogni luogo; restituisce una funzione da chiamare a ogni fotogramma (o niente)
  var LANDMARK = {
    tower: function (g) { pisaTower(g, 430, 700, 1.05); tree(g, 180, 700, 0.8); },
    radcam: function (g) { radcam(g, 470, 700, 1.05); tree(g, 150, 700, 0.85); },
    alps: function (g) { alps(g, 800, 600, 1); var w = waves(g, 625, 3, 9); sailboat(g, 360, 640, 0.45); return w; },
    sea: function (g) { seaHills(g, 800, 600, 1); P(g, 'M -500 560 L 2100 560', 'l'); var w = waves(g, 590, 4, 4); sun(g, 1130, 200, 44); return w; },
    riviera: riviera,
    bridge: function (g) { pontecoperto(g, 700, 600, 0.8); return waves(g, 640, 2, 6); },
    skyline: function (g) { skyline(g, 560, 700, 0.95); },
    ring: function (g) { diamondRing(g, 600, 700, 0.85); tree(g, 1060, 700, 0.7); }
  };
  var PLACES = {
    pisa: [43.7167, 10.4036, 'Pisa', 'tower'], oxford: [51.752, -1.2577, 'Oxford', 'radcam'], lausanne: [46.5191, 6.5668, 'Lausanne', 'alps'],
    cetraro: [39.5167, 15.9333, 'Cetraro', 'sea'], pavia: [45.1847, 9.1582, 'Pavia', 'bridge'], kaohsiung: [22.6273, 120.3014, 'Kaohsiung', 'skyline'],
    didcot: [51.5745, -1.3126, 'Didcot', 'ring'], capferrat: [43.6886, 7.3306, 'Saint-Jean-Cap-Ferrat', 'riviera']
  };
  function km(a, b) {
    var la1 = a[0] * D2R, la2 = b[0] * D2R, dl = (b[1] - a[1]) * D2R;
    return 6371 * Math.acos(Math.min(1, Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl)));
  }

  // mezzi di trasporto
  function miniFace(g, x, y) {
    var f = G(g, 'translate(' + x + ' ' + y + ')');
    C(f, 0, 0, 15, 'k thin');
    C(f, 0, 3, 9.5, 'k thin');
    P(f, 'M -10.5 3 C -11 -10 11 -10 10.5 3 C 8 -3 2 -3 -1 -7 C -4 -2 -8 -2 -10.5 3 Z', 'f');
    S('ellipse', { cx: -3.6, cy: 3.5, rx: 1.4, ry: 2.1, 'class': 'f' }, f);
    S('ellipse', { cx: 3.6, cy: 3.5, rx: 1.4, ry: 2.1, 'class': 'f' }, f);
    P(f, 'M -3.5 7.5 Q 0 10.5 3.5 7.5', 'l thin');
    return f;
  }
  function plane(g) {
    var p = G(g);
    P(p, 'M -150 -40 L -178 -102 L -146 -102 L -104 -42');
    P(p, 'M -186 -6 C -186 -34 -164 -42 -130 -42 L 132 -42 C 172 -42 196 -22 196 -2 C 196 10 186 16 166 16 L -150 16 C -172 16 -186 10 -186 -6 Z');
    P(p, 'M 150 -32 C 164 -32 176 -24 182 -14 L 152 -14 Z', 'k thin');
    for (var x = -110; x <= 110; x += 30) if (x !== 40) C(p, x, -18, 7, 'k thin');
    miniFace(p, 40, -16);
    P(p, 'M -150 -6 L -196 18 L -170 18 L -136 4');
    P(p, 'M -20 6 L -90 74 L -50 74 L 50 6');
    P(p, 'M -60 40 L -40 40', 'l thin');
    return p;
  }
  function train(g) {
    var t = G(g), k, wheels = [];
    [-540, -170].forEach(function (x0, j) {
      P(t, rrect(x0, -150, 360, 128, 14));
      for (k = 0; k < 5; k++) {
        if (j === 1 && k === 2) continue;
        P(t, rrect(x0 + 22 + k * 68, -128, 48, 40, 8), 'k thin');
      }
      P(t, 'M ' + x0 + ' -66 h 360', 'l thin acc');
      [60, 110, 250, 300].forEach(function (w) { wheels.push(C(t, x0 + w, -14, 15)); });
    });
    miniFace(t, -170 + 22 + 2 * 68 + 24, -108);
    P(t, 'M 200 -22 L 200 -150 L 380 -150 C 450 -150 500 -110 520 -60 L 528 -34 C 530 -26 526 -22 518 -22 Z');
    P(t, 'M 400 -136 C 440 -134 468 -112 480 -86 L 400 -86 Z', 'k thin');
    P(t, 'M 200 -66 h 316', 'l thin acc');
    [260, 310, 440].forEach(function (w) { wheels.push(C(t, w, -14, 15)); });
    P(t, 'M 190 -44 h 10 M -180 -44 h 10', 'l bold');
    return t;
  }

  // ---------------------------------------------------------------- testi delle tappe
  function talkParts(it) {
    var s = it.text, o = s.indexOf('“'), c = s.indexOf('”');
    var title = o >= 0 && c > o ? s.slice(o + 1, c) : s;
    var venue = c > o ? s.slice(c + 1).replace(/^[,\s]+/, '') : '';
    return { title: title, venue: venue.split(',')[0], poster: s.indexOf('Poster') === 0 };
  }
  function paperParts(it) {
    var s = it.text, w = s.indexOf(', with '), title = w > 0 ? s.slice(0, w) : s, rest = w > 0 ? s.slice(w + 7) : '';
    rest = rest.replace(/\s*\(.*\)\s*$/, '').replace(/,\s*to appear.*$/, '');
    var names = ['F. Hrobat'].concat(rest ? rest.split(/,\s*|\s+and\s+/) : []).filter(function (x) { return x; });
    names.sort(function (a, b) { var x = a.split(' ').pop(), y = b.split(' ').pop(); return x < y ? -1 : x > y ? 1 : 0; });
    return { title: title, authors: names.join(', '), venue: /SIMAX/.test(s) ? 'SIMAX' : 'arXiv', soon: /to appear/.test(s) };
  }
  function eqsOf(it) {
    var s = it.text;
    if (/Lyapunov/.test(s)) return ['AX + XA = −BBᵀ', 'span{B, AB, A²B}', 'X ≈ ZDZᵀ', 'compress!'];
    if (/Friendship/.test(s)) return ['⟨d²⟩/⟨d⟩ ≥ ⟨d⟩', 'f(A)·1', 'friends > you?', 'A = Aᵀ'];
    if (/Perturbation/.test(s)) return ['A + εE', 'QΛQᵀ', '[A, Ω]', 'λ(ε) = ?'];
    if (/eigenvalue/.test(s)) return ['A(t)x = λ(t)x', 'snapshots', 'row sampling', 'λ₁ ≤ λ₂ ≤ …'];
    return ['Ax = λx', 'Σ', '∫', '‖x‖'];
  }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function crew(g, xs, it, me, o) {
    var R = rng(it.seed + 101), off = Math.floor(R() * STYLES.length), j = 0;
    return xs.map(function (x, k) {
      var oo = { hair: STYLES[(off + j++) % STYLES.length] };
      if (o) for (var key in o) oo[key] = o[key];
      var r = k === me ? mkMe(g, o, it) : folk(g, R, oo);
      return { x: x, r: r, ph: R() * 6 };
    });
  }

  // ---------------------------------------------------------------- atti
  // Ogni atto disegna nel suo gruppo (coordinate di scena 1600 x 900, terra a y = 700) e restituisce
  // { dur, cam: { x, y, z }, focus: [x, y] (dove si chiude il diaframma), update(t, T) } con t tempo dell'atto e T globale.
  var ACTS = {};

  ACTS.intro = function (c) {
    var g = c.g;
    ground(g, 700, true);
    var cl = clouds(g, 5, 3), sr = sun(g, 1340, 150, 34);
    var tt = tlines(g, 800, 190, ['Francesco Hrobat'], 64, 'b');
    var st = tlines(g, 800, 245, ['the story so far'], 28);
    var m = mkMe(g, {}, null);
    var a = { dur: 3.6, cam: { x: 800, y: 450, z: 1 }, focus: [800, 420] };
    a.update = function (t, T) {
      drift(cl, T);
      tf(sr, 0, 0, T * 12);
      tt.type(seg(t, 0.15, 1.1));
      st.type(seg(t, 1.0, 1.5));
      var p = pose({ x: lerp(300, 800, seg(t, 0.2, 2.0)) });
      if (t < 2.0) walk(p, (t - 0.2) * 9.4, seg(t, 0.2, 0.35) * (1 - seg(t, 1.85, 2.0)));
      else { p.mouth = 'grin'; p.eyes = t > 2.4 ? 'happy' : 'open'; wave(p, T, seg(t, 2.0, 2.3)); }
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  // aula con il banco visto di fronte, lui seduto che scrive (gare e canguro)
  function classroom(c, it) {
    var g = c.g, o = {};
    wall(g, 610);
    windowFrame(g, 230, 150, 240, 220);
    o.clk = clock(g, 1250, 230, 52);
    var back = G(g), bodyL = G(g), deskL = G(g), armL = G(g);
    o.fx = G(g);
    P(back, 'M 728 640 L 728 468 Q 728 452 744 452 L 856 452 Q 872 452 872 468 L 872 640');
    o.m = mkMe(bodyL, { armLayer: armL }, it);
    desk(deskL, 800, 548, 590, 380, 460, 52, 700);
    var q = [[730, 556], [870, 556], [882, 586], [718, 586]];
    P(deskL, quadD(q));
    o.rows = [];
    for (var i = 0; i < 4; i++) o.rows.push(scribble(deskL, q, 0.18 + i * 0.22, it.seed + i));
    var pen = G(o.m.arms[1].slot);
    o.pen = P(pen, 'M 9 -26 L -1 8', 'l bold');
    o.write = function (k) {
      var n = o.rows.length, x = clamp01(k) * n, r = Math.min(n - 1, Math.floor(x)), f = k >= 1 ? 1 : x - r;
      o.rows.forEach(function (row, j) { row.set(j < r ? 1 : j > r ? 0 : f); });
      return o.rows[r].at(f);
    };
    // pose di scrittura: la mano destra segue la punta della penna, la sinistra tiene fermo il foglio
    o.pose = function (t, T, k) {
      var tip = o.write(k);
      var p = pose({ s: 1.35, sit: 1, eyes: 'focus', mouth: 'tongue', look: [0.1, 1], brow: -0.4, browA: 7, tilt: 2 * Math.sin(T * 2.4), rR: 0 });
      p.wR = [tip[0] + 1.35, tip[1] - 10.8];
      p.wL = [752, 578];
      return p;
    };
    return o;
  }

  // gara individuale; ogni volta un imprevisto diverso: l'idea, la matita che si spezza, il tempo che scade, il foglio da rifare
  ACTS.exam = function (c, it) {
    var o = classroom(c, it), m = o.m, gag = ['bulb', 'snap', 'rush', 'crumple'][it.nth % 4];
    var b = bulb(o.fx), drops = [P(o.fx, DROP, 'k acc'), P(o.fx, DROP, 'k acc')], frag = P(o.fx, 'M -6 -6 L 6 6', 'l bold');
    var ball = P(o.fx, 'M -14 -2 L -8 -12 L 2 -14 L 12 -8 L 14 4 L 6 13 L -6 12 L -13 6 Z M -6 -4 L 4 2 M -2 6 L 6 -6', 'k');
    var timeUp = G(o.fx);
    P(timeUp, rrect(-74, -26, 148, 52, 12));
    TX(timeUp, 0, 11, 'TIME!', 32, 'b ta');
    if (gag === 'crumple') {
      var bin = G(c.g);
      P(bin, 'M 1080 610 L 1180 610 L 1168 700 L 1092 700 Z');
      P(bin, 'M 1110 626 L 1116 690 M 1130 626 L 1130 690 M 1150 626 L 1144 690', 'l thin');
    }
    var idea = gag === 'bulb' || gag === 'crumple';
    if (idea) c.cue(1.85, 'pop');
    if (gag === 'snap') { c.cue(1.0, 'boing'); c.cue(1.55, 'pop'); }
    if (gag === 'rush') c.cue(2.3, 'bell');
    if (gag === 'crumple') { c.cue(1.05, 'whoosh'); c.cue(1.5, 'pop'); }
    c.cue(2.85, 'tada');
    var a = { dur: 3.3, cam: { x: 800, y: 440, z: 1.12 }, focus: [800, 410] };
    a.update = function (t, T) {
      var spin = gag === 'rush' ? 2600 * eIn(seg(t, 1.3, 2.3)) : 0;
      o.clk.set(t * 400 + spin, t * 34 + spin / 12);
      var k;
      if (gag === 'snap') k = 0.4 * seg(t, 0.15, 1.0) + 0.6 * seg(t, 1.6, 2.8);
      else if (gag === 'rush') k = seg(t, 0.15, 2.3);
      else if (gag === 'crumple') k = t < 1.0 ? 0.55 * seg(t, 0.15, 0.95) : seg(t, 1.6, 2.8);
      else k = 0.55 * seg(t, 0.15, 1.85) + 0.45 * seg(t, 2.3, 2.85);
      var p = o.pose(t, T, k);
      if (idea && t > 1.85 && t < 2.3) { p.eyes = 'wide'; p.mouth = 'o'; p.look = [0, -1]; p.brow = 1.2; p.browA = 0; }
      else if (gag === 'bulb' && t >= 2.3 && t < 2.85) p.mouth = 'grin';
      if (gag === 'snap' && t > 1.0 && t < 1.6) { p.eyes = 'wide'; p.mouth = 'o'; p.look = [0.3, 0.6]; p.brow = 1.3; p.browA = -6; }
      if (gag === 'rush' && t > 1.4 && t < 2.3) { p.mouth = 'wavy'; p.brow = 0.8; p.browA = -10; }
      if (gag === 'rush' && t >= 2.3 && t < 2.85) { p.eyes = 'closed'; p.mouth = 'wavy'; p.wR = null; p.aR = [10, -10]; }
      if (gag === 'crumple' && t > 0.95 && t < 1.6) {
        p.mouth = 'frown'; p.brow = -0.6; p.browA = 10; p.look = [0.6, 0];
        p.wR = [800 + 70 * seg(t, 1.0, 1.1), 520 - 40 * seg(t, 1.0, 1.1)]; p.wL = [770, 540];
      }
      if (t >= 2.85) { cheer(p, T, seg(t, 2.85, 3.05)); p.eyes = 'happy'; p.mouth = 'grin'; p.look = [0, 0]; p.brow = 0.6; p.browA = 0; }
      m.set(p, T);
      // la matita: spezzata e poi nuova
      o.pen.setAttribute('d', gag === 'snap' && t > 1.0 && t < 1.55 ? 'M 9 -26 L 4 -10' : 'M 9 -26 L -1 8');
      var fk = gag === 'snap' ? seg(t, 1.0, 1.6) : 0, hr = m.handW(1);
      vis(frag, fk > 0 && fk < 1);
      tf(frag, hr[0] + 120 * fk, hr[1] + 12 - 170 * fk + 300 * fk * fk, fk * 720);
      var top = m.topW(), hw = m.headW(), dk = seg(t, 1.0, 1.75), dk2 = gag === 'rush' ? seg(t, 1.6, 2.2) : 0;
      tf(b, top[0], top[1] - 6, 0, idea ? 1.15 * pop(t, 1.85) : 0);
      tf(drops[0], hw[0] + 66, hw[1] - 24 + dk * 36, 0, 1.15);
      alpha(drops[0], dk > 0 && dk < 1 ? Math.min(1, Math.sin(dk * Math.PI) * 2) : 0);
      tf(drops[1], hw[0] - 66, hw[1] - 30 + dk2 * 36, 0, 1.05);
      alpha(drops[1], dk2 > 0 && dk2 < 1 ? Math.min(1, Math.sin(dk2 * Math.PI) * 2) : 0);
      vis(timeUp, gag === 'rush' && t > 2.3);
      tf(timeUp, 1250, 340, -6, pop(t, 2.3));
      // il foglio appallottolato vola nel cestino
      var bk = seg(t, 1.05, 1.5);
      vis(ball, gag === 'crumple' && t > 0.98 && t < 1.52);
      if (t < 1.05) tf(ball, hr[0], hr[1] - 10, 0, pop(t, 0.98));
      else tf(ball, lerp(870, 1130, bk), lerp(500, 640, bk) - 230 * Math.sin(Math.PI * bk), bk * 400);
      a.focus = hw;
    };
    return a;
  };

  ACTS.podium = function (c, it) {
    var g = c.g, R = rng(it.seed + 3), ry = rays(g, 800, 330);
    ground(g, 700);
    var plain = !it.medal || it.medal === 'plain';
    var place = { gold: 0, silver: 1, bronze: 2 }[it.medal] || 0;
    var steps = [[800, 560, '1'], [595, 610, '2'], [1005, 640, '3']], others = [];
    if (plain) TX(g, 800, 330, it.rank || '', 230, 'out b');
    else steps.forEach(function (s) { P(g, rect(s[0] - 100, s[1], 200, 700 - s[1])); TX(g, s[0], s[1] + 64, s[2], 54, 'b'); });
    if (!plain) steps.forEach(function (s, k) { if (k !== place) others.push({ r: folk(g, R), x: s[0], y: s[1], ph: R() * 6 }); });
    var mx = plain ? 800 : steps[place][0], my = plain ? 700 : steps[place][1];
    var m = mkMe(g, {}, it);
    var md = plain ? rosette(m.tAcc, it.rank || '') : medal(m.tAcc, it.medal, it.rank || '');
    var fx = G(g), conf = confetti(fx, mx, 300, 40, it.seed), spk = sparkles(fx, 8, it.seed);
    if (plain) c.cue(0.55, 'pop'); else c.cue(1.0, 'ding');
    c.cue(1.05, 'tada'); c.cue(1.2, 'clap');
    var a = { dur: 2.9, cam: { x: mx, y: 440, z: 1.05 }, focus: [mx, 400] };
    a.update = function (t, T) {
      ry.set(T);
      var p = pose({ x: mx, y: my, look: [0, -0.8], eyes: 'wide', mouth: 'o', brow: 0.8 });
      if (plain) tf(md, 18, -48, 0, 0.95 * pop(t, 0.55));
      else tf(md, 0, -620 * (1 - eBounce(seg(t, 0.2, 1.0))));
      if (t > 1.0) {
        cheer(p, T, seg(t, 1.0, 1.2));
        p.y = my + hop(t, 1.05, 1.45, 36) + hop(t, 1.5, 1.9, 26);
        p.eyes = 'happy'; p.mouth = 'grin'; p.look = [0, 0]; p.brow = 0.4;
      }
      m.set(p, T);
      others.forEach(function (q) {
        var op = Math.abs(Math.sin(T * 9 + q.ph));
        var pp = pose({ x: q.x, y: q.y, s: 1.0, eyes: t > 1.0 ? 'happy' : 'open', turn: q.x < mx ? 0.5 : -0.5, look: [q.x < mx ? 1 : -1, 0] });
        if (t > 1.0) { pp.tL = [-6 - 12 * op, -50]; pp.tR = [6 + 12 * op, -50]; }
        q.r.set(pp, T + q.ph);
      });
      conf(t - 1.0);
      var sh = m.headW();
      spk(T, sh[0], sh[1] + 40, seg(t, 1.0, 1.3), 170, 150);
      a.focus = sh;
    };
    return a;
  };

  ACTS.team = function (c, it) {
    var g = c.g;
    wall(g, 610);
    P(g, rect(590, 110, 420, 220));
    TX(g, 800, 165, 'TEAM ROUND', 26, 'b');
    var clk = TX(g, 800, 270, '90:00', 72, 'b');
    var bodies = G(g), table = G(g), arms = G(g), fx = G(g);
    var X = [520, 695, 885, 1070], ppl = crew(bodies, X, it, 2, { armLayer: arms });
    desk(table, 795, 575, 612, 740, 820, 46, 700);
    X.forEach(function (x) { var q = [[x - 42, 582], [x + 42, 582], [x + 48, 606], [x - 48, 606]]; P(table, quadD(q)); P(table, 'M ' + (x - 30) + ' 590 h 50 M ' + (x - 32) + ' 598 h 40', 'l thin'); });
    var card = G(ppl[2].r.arms[1].slot);
    P(card, rect(-42, -70, 84, 52));
    TX(card, 0, -34, String(it.year), 28, 'b');
    var b = bulb(fx), conf = confetti(fx, 885, 260, 36, it.seed);
    c.cue(1.15, 'pop'); c.cue(2.2, 'tada');
    var a = { dur: 3.2, cam: { x: 795, y: 430, z: 1.05 }, focus: [885, 420] };
    a.update = function (t, T) {
      clk.textContent = mmss(5400 - t * 1400);
      ppl.forEach(function (q, k) {
        var me = k === 2, p = pose({ x: q.x, s: 1.2, sit: 1, eyes: 'focus', look: [0, 1], mouth: k % 2 ? 'flat' : 'tongue', rR: 0 });
        p.wR = [q.x + 14 + Math.sin(T * 7 + q.ph) * 10, 588 + Math.cos(T * 9 + q.ph) * 2];
        p.wL = [q.x - 26, 594];
        if (!me && t > 1.35) { var dx = X[2] - q.x; p.turn = dx > 0 ? 0.7 : -0.7; p.look = [dx > 0 ? 1 : -1, -0.2]; p.eyes = 'wide'; p.mouth = 'o'; }
        if (me && t > 1.15) { p.eyes = 'wide'; p.mouth = 'grin'; p.look = [0, -0.6]; }
        if (me && t > 1.45) { p.wR = null; p.aR = [lerp(10, 150, eOut(seg(t, 1.45, 1.75))), -18]; }
        if (t > 2.2) {
          var keep = p.aR;
          cheer(p, T + q.ph, seg(t, 2.2, 2.4));
          if (me) p.aR = keep;
          p.eyes = 'happy'; p.mouth = 'grin'; p.turn = 0; p.look = [0, 0];
        }
        q.r.set(p, T + q.ph);
      });
      var top = ppl[2].r.topW();
      tf(b, top[0], top[1] - 6, 0, pop(t, 1.15) * (1 - seg(t, 2.1, 2.3)));
      vis(card, t > 1.45);
      conf(t - 2.2);
      a.focus = ppl[2].r.headW();
    };
    return a;
  };

  ACTS.teampodium = function (c, it) {
    var g = c.g, ry = rays(g, 800, 330);
    ground(g, 700);
    P(g, rect(470, 600, 660, 100));
    TX(g, 800, 668, '1', 56, 'b');
    TX(g, 800, 150, '★ ' + (it.rank || '1st') + ' place ★', 44, 'b');
    var X = [575, 720, 880, 1025], ppl = crew(g, X, it, 2);
    var tro = G(ppl[2].r.arms[1].slot);
    tf(trophy(tro), 0, 4, 0, 0.8);
    var fx = G(g), conf = confetti(fx, 800, 260, 44, it.seed + 1), spk = sparkles(fx, 10, it.seed);
    c.cue(0.3, 'tada'); c.cue(0.5, 'clap');
    var a = { dur: 2.9, cam: { x: 800, y: 430, z: 1 }, focus: [880, 400] };
    a.update = function (t, T) {
      ry.set(T);
      ppl.forEach(function (q, k) {
        var p = pose({ x: q.x, y: 600, s: 1.05, eyes: 'happy', mouth: 'grin' });
        cheer(p, T + q.ph, seg(t, 0.2, 0.45));
        if (k === 2) { p.aR = [160, 8]; p.rR = 0; }
        p.y = 600 - Math.abs(Math.sin(t * 6 + q.ph)) * 22 * seg(t, 0.3, 0.6);
        q.r.set(p, T + q.ph);
      });
      conf(t - 0.4);
      spk(T, 800, 420, seg(t, 0.3, 0.6), 330, 170);
      a.focus = ppl[2].r.headW();
    };
    return a;
  };

  ACTS.lab = function (c, it) {
    var g = c.g;
    wall(g, 575);
    P(g, 'M 260 300 h 330 M 300 300 v -40 h 40 v 40 M 380 300 v -60 h 30 v 60 M 450 300 v -34 h 50 v 34 M 530 300 v -52 h 30 v 52', 'l');
    var pt = G(g, 'translate(1040 160)'), d = '', i, k;
    for (i = 0; i < 5; i++) for (k = 0; k < 9; k++) if (!(i === 0 && k > 0 && k < 8) && !(i < 3 && i > 0 && k > 1 && k < 7)) d += rect(k * 30, i * 30, 26, 26) + ' ';
    P(pt, d, 'l thin');
    var body = G(g), bench = G(g), arms = G(g), fx = G(g);
    var m = mkMe(body, { armLayer: arms }, it);
    labCoat(m.tAcc);
    var md = medal(m.tAcc, it.medal || 'silver', it.rank || '');
    var gog = goggles(m.hAcc), soot = G(m.hAcc);
    [[-30, -50], [-24, -44], [28, -52], [34, -46], [30, -40], [-36, -40]].forEach(function (q) { C(soot, q[0], q[1], 2.2, 'f'); });
    P(bench, 'M 520 575 L 1080 575 L 1110 612 L 490 612 Z');
    P(bench, rect(490, 612, 620, 94));
    P(bench, 'M 800 622 L 800 696 M 530 660 h 230 M 840 660 h 230', 'l thin');
    [575, 600, 625, 650].forEach(function (x) { P(bench, 'M ' + (x - 7) + ' 550 L ' + (x - 7) + ' 500 M ' + (x + 7) + ' 550 L ' + (x + 7) + ' 500 M ' + (x - 7) + ' 500 h 14', 'l thin'); });
    P(bench, rect(560, 545, 110, 26));
    function flask(gg) {
      P(gg, 'M -7 -16 L -7 10 L -26 40 Q -29 46 -22 46 L 22 46 Q 29 46 26 40 L 7 10 L 7 -16');
      P(gg, 'M -10 -16 L 10 -16', 'l');
      P(gg, 'M -19 30 Q -10 26 0 30 Q 10 34 19 30', 'l thin acc');
    }
    var fa = G(m.arms[1].slot);
    flask(fa);
    var fb = G(bench);
    flask(fb);
    var bubs = [];
    for (i = 0; i < 14; i++) bubs.push(C(fx, 0, 0, 3 + (i % 4) * 1.6, 'k thin acc'));
    var boomG = G(fx), cl = '', n = 16;
    for (i = 0; i <= n; i++) {
      var an = i / n * Math.PI * 2, x = Math.cos(an) * 150, y = Math.sin(an) * 120;
      if (!i) cl = 'M ' + f1(x) + ' ' + f1(y); else cl += ' A 36 36 0 0 1 ' + f1(x) + ' ' + f1(y);
    }
    P(boomG, cl + ' Z');
    TX(boomG, 0, 16, 'POOF!', 52, 'b');
    var conf = confetti(fx, 800, 300, 36, it.seed), spk = sparkles(fx, 8, it.seed);
    c.cue(2.45, 'poof'); c.cue(4.5, 'ding'); c.cue(4.6, 'tada');
    var a = { dur: 5.6, cam: { x: 800, y: 440, z: 1.08 }, focus: [800, 400] };
    a.update = function (t, T) {
      var after = t > 2.55;
      m.setHair(after ? 'boom' : m.o.hair);
      vis(soot, after);
      tf(gog, 0, after ? -34 : 0);
      vis(fa, !after);
      var p = pose({ s: 1.2, eyes: 'open', mouth: 'o', look: [0.6, 0.3], turn: 0.25, rR: 0 });
      p.wR = [880 + 16 * Math.cos(T * 7), 468 + 8 * Math.sin(T * 7)];
      p.wL = [700, 588];
      if (t > 1.6 && t < 2.55) { p.look = [1, 0.2]; p.eyes = 'wide'; p.brow = 1.2; p.turn = 0.45; p.wR = [870, 480]; }
      if (after) {
        p.wR = null; p.turn = 0; p.look = [0, 0];
        p.eyes = t < 3.4 ? 'dizzy' : t < 3.55 ? 'closed' : 'open';
        p.mouth = t < 3.8 ? 'wavy' : 'grin';
        p.brow = t < 3.8 ? -0.4 : 0.6;
      }
      tf(md, 0, -640 * (1 - eBounce(seg(t, 3.9, 4.6))));
      vis(md, t > 3.85);
      if (t > 4.6) { cheer(p, T, seg(t, 4.6, 4.8)); p.eyes = 'happy'; p.mouth = 'grin'; }
      m.set(p, T);
      var shk = t > 1.6 && t < 2.5 ? Math.sin(T * 50) * 7 * seg(t, 1.6, 2.2) : 0;
      tf(fb, 985, 529, shk);
      var src = [m.handW(1), [985, 512]];
      bubs.forEach(function (bb, j) {
        var fromB = j % 2 === 1, on = fromB ? t > 1.5 && t < 2.5 : t < 2.5 && !after;
        vis(bb, on);
        if (!on) return;
        var life = (T * (fromB ? 1.9 : 1.2) + j * 0.37) % 1, s0 = src[fromB ? 1 : 0];
        tf(bb, s0[0] + Math.sin(life * 9 + j) * 8, s0[1] - (fromB ? 20 : 26) - life * (fromB ? 150 : 90), 0, fromB ? 1.4 : 1);
        alpha(bb, 1 - life);
      });
      var bk = seg(t, 2.45, 2.65);
      vis(boomG, t > 2.45 && t < 3.5);
      tf(boomG, 900, 430, 0, 0.2 + 1.1 * eOut(bk));
      alpha(boomG, 1 - seg(t, 2.95, 3.45));
      a.shake = t > 2.45 && t < 2.85 ? 1 : 0;
      conf(t - 4.6);
      var lh = m.headW();
      spk(T, lh[0], lh[1] + 40, seg(t, 4.6, 4.9), 160, 140);
      a.focus = lh;
    };
    return a;
  };

  function kangaroo(g) {
    var k = G(g);
    P(k, 'M 26 -50 C 70 -40 110 -16 140 -6 C 147 -3 146 6 138 6 C 104 2 66 -10 20 -24 Z');
    P(k, 'M -24 -190 C -26 -224 -12 -230 -8 -196 Z');
    P(k, 'M -36 -192 C -44 -224 -28 -232 -22 -196 Z');
    P(k, 'M -26 -160 C -62 -140 -66 -70 -40 -36 C -20 -10 34 -10 46 -42 C 58 -76 40 -140 -26 -160 Z');
    P(k, 'M -4 -10 L -66 -6 C -76 -6 -76 6 -66 6 L 16 6 C 30 6 34 -8 22 -14 Z');
    P(k, 'M 0 -96 C 40 -104 56 -50 34 -24 C 22 -10 -4 -14 -8 -30 C -12 -50 -24 -88 0 -96 Z');
    P(k, 'M -44 -70 C -34 -58 -12 -56 0 -66', 'l thin');
    var arm = P(k, 'M -40 -120 C -58 -114 -66 -104 -62 -96', 'l');
    P(k, 'M -20 -150 C -36 -150 -60 -154 -72 -162 C -80 -168 -76 -180 -64 -180 C -52 -196 -26 -198 -14 -184 C -4 -172 -6 -152 -20 -150 Z');
    C(k, -42, -174, 3.4, 'f');
    C(k, -74, -169, 3.6, 'f');
    P(k, 'M -66 -158 Q -60 -153 -54 -157', 'l thin');
    k.paw = [-62, -96];
    return k;
  }
  ACTS.kangaroo = function (c, it) {
    var o = classroom(c, it), m = o.m, kg = G(c.g), roo = kangaroo(kg), held = rosette(roo, it.rank || '');
    tf(held, -70, -92, 0, 0.9);
    var ros = rosette(m.tAcc, it.rank || '');
    var conf = confetti(o.fx, 900, 330, 30, it.seed);
    [2.0, 2.4, 2.8, 3.5, 3.9, 4.3].forEach(function (b0) { c.cue(b0, 'boing'); });
    c.cue(2.9, 'pop'); c.cue(3.1, 'tada');
    var a = { dur: 5.0, cam: { x: 860, y: 440, z: 1.08 }, focus: [800, 410] };
    a.update = function (t, T) {
      o.clk.set(t * 400, t * 34);
      var p = o.pose(t, T, seg(t, 0.15, 2.3));
      if (t > 2.3) { p.wR = null; p.wL = null; p.turn = 0.5; p.look = [1, 0]; p.eyes = 'wide'; p.mouth = 'o'; p.brow = 1; p.browA = 0; }
      if (t > 3.1) { cheer(p, T, seg(t, 3.1, 3.3)); p.eyes = 'happy'; p.mouth = 'grin'; }
      m.set(p, T);
      var kx = lerp(1750, 1130, seg(t, 1.6, 2.8)), ky = 700, hopping = t > 1.6 && t < 2.8;
      if (hopping) ky += -Math.abs(Math.sin((t - 1.6) * 7.8)) * 70;
      if (t > 3.1) ky += -Math.abs(Math.sin((t - 3.1) * 8)) * 50;
      tf(roo, kx, ky, hopping ? -6 : 0, 0.95);
      vis(held, t < 2.9);
      tf(ros, 20, -64, 0, 0.95 * pop(t, 2.9));
      conf(t - 3.1);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.grad = function (c, it) {
    var g = c.g, sns = /Normale/.test(it.text);
    ground(g, 700, true);
    var cl = clouds(g, it.seed, 3);
    if (sns) carovana(g, 480, 700, 0.75); else { pisaTower(g, 400, 700, 1.0); tree(g, 170, 700, 0.8); }
    var m = mkMe(g, {}, it), leaves = laurel(m.hAcc);
    var book = G(m.arms[0].slot);
    P(book, rect(-26, -36, 52, 64));
    P(book, 'M -18 -36 v 64 M -8 -20 h 26 M -8 -10 h 20', 'l thin');
    var cnt = TX(g, 1180, 300, '0/' + it.of, 80, 'b');
    var stamp = G(g);
    P(stamp, rrect(-150, -36, 300, 72, 8), 'l bold acc');
    TX(stamp, 0, 13, (it.honours || '').toUpperCase(), 36, 'b ta');
    var fx = G(g), conf = confetti(fx, 800, -40, 60, it.seed, true), spk = sparkles(fx, 9, it.seed);
    c.cue(0.35, 'pop'); c.cue(2.27, 'stamp'); c.cue(2.5, 'tada');
    var a = { dur: 5.4, cam: { x: 800, y: 440, z: 1 }, focus: [820, 400] };
    a.update = function (t, T) {
      drift(cl, T);
      leaves.forEach(function (lf, i) { tf(lf, lf.x, lf.y, 0, pop(t, 0.35 + i * 0.06)); });
      cnt.textContent = Math.round(it.grade * eOut(seg(t, 1.0, 2.2))) + '/' + it.of;
      var sk = seg(t, 2.25, 2.45);
      vis(stamp, !!it.honours && t > 2.25);
      tf(stamp, 1180, 390, -8, lerp(2.6, 1, eOut(sk)));
      alpha(stamp, sk * 1.5);
      a.shake = t > 2.4 && t < 2.6 ? 0.8 : 0;
      var p = pose({ x: 820, s: 1.2, rL: 0, tL: [-6, -44] });
      if (t < 1.0) { p.look = [0, -1]; p.eyes = 'wide'; p.mouth = 'o'; p.brow = 1; }
      else if (t < 2.5) { p.turn = 0.55; p.look = [1, -0.3]; p.mouth = t > 2.0 ? 'grin' : 'o'; p.eyes = 'wide'; }
      else {
        var tl = p.tL;
        cheer(p, T, seg(t, 2.5, 2.7));
        p.tL = tl;
        p.y = 700 + hop(t, 2.55, 3.0, 40) + hop(t, 3.05, 3.5, 30);
        p.eyes = 'happy'; p.mouth = 'grin';
      }
      m.set(p, T);
      conf(t - 2.5);
      var gh = m.headW();
      spk(T, gh[0], gh[1], seg(t, 2.5, 2.8), 150, 120);
      a.focus = gh;
    };
    return a;
  };

  // borse di studio: la lettera arriva ogni volta con un postino diverso (busta con le ali, gufo, aeroplanino)
  ACTS.letter = function (c, it) {
    var g = c.g, courier = ['wings', 'owl', 'plane'][it.nth % 3];
    ground(g, 700, true);
    tree(g, 330, 700, 1.1);
    var cl = clouds(g, it.seed, 3);
    var m = mkMe(g, {}, it);
    var env = G(g), wings = G(env);
    P(wings, 'M -10 -30 C -30 -80 -80 -80 -64 -40 M 10 -30 C 30 -80 80 -80 64 -40', 'l');
    P(env, rect(-46, -30, 92, 60));
    var flapC = P(env, 'M -46 -30 L 0 4 L 46 -30', 'l'), flapO = P(env, 'M -46 -30 L 0 -64 L 46 -30', 'l');
    var bird = courier === 'owl' ? owl(G(g)) : null, pl = courier === 'plane' ? paperPlane(G(g)) : null;
    var card = G(g), name = it.text.split(',')[0];
    P(card, rrect(-150, -190, 300, 380, 10));
    TX(card, 0, -140, 'SCHOLARSHIP', 26, 'b');
    P(card, 'M -110 -120 h 220', 'l thin');
    tlines(card, 0, -84, wrap(name, 22).slice(0, 4), 19);
    TX(card, 0, 70, '+ ' + (it.dur || ''), 40, 'b ta');
    P(G(card, 'translate(96 140)'), starD(24, 13, 8), 'k acc');
    P(card, 'M -120 140 q 20 -20 40 0 t 40 0', 'l thin');
    var fx = G(g), spk = sparkles(fx, 8, it.seed);
    c.cue(1.3, 'pop'); c.cue(2.7, 'tada');
    var cardT = courier === 'plane' ? 1.45 : 1.8;
    function path(f) {
      var u = 1 - f;
      return [u * u * u * 1700 + 3 * u * u * f * 1150 + 3 * u * f * f * 1200 + f * f * f * 800,
        u * u * u * 120 + 3 * u * u * f * 40 + 3 * u * f * f * 560 + f * f * f * 520];
    }
    var a = { dur: 4.6, cam: { x: 820, y: 440, z: 1 }, focus: [760, 400] };
    a.update = function (t, T) {
      drift(cl, T);
      var f = eIO(seg(t, 0, 1.3)), e = path(f), ex = e[0], ey = e[1], held = t >= 1.3;
      tf(env, ex, ey + (held ? 0 : Math.sin(T * 8) * 6), held ? 0 : -10 + Math.sin(T * 5) * 8);
      vis(env, courier !== 'plane');
      vis(wings, courier === 'wings' && !held);
      tf(wings, 0, 0, 0, 1, Math.sin(T * 24));
      var open = t > 1.6;
      vis(flapC, !open); vis(flapO, open);
      if (bird) {
        var fly = Math.max(0, t - 1.3);
        tf(bird, ex + fly * 700, ey - 78 - fly * 520 + Math.sin(T * 9) * 5, -fly * 12);
        vis(bird, t < 2.5);
        tf(bird.wl, 0, 0, 0, 1, 0.4 + 0.6 * Math.abs(Math.sin(T * 14)));
        tf(bird.wr, 0, 0, 0, 1, 0.4 + 0.6 * Math.abs(Math.sin(T * 14)));
      }
      if (pl) {
        var e2 = path(Math.min(1, f + 0.02));
        tf(pl, ex, ey, held ? 0 : Math.atan2(e2[1] - ey, e2[0] - ex) / D2R + Math.sin(T * 6) * 6);
        vis(pl, t < cardT);
      }
      var ck = eOut(seg(t, cardT, cardT + 0.5));
      vis(card, t > cardT);
      tf(card, lerp(courier === 'plane' ? ex : 800, 1180, ck), lerp(courier === 'plane' ? ey : 500, 380, ck), lerp(-12, 3, ck), lerp(0.15, 1, ck));
      var p = pose({ x: 760, s: 1.15, turn: 0.4, look: [1, -0.6], eyes: 'wide', mouth: 'o' });
      if (t > 0.6) { p.wL = [lerp(1000, ex - 38, seg(t, 0.6, 1.2)), ey + 14]; p.wR = [ex + 38, ey + 14]; p.bL = 1; p.bR = -1; }
      if (t > 2.3) { p.look = [1, 0]; p.mouth = 'grin'; }
      if (t > 2.7) { p.wL = null; cheer(p, T, seg(t, 2.7, 2.9)); p.wR = [ex + 38, ey + 14]; p.y = 700 + hop(t, 2.75, 3.15, 40) + hop(t, 3.2, 3.6, 30); p.eyes = 'happy'; p.turn = 0; }
      m.set(p, T);
      if (t > 2.7) tf(env, m.handW(1)[0] - 38, m.handW(1)[1] - 14, 0);
      var hw = m.headW();
      spk(T, hw[0], hw[1], seg(t, 2.8, 3.1), 150, 110);
      a.focus = hw;
    };
    return a;
  };

  ACTS.parallel = function (c, it) {
    var g = c.g;
    wall(g, 640);
    var mons = [[440, 250], [440, 470], [1160, 250], [1160, 470]].map(function (q, k) {
      var mg = G(g, 'translate(' + q[0] + ' ' + q[1] + ')');
      P(mg, rrect(-120, -80, 240, 160, 10));
      P(mg, rect(-104, -66, 208, 132), 'l thin');
      TX(mg, -88, -36, 'core ' + (k + 1), 20, '', 'start');
      P(mg, rect(-88, 0, 176, 22), 'l thin');
      var bar = S('rect', { x: -88, y: 0, width: 0, height: 22, 'class': 'hatch' }, mg);
      var ok = P(mg, 'M -20 40 l 14 14 l 30 -30', 'l bold acc');
      return { bar: bar, ok: ok, sp: [1.0, 0.8, 1.15, 0.9][k] };
    });
    var m = mkMe(g, {}, it);
    var baton = G(m.arms[1].slot);
    P(baton, 'M 0 -4 L 0 -70', 'l');
    c.cue(3.5, 'ding'); c.cue(3.65, 'tada');
    var a = { dur: 4.8, cam: { x: 800, y: 440, z: 1 }, focus: [800, 400] };
    var BEAT = [[62, -58], [30, -86], [98, -96], [62, -146]];
    a.update = function (t, T) {
      var bt = t / 0.45, bi = Math.floor(bt) % 4, bf = eIO(bt - Math.floor(bt));
      var A = BEAT[bi], B = BEAT[(bi + 1) % 4];
      var p = pose({ s: 1.2, eyes: 'happy', mouth: 'smile', rR: -25, tilt: Math.sin(bt * Math.PI) * 4 });
      if (t < 3.6) {
        p.tR = [lerp(A[0], B[0], bf), lerp(A[1], B[1], bf)];
        p.tL = [-lerp(A[0], B[0], bf) + 6, lerp(A[1], B[1], bf) + 14];
        p.bR = -1; p.bL = 1;
        p.bob = Math.abs(Math.sin(bt * Math.PI)) * 4;
      } else {
        p.aL = [-120, -20]; p.aR = [120, 20]; p.mouth = 'grin'; p.rR = -60;
      }
      m.set(p, T);
      mons.forEach(function (mn) {
        var k = Math.min(1, Math.floor(bt) * 0.13 * mn.sp + 0.13 * mn.sp * bf);
        if (t > 3.4) k = 1;
        mn.bar.setAttribute('width', f1(176 * k));
        vis(mn.ok, t > 3.5);
        tf(mn.ok, 0, 0, 0, pop(t, 3.5));
      });
      a.focus = m.headW();
    };
    return a;
  };

  // ---- viaggio: il mezzo, poi l'arrivo
  ACTS.ride = function (c, it) {
    var g = c.g, ks = it.map.split('>'), A = PLACES[ks[0]], B = PLACES[ks[1]], dist = km(A, B);
    var mode = dist > 700 ? 'plane' : dist > 40 ? 'train' : 'bike', R = rng(it.seed + 5);
    TX(g, 800, 110, A[2] + ' → ' + B[2], 34, 'b');
    var kmT = TX(g, 800, 160, '0 km', 28, 'tm');
    var a = { dur: 2.3, cam: { x: 800, y: 450, z: 1 }, focus: [800, 400] }, upd;
    if (mode === 'plane') {
      var far = [], i;
      for (i = 0; i < 9; i++) far.push({ c: cloud(g, 0, 0, 0.4 + R() * 0.9), x: R() * 2400, y: 220 + R() * 420 });
      var hills = P(g, '', 'l thin');
      var trail = P(g, '', 'l thin m dash');
      var pl = plane(G(g));
      c.cue(1.6, 'whoosh');
      upd = function (t, T) {
        far.forEach(function (q) { var x = ((q.x - T * 600 * q.c.bs) % 2400 + 2400) % 2400 - 400; tf(q.c, x, q.y, 0, q.c.bs); });
        var hd = '', off = (T * 60) % 300;
        for (var x = -500 - off; x < 2100; x += 300) hd += (x === -500 - off ? 'M' : ' L') + f1(x) + ' 800 Q ' + f1(x + 75) + ' 770 ' + f1(x + 150) + ' 800 Q ' + f1(x + 225) + ' 830 ' + f1(x + 300) + ' 800';
        hills.setAttribute('d', hd);
        var px = lerp(-400, 800, eOut(seg(t, 0, 0.8))) + 1500 * eIn(seg(t, 1.6, 2.3)), py = 400 + Math.sin(T * 2.2) * 10 - 60 * eIn(seg(t, 1.6, 2.3));
        tf(pl.parentNode, px, py, -3 * Math.sin(T * 1.7) - 6 * seg(t, 1.6, 2.0));
        vis(pl.parentNode, t < 2.25);
        vis(trail, t < 2.25);
        trail.setAttribute('d', 'M -600 ' + f1(py - 20) + ' L ' + f1(px - 190) + ' ' + f1(py - 20));
        a.focus = [px + 40, py - 16];
      };
    } else if (mode === 'train') {
      var hl = P(g, 'M -500 560 C -300 420 -100 440 100 540 C 300 420 500 430 700 540 C 900 430 1100 420 1300 540 C 1500 440 1700 430 1900 540 C 2100 430 2300 440 2500 540 L 2500 700 L -500 700 Z');
      P(g, 'M -500 700 L 2100 700 M -500 712 L 2100 712', 'l');
      var sl = S('path', { d: 'M -500 706 L 2100 706', 'class': 'l', 'stroke-dasharray': '4 30' }, g);
      var poles = P(g, '', 'l thin');
      var tr = train(G(g));
      c.cue(0.15, 'toot');
      upd = function (t, T) {
        tf(hl, -((T * 60) % 1200), 0);
        sl.setAttribute('stroke-dashoffset', f1(T * 900));
        var pd = '', off = (T * 700) % 520;
        for (var x = -500 - off; x < 2100; x += 520) pd += 'M ' + f1(x) + ' 700 L ' + f1(x) + ' 420 M ' + f1(x - 20) + ' 430 h 40 ';
        poles.setAttribute('d', pd);
        var tx = lerp(-1300, 800, eOut(seg(t, 0, 0.8))) + 1800 * eIn(seg(t, 1.6, 2.3));
        tf(tr.parentNode, tx, 686 + Math.abs(Math.sin(T * 14)) * 2);
        vis(tr.parentNode, t < 2.25);
        a.focus = [tx - 170 + 182, 578];
      };
    } else {
      var trees = [];
      for (var j = 0; j < 4; j++) trees.push({ g: tree(G(g), 0, 0, 0.7), x: j * 650 });
      P(g, 'M -500 700 L 2100 700', 'l');
      var lane = S('path', { d: 'M -500 740 L 2100 740', 'class': 'l thin', 'stroke-dasharray': '40 40' }, g);
      var bk = G(g), wl = [C(bk, 700, 652, 48), C(bk, 910, 652, 48)], spokes = P(bk, '', 'l thin');
      var body = G(bk);
      P(bk, 'M 700 652 L 790 652 L 768 584 Z M 768 584 L 858 588 L 790 652 M 858 588 L 910 652 M 858 588 L 864 562 L 888 558', 'l bold');
      P(bk, 'M 748 580 h 38', 'l xb');
      var crank = P(bk, '', 'l bold');
      c.cue(0.4, 'bell');
      var m = mkMe(body, {}, it);
      upd = function (t, T) {
        trees.forEach(function (q) { var x = ((q.x - T * 420) % 2600 + 2600) % 2600 - 500; tf(q.g.parentNode, x, 700); });
        lane.setAttribute('stroke-dashoffset', f1(T * 420));
        var bx = lerp(-700, 0, eOut(seg(t, 0, 0.7))) + 1500 * eIn(seg(t, 1.6, 2.3)), ph = T * 7;
        tf(bk, bx, Math.abs(Math.sin(T * 9)) * 1.5);
        vis(bk, t < 2.25);
        var sd = '';
        [700, 910].forEach(function (cx) { for (var k = 0; k < 4; k++) { var an = ph + k * Math.PI / 4; sd += 'M ' + f1(cx + Math.cos(an) * 46) + ' ' + f1(652 + Math.sin(an) * 46) + ' L ' + f1(cx - Math.cos(an) * 46) + ' ' + f1(652 - Math.sin(an) * 46) + ' '; } });
        spokes.setAttribute('d', sd);
        var p1 = [790 + Math.cos(ph) * 22, 652 + Math.sin(ph) * 22], p2 = [790 - Math.cos(ph) * 22, 652 - Math.sin(ph) * 22];
        crank.setAttribute('d', 'M ' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L ' + f1(p2[0]) + ' ' + f1(p2[1]));
        var p = pose({ x: 768, y: 572 + 100 * 1.05, s: 1.05, lean: 22, turn: 0.8, mouth: 'grin', eyes: 'happy' });
        p.feet = [[p1[0], p1[1] - 7], [p2[0], p2[1] - 7]];
        p.knee = 1;
        p.wL = p.wR = [886, 560];
        p.bL = 1; p.bR = 1;
        m.set(p, T);
        a.focus = m.headW();
        a.focus = [a.focus[0] + bx, a.focus[1]];
      };
    }
    a.update = function (t, T) { kmT.textContent = Math.round(dist * eIO(seg(t, 0.3, 1.7))).toLocaleString('en-US') + ' km'; upd(t, T); };
    return a;
  };

  ACTS.arrive = function (c, it) {
    var g = c.g, B = PLACES[it.map.split('>')[1]];
    var cl = clouds(g, it.seed + 9, 2);
    var anim = LANDMARK[B[3]](g);
    ground(g, 700, true);
    signpost(g, 1220, 700, B[2]);
    var m = mkMe(g, {}, it), sc = G(m.arms[1].slot);
    suitcase(sc);
    var a = { dur: 2.0, cam: { x: 800, y: 450, z: 1 }, focus: [760, 400] };
    a.update = function (t, T) {
      drift(cl, T);
      if (anim) anim(T);
      var p = pose({ x: lerp(-60, 760, seg(t, 0, 1.25)), rR: 0 });
      if (t < 1.25) walk(p, t * 9.4, 1 - seg(t, 1.1, 1.25));
      else { p.turn = lerp(0.85, -0.3, seg(t, 1.25, 1.45)); p.look = [-0.6, -1]; p.tilt = -6; p.eyes = 'wide'; p.mouth = 'o'; }
      if (t > 1.7) { p.turn = 0; p.look = [0, 0]; p.tilt = 0; p.eyes = 'happy'; p.mouth = 'grin'; }
      p.aR = [8, -4];
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  // ---- talk: slide del titolo con una figura sull'argomento (chi parla la indica col braccio), arredi del posto
  // (lanterne a Taiwan, festoni tricolori per gli italiani, una finestra sul posto) e ogni volta un imprevisto
  // diverso nel pubblico: la domanda, chi si addormenta, il telefono che squilla, le risate
  function slideFig(g, s) {
    var f = G(g), d = '', i;
    if (/Zolotarev/.test(s)) {
      for (i = 0; i <= 40; i++) { var x = -1 + i / 20; d += (i ? ' L ' : 'M ') + f1(800 + 70 * x) + ' ' + f1(432 - 26 * Math.cos(5 * Math.acos(Math.max(-1, Math.min(1, x))))); }
      P(f, 'M 722 432 h 156 M 722 406 h 156 M 722 458 h 156', 'l thin m');
      P(f, d, 'l acc');
    } else if (/Lanczos|Lyapunov/.test(s)) {
      for (i = 0; i < 8; i++) { var h = 62 * Math.exp(-0.55 * i); d += rect(728 + i * 19, 466 - h, 12, h) + ' '; }
      P(f, d, 'k acc');
      P(f, 'M 722 466 h 160', 'l thin');
    } else if (/eigenvalue/.test(s)) {
      P(f, 'M 722 440 h 160', 'l thin');
      [740, 770, 812, 846, 870].forEach(function (x, j) { C(f, x, 440, 6, 'k acc'); P(f, 'M ' + x + ' 426 l ' + (j % 2 ? 6 : -6) + ' -16', 'l thin m'); });
    } else if (/friends/.test(s)) {
      var nd = [[740, 420], [780, 396], [830, 410], [860, 446], [800, 452], [760, 456]];
      [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 4], [4, 5], [5, 0], [2, 4]].forEach(function (e) { d += 'M ' + nd[e[0]][0] + ' ' + nd[e[0]][1] + ' L ' + nd[e[1]][0] + ' ' + nd[e[1]][1] + ' '; });
      P(f, d, 'l thin m');
      nd.forEach(function (q, j) { C(f, q[0], q[1], j === 4 ? 9 : 6, j === 4 ? 'k acc' : 'k'); });
    }
    return f;
  }
  function talkDecor(g, s) {
    var deco = G(g);
    if (/Taiwan|Kaohsiung/.test(s)) {
      [960, 1130, 1300, 1470].forEach(function (x, j) { lantern(deco, x, 100 + (j % 2) * 26, 0.9); });
      P(deco, 'M 1215 612 h 90 M 1260 612 L 1260 700', 'l bold');
      P(deco, 'M 1245 560 L 1275 560 L 1271 608 L 1249 608 Z');
      P(deco, 'M 1243 560 Q 1260 546 1277 560 M 1263 552 L 1272 518', 'l');
      [[1254, 600], [1262, 602], [1268, 598], [1258, 594]].forEach(function (q) { C(deco, q[0], q[1], 3, 'f'); });
    } else if (/Italian/.test(s)) {
      bunting(deco, 930, 1560, 60, 26, 11, ['grn', '', 'red']);
    } else {
      var lm = /Pisa/.test(s) ? 'tower' : /Rutherford|Didcot/.test(s) ? 'ring' : /Oxford|JAMS/.test(s) ? 'radcam' : '';
      if (lm) {
        P(deco, rect(990, 120, 300, 200));
        if (lm === 'tower') pisaTower(deco, 1140, 316, 0.45);
        else if (lm === 'radcam') radcam(deco, 1140, 318, 0.5);
        else { diamondRing(deco, 1130, 304, 0.3); tree(deco, 1250, 318, 0.3); }
        P(deco, 'M 980 320 h 320', 'l bold');
      }
    }
    return deco;
  }
  ACTS.talk = function (c, it) {
    var g = c.g, tp = talkParts(it), s = it.text, gag = ['question', 'sleepy', 'phone', 'laugh'][it.nth % 4];
    wall(g, 640);
    talkDecor(g, s);
    var scr = G(g);
    P(scr, 'M 226 122 L 914 122', 'l bold');
    P(scr, rect(240, 128, 660, 400));
    P(scr, 'M 570 528 L 570 546 M 558 546 h 24', 'l thin');
    TX(scr, 270, 178, (tp.venue + ' · ' + it.when).slice(0, 52), 16, 'tm', 'start');
    var ttl = tlines(scr, 270, 250, wrap(tp.title, 26).slice(0, 4), 32, 'b', 'start');
    var fig = slideFig(scr, s);
    TX(scr, 270, 478, 'Francesco Hrobat', 20, '', 'start');
    P(scr, 'M 270 496 L 870 496', 'l thin acc');
    var m = mkMe(g, {}, it);
    var aud = G(g), heads = audience(aud, 772, 0.95, [230, 410, 590, 770, 950, 1130, 1310], it.seed);
    var fx = G(g), bq = bubble(fx, '?'), laughs = [bubble(fx, 'ha!'), bubble(fx, 'ha!'), bubble(fx, 'ha!')];
    laughs.forEach(function (b) { b.t.setAttribute('font-size', 20); });
    var zz = [0, 1, 2].map(function () { return TX(fx, 0, 0, 'z', 30, 'b tm'); });
    var phone = G(fx);
    P(phone, rrect(-10, -18, 20, 36, 5));
    var notes = [TX(phone, 22, -20, '♪', 26, 'b'), TX(phone, -26, -26, '♪', 22, 'b')];
    if (gag === 'question') { c.cue(3.6, 'pop'); c.cue(4.2, 'pop'); }
    if (gag === 'sleepy') c.cue(4.4, 'pop');
    if (gag === 'phone') { c.cue(3.3, 'bell'); c.cue(3.75, 'bell'); }
    if (gag === 'laugh') { c.cue(3.5, 'pop'); c.cue(3.8, 'pop'); c.cue(4.1, 'pop'); }
    c.cue(4.5, 'clap');
    var a = { dur: 5.4, cam: { x: 800, y: 450, z: 1 }, focus: [1070, 400] };
    a.update = function (t, T) {
      ttl.type(seg(t, 0.2, 1.4));
      alpha(fig, seg(t, 1.3, 1.7));
      var p = pose({ x: 1070, mouth: 'talk', turn: -0.5, look: [-1, -0.3] });
      var pointing = t > 0.3 && t < 2.7;
      if (pointing) p.tilt = -3;
      else if (t < 3.6) { p.turn = 0; p.look = [0, 0.4]; p.aL = [-55, -35]; p.aR = [55, 35]; }
      else if (t < 4.4) {
        p.turn = -0.3; p.look = [-0.6, 0.7]; p.aR = [70, 40];
        if (gag === 'phone') { p.mouth = 'o'; p.brow = 1; p.aR = [10, -10]; }
        if (gag === 'laugh') { p.mouth = 'grin'; p.eyes = 'happy'; }
      } else { p.turn = 0; p.mouth = 'grin'; p.eyes = 'happy'; p.tilt = 5 * seg(t, 4.5, 4.8); }
      // indica con il braccio la riga del titolo che sta leggendo
      if (pointing) {
        var ln = Math.min(ttl.n - 1, Math.floor(seg(t, 0.3, 2.5) * ttl.n)), fr = (seg(t, 0.3, 2.5) * ttl.n) % 1;
        pointAt(m, p, T, 0, 280 + fr * 480, 258 + ln * 39, 0);
      } else m.set(p, T);
      var st = heads.map(function () { return { nod: t < 3.5 ? 1 : 0, clap: t > 4.5 }; });
      var asleep = gag === 'sleepy' && t > 0.8 && t < 4.4, ring = gag === 'phone' && t > 3.3 && t < 4.2, haha = gag === 'laugh' && t > 3.5 && t < 4.4;
      if (gag === 'question') st[2].raise = t > 3.5 && t < 4.5;
      if (asleep) { st[4].nod = 0; st[4].tilt = 24; }
      if (ring) { st[4].tilt = -12; st[6].tilt = 12; }
      if (haha) [1, 3, 5].forEach(function (j) { st[j].bounce = Math.abs(Math.sin(T * 14 + j)) * 6; });
      heads.forEach(function (h, j) { h.set(T, st[j]); });
      // la domanda (o il risveglio) in un fumetto
      var bx = gag === 'sleepy' ? 1036 : 676, show = gag === 'question' ? t > 3.6 && t < 4.6 : gag === 'sleepy' ? t > 4.4 && t < 5.1 : false;
      bq.t.textContent = gag === 'question' && t < 4.2 ? '?' : '!';
      tf(bq, bx, 578, 0, show ? pop(t, gag === 'sleepy' ? 4.4 : 3.6) : 0);
      zz.forEach(function (z, j) {
        var life = (T * 0.8 + j / 3) % 1;
        vis(z, asleep);
        tf(z, 990 + life * 40 + j * 4, 650 - life * 90, 0, 0.6 + life * 0.6);
        alpha(z, Math.sin(life * Math.PI));
      });
      vis(phone, ring);
      tf(phone, 1150, 610, Math.sin(T * 60) * 12);
      notes.forEach(function (nt, j) { alpha(nt, 0.5 + 0.5 * Math.sin(T * 9 + j * 2)); });
      laughs.forEach(function (lb, j) {
        var x = [410, 770, 1130][j], on = haha && (Math.floor(T * 3) + j) % 2 === 0;
        tf(lb, x + 70, 588, 0, on ? 0.85 : 0);
      });
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.poster = function (c, it) {
    var g = c.g, tp = talkParts(it), R = rng(it.seed);
    wall(g, 640);
    P(g, 'M 430 600 L 470 700 M 710 600 L 670 700', 'l bold');
    P(g, rect(380, 150, 380, 460));
    tlines(g, 570, 200, wrap(tp.title, 24).slice(0, 3), 20, 'b');
    TX(g, 570, 282, 'F. Hrobat · Pisa · ' + it.when, 14, 'tm');
    var d = '';
    for (var i = 0; i < 6; i++) d += 'M 404 ' + (312 + i * 14) + ' h ' + (130 + R() * 30) + ' M 594 ' + (312 + i * 14) + ' h ' + (120 + R() * 30) + ' ';
    P(g, d, 'l thin m');
    P(g, 'M 420 430 L 420 570 L 720 570', 'l');
    var curve = S('path', { d: 'M 430 444 C 480 450 500 520 560 540 C 610 556 660 560 715 562', 'class': 'l acc', pathLength: 1, 'stroke-dasharray': '1 1' }, g);
    var m = mkMe(g, {}, it), v = folk(g, R, { hair: 'bob' }), cup = G(v.arms[0].slot);
    P(cup, 'M -12 -24 L 12 -24 L 10 4 L -10 4 Z');
    var b = bubble(g, '!');
    c.cue(2.8, 'pop');
    var a = { dur: 4.8, cam: { x: 800, y: 450, z: 1 }, focus: [900, 400] };
    a.update = function (t, T) {
      curve.setAttribute('stroke-dashoffset', (1 - seg(t, 0.3, 1.6)).toFixed(3));
      var p = pose({ x: 900, mouth: 'talk', turn: -0.4, look: [-1, 0.2] });
      if (t < 2.8) p.wL = [780 - 10 * Math.sin(T * 3), 500 + 20 * Math.sin(T * 2)];
      else { p.turn = 0.4; p.look = [1, 0]; p.mouth = t > 3.2 ? 'grin' : 'talk'; p.aR = [50, 30]; }
      if (t > 3.3) p.eyes = 'happy';
      m.set(p, T);
      var q = pose({ x: 1180, dir: -1, turn: 0.5, look: [1, 0], rL: 0, aL: [-10, 70], tilt: t < 2.8 ? Math.sin(T * 5) * 5 : 0, mouth: t > 2.8 ? 'grin' : 'smile' });
      if (t > 2.8) { q.eyes = 'wide'; q.brow = 1; }
      if (t > 3.3) q.eyes = 'happy';
      v.set(q, T + 1);
      tf(b, 1180, 300, 0, t > 2.8 && t < 4.4 ? pop(t, 2.8) : 0);
      a.focus = m.headW();
    };
    return a;
  };

  // ---- articoli: al laptop, poi la prima pagina e l'animazione Manim sullo schermo
  function laptopDesk(c, it, cx) {
    var g = c.g, o = {};
    wall(g, 610);
    var back = G(g), body = G(g), deskL = G(g), arms = G(g), front = G(g);
    o.fx = G(g);
    P(back, 'M ' + (cx - 72) + ' 640 L ' + (cx - 72) + ' 448 Q ' + (cx - 72) + ' 432 ' + (cx - 56) + ' 432 L ' + (cx + 56) + ' 432 Q ' + (cx + 72) + ' 432 ' + (cx + 72) + ' 448 L ' + (cx + 72) + ' 640');
    o.m = mkMe(body, { armLayer: arms }, it);
    desk(deskL, cx, 548, 590, 380, 460, 52, 700);
    o.steam = mug(deskL, cx + 150, 576);
    P(front, 'M ' + (cx - 106) + ' 574 L ' + (cx + 106) + ' 574 L ' + (cx + 114) + ' 584 L ' + (cx - 114) + ' 584 Z');
    P(front, rrect(cx - 98, 488, 196, 88, 8));
    TX(front, cx, 552, 'λ', 52, 'b');
    o.lid = [cx, 488];
    o.cx = cx;
    o.pose = function (t, T, k) {
      var p = pose({ x: cx, y: 680, s: 1.35, sit: 1, eyes: 'focus', look: [0, 0.6], mouth: 'flat', tilt: Math.sin(T * 3) * 2 });
      var j = k === undefined ? 1 : k;
      p.wL = [cx - 28 + Math.sin(T * 23) * 4 * j, 566 + Math.abs(Math.sin(T * 19)) * 5 * j];
      p.wR = [cx + 28 + Math.sin(T * 21 + 1) * 4 * j, 566 + Math.abs(Math.sin(T * 17 + 2)) * 5 * j];
      return p;
    };
    return o;
  }

  ACTS.typing = function (c, it) {
    var o = laptopDesk(c, it, 800), m = o.m, eqs = eqsOf(it).map(function (s) { return TX(o.fx, 0, 0, s, 30, 'b'); });
    var burst = P(o.fx, 'M -120 -40 L -170 -90 M 0 -60 L 0 -130 M 120 -40 L 170 -90 M -60 -54 L -84 -110 M 60 -54 L 84 -110', 'l acc');
    c.cue(2.3, 'whoosh');
    var a = { dur: 2.7, cam: { x: 800, y: 430, z: 1.1 }, focus: [800, 390] };
    a.update = function (t, T) {
      o.steam(T);
      var p = o.pose(t, T, t < 2.0 ? 1 : 0);
      if (t > 1.95 && t < 2.3) { p.wR = null; p.aR = [150, 10]; p.look = [0, -0.5]; p.mouth = 'grin'; p.eyes = 'wide'; }
      if (t >= 2.3) { p.eyes = 'happy'; p.mouth = 'grin'; }
      m.set(p, T);
      eqs.forEach(function (e, j) {
        var k = seg(t, 0.1 + j * 0.42, 1.3 + j * 0.42);
        vis(e, k > 0 && k < 1);
        tf(e, 800 + (j % 2 ? 1 : -1) * (90 + j * 30) + Math.sin(k * 6 + j) * 14, 470 - k * 300);
        alpha(e, Math.sin(k * Math.PI) * 1.4);
      });
      var bk = seg(t, 2.3, 2.6);
      vis(burst, bk > 0 && bk < 1);
      tf(burst, 800, 490, 0, 0.6 + bk * 0.7);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.paper = function (c, it) {
    var g = c.g, pp = paperParts(it), R = rng(it.seed);
    wall(g, 640);
    var page = G(g);
    P(page, rect(-150, -200, 300, 400));
    var tl = wrap(pp.title, 20).slice(0, 5);
    tlines(page, 0, -150, tl, 20, 'b');
    tlines(page, 0, -142 + tl.length * 24 + 6, wrap(pp.authors, 30).slice(0, 2), 13, 'tm');
    var d = '';
    for (var i = 0; i < 7; i++) d += 'M -120 ' + (40 + i * 18) + ' h ' + (200 + R() * 40) + ' ';
    P(page, d, 'l thin m');
    var stamp = G(page);
    P(stamp, rrect(-84, -30, 168, 60, 8), 'l bold acc');
    TX(stamp, 0, pp.soon ? 0 : 12, pp.venue, 34, 'b ta');
    if (pp.soon) TX(stamp, 0, 20, 'to appear', 14, 'ta');
    var scr = G(g);
    P(scr, 'M 760 420 L 720 700 M 940 420 L 980 700', 'l bold');
    P(scr, rect(596, 146, 488, 278));
    var inner = S('rect', { x: 600, y: 150, width: 480, height: 270, 'class': 'k thin' }, scr);
    if (it.anim) c.video(it.anim, inner);
    else tlines(scr, 840, 270, eqsOf(it).slice(0, 2), 32, 'b');
    var m = mkMe(g, {}, it);
    c.cue(1.15, 'stamp');
    var a = { dur: 4.6, cam: { x: 800, y: 450, z: 1 }, focus: [1230, 400] };
    a.update = function (t, T) {
      var k = eOut(seg(t, 0, 0.6));
      tf(page, 360, lerp(900, 360, k), lerp(25, -3, k));
      var sk = seg(t, 1.1, 1.3);
      vis(stamp, t > 1.1);
      tf(stamp, 34, 70, -12, lerp(2.6, 1, eOut(sk)));
      a.shake = t > 1.25 && t < 1.4 ? 0.6 : 0;
      var p = pose({ x: 1230, mouth: 'talk', turn: -0.45, look: [-1, -0.2], aL: [-112, -12], aR: [20, 30] });
      if (t > 3.6) { p.turn = 0; p.look = [0, 0]; p.mouth = 'grin'; p.eyes = 'happy'; p.aL = [-60, -40]; }
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  // lezioni: alla lavagna il metodo di Newton, A = LU o la SVD (a turno); il professore indica ogni passo,
  // e con A = LU si sposta lungo la lavagna da una matrice all'altra
  ACTS.teach = function (c, it) {
    var g = c.g, kind = ['newton', 'lu', 'svd'][it.nth % 3], steps = [], i, d;
    wall(g, 640);
    P(g, rect(300, 120, 900, 400));
    P(g, 'M 290 528 h 920', 'l bold');
    TX(g, 330, 190, it.text.split(',')[0], 22, 'tm', 'start');
    function add(e, x, y) { steps.push({ e: e, x: x, y: y }); vis(e, false); return e; }
    if (kind === 'lu') {
      var A = [[2, 1, 1], [4, 3, 3], [8, 7, 9]], L = [[1, 0, 0], [2, 1, 0], [4, 3, 1]], U = [[2, 1, 1], [0, 1, 1], [0, 0, 2]];
      var mat = function (M, x0, lab) {
        P(g, 'M ' + (x0 + 8) + ' 270 h -12 v 170 h 12 M ' + (x0 + 152) + ' 270 h 12 v 170 h -12', 'l');
        TX(g, x0 + 80, 255, lab, 22, 'b tm');
        for (var r = 0; r < 3; r++) for (var cc = 0; cc < 3; cc++) add(TX(g, x0 + 30 + cc * 50, 316 + r * 52, String(M[r][cc]), 32, 'b'), x0 + 30 + cc * 50, 306 + r * 52);
      };
      mat(A, 340, 'A');
      TX(g, 540, 368, '=', 40, 'b');
      mat(L, 580, 'L');
      mat(U, 790, 'U');
      add(P(g, 'M 990 340 l 18 18 l 38 -40', 'l bold acc'), 1010, 330);
    } else if (kind === 'newton') {
      P(g, 'M 360 450 h 580 M 380 470 V 220', 'l thin');
      var fy = function (u) { return 450 - 230 * (u * u - 0.25); };
      d = '';
      for (i = 0; i <= 30; i++) { var u = 0.1 + 0.9 * i / 30; d += (i ? ' L ' : 'M ') + f1(380 + 540 * u) + ' ' + f1(fy(u)); }
      add(P(g, d, 'l acc'), 380 + 540 * 0.75, fy(0.75));
      var us = [0.963];
      for (i = 0; i < 2; i++) { var u0 = us[us.length - 1]; us.push(u0 - (u0 * u0 - 0.25) / (2 * u0)); }
      us.forEach(function (uu, j) {
        var x = 380 + 540 * uu, y = fy(uu), gg = G(g);
        P(gg, 'M ' + f1(x) + ' 450 L ' + f1(x) + ' ' + f1(y), 'l thin m');
        if (j < us.length - 1) P(gg, 'M ' + f1(x) + ' ' + f1(y) + ' L ' + f1(380 + 540 * us[j + 1]) + ' 450', 'l');
        C(gg, x, y, 7, 'k acc');
        TX(gg, x, 484, 'x' + '₀₁₂'.charAt(j), 22, 'b');
        add(gg, x, y);
      });
      add(TX(g, 700, 250, 'x ← x − f(x) / f′(x)', 30, 'b'), 700, 240);
      var root = G(g);
      P(G(root, 'translate(650 450)'), starD(16, 7, 5), 'k gold');
      add(root, 650, 440);
    } else {
      var circ = G(g);
      C(circ, 450, 330, 80, 'l');
      add(circ, 450, 260);
      var vv = G(g);
      P(vv, 'M 450 330 L 507 273 M 507 273 l -14 2 M 507 273 l -2 14 M 450 330 L 393 273 M 393 273 l 14 2 M 393 273 l 2 14', 'l acc');
      TX(vv, 522, 266, 'v₁', 22, 'b');
      TX(vv, 376, 266, 'v₂', 22, 'b', 'end');
      add(vv, 500, 280);
      var arr = G(g);
      P(arr, 'M 570 330 L 640 330 M 640 330 l -12 -8 M 640 330 l -12 8', 'l bold');
      TX(arr, 605, 312, 'A', 26, 'b');
      add(arr, 605, 320);
      var ell = G(g, 'translate(800 330) rotate(-20)');
      P(ell, 'M -130 0 A 130 52 0 1 0 130 0 A 130 52 0 1 0 -130 0', 'l');
      add(ell, 800, 300);
      var ax = G(g, 'translate(800 330) rotate(-20)');
      P(ax, 'M 0 0 L 130 0 M 130 0 l -14 -6 M 130 0 l -14 6 M 0 0 L 0 -52 M 0 -52 l -6 14 M 0 -52 l 6 14', 'l acc');
      TX(ax, 136, -8, 'σ₁u₁', 20, 'b', 'start');
      TX(ax, 8, -60, 'σ₂u₂', 20, 'b', 'start');
      add(ax, 900, 300);
      add(TX(g, 1010, 450, 'A = UΣVᵀ', 32, 'b'), 1010, 440);
    }
    var m = mkMe(g, {}, it);
    var aud = G(g), heads = audience(aud, 772, 0.95, [470, 700, 930], it.seed + 2);
    var bq = bubble(g, '?');
    var N = steps.length, ts = steps.map(function (s, j) { return 0.25 + 2.6 * j / N; });
    var st = steps.map(function (s) { return kind !== 'lu' ? 1180 : s.x < 560 ? 760 : s.x < 800 ? 1000 : 1180; });
    c.cue(2.95, 'ding'); c.cue(3.1, 'pop'); c.cue(3.7, 'pop');
    var a = { dur: 5.0, cam: { x: 800, y: 450, z: 1 }, focus: [1180, 400] };
    a.update = function (t, T) {
      var cur = -1, j;
      for (j = 0; j < N; j++) if (t >= ts[j]) cur = j;
      steps.forEach(function (s, k) { vis(s.e, k <= cur); });
      // la postazione: l'ultima che è cambiata, raggiunta in 0,3 secondi
      var jj = 0;
      for (j = 1; j <= Math.max(0, cur); j++) if (st[j] !== st[j - 1]) jj = j;
      var x = jj ? lerp(st[jj - 1], st[jj], eIO(seg(t, ts[jj], ts[jj] + 0.32))) : st[0];
      var moving = jj > 0 && t > ts[jj] && t < ts[jj] + 0.32;
      var p = pose({ x: x, turn: -0.6, look: [-1, -0.3], mouth: 'talk', aL: [-104, -8] });
      if (moving) { walk(p, t * 12, 1); p.aL = [-36, -12]; }
      if (t > 3.1 && t < 4.1) { p.turn = -0.2; p.look = [-0.4, 0.8]; p.aL = [-26, -10]; }
      if (t >= 4.1) { p.turn = 0; p.look = [0, 0]; p.mouth = 'grin'; p.eyes = 'happy'; p.aL = [-40, -20]; }
      var frac = cur < 0 ? 1 : (t - ts[cur]) / (cur < N - 1 ? ts[cur + 1] - ts[cur] : 0.4);
      if (t < 3.05 && !moving && cur >= 0) pointAt(m, p, T, 0, steps[cur].x, steps[cur].y - 10, Math.max(0, 1 - frac * 5));
      else m.set(p, T);
      heads.forEach(function (h, k) { h.set(T, { nod: 1, raise: k === 1 && t > 3.1 && t < 4.1 }); });
      bq.t.textContent = t < 3.7 ? '?' : '!';
      tf(bq, 786, 580, 0, t > 3.1 && t < 4.4 ? pop(t, 3.1) : 0);
      a.focus = m.headW();
    };
    return a;
  };

  // ---- ruoli
  function banner(g, txt, y) {
    var w = Math.min(1100, txt.length * 17 + 80);
    P(g, 'M ' + f1(800 - w / 2 - 60) + ' 40 L ' + f1(800 - w / 2) + ' ' + (y - 24) + ' M ' + f1(800 + w / 2 + 60) + ' 40 L ' + f1(800 + w / 2) + ' ' + (y - 24), 'l thin');
    P(g, rect(800 - w / 2, y - 30, w, 52));
    TX(g, 800, y + 6, txt, 26, 'b');
  }
  function badge(parent) {
    var b = G(parent);
    P(b, 'M -14 -86 L 0 -46 L 14 -86', 'l thin acc');
    P(b, rect(-13, -48, 26, 32));
    P(b, 'M -7 -36 h 14 M -7 -28 h 10', 'l thin');
    return b;
  }
  ACTS.officer = function (c, it) {
    var g = c.g, R = rng(it.seed), name = it.text.split(', ').slice(1).join(', ') || it.text;
    wall(g, 640);
    banner(g, name, 120);
    P(g, 'M 300 560 L 330 700 M 420 560 L 390 700', 'l bold');
    P(g, rect(250, 260, 220, 300));
    TX(g, 360, 320, 'SEMINAR', 30, 'b');
    TX(g, 360, 380, 'λ', 70, 'b ta');
    TX(g, 360, 440, 'Thu · 5 pm', 20);
    TX(g, 360, 480, '+ pizza', 20, 'b');
    var m = mkMe(g, {}, it);
    badge(m.tAcc);
    var box = G(g);
    P(box, rect(722, 470, 156, 70));
    P(box, 'M 712 540 L 888 540 L 900 566 L 700 566 Z');
    P(box, 'M 724 553 C 724 538 876 538 876 553 C 876 568 724 568 724 553 Z', 'k thin');
    var slices = [], sl = '';
    for (var i = 0; i < 6; i++) {
      var an = i / 6 * Math.PI * 2;
      sl += 'M 800 553 L ' + f1(800 + Math.cos(an) * 76) + ' ' + f1(553 + Math.sin(an) * 15) + ' ';
    }
    P(box, sl, 'l thin');
    [[770, 550], [830, 556], [800, 546]].forEach(function (q) { C(box, q[0], q[1], 4, 'k thin'); });
    var fs = [folk(g, R), folk(g, R)], fsl = fs.map(function () { var s = P(g, 'M 0 0 L 34 -10 L 30 12 Z', 'k gold'); return s; });
    c.cue(1.8, 'pop'); c.cue(2.5, 'pop');
    var a = { dur: 4.8, cam: { x: 820, y: 450, z: 1 }, focus: [800, 400] };
    a.update = function (t, T) {
      var p = pose({ x: 800, turn: 0.3, look: [1, 0], mouth: 'talk', wL: [726, 552], wR: [874, 552], bL: -1, bR: 1 });
      if (t > 3.6) { p.mouth = 'chew'; p.eyes = 'happy'; }
      m.set(p, T);
      fs.forEach(function (f, k) {
        var a0 = 0.3 + k * 0.7, x0 = 1750 + k * 200, x1 = 1010 + k * 170, k2 = seg(t, a0, a0 + 1.3);
        var q = pose({ x: lerp(x0, x1, k2), dir: -1, s: 1.05 });
        if (k2 < 1) walk(q, (t - a0) * 9.4, 1 - seg(t, a0 + 1.15, a0 + 1.3)); else { q.turn = 0.4; q.look = [1, 0]; }
        var got = t > a0 + 1.5;
        if (got) { q.tR = [24, -60]; q.mouth = t > a0 + 1.9 ? 'chew' : 'o'; q.eyes = 'happy'; }
        f.set(q, T + k);
        var hw = f.handW(1), ks = seg(t, a0 + 1.4, a0 + 1.7);
        vis(fsl[k], ks > 0);
        tf(fsl[k], lerp(800, hw[0], ks), lerp(552, hw[1] - 10, ks) - Math.sin(ks * Math.PI) * 60, 180);
      });
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.organize = function (c, it) {
    var g = c.g, R = rng(it.seed), m0 = /of the (.+?),/.exec(it.text), name = m0 ? m0[1] : 'Meeting';
    var cl = clouds(g, it.seed, 2);
    ground(g, 700, true);
    banner(g, name, 120);
    var m = mkMe(g, {}, it);
    badge(m.tAcc);
    var clip = G(m.arms[0].slot);
    P(clip, rect(-34, -8, 68, 92));
    P(clip, rect(-12, -14, 24, 10), 'k thin');
    var ticks = [];
    for (var i = 0; i < 4; i++) {
      P(clip, rect(-24, 6 + i * 19, 11, 11), 'l thin');
      P(clip, 'M -6 ' + (12 + i * 19) + ' h ' + (22 + (i % 2) * 6), 'l thin');
      ticks.push(P(clip, 'M -23 ' + (11 + i * 19) + ' l 4 5 l 9 -12', 'l acc'));
    }
    var pen = G(m.arms[1].slot);
    P(pen, 'M 8 -24 L -1 8', 'l bold');
    var ppl = [folk(g, R), folk(g, R), folk(g, R)];
    [0.8, 1.3, 1.8, 2.3].forEach(function (t0) { c.cue(t0, 'tick'); });
    var a = { dur: 4.6, cam: { x: 800, y: 450, z: 1 }, focus: [800, 400] };
    a.update = function (t, T) {
      drift(cl, T);
      var p = pose({ x: 800, rL: 0, rR: 0, tL: [-20, -44], look: [0, 1], mouth: 'flat', eyes: 'focus' });
      var cur = Math.min(3, Math.floor(seg(t, 0.3, 2.3) * 4));
      ticks.forEach(function (tk, j) { vis(tk, t > 0.3 + (j + 1) * 0.5); });
      p.tR = [-10 + Math.sin(T * 20) * 3, -38 + cur * 19 * 0.0 + 0];
      var hl = m.handW(0);
      p.wR = [hl[0] + 8 + Math.sin(T * 20) * 3, hl[1] + 16 + cur * 19 * 1.15];
      p.tR = null;
      if (t > 2.4) { p.look = [0, 0]; p.eyes = 'open'; p.mouth = 'grin'; p.wR = null; wave(p, T, seg(t, 2.6, 2.8)); }
      if (t > 3.4) p.eyes = 'happy';
      m.set(p, T);
      ppl.forEach(function (f, k) {
        var from = k === 1 ? -500 : 2100 + k * 100, to = [1080, 480, 1260][k], a0 = 1.8 + k * 0.3, k2 = seg(t, a0, a0 + 1.4);
        var q = pose({ x: lerp(from, to, k2), dir: from < to ? 1 : -1, s: 1.05 });
        if (k2 < 1) walk(q, (t - a0) * 9.4, 1 - seg(t, a0 + 1.25, a0 + 1.4)); else { q.mouth = 'grin'; wave(q, T + k, seg(t, a0 + 1.4, a0 + 1.6)); q.turn = 0.3; q.look = [1, 0]; }
        f.set(q, T + k);
      });
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.online = function (c, it) {
    var o = laptopDesk(c, it, 1080), m = o.m, g = c.g, win = G(g);
    P(win, rrect(230, 130, 560, 400, 12));
    P(win, 'M 230 172 h 560', 'l thin');
    [252, 272, 292].forEach(function (x) { C(win, x, 151, 5, 'k thin'); });
    TX(win, 510, 158, (it.text.split(' ')[0] || 'call').toLowerCase() + ' · video call', 16, 'tm');
    var tiles = [], R = rng(it.seed), k;
    for (k = 0; k < 6; k++) {
      var tx = 250 + (k % 3) * 178, ty = 186 + Math.floor(k / 3) * 166, tg = G(win);
      P(tg, rrect(tx, ty, 166, 154, 8), 'k thin');
      var hg = G(tg, 'translate(' + (tx + 83) + ' ' + (ty + 96) + ')');
      P(hg, 'M -40 58 C -40 30 -24 22 0 22 C 24 22 40 30 40 58', 'k');
      C(hg, 0, -8, 28);
      P(hg, ['M -28 -14 C -30 -44 30 -44 28 -14 C 20 -26 -20 -26 -28 -14 Z', 'M -30 10 C -40 -46 40 -46 30 10 C 28 -20 -28 -20 -30 10 Z', 'M -28 -10 C -34 -50 34 -50 28 -10 L 20 -26 L 8 -16 L -4 -28 L -16 -16 Z'][k % 3]);
      C(hg, -9, -6, 2.6, 'f'); C(hg, 9, -6, 2.6, 'f');
      P(hg, 'M -8 6 Q 0 13 8 6', 'l thin');
      var hand = C(hg, 34, 6, 9);
      tiles.push({ g: tg, hand: hand, ph: R() * 6 });
    }
    var globe = G(g, 'translate(820 130)');
    for (var cq = 0; cq < 6; cq++) c.cue(0.2 + cq * 0.18, 'pop');
    C(globe, 0, 0, 34);
    var mer = P(globe, '', 'l thin');
    P(globe, 'M -34 0 h 68 M -28 -18 h 56 M -28 18 h 56', 'l thin');
    var a = { dur: 4.6, cam: { x: 800, y: 440, z: 1 }, focus: [1080, 390] };
    a.update = function (t, T) {
      o.steam(T);
      var p = o.pose(t, T, t < 1.4 ? 1 : 0);
      p.look = [-0.8, -0.2]; p.turn = -0.3; p.eyes = 'open'; p.mouth = 'smile';
      if (t > 1.6) { p.mouth = 'grin'; wave(p, T, seg(t, 1.6, 1.8)); p.eyes = t > 2.4 ? 'happy' : 'open'; }
      m.set(p, T);
      tiles.forEach(function (tl, j) {
        tf(tl.g, 0, 0);
        alpha(tl.g, seg(t, 0.2 + j * 0.18, 0.45 + j * 0.18));
        var wv = t > 1.6 + j * 0.1;
        tl.hand.setAttribute('cy', f1(wv ? -20 + Math.sin(T * 10 + tl.ph) * 8 : 40));
      });
      var md = '';
      for (var q = 0; q < 3; q++) { var w = Math.abs(Math.cos(T * 1.5 + q * 1.05)) * 34; md += 'M 0 -34 C ' + f1(w) + ' -34 ' + f1(w) + ' 34 0 34 C ' + f1(-w) + ' 34 ' + f1(-w) + ' -34 0 -34 '; }
      mer.setAttribute('d', md);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.social = function (c, it) {
    var g = c.g, R = rng(it.seed);
    wall(g, 640);
    var win = G(g);
    P(win, rrect(220, 130, 600, 420, 12));
    P(win, 'M 220 176 h 600', 'l thin');
    P(win, rrect(300, 142, 480, 24, 12), 'k thin');
    TX(win, 316, 160, 'people.maths.ox.ac.uk/siamsc', 15, 'tm', 'start');
    [244, 264].forEach(function (x) { C(win, x, 153, 5, 'k thin'); });
    P(win, rect(250, 200, 240, 150), 'k thin');
    P(win, 'M 262 336 L 330 260 L 380 310 L 410 285 L 478 336 Z', 'l thin');
    C(win, 440, 240, 14, 'k thin');
    var d = '';
    for (var i = 0; i < 9; i++) d += 'M 520 ' + (214 + i * 16) + ' h ' + (160 + R() * 110) + ' ';
    for (i = 0; i < 6; i++) d += 'M 250 ' + (390 + i * 18) + ' h ' + (380 + R() * 150) + ' ';
    P(win, d, 'l thin m');
    var likes = TX(g, 780, 600, '♥ 0', 30, 'b ta', 'end');
    var m = mkMe(g, {}, it), phone = G(m.arms[1].slot);
    P(phone, rrect(-16, -40, 32, 58, 6));
    P(phone, 'M -10 -32 h 20 v 40 h -20 Z', 'l thin');
    var pops = [];
    for (var cq = 0; cq < 10; cq += 2) c.cue(0.4 + cq * 0.3, 'pop');
    for (i = 0; i < 10; i++) {
      var pg = G(g);
      if (i % 3 === 0) { P(pg, circD(0, 0, 18)); TX(pg, 0, 6, '+1', 16, 'b'); }
      else P(pg, HEART, 'k acc');
      pops.push(pg);
    }
    var a = { dur: 4.6, cam: { x: 800, y: 450, z: 1 }, focus: [1060, 400] };
    a.update = function (t, T) {
      var p = pose({ x: 1060, rR: 0, tR: [22, -66], tL: [-14, -52], look: [0.4, 0.9], eyes: 'focus', mouth: 'smile' });
      if (t > 3.4) { p.look = [0, 0]; p.eyes = 'happy'; p.mouth = 'grin'; p.tL = null; wave(p, T, 0); p.aL = [-130, -30]; }
      m.set(p, T);
      var src = m.handW(1);
      pops.forEach(function (q, j) {
        var life = seg(t, 0.4 + j * 0.3, 1.6 + j * 0.3);
        vis(q, life > 0 && life < 1);
        tf(q, src[0] + Math.sin(life * 5 + j) * 50 + (j % 2 ? 40 : -40) * life, src[1] - 40 - life * 300, 0, 0.6 + life * 0.6);
        alpha(q, Math.sin(life * Math.PI) * 1.5);
      });
      likes.textContent = '♥ ' + Math.round(eIO(seg(t, 0.4, 3.6)) * 256);
      a.focus = m.headW();
    };
    return a;
  };

  // ---- scuole e programmi
  ACTS.school = function (c, it) {
    var g = c.g, variant = it.variant, R = rng(it.seed);
    wall(g, 640);
    P(g, rect(220, 150, 540, 330));
    P(g, 'M 210 488 h 560', 'l bold');
    var art = G(g), steps = [];
    if (variant === 'net') {
      var cols = [[300, [220, 300, 380]], [470, [190, 260, 330, 400]], [640, [260, 340]]], nodes = [];
      cols.forEach(function (cl) { nodes.push(cl[1].map(function (y) { return [cl[0], y]; })); });
      for (var i = 0; i < 2; i++) nodes[i].forEach(function (a) { nodes[i + 1].forEach(function (b) { steps.push(P(art, 'M ' + a[0] + ' ' + a[1] + ' L ' + b[0] + ' ' + b[1], 'l thin m')); }); });
      nodes.forEach(function (cl) { cl.forEach(function (n) { steps.push(C(art, n[0], n[1], 13)); }); });
    } else if (variant === 'dice') {
      [[300, 250, 3], [420, 330, 5]].forEach(function (dc) {
        var dg = G(art, 'translate(' + dc[0] + ' ' + dc[1] + ') rotate(' + (dc[2] * 4 - 14) + ')');
        P(dg, rrect(-40, -40, 80, 80, 12));
        var pips = { 3: [[-20, -20], [0, 0], [20, 20]], 5: [[-20, -20], [20, -20], [0, 0], [-20, 20], [20, 20]] }[dc[2]];
        pips.forEach(function (q) { C(dg, q[0], q[1], 6, 'f'); });
        steps.push(dg);
      });
      steps.push(TX(art, 600, 250, 'E[ ‖Sx‖² ]', 30, 'b'));
      steps.push(TX(art, 600, 320, '≈ ‖x‖²', 30, 'b'));
      steps.push(TX(art, 560, 420, 'sketch!', 26, 'ta'));
    } else {
      steps.push(P(art, 'M 260 330 C 320 220 380 220 440 330 C 500 440 560 440 620 330 C 650 280 680 260 720 270', 'l acc'));
      steps.push(TX(art, 490, 230, '∂u/∂t = Δu', 34, 'b'));
      steps.push(TX(art, 490, 440, 'u(x, 0) = u₀(x)', 26));
    }
    var prof = folk(g, R, { hair: 'bald', glasses: true, shirt: 'sweater' });
    var spots = [[640, 300], [520, 250], [600, 390]];
    var body = G(g), deskL = G(g), arms = G(g), fx = G(g);
    var m = mkMe(body, { armLayer: arms }, it);
    desk(deskL, 1180, 560, 596, 200, 250, 44, 700);
    P(deskL, quadD([[1130, 566], [1210, 566], [1216, 590], [1124, 590]]));
    var pen = G(m.arms[1].slot);
    P(pen, 'M 8 -24 L -1 8', 'l bold');
    var b = bulb(fx);
    c.cue(3.2, 'pop');
    var a = { dur: 4.6, cam: { x: 800, y: 450, z: 1 }, focus: [1180, 400] };
    a.update = function (t, T) {
      steps.forEach(function (s, j) { vis(s, t > 0.2 + j * (2.4 / steps.length)); });
      var q = pose({ x: 860, turn: -0.6, look: [-1, -0.2], mouth: 'talk', aL: [-112, -8] });
      var si = Math.floor(t / 1.1), sf = eIO(seg(t - si * 1.1, 0, 0.35)), s0 = spots[Math.max(0, si - 1) % 3], s1 = spots[si % 3];
      pointAt(prof, q, T + 2, 0, lerp(s0[0], s1[0], sf), lerp(s0[1], s1[1], sf), sf >= 1 ? 0.6 * Math.abs(Math.sin(T * 8)) : 0);
      var up = Math.floor(t / 0.8) % 2 === 0;
      var p = pose({ x: 1180, y: 690, s: 1.2, sit: 1, turn: -0.6, rR: 0, look: up ? [-1, -0.4] : [-0.2, 1], eyes: up ? 'open' : 'focus', mouth: 'smile' });
      p.wR = [1186 + Math.sin(T * 9) * 10, 570];
      p.wL = [1140, 582];
      if (t > 3.2) { p.eyes = 'wide'; p.mouth = 'grin'; p.look = [-0.4, -1]; }
      if (t > 3.7) p.eyes = 'happy';
      m.set(p, T);
      var top = m.topW();
      tf(b, top[0], top[1] - 6, 0, pop(t, 3.2));
      a.focus = m.headW();
    };
    return a;
  };

  // campus e feste di matematica: alla lavagna a fogli un rompicapo, ogni volta diverso (il "?" che si risolve
  // in un grafico, oppure un quadrato magico che si riempie)
  ACTS.camp = function (c, it) {
    var g = c.g, name = it.text.split(',')[0], magic = it.nth % 2 === 1;
    ground(g, 700, true);
    TX(g, 800, 78, name, 34, 'b');
    bunting(g, 150, 1450, 120, 55, 15, ['', 'gold']);
    P(g, 'M 430 600 L 460 700 M 610 600 L 580 700 M 520 600 L 520 700', 'l bold');
    P(g, rect(400, 250, 240, 350));
    var q1 = TX(g, 520, 470, '?', 160, 'b'), sol = G(g), cells = [], k;
    if (magic) {
      TX(g, 520, 292, 'magic square', 20, 'tm');
      var MS = [2, 7, 6, 9, 5, 1, 4, 3, 8], d = '';
      for (k = 1; k < 3; k++) d += 'M ' + (430 + k * 60) + ' 320 v 180 M 430 ' + (320 + k * 60) + ' h 180 ';
      P(g, rect(430, 320, 180, 180) + ' ' + d, 'l thin');
      MS.forEach(function (v, j) { cells.push(TX(g, 460 + (j % 3) * 60, 362 + Math.floor(j / 3) * 60, String(v), 34, 'b')); });
      P(sol, 'M 446 548 l 12 12 l 26 -26', 'l bold acc');
      TX(sol, 560, 562, '= 15', 26, 'b ta');
    } else {
      P(sol, 'M 440 520 L 480 360 L 520 470 L 560 300 L 600 420', 'l acc');
      TX(sol, 520, 560, 'solved!', 24, 'b');
    }
    var X = [760, 960, 1140, 1320], ppl = crew(g, X, it, 1), fx = G(g), b = bulb(fx), conf = confetti(fx, 960, 300, 40, it.seed);
    var spk = sparkles(fx, 6, it.seed + 2);
    c.cue(1.85, 'pop'); c.cue(2.3, 'ding'); c.cue(2.8, 'tada');
    var a = { dur: 4.6, cam: { x: 840, y: 450, z: 1 }, focus: [960, 400] };
    a.update = function (t, T) {
      vis(q1, !magic && t < 2.3);
      vis(sol, t >= 2.3);
      cells.forEach(function (e, j) { vis(e, t > 0.4 + j * 0.2); });
      ppl.forEach(function (q, j) {
        var me = j === 1, p = pose({ x: q.x, s: 1.05, turn: -0.6, look: [-1, 0], mouth: 'flat' });
        if (t < 2.0) { p.tR = [8, -96]; p.tilt = Math.sin(T * 2 + q.ph) * 4; }
        if (me && t > 1.9) { p.aL = [-112, -10]; p.mouth = 'grin'; p.eyes = 'wide'; }
        if (!me && t > 2.2) { p.eyes = 'wide'; p.mouth = 'o'; }
        if (t > 2.8) { cheer(p, T + q.ph, seg(t, 2.8, 3.0)); p.eyes = 'happy'; p.mouth = 'grin'; p.turn = 0; p.look = [0, 0]; p.y = 700 - Math.abs(Math.sin((t - 2.8) * 7 + q.ph)) * 30; }
        q.r.set(p, T + q.ph);
      });
      var top = ppl[1].r.topW();
      tf(b, top[0], top[1] - 6, 0, pop(t, 1.85) * (1 - seg(t, 2.7, 2.9)));
      conf(t - 2.8);
      spk(T, 520, 420, seg(t, 2.3, 2.6), 150, 190);
      a.focus = ppl[1].r.headW();
    };
    return a;
  };

  ACTS.quant = function (c, it) {
    var g = c.g;
    P(g, 'M -500 520 L 2100 520', 'l');
    var sw = waves(g, 550, 4, 8), sn = sun(g, 1300, 400, 46);
    palm(g, 1460, 700, 1.2);
    ground(g, 700);
    P(g, rect(240, 140, 520, 380));
    P(g, 'M 270 480 L 730 480 M 270 480 L 270 170', 'l thin');
    var candles = [], v = 420, R = rng(it.seed);
    for (var k = 0; k < 11; k++) {
      var up = R() < 0.72, o = v, cl = v + (up ? -1 : 1) * (12 + R() * 26), hi = Math.min(o, cl) - 8 - R() * 12, lo = Math.max(o, cl) + 8 + R() * 12;
      var cg = G(g), x = 300 + k * 40;
      P(cg, 'M ' + x + ' ' + f1(hi) + ' L ' + x + ' ' + f1(lo), 'l thin');
      P(cg, rect(x - 9, f1(Math.min(o, cl)), 18, f1(Math.abs(o - cl))), up ? 'k' : 'k hatch');
      candles.push(cg);
      v = cl - 8;
    }
    var arrow = P(g, 'M 300 440 L 700 ' + f1(v - 10) + ' M 700 ' + f1(v - 10) + ' l -30 4 M 700 ' + f1(v - 10) + ' l -14 26', 'l bold acc');
    var m = mkMe(g, {}, it), sh = G(m.hAcc);
    P(sh, 'M -38 -84 L -3 -84 L -5 -60 Q -7 -49 -19 -49 Q -35 -49 -37 -62 Z M 38 -84 L 3 -84 L 5 -60 Q 7 -49 19 -49 Q 35 -49 37 -62 Z', 'f');
    P(sh, 'M -3 -79 L 3 -79 M -38 -80 L -52 -82 M 38 -80 L 52 -82', 'l');
    var gull = bird(g);
    c.cue(2.6, 'ding'); c.cue(2.8, 'tada');
    var a = { dur: 4.6, cam: { x: 800, y: 440, z: 1 }, focus: [960, 400] };
    a.update = function (t, T) {
      sw(T); tf(sn, 1300, 400, T * 8);
      candles.forEach(function (cg, k) { vis(cg, t > 0.3 + k * 0.2); });
      vis(arrow, t > 2.6);
      var p = pose({ x: 960, turn: -0.5, look: [-1, 0], mouth: 'talk', aL: [-110, -12] });
      if (t > 2.8) { cheer(p, T, seg(t, 2.8, 3.0)); p.mouth = 'grin'; p.turn = 0; p.y = 700 + hop(t, 2.85, 3.25, 34); }
      m.set(p, T);
      tf(gull, lerp(-200, 1900, seg(t, 0, 4.6)), 240 + Math.sin(T * 2) * 20, 0, 1.2, 0.6 + 0.4 * Math.sin(T * 12));
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.visit = function (c, it) {
    var g = c.g, R = rng(it.seed);
    alps(g, 800, 470, 0.7);
    rolex(g, 800, 640, 1);
    ground(g, 700);
    var m = mkMe(g, {}, it), sc = G(m.tAcc);
    P(sc, 'M -24 -90 C -10 -78 10 -78 24 -90 L 24 -80 C 10 -66 -10 -66 -24 -80 Z');
    P(sc, 'M 8 -76 L 14 -36 L 26 -38 L 20 -78 Z M 14 -36 l 0 6 M 18 -36 l 0 6 M 22 -37 l 0 6', 'k');
    var cupG = G(m.arms[0].slot);
    P(cupG, 'M -12 -24 L 12 -24 L 10 6 L -10 6 Z');
    var steam = P(cupG, '', 'l thin m');
    var flakes = [];
    for (var i = 0; i < 46; i++) flakes.push({ e: P(g, 'M -5 0 L 5 0 M 0 -5 L 0 5 M -3.5 -3.5 L 3.5 3.5 M -3.5 3.5 L 3.5 -3.5', 'l thin'), x: R() * 1800 - 100, sp: 40 + R() * 50, ph: R() * 6, y0: R() * 900 });
    var a = { dur: 4.6, cam: { x: 800, y: 450, z: 1 }, focus: [800, 400] };
    a.update = function (t, T) {
      flakes.forEach(function (f) { var y = (f.y0 + T * f.sp) % 820 - 60; tf(f.e, f.x + Math.sin(T + f.ph) * 20, y); });
      steam.setAttribute('d', 'M -4 -30 q ' + f1(5 * Math.sin(T * 3)) + ' -8 0 -16 q ' + f1(-5 * Math.sin(T * 3)) + ' -8 0 -16');
      var p = pose({ rL: 0, tL: [-30, -60], mouth: 'smile' });
      if (t > 0.8 && t < 3.0) { p.look = [0.2, -1]; p.tilt = -8; p.mouth = 'tongue'; p.eyes = 'open'; }
      if (t > 3.0) { p.eyes = 'happy'; p.mouth = 'grin'; }
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.phd = function (c, it) {
    var g = c.g, start = it.from.split('-').map(Number), days = Math.floor((Date.now() - new Date(start[0], (start[1] || 1) - 1, start[2] || 1)) / 864e5) + 1;
    spires(g, 800, 640, 0.9);
    ground(g, 700, true);
    var cnt = TX(g, 1200, 260, 'PhD · day 1', 48, 'b');
    var m = mkMe(g, {}, it), gown = G(m.tAcc);
    P(gown, 'M -38 -78 L -50 46 L -16 46 L -14 -86 C -24 -88 -33 -86 -38 -78 Z M 38 -78 L 50 46 L 16 46 L 14 -86 C 24 -88 33 -86 38 -78 Z');
    P(gown, 'M 0 -84 L -12 -92 L -12 -78 Z M 0 -84 L 12 -92 L 12 -78 Z', 'k');
    var cap = G(m.hAcc, 'translate(0 -2)');
    P(cap, 'M -40 -120 L -40 -138 C -14 -146 14 -146 40 -138 L 40 -120 C 14 -128 -14 -128 -40 -120 Z');
    P(cap, 'M -66 -146 L 4 -166 L 70 -146 L 0 -126 Z');
    var tassel = P(cap, '', 'l thin acc');
    var rain = G(g), cloudG = G(rain), drops = [], R = rng(it.seed);
    P(cloudG, 'M -150 30 C -190 30 -190 -20 -150 -20 C -150 -70 -80 -86 -50 -50 C -30 -100 60 -100 70 -46 C 110 -66 160 -30 140 10 C 170 14 160 30 140 30 Z');
    for (var i = 0; i < 24; i++) drops.push({ e: P(rain, 'M 0 0 L -4 16', 'l thin acc'), x: -150 + R() * 300, ph: R() });
    var umb = G(m.arms[1].slot);
    P(umb, 'M 0 10 L 0 -215 M 0 10 C 0 22 -14 22 -14 12', 'l');
    P(G(umb, 'translate(-24 -52)'), 'M -120 -150 C -110 -230 110 -230 120 -150 C 100 -164 80 -164 60 -150 C 40 -164 20 -164 0 -150 C -20 -164 -40 -164 -60 -150 C -80 -164 -100 -164 -120 -150 Z');
    c.cue(3.1, 'pop');
    var a = { dur: 5.6, cam: { x: 800, y: 440, z: 1 }, focus: [800, 400] };
    a.update = function (t, T) {
      cnt.textContent = 'PhD · day ' + Math.max(1, Math.round(days * eIO(seg(t, 0.6, 2.6))));
      var sw = Math.sin(T * 4) * 10;
      tassel.setAttribute('d', 'M 4 -146 L ' + f1(54 + sw * 0.3) + ' -144 L ' + f1(56 + sw) + ' -106');
      var cx = lerp(1400, 800, eOut(seg(t, 2.0, 2.7)));
      tf(cloudG, 0, 0);
      tf(rain, cx, 130);
      drops.forEach(function (d) { var y = ((T * 2.2 + d.ph) % 1) * 560 + 40; vis(d.e, t > 2.6); tf(d.e, d.x, y); });
      var p = pose({ mouth: 'grin', rR: 0, aR: [8, -4] });
      if (t > 2.6 && t < 3.1) { p.eyes = 'wide'; p.mouth = 'o'; p.look = [0, -1]; }
      vis(umb, t > 3.1);
      if (t > 3.1) { p.tR = [62, -62]; tf(umb, 0, 0, 0, pop(t, 3.1)); p.eyes = 'happy'; }
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS['3mt'] = function (c, it) {
    var g = c.g;
    P(g, 'M 700 0 L 590 700 M 900 0 L 1010 700', 'l thin m');
    P(g, 'M 620 700 C 620 680 980 680 980 700', 'l thin m');
    ground(g, 700);
    var sw = G(g, 'translate(330 260)');
    P(sw, rect(-14, -104, 28, 18));
    C(sw, 0, 0, 86);
    var tk = '';
    for (var i = 0; i < 12; i++) { var an = i * 30 * D2R; tk += 'M ' + f1(Math.sin(an) * 70) + ' ' + f1(-Math.cos(an) * 70) + ' L ' + f1(Math.sin(an) * 80) + ' ' + f1(-Math.cos(an) * 80) + ' '; }
    P(sw, tk, 'l thin');
    var hand = P(sw, 'M 0 8 L 0 -64', 'l bold acc');
    var digits = TX(g, 330, 420, '3:00', 52, 'b');
    var sl = G(g);
    P(sl, rect(1040, 150, 290, 210));
    var R = rng(it.seed), nodes = [], ed = '';
    for (i = 0; i < 9; i++) nodes.push([1080 + R() * 210, 190 + R() * 140]);
    nodes.forEach(function (a, j) { nodes.forEach(function (b, k) { if (k > j && R() < 0.3) ed += 'M ' + f1(a[0]) + ' ' + f1(a[1]) + ' L ' + f1(b[0]) + ' ' + f1(b[1]) + ' '; }); });
    P(sl, ed, 'l thin m');
    nodes.forEach(function (n, j) { C(sl, n[0], n[1], j === 4 ? 12 : 8, j === 4 ? 'k acc' : 'k'); });
    var m = mkMe(g, {}, it), star = G(m.arms[1].slot);
    P(star, 'M 0 0 L 0 -40', 'l bold');
    P(G(star, 'translate(0 -70)'), starD(38, 17, 5), 'k gold');
    var aud = G(g), heads = audience(aud, 776, 0.95, [250, 430, 610, 790, 970, 1150, 1330], it.seed);
    var hearts = [];
    for (i = 0; i < 16; i++) hearts.push({ e: P(g, HEART, 'k acc'), x: 250 + R() * 1100, ph: R() });
    TX(g, 800, 110, '', 30, 'b');
    var fav = G(g);
    P(fav, rrect(-230, -34, 460, 60, 30), 'k');
    TX(fav, 0, 8, '★ Audience Favourite ★', 28, 'b');
    var conf = confetti(G(g), 800, 300, 40, it.seed), spk = sparkles(G(g), 9, it.seed);
    c.cue(4.0, 'ding'); c.cue(4.1, 'clap'); c.cue(4.2, 'tada');
    var GEST = [{ L: [-84, -40], R: [84, -40] }, { L: [-46, 4], R: [66, -150] }, { L: [-46, 4], R: [112, -84] }, { L: [-18, -46], R: [18, -46] }];
    var a = { dur: 5.8, cam: { x: 800, y: 450, z: 1 }, focus: [800, 400] };
    a.update = function (t, T) {
      var k = seg(t, 0.3, 4.0), left = 180 * (1 - k);
      digits.textContent = mmss(left);
      tf(hand, 0, 0, 360 * k);
      tf(sw, 330 + (t > 4.0 && t < 4.4 ? Math.sin(T * 60) * 6 : 0), 260);
      var gi = Math.floor(t / 0.6) % 4, gf = eIO((t / 0.6) % 1 * 2), G0 = GEST[gi], G1 = GEST[(gi + 3) % 4];
      var p = pose({ s: 1.2, mouth: 'talk', eyes: 'open', rR: 0 });
      p.tL = [lerp(G1.L[0], G0.L[0], gf), lerp(G1.L[1], G0.L[1], gf)];
      p.tR = [lerp(G1.R[0], G0.R[0], gf), lerp(G1.R[1], G0.R[1], gf)];
      p.bob = Math.abs(Math.sin(T * 6)) * 3;
      vis(star, t > 4.2);
      if (t > 4.0) { p.mouth = 'grin'; p.eyes = 'happy'; p.tL = p.tR = null; p.aR = [150, 10]; p.aL = [-150, -20]; p.y = 700 + hop(t, 4.25, 4.65, 34); }
      if (t > 4.2) tf(star, 0, 0, 0, pop(t, 4.2));
      m.set(p, T);
      heads.forEach(function (h) { h.set(T, { nod: 1, clap: t > 4.1 }); });
      hearts.forEach(function (h, j) {
        var life = ((T * 0.6 + h.ph) % 1), on = t > 1.0 && (t < 4.0 || t > 4.2);
        vis(h.e, on);
        tf(h.e, h.x + Math.sin(life * 6 + j) * 20, 820 - life * 420, 0, 0.8 + life);
        alpha(h.e, Math.sin(life * Math.PI));
      });
      tf(fav, 800, 120, 0, pop(t, 4.4));
      conf(t - 4.2);
      var th = m.headW();
      spk(T, th[0], th[1], seg(t, 4.2, 4.5), 170, 140);
      a.focus = m.headW();
    };
    return a;
  };

  ACTS.outro = function (c) {
    var o = laptopDesk(c, null, 800), m = o.m, g = c.g;
    var win = G(g, 'translate(0 0)');
    P(win, rect(1080, 150, 300, 230));
    var inner = G(win);
    spires(inner, 1230, 380, 0.22);
    P(win, 'M 1230 150 v 230 M 1080 265 h 300', 'l thin');
    var last = TX(g, 800, 180, '', 48, 'b');
    var phd = TX(g, 800, 236, '', 24, 'tm');
    var all = 'To be continued…', d0 = new Date(2025, 9, 1), days = Math.floor((Date.now() - d0) / 864e5) + 1;
    c.cue(2.2, 'tada');
    var a = { dur: 4.2, cam: { x: 800, y: 430, z: 1.05 }, focus: [800, 390] };
    a.update = function (t, T) {
      o.steam(T);
      last.textContent = all.slice(0, Math.round(all.length * seg(t, 1.0, 2.2)));
      phd.textContent = t > 2.2 ? 'now · PhD day ' + days : '';
      var p = o.pose(t, T, t < 1.6 || t > 6 ? 1 : 0);
      if (t > 1.6 && t < 6) { p.look = [0, 0]; p.eyes = t > 2.2 ? 'happy' : 'open'; p.mouth = 'grin'; p.tilt = 0; wave(p, T, seg(t, 1.8, 2.0)); }
      m.set(p, T);
      a.focus = m.headW();
    };
    return a;
  };

  // cartello d'inizio capitolo: anni, sottotitolo, il posto sullo sfondo e il Mii che arriva di corsa
  ACTS.chapter = function (c, it) {
    var g = c.g, ch = it.chapter;
    var cl = clouds(g, 31 + ch.n, 3);
    if (ch.place === 'school') schoolHouse(g, 1190, 700, 0.85);
    else if (ch.place === 'tower') { pisaTower(g, 1200, 700, 0.9); tree(g, 1390, 700, 0.6); }
    else radcam(g, 1200, 700, 0.8);
    ground(g, 700, true);
    var num = TX(g, 470, 236, 'chapter ' + ch.n, 26, 'tm');
    var ttl = tlines(g, 470, 330, [ch.title], 74, 'b');
    var sub = tlines(g, 470, 392, [ch.sub], 28);
    var m = mkMe(g, {}, null), fx = G(g), spk = sparkles(fx, 8, 40 + ch.n);
    c.cue(1.25, 'tada');
    var a = { dur: 2.7, cam: { x: 800, y: 450, z: 1 }, focus: [780, 420] };
    a.update = function (t, T) {
      drift(cl, T);
      alpha(num, seg(t, 0.05, 0.4));
      ttl.type(seg(t, 0.15, 0.85));
      sub.type(seg(t, 0.75, 1.25));
      var p = pose({ x: lerp(-80, 780, eOut(seg(t, 0, 1.1))) });
      if (t < 1.1) walk(p, t * 13, 1 - seg(t, 0.95, 1.1));
      else { cheer(p, T, seg(t, 1.15, 1.3)); p.y = 700 + hop(t, 1.2, 1.6, 50); p.eyes = 'happy'; p.mouth = 'grin'; }
      m.set(p, T);
      var hw = m.headW();
      spk(T, hw[0], hw[1], seg(t, 1.25, 1.5), 130, 100);
      a.focus = hw;
    };
    return a;
  };

  // ---- le gag degli articoli, una per articolo, prima della prima pagina
  // compressione: il Mii schiaccia una matrice grande fino a una striscia sottile (rango basso)
  ACTS.squeeze = function (c, it) {
    var g = c.g;
    wall(g, 640);
    var mat = gridMat(G(g), 6, 6, 40), lab = TX(g, 0, 0, 'X', 40, 'b');
    var res = TX(g, 0, 0, 'X ≈ ZDZᵀ', 40, 'b ta'), low = G(g);
    P(low, rrect(-100, -28, 200, 56, 12), 'l bold acc');
    TX(low, 0, 11, 'low rank!', 30, 'b ta');
    var m = mkMe(g, {}, it), fx = G(g), drop = P(fx, DROP, 'k acc'), spk = sparkles(fx, 7, it.seed);
    c.cue(0.9, 'whoosh'); c.cue(2.0, 'ding'); c.cue(2.2, 'stamp');
    var a = { dur: 3.1, cam: { x: 820, y: 450, z: 1 }, focus: [760, 400] };
    a.update = function (t, T) {
      var k = eIO(seg(t, 0.85, 2.0)), W = 240 * (1 - 0.8 * k), right = 1060, left = right - W, cx = right - W / 2;
      tf(mat, cx, 440, 0, W / 240, 1);
      tf(lab, cx, 300);
      vis(res, t > 2.0);
      tf(res, 860, 220, 0, pop(t, 2.0));
      vis(low, t > 2.2);
      tf(low, 1200, 580, -8, lerp(2.4, 1, eOut(seg(t, 2.2, 2.4))));
      a.shake = t > 2.3 && t < 2.45 ? 0.6 : 0;
      var x = t < 0.85 ? lerp(480, left - 72, eOut(seg(t, 0, 0.85))) : left - 72;
      var p = pose({ x: x, turn: 0.6, look: [1, 0] });
      if (t < 0.85) walk(p, t * 10, 1 - seg(t, 0.7, 0.85));
      else if (t < 2.05) {
        walk(p, t * 7, 0.4);
        p.lean = 8; p.wL = [left - 2, 500]; p.wR = [left - 2, 552]; p.bL = 1; p.bR = 1;
        p.mouth = 'wavy'; p.eyes = 'focus'; p.brow = -0.5; p.browA = 8;
      } else { p.turn = 0; p.look = [0, 0]; p.mouth = 'grin'; p.eyes = 'happy'; wave(p, T, seg(t, 2.1, 2.3)); }
      m.set(p, T);
      var hw = m.headW(), dk = seg(t, 1.2, 1.9);
      tf(drop, hw[0] + 58, hw[1] - 26 + dk * 34, 0, 1.1);
      alpha(drop, dk > 0 && dk < 1 ? Math.min(1, Math.sin(dk * Math.PI) * 2) : 0);
      spk(T, cx, 440, seg(t, 2.0, 2.3), 120, 160);
      a.focus = hw;
    };
    return a;
  };

  // paradosso dell'amicizia: ogni amico ha più amici di lui
  ACTS.friends = function (c, it) {
    var g = c.g, R = rng(it.seed + 7);
    var cl = clouds(g, it.seed, 2);
    ground(g, 700, true);
    var spots = [[520, 610, 0.8], [1080, 610, 0.8], [320, 700, 0.95], [1280, 700, 0.95]], nums = [8, 6, 9, 7];
    var lines = G(g), people = G(g), badges = G(g), fx = G(g), fr = [], me;
    spots.forEach(function (sp, k) {
      if (k === 2) me = mkMe(people, {}, it);
      fr.push({ x: sp[0], y: sp[1], s: sp[2], r: folk(people, R, { hair: STYLES[(k + 1) % STYLES.length] }), n: nums[k], ph: R() * 6 });
    });
    var links = fr.map(function () { return S('path', { d: '', 'class': 'l thin m', pathLength: 1, 'stroke-dasharray': '1 1' }, lines); });
    function badge(n, cls) {
      var b = G(badges);
      C(b, 0, 0, 22, cls || 'k');
      TX(b, 0, 9, String(n), 24, 'b');
      tf(b, 0, 0, 0, 0);
      return b;
    }
    var bf = fr.map(function (f) { return badge(f.n); }), bm = badge(3, 'k acc');
    var msg = tlines(g, 800, 150, ['your friends have more friends', 'than you (on average)'], 32, 'b');
    var drop = P(fx, DROP, 'k acc');
    c.cue(1.0, 'pop'); c.cue(1.25, 'pop'); c.cue(1.5, 'pop'); c.cue(1.75, 'pop'); c.cue(2.05, 'boing'); c.cue(2.9, 'tada');
    var a = { dur: 3.5, cam: { x: 800, y: 450, z: 1 }, focus: [800, 420] };
    a.update = function (t, T) {
      drift(cl, T);
      var p = pose({ x: 800, s: 1.1, mouth: 'smile', look: [0, -0.3] });
      if (t > 2.05 && t < 2.8) { p.eyes = 'wide'; p.mouth = 'o'; p.brow = 1; p.aL = [-58, -70]; p.aR = [58, 70]; p.tilt = 6; }
      if (t >= 2.8) { p.eyes = 'happy'; p.mouth = 'grin'; wave(p, T, seg(t, 2.8, 3.0)); }
      me.set(p, T);
      var mh = me.headW();
      fr.forEach(function (f, k) {
        var q = pose({ x: f.x, y: f.y, s: f.s * Math.max(0.01, pop(t, 0.1 + k * 0.12)), turn: f.x < 800 ? 0.4 : -0.4, look: [f.x < 800 ? 1 : -1, 0] });
        if (t >= 2.8) { q.eyes = 'happy'; q.mouth = 'grin'; wave(q, T + f.ph, seg(t, 2.8, 3.0)); }
        f.r.set(q, T + f.ph);
        var fh = f.r.headW();
        links[k].setAttribute('d', 'M ' + f1(mh[0]) + ' ' + f1(mh[1]) + ' L ' + f1(fh[0]) + ' ' + f1(fh[1]));
        links[k].setAttribute('stroke-dashoffset', (1 - seg(t, 0.4 + k * 0.1, 0.9 + k * 0.1)).toFixed(3));
        tf(bf[k], fh[0], fh[1] - 112 * f.s, 0, pop(t, 1.0 + k * 0.25));
      });
      tf(bm, mh[0], mh[1] - 112 * 1.1, 0, pop(t, 2.0));
      msg.type(seg(t, 2.1, 2.7));
      var dk = seg(t, 2.15, 2.75);
      tf(drop, mh[0] + 62, mh[1] - 20 + dk * 30, 0, 1.1);
      alpha(drop, dk > 0 && dk < 1 ? Math.min(1, Math.sin(dk * Math.PI) * 2) : 0);
      a.focus = mh;
    };
    return a;
  };

  // perturbazioni nello spazio delle matrici isospettrali: la matrice trema, gli autovalori no
  ACTS.wobble = function (c, it) {
    var g = c.g;
    wall(g, 640);
    P(g, rect(240, 380, 330, 170));
    TX(g, 405, 420, 'eigenvalues', 22, 'tm');
    P(g, 'M 270 500 h 270', 'l');
    [300, 360, 450, 510].forEach(function (x) { C(g, x, 500, 9, 'k acc'); });
    var same = G(g);
    P(same, 'M -16 0 l 10 10 l 22 -22', 'l bold acc');
    TX(same, 22, 10, 'same λ!', 26, 'b ta', 'start');
    P(g, 'M 880 520 L 850 700 M 960 520 L 990 700', 'l bold');
    var matG = G(g);
    gridMat(matG, 5, 5, 44);
    var eps = [TX(g, 0, 0, 'ε', 40, 'b ta'), TX(g, 0, 0, 'ε', 40, 'b ta')];
    var m = mkMe(g, {}, it), fx = G(g), spk = sparkles(fx, 6, it.seed);
    var POKES = [0.5, 1.4];
    POKES.forEach(function (p0) { c.cue(p0 + 0.08, 'boing'); });
    c.cue(1.95, 'ding');
    var a = { dur: 2.9, cam: { x: 800, y: 450, z: 1 }, focus: [700, 400] };
    a.update = function (t, T) {
      var sk = 0, sq = 0, jab = 0;
      POKES.forEach(function (p0) {
        var tau = t - p0 - 0.08;
        if (tau > 0) { var e = Math.exp(-4 * tau); sk += 16 * e * Math.sin(18 * tau); sq += 0.06 * e * Math.sin(22 * tau); }
        jab = Math.max(jab, Math.sin(Math.PI * seg(t, p0, p0 + 0.2)));
      });
      matG.setAttribute('transform', 'translate(920 520) skewX(' + f1(sk) + ') scale(' + (1 - sq).toFixed(3) + ' ' + (1 + sq).toFixed(3) + ') translate(0 -110)');
      eps.forEach(function (e, j) { var k = seg(t, POKES[j] + 0.05, POKES[j] + 0.7); vis(e, k > 0 && k < 1); tf(e, 790 - k * 20, 380 - k * 60); alpha(e, 1 - k); });
      vis(same, t > 1.95);
      tf(same, 300, 590, 0, pop(t, 1.95));
      var p = pose({ x: 705, turn: 0.55, look: [1, -0.2], mouth: 'smile' });
      if (t > 0.6 && t < 1.9) { p.eyes = 'wide'; p.mouth = 'o'; }
      if (t >= 1.9) { p.turn = -0.4; p.look = [-1, 0.5]; p.mouth = 'grin'; p.eyes = 'happy'; }
      if (t < 1.9) pointAt(m, p, T, 1, 808, 430, jab); else m.set(p, T);
      spk(T, 405, 500, seg(t, 1.95, 2.2), 150, 50);
      a.focus = m.headW();
    };
    return a;
  };

  // sequenze di problemi agli autovalori: fotografie (snapshot) alle matrici che passano sul nastro
  ACTS.snap = function (c, it) {
    var g = c.g, R = rng(it.seed), k;
    wall(g, 640);
    TX(g, 640, 150, 'snapshots', 24, 'tm');
    P(g, 'M 420 554 L 400 700 M 880 554 L 900 700', 'l bold');
    P(g, rrect(330, 504, 640, 34, 17));
    var belt = S('path', { d: 'M 352 504 L 948 504', 'class': 'l thin', 'stroke-dasharray': '14 18' }, g);
    C(g, 352, 521, 12, 'l thin'); C(g, 948, 521, 12, 'l thin');
    var mats = [], photos = [];
    for (k = 0; k < 3; k++) {
      var rows = [Math.floor(R() * 4), Math.floor(R() * 4)], mg = G(g), ph = G(g);
      gridMat(mg, 4, 4, 22);
      rows.forEach(function (r) { S('rect', { x: -44, y: -44 + r * 22, width: 88, height: 22, 'class': 'hatch' }, mg); });
      TX(mg, 0, -56, 'A(t' + '₁₂₃'.charAt(k) + ')', 18, 'b');
      P(ph, rect(-38, -46, 76, 92));
      var inner = G(ph, 'translate(0 -8) scale(0.62)');
      gridMat(inner, 4, 4, 22);
      rows.forEach(function (r) { S('rect', { x: -44, y: -44 + r * 22, width: 88, height: 22, 'class': 'hatch' }, inner); });
      mats.push(mg); photos.push(ph);
    }
    var m = mkMe(g, {}, it), cam = G(m.arms[1].slot);
    cameraProp(cam);
    var fx = G(g), flash = S('rect', { x: -500, y: -300, width: 2600, height: 1500, 'class': 'pf' }, fx);
    var burst = P(fx, 'M -30 0 L -60 0 M 0 -30 L 0 -60 M 22 -22 L 44 -44 M -22 -22 L -44 -44 M 22 22 L 44 44 M -22 22 L -44 44', 'l acc');
    var SHOT = [1.15, 1.7, 2.25];
    SHOT.forEach(function (s0) { c.cue(s0, 'flash'); });
    c.cue(2.6, 'tada');
    var a = { dur: 3.1, cam: { x: 800, y: 450, z: 1 }, focus: [1180, 400] };
    a.update = function (t, T) {
      belt.setAttribute('stroke-dashoffset', f1(-T * 400));
      var fl = 0, fb = -1;
      mats.forEach(function (mg, j) {
        var x = 300 + (t - 0.55 * j) * 400;
        vis(mg, x > 340 && x < 960);
        tf(mg, x, 460);
        var ph = photos[j];
        vis(ph, t > SHOT[j]);
        tf(ph, 520 + 120 * j, 260, -6 + 6 * j, pop(t, SHOT[j]));
        var age = t - SHOT[j];
        if (age >= 0 && age < 0.25) { fl = Math.max(fl, 0.7 * (1 - age / 0.25)); fb = age; }
      });
      alpha(flash, fl);
      vis(flash, fl > 0.01);
      var p = pose({ x: 1180, turn: -0.5, look: [-1, 0.2], mouth: 'smile', eyes: fl > 0.3 ? 'closed' : 'open', rR: 0, tR: [-16, -58], tL: [-70, -56] });
      if (t > 2.6) { p.turn = 0; p.look = [0, 0]; p.mouth = 'grin'; p.eyes = 'happy'; }
      m.set(p, T);
      var hw = m.handW(1);
      vis(burst, fb >= 0);
      tf(burst, hw[0] - 30 * 1.15, hw[1] - 6, 0, 0.6 + Math.max(0, fb) * 3);
      a.focus = m.headW();
    };
    return a;
  };

  // un atto che si rompe non deve fermare il film: al suo posto la forma della tappa con le onde
  ACTS.fallback = function (c, it) {
    var g = c.g, w = [];
    for (var i = 0; i < 3; i++) w.push(C(g, 800, 420, 80, 'l thin'));
    var m = mkMe(g, {}, it);
    return {
      dur: 3, cam: { x: 800, y: 450, z: 1 }, focus: [800, 400],
      update: function (t, T) {
        w.forEach(function (e, j) { var k = (T * 0.5 + j / 3) % 1; tf(e, 0, 0); e.setAttribute('r', f1(80 + k * 300)); alpha(e, 1 - k); });
        m.set(pose({ mouth: 'smile' }), T);
      }
    };
  };

  // ---------------------------------------------------------------- dalle tappe agli atti
  var SEQS = { exam: ['exam', 'podium'], team: ['team', 'teampodium'] };
  // la gag di ogni articolo, scelta dalle parole del titolo
  function paperGag(it) {
    var s = it.text;
    return /Lyapunov|compression/.test(s) ? 'squeeze' : /Friendship/.test(s) ? 'friends' : /Perturbation/.test(s) ? 'wobble' : /eigenvalue|snapshot/.test(s) ? 'snap' : 'typing';
  }
  function baseName(it) {
    var name = it.toon;
    if (!name) {
      if (it.medal) name = 'exam';
      else if (it.grade) name = 'grad';
      else name = { prize: 'letter', talk: 'talk', paper: 'paper', teach: 'teach', role: 'officer', event: 'school', edu: 'school' }[it.kind] || 'school';
    }
    if (name === 'talk' && /^Poster/.test(it.text)) name = 'poster';
    return name;
  }
  function actsOf(it) {
    var name = baseName(it), ks = (it.map || '').split('>');
    var travel = ks.length === 2 && PLACES[ks[0]] && PLACES[ks[1]] ? ['ride', 'arrive'] : [];
    return travel.concat(name === 'paper' ? [paperGag(it), 'paper'] : SEQS[name] || [name]);
  }
  // key: la data della tappa (con .2, .3 se più tappe hanno la stessa), per i link diretti;
  // nth: quante tappe dello stesso genere vengono prima, per variare le scene che si ripetono
  function parse(lis) {
    var seen = {}, fams = {};
    return [].map.call(lis, function (li, i) {
      function at(k) { return li.getAttribute('data-' + k); }
      var w = li.querySelector('.tl-what'), wh = li.querySelector('.tl-when'), tn = (at('toon') || '').split(':');
      var it = {
        kind: at('k'), from: at('d') || '', when: wh ? wh.textContent : '', text: w ? w.textContent : '',
        toon: tn[0], variant: tn[1] || '', medal: at('medal'), rank: at('rank'), map: at('map'),
        grade: +(at('grade') || 0), of: at('of'), honours: at('honours'), anim: at('anim'), dur: at('dur'),
        year: +(at('d') || '0').slice(0, 4), seed: 17 + i * 7919, hl: li.hasAttribute('data-hl')
      };
      var key = it.from || String(i + 1);
      seen[key] = (seen[key] || 0) + 1;
      it.key = seen[key] > 1 ? key + '.' + seen[key] : key;
      var fam = baseName(it);
      it.nth = fams[fam] = fams[fam] === undefined ? 0 : fams[fam] + 1;
      return it;
    });
  }
  // capitoli: le tappe prima di "until" (confronto fra date scritte AAAA-MM) stanno in quel capitolo
  var CHAPTERS = [
    { until: '2020-09', sub: 'school years & olympiads', short: 'school', place: 'school' },
    { until: '2025-10', sub: 'Pisa · University & Normale', short: 'Pisa', place: 'tower' },
    { until: '~', sub: 'Oxford · PhD', short: 'Oxford', place: 'radcam' }
  ];
  function chapterOf(it) {
    for (var i = 0; i < CHAPTERS.length; i++) if (it.from < CHAPTERS[i].until) return i;
    return CHAPTERS.length - 1;
  }

  // ---------------------------------------------------------------- suoni
  // Tutto sintetizzato con Web Audio (niente file): effetti brevi e una musichetta originale in loop.
  // Parte spento; il bottone ♪ lo accende.
  var Sound = (function () {
    var AC = window.AudioContext || window.webkitAudioContext, ctx = null, out = null, on = false, timer = 0, nextT = 0, step = 0, nbuf = null;
    function init() {
      if (ctx || !AC) return !!ctx;
      try { ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.45; out.connect(ctx.destination); } catch (e) { ctx = null; }
      return !!ctx;
    }
    function tone(f, t0, d, type, v, f2) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + d + 0.03);
    }
    function noise(t0, d, v, type, f, f2) {
      if (!nbuf) {
        nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var a = nbuf.getChannelData(0);
        for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      }
      var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nbuf;
      fl.type = type || 'bandpass';
      fl.frequency.setValueAtTime(f || 1000, t0);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      s.connect(fl); fl.connect(g); g.connect(out);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.03);
    }
    function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    var FX = {
      pop: function (t) { tone(520, t, 0.12, 'sine', 0.35, 1100); },
      ding: function (t) { tone(hz(88), t, 0.9, 'sine', 0.22); tone(hz(95), t + 0.06, 0.7, 'sine', 0.12); },
      tada: function (t) { [72, 76, 79, 84].forEach(function (n, i) { tone(hz(n), t + i * 0.07, 0.45, 'triangle', 0.16); }); },
      clap: function (t) { for (var i = 0; i < 18; i++) noise(t + i * 0.06 + Math.random() * 0.04, 0.05, 0.25, 'bandpass', 1800 + Math.random() * 900); },
      poof: function (t) { noise(t, 0.6, 0.6, 'lowpass', 1600, 120); },
      stamp: function (t) { tone(140, t, 0.18, 'sine', 0.6, 60); noise(t, 0.08, 0.3, 'lowpass', 900); },
      whoosh: function (t) { noise(t, 0.3, 0.14, 'bandpass', 400, 2400); },
      boing: function (t) { tone(180, t, 0.3, 'triangle', 0.3, 420); },
      bell: function (t) { tone(hz(93), t, 0.5, 'sine', 0.18); tone(hz(93), t + 0.16, 0.5, 'sine', 0.15); },
      toot: function (t) { tone(hz(69), t, 0.35, 'square', 0.07); tone(hz(64), t + 0.36, 0.45, 'square', 0.07); },
      tick: function (t) { noise(t, 0.03, 0.2, 'highpass', 3000); },
      flash: function (t) { noise(t, 0.12, 0.3, 'highpass', 2500); tone(1800, t, 0.15, 'sine', 0.1, 900); }
    };
    // la melodia gira su I-vi-IV-V in do maggiore, a crome; basso a semiminime e charleston leggero
    var MEL = [79, 0, 76, 79, 81, 0, 79, 76, 74, 76, 79, 0, 76, 0, 0, 0, 79, 0, 76, 79, 84, 0, 83, 81, 79, 81, 79, 76, 74, 0, 0, 0];
    var BASS = [48, 45, 41, 43], BEAT = 60 / 112 / 2;
    function schedule() {
      while (nextT < ctx.currentTime + 0.25) {
        var s = step % 32, bar = Math.floor(s / 8);
        if (MEL[s]) tone(hz(MEL[s]), nextT, BEAT * 1.6, 'triangle', 0.06);
        if (s % 2 === 0) tone(hz(BASS[bar] + (s % 4 === 2 ? 7 : 0)), nextT, BEAT * 1.8, 'sine', 0.09);
        else noise(nextT, 0.04, 0.04, 'highpass', 6000);
        nextT += BEAT;
        step++;
      }
    }
    return {
      on: function () { return on; },
      set: function (v) {
        if (v && !init()) return false;
        on = v;
        if (on) {
          if (ctx.state === 'suspended') ctx.resume();
          nextT = ctx.currentTime + 0.05;
          if (!timer) timer = setInterval(schedule, 90);
        } else if (timer) { clearInterval(timer); timer = 0; }
        return on;
      },
      fx: function (name) { if (on && ctx && FX[name]) { try { FX[name](ctx.currentTime + 0.01); } catch (e) {} } },
      pause: function (p) { if (!ctx) return; if (p) ctx.suspend(); else if (on) ctx.resume(); },
      stop: function () {
        if (timer) clearInterval(timer);
        timer = 0; on = false;
        if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; nbuf = null; }
      }
    };
  })();

  // statistiche: un evento su GoatCounter, se la pagina lo carica (sul sito sì, in locale no)
  function stat(name) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'timeline-film-' + name, title: 'Timeline film: ' + name, event: true }); } catch (e) {}
  }

  // ---------------------------------------------------------------- stile
  // contorni blu notte su carta; bottoni e riquadri alla maniera dei menu della Wii (bianchi, bordi azzurri, arrotondati)
  var CSS = [
    '.tlt{--ink:#012a4a;--paper:#fdfbf6;--hair:#012a4a;--fav:#002147;--acc:#0b47d1;--mute:#93a0ad;--gold:#f2cf6b;--silver:#d6dde5;--bronze:#e0ae7c;',
    '--red:#d9534f;--grn:#3c9a5f;--wii:#34bdeb;--wii2:#bde7f7;--panel:#ffffff;--cap:rgba(255,255,255,.88);',
    'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;overflow:hidden;background:var(--paper);color:var(--ink);',
    "font-family:'Courier New',Courier,monospace;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}",
    '.tlt.tlt-dark{--ink:#e2e8ef;--paper:#12161b;--hair:#3d4a58;--fav:#2f5d95;--acc:#86a9ff;--mute:#6c7781;--gold:#b8963c;--silver:#7f8a96;--bronze:#9c6a3c;',
    '--red:#b24a43;--grn:#2f7d4c;--wii:#3aa7d6;--wii2:#244a5c;--panel:#1a2027;--cap:rgba(26,32,39,.88)}',
    '.tlt svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;overflow:hidden}',
    '.tlt-stage{cursor:pointer;touch-action:none}',
    '.tlt-iris,.tlt-vids,.tlt-year{pointer-events:none}',
    '.tlt-iris path{fill:var(--ink)}.tlt-dark .tlt-iris path{fill:#000}',
    '.tlt .k{fill:var(--paper);stroke:var(--ink);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}',
    '.tlt .l{fill:none;stroke:var(--ink);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}',
    '.tlt .thin{stroke-width:2.2}.tlt .bold{stroke-width:5.5}.tlt .xb{stroke-width:9}',
    '.tlt .f{fill:var(--ink);stroke:none}.tlt .pf{fill:var(--paper);stroke:none}',
    '.tlt .hair{fill:var(--hair);stroke:var(--ink);stroke-width:3.5;stroke-linejoin:round}',
    '.tlt .shine{fill:none;stroke:var(--paper);stroke-width:3.5;stroke-linecap:round;opacity:.55}.tlt .glint{opacity:.5}',
    '.tlt .acc{stroke:var(--acc)}.tlt .af{fill:var(--acc);stroke:none}.tlt .m{stroke:var(--mute)}',
    '.tlt .gold{fill:var(--gold)}.tlt .silver{fill:var(--silver)}.tlt .bronze{fill:var(--bronze)}.tlt .hatch{fill:url(#tlt-hatch)}',
    '.tlt .red{fill:var(--red)}.tlt .grn{fill:var(--grn)}.tlt .spk{fill:var(--gold);stroke:none}',
    '.tlt .fav{fill:var(--fav)}.tlt .tube-f.favs{stroke:var(--fav)}.tlt .lt{stroke:var(--paper)}',
    '.tlt .tlt-hl{stroke:var(--acc);stroke-width:3}',
    '.tlt .tube-o{fill:none;stroke:var(--ink);stroke-linecap:round;stroke-linejoin:round}',
    '.tlt .tube-f{fill:none;stroke:var(--paper);stroke-linecap:round;stroke-linejoin:round}',
    ".tlt .tx{fill:var(--ink);stroke:none;font-family:'Courier New',Courier,monospace}",
    '.tlt .tx.b{font-weight:bold}.tlt .tx.ta{fill:var(--acc)}.tlt .tx.tm{fill:var(--mute)}',
    '.tlt .tx.out{fill:none;stroke:var(--mute);stroke-width:2.5}',
    '.tlt .dash{stroke-dasharray:3 12}',
    '.tlt-vids{position:absolute;left:0;top:0;width:100%;height:100%}',
    '.tlt-vid{position:absolute;object-fit:contain;background:#fff;display:none}',
    '.tlt-dark .tlt-vid{filter:invert(1) hue-rotate(180deg)}',
    '.tlt-year{position:absolute;left:18px;top:4px;font-size:clamp(54px,10vw,150px);font-weight:bold;line-height:1;color:transparent;',
    '-webkit-text-stroke:2px var(--ink);opacity:.13;letter-spacing:-.02em}',
    '.tlt-top{position:absolute;top:14px;right:14px;display:flex;gap:8px;z-index:3}',
    '.tlt-b,.tlt-mb{font:inherit;color:var(--ink);background:var(--panel);border:2px solid var(--wii2);cursor:pointer;',
    'box-shadow:0 3px 0 var(--wii2),0 6px 14px rgba(0,40,70,.10);transition:transform .15s,border-color .15s,background .15s;text-decoration:none}',
    '.tlt-b{min-width:42px;height:42px;padding:0 10px;border-radius:999px;font-size:16px;line-height:1}',
    '.tlt-b:hover,.tlt-b:focus-visible,.tlt-mb:hover,.tlt-mb:focus-visible{border-color:var(--wii);outline:none;transform:translateY(-2px)}',
    '.tlt-b.on{background:var(--wii);border-color:var(--wii);color:#fff}',
    '.tlt-menu{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:18px;z-index:3}',
    '.tlt-menu[hidden]{display:none}',
    '.tlt-mb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:220px;padding:14px 24px;border-radius:24px;border-width:3px}',
    '.tlt-mb b{font-size:20px}.tlt-mb span{font-size:13px;color:var(--mute)}',
    '.tlt-mb.sm{min-width:0;padding:10px 18px;border-radius:999px;font-size:15px;font-weight:bold}',
    '.tlt-endp{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:none;flex-wrap:wrap;justify-content:center;gap:12px;z-index:3;width:min(760px,calc(100% - 28px))}',
    '.tlt-ended .tlt-endp{display:flex}',
    '.tlt-toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);padding:.45em 1.1em;border-radius:999px;background:var(--wii);color:#fff;',
    'font-weight:bold;opacity:0;transition:opacity .3s;z-index:4;pointer-events:none;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tlt-toast.on{opacity:1}',
    '.tlt-cap{position:absolute;left:50%;bottom:50px;transform:translateX(-50%);width:min(920px,calc(100% - 28px));box-sizing:border-box;',
    'padding:.5rem .9rem;border-radius:18px;background:var(--cap);border:2px solid var(--wii2);text-align:center;font-size:clamp(13px,1.5vw,18px);line-height:1.45;z-index:2}',
    '.tlt-when{margin-right:.5em}',
    '.tlt-prog{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(1000px,calc(100% - 28px));height:28px;z-index:2}',
    '.tlt:not(.tlt-going) .tlt-prog{visibility:hidden}',
    '.tlt-line,.tlt-fill{position:absolute;left:0;top:13px;height:3px;border-radius:2px}',
    '.tlt-line{right:0;background:var(--wii2)}.tlt-fill{width:0;background:var(--wii)}',
    '.tlt-mk{position:absolute;top:14px;width:16px;height:26px;margin:-13px 0 0 -8px;padding:0;border:0;background:none;cursor:pointer}',
    '.tlt-mk i{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;background:var(--ink);opacity:.45;box-sizing:border-box;transition:transform .2s,opacity .2s}',
    '.tlt-mk i[data-k="edu"]{border-radius:50%}',
    '.tlt-mk i[data-k="paper"]{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);width:10px;height:10px;margin:-5px 0 0 -5px}',
    '.tlt-mk i[data-k="talk"]{clip-path:polygon(50% 0,100% 100%,0 100%);width:10px;height:9px;margin:-5px 0 0 -5px}',
    '.tlt-mk i[data-k="teach"]{background:none;border:2px solid var(--ink);border-radius:50%}',
    '.tlt-mk i[data-k="prize"]{clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);width:12px;height:12px;margin:-6px 0 0 -6px}',
    '.tlt-mk i[data-k="event"]{background:none;border:2px solid var(--ink)}',
    '.tlt-mk.past i{opacity:.9}.tlt-mk.cur i{transform:scale(1.8);opacity:1;background:var(--acc)}',
    '.tlt-mk.cur i[data-k="teach"],.tlt-mk.cur i[data-k="event"]{background:none;border-color:var(--acc)}',
    '.tlt-mk:focus-visible,.tlt-ch:focus-visible{outline:2px solid var(--acc);border-radius:4px}',
    '.tlt-ch{position:absolute;top:-10px;transform:translateX(-50%);padding:0 4px;border:0;background:none;color:var(--mute);font:inherit;font-size:11px;font-weight:bold;white-space:nowrap;cursor:pointer}',
    '.tlt-ch::after{content:"";position:absolute;left:50%;top:20px;width:2px;height:12px;margin-left:-1px;background:var(--mute)}',
    '.tlt-ch.cur{color:var(--acc)}',
    '@media (max-width:600px){.tlt-b{min-width:34px;height:34px;font-size:13px;padding:0 6px}.tlt-cap{bottom:44px}.tlt-top{top:10px;right:10px;gap:5px}',
    '.tlt-menu{flex-direction:column;gap:10px;bottom:104px}.tlt-mb{min-width:200px;padding:10px 18px}.tlt-endp{bottom:104px;gap:8px}}'
  ].join('');
  function injectCSS() {
    var st = document.getElementById('tlt-css');
    if (!st) { st = document.createElement('style'); st.id = 'tlt-css'; document.head.appendChild(st); }
    st.textContent = CSS;
  }
  function isDark() {
    var a = document.body.getAttribute('a');
    return a === 'dark' || (a === 'auto' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // ---------------------------------------------------------------- il proiettore
  // La sequenza: apertura (con il menu "highlights" o "the full story"), per ogni capitolo un cartello e le sue
  // tappe, chiusura con i bottoni finali. opt: onClose(indice della tappa, azione), key (link diretto: data della
  // tappa o nome della scena), item (per lo sviluppo: numero della tappa), t, paused.
  function open(ov, lis, opt) {
    opt = opt || {};
    injectCSS();
    var IRIS = REDUCED ? 0 : 0.42, WIPE = REDUCED ? 0 : 0.3, WHIP = REDUCED ? 0 : 0.42, TEMPO = 1.15, MENU_WAIT = 7;
    var items = parse(lis), n = items.length, now = new Date();
    var touch = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var chaps = CHAPTERS.map(function (ch, i) {
      var its = items.filter(function (it) { return chapterOf(it) === i; });
      var y0 = its.length ? its[0].year : now.getFullYear(), y1 = its.length ? its[its.length - 1].year : y0;
      return { n: i + 1, sub: ch.sub, short: ch.short, place: ch.place, title: y0 + ' – ' + (i === CHAPTERS.length - 1 ? 'now' : y1), year: y0 };
    });
    function picks(md) { var l = md === 'full' ? items : items.filter(function (it) { return it.hl; }); return l.length ? l : items; }
    function makeSeq(md) {
      var s = [{ intro: true, year: items[0].year }], last = -1;
      picks(md).forEach(function (it) {
        var c = chapterOf(it);
        if (c !== last) { s.push({ chapter: chaps[c], year: it.year }); last = c; }
        s.push(it);
      });
      s.push({ outro: true, year: now.getFullYear() });
      return s;
    }
    function minutes(md) {
      var sec = (picks(md).length * 6.8 + CHAPTERS.length * 2.7 + 8) / TEMPO;
      return '≈ ' + Math.max(1, Math.round(sec / 60)) + ' min';
    }
    var mode = null, seq = makeSeq('full');

    ov.removeAttribute('style');
    ov.className = 'tlt' + (isDark() ? ' tlt-dark' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Timeline, the animated version');
    ov.innerHTML =
      '<svg class="tlt-stage" aria-hidden="true"><defs><pattern id="tlt-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line class="tlt-hl" x1="0" y1="0" x2="0" y2="9"/></pattern></defs><g class="tlt-world"></g></svg>' +
      '<div class="tlt-vids"></div><svg class="tlt-iris" aria-hidden="true"><path fill-rule="evenodd" d=""/></svg>' +
      '<div class="tlt-year" aria-hidden="true"></div>' +
      '<div class="tlt-top"><button type="button" class="tlt-b tlt-prev" aria-label="Previous" title="previous (←)">‹</button>' +
      '<button type="button" class="tlt-b tlt-pp" aria-label="Pause" title="pause (space)">❚❚</button>' +
      '<button type="button" class="tlt-b tlt-next" aria-label="Next" title="next (→)">›</button>' +
      '<button type="button" class="tlt-b tlt-sp" aria-label="Speed" title="speed">1×</button>' +
      '<button type="button" class="tlt-b tlt-snd" aria-label="Sound" aria-pressed="false" title="sound">♪</button>' +
      '<button type="button" class="tlt-b tlt-lnk" aria-label="Copy a link to this moment" title="copy a link to this moment">🔗</button>' +
      '<button type="button" class="tlt-b tlt-x" aria-label="Close" title="close (esc)">×</button></div>' +
      '<div class="tlt-menu" hidden><button type="button" class="tlt-mb" data-m="short"><b>▶ highlights</b><span></span></button>' +
      '<button type="button" class="tlt-mb" data-m="full"><b>▶ the full story</b><span></span></button></div>' +
      '<div class="tlt-endp"></div><div class="tlt-toast" role="status"></div>' +
      '<div class="tlt-cap" aria-live="polite"><b class="tlt-when"></b><span class="tlt-what"></span></div>' +
      '<div class="tlt-prog"><span class="tlt-line"></span><span class="tlt-fill"></span></div>';
    function q(s) { return ov.querySelector(s); }
    var stage = q('.tlt-stage'), world = q('.tlt-world'), vids = q('.tlt-vids'), iris = q('.tlt-iris'), irisP = iris.querySelector('path');
    var yearEl = q('.tlt-year'), whenEl = q('.tlt-when'), whatEl = q('.tlt-what'), fillEl = q('.tlt-fill'), progEl = q('.tlt-prog');
    var ppBtn = q('.tlt-pp'), spBtn = q('.tlt-sp'), sndBtn = q('.tlt-snd'), menuEl = q('.tlt-menu'), endp = q('.tlt-endp'), toastEl = q('.tlt-toast');
    [].forEach.call(menuEl.querySelectorAll('.tlt-mb'), function (b) {
      b.querySelector('span').textContent = minutes(b.getAttribute('data-m'));
      b.addEventListener('click', function () { choose(b.getAttribute('data-m')); });
    });

    // bottoni finali: di nuovo, gli articoli (si apre la sezione della home), email e Google Scholar presi dalla pagina
    function endBtn(label, fn, href) {
      var b = document.createElement(href ? 'a' : 'button');
      b.className = 'tlt-mb sm';
      if (href) { b.setAttribute('href', href); if (!/^mailto:/.test(href)) { b.target = '_blank'; b.rel = 'noopener'; } } else b.type = 'button';
      b.textContent = label;
      if (fn) b.addEventListener('click', fn);
      endp.appendChild(b);
      return b;
    }
    var mail = document.querySelector('a[href^="mailto:"]'), scholar = document.querySelector('a[href*="scholar.google"]');
    var againBtn = endBtn('↺ watch again', function () { replay(); });
    endBtn('papers', function () { close('papers'); });
    if (mail) endBtn('email', null, mail.getAttribute('href'));
    if (scholar) endBtn('Google Scholar', null, scholar.getAttribute('href'));
    endBtn('close', function () { close(); });

    var marks = [];
    function buildMarks() {
      marks.forEach(function (mk) { if (mk) mk.parentNode.removeChild(mk); });
      marks = seq.map(function (it, i) {
        if (it.intro || it.outro) return null;
        var b = document.createElement('button');
        b.type = 'button';
        b.style.left = ((i + 0.5) / seq.length * 100).toFixed(3) + '%';
        if (it.chapter) {
          b.className = 'tlt-ch';
          b.textContent = it.chapter.short;
          b.setAttribute('aria-label', 'Chapter ' + it.chapter.n + ': ' + it.chapter.sub);
        } else {
          b.className = 'tlt-mk';
          b.setAttribute('aria-label', it.when + ': ' + it.text);
          b.innerHTML = '<i data-k="' + it.kind + '"></i>';
        }
        b.addEventListener('click', function () { go(i); });
        progEl.appendChild(b);
        return b;
      });
    }

    var VB = { x: 0, y: 0, w: 1600, h: 900 }, portrait = false;
    function layout() {
      var W = ov.clientWidth || window.innerWidth || 1600, H = ov.clientHeight || window.innerHeight || 900, A = W / H, w, h;
      portrait = A < 1;
      // in verticale l'inquadratura si stringe sul personaggio, che la camera segue
      if (A >= 1.28) { h = 900; w = 900 * A; } else if (!portrait) { w = 1150; h = 1150 / A; } else { w = 780; h = 780 / A; }
      VB = { x: 800 - w / 2, y: 450 - h / 2, w: w, h: h };
      var vb = f1(VB.x) + ' ' + f1(VB.y) + ' ' + f1(w) + ' ' + f1(h);
      stage.setAttribute('viewBox', vb);
      iris.setAttribute('viewBox', vb);
      if (cur) render();
    }

    var cur = null, k = 0, t = 0, Tg = 0, paused = false, speed = 1, raf = 0, last = 0, closed = false, capText = '', look = null, ended = false, menuFocused = false;
    function safe(fn) {
      var broken = false;
      return function (a, b) {
        if (broken) return;
        try { fn(a, b); } catch (e) { broken = true; if (window.console) console.error(e); }
      };
    }
    // il passaggio fra due voci: il cerchio dei vecchi cartoni quando cambia l'anno o il capitolo, altrimenti una tendina
    function trans(a, b) {
      if (!a || !b || a.intro || b.chapter || b.outro) return 'iris';
      if (a.chapter) return 'wipe';
      return a.year === b.year ? 'wipe' : 'iris';
    }
    function build(idx) {
      k = idx; t = 0; ended = false;
      ov.classList.remove('tlt-ended');
      world.textContent = '';
      vids.textContent = '';
      var it = seq[idx], names = it.intro ? ['intro'] : it.outro ? ['outro'] : it.chapter ? ['chapter'] : actsOf(it), acts = [], t0 = 0, cues = [];
      cur = { acts: acts, total: 0, ai: -1, videos: [], it: it, cues: cues, tin: trans(seq[idx - 1], it), tout: trans(it, seq[idx + 1]) };
      names.forEach(function (nm, j) {
        var g = G(world), ox = j * 2400, a, base = t0;
        tf(g, ox, 0);
        var c = { g: g, ox: ox, video: function (src, el) { addVideo(src, el, j); }, cue: function (tt, name) { cues.push([base + tt, name]); } };
        try { a = (ACTS[nm] || ACTS.fallback)(c, it); } catch (e) {
          if (window.console) console.error(e);
          g.textContent = '';
          a = ACTS.fallback(c, it);
        }
        a.update = safe(a.update);
        a.t0 = t0; a.ox = ox; a.j = j;
        if (!a.cam) a.cam = { x: 800, y: 450, z: 1 };
        a.update(0, Tg);
        if (j) cues.push([t0, 'whoosh']);
        t0 += a.dur;
        acts.push(a);
      });
      cur.total = t0;
      if (cur.tout === 'wipe' && !it.outro) cues.push([t0 - WIPE, 'whoosh']);
      yearEl.textContent = it.intro ? '' : String(it.chapter ? it.chapter.year : it.year);
      if (it.intro) { whenEl.textContent = ''; capText = mode ? 'here we go!' : touch ? 'choose how to watch · tap to pause · swipe to skip' : 'choose how to watch · space to pause · ← → to skip · esc to close'; }
      else if (it.outro) { whenEl.textContent = 'now'; capText = 'thanks for watching!'; }
      else if (it.chapter) { whenEl.textContent = 'chapter ' + it.chapter.n; capText = it.chapter.title + ' · ' + it.chapter.sub; }
      else { whenEl.textContent = it.when; capText = it.text; }
      whatEl.textContent = '';
      marks.forEach(function (mk, i) {
        if (!mk) return;
        mk.classList.toggle('cur', i === idx);
        mk.classList.toggle('past', i < idx || !!it.outro);
      });
    }
    function addVideo(src, el, j) {
      var v = document.createElement('video');
      v.className = 'tlt-vid';
      v.src = src;
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('aria-hidden', 'true');
      v.preload = 'auto';
      vids.appendChild(v);
      cur.videos.push({ v: v, el: el, j: j, on: false });
    }
    function holding() { return cur.it.intro && !mode; }
    function drawMask(mk, a, cx, cy, cz) {
      if (!mk || mk.k >= 1) { irisP.setAttribute('d', ''); return; }
      if (mk.kind === 'wipe') {
        // tendina inclinata che passa da sinistra a destra: prima copre, poi scopre
        var W = VB.w + 240, L = mk.out ? VB.x - 120 : VB.x - 120 + mk.k * W, Rr = mk.out ? VB.x - 120 + (1 - mk.k) * W : VB.x + VB.w + 120;
        var y0 = VB.y - 10, y1 = VB.y + VB.h + 10;
        irisP.setAttribute('d', 'M' + f1(L + 60) + ' ' + f1(y0) + ' L' + f1(Rr + 60) + ' ' + f1(y0) + ' L' + f1(Rr - 60) + ' ' + f1(y1) + ' L' + f1(L - 60) + ' ' + f1(y1) + ' Z');
        return;
      }
      var fc = a.focus || [800, 400], fx = (fc[0] + a.ox - cx) * cz + 800, fy = (fc[1] - cy) * cz + 450, R = Math.max(0.1, Math.hypot(VB.w, VB.h) * mk.k);
      irisP.setAttribute('d', 'M' + f1(VB.x - 10) + ' ' + f1(VB.y - 10) + ' h' + f1(VB.w + 20) + ' v' + f1(VB.h + 20) + ' h' + f1(-VB.w - 20) + ' Z M' +
        f1(fx - R) + ' ' + f1(fy) + ' a' + f1(R) + ' ' + f1(R) + ' 0 1 0 ' + f1(2 * R) + ' 0 a' + f1(R) + ' ' + f1(R) + ' 0 1 0 ' + f1(-2 * R) + ' 0 Z');
    }
    function render() {
      var acts = cur.acts, ai = 0, hold = holding();
      while (ai < acts.length - 1 && t >= acts[ai + 1].t0) ai++;
      if (ai !== cur.ai) {
        // gli atti già passati restano fermi sul loro ultimo fotogramma (anche dopo un salto)
        for (var j = Math.max(0, cur.ai); j < ai; j++) acts[j].update(acts[j].dur, Tg);
        cur.ai = ai;
      }
      var a = acts[ai], lt = t - a.t0;
      a.update(cur.it.outro || hold ? lt : Math.min(lt, a.dur), Tg);
      var cx = a.cam.x + a.ox, cy = a.cam.y, cz = a.cam.z || 1;
      if (ai > 0 && lt < WHIP) {
        var pa = acts[ai - 1], qq = eIO(lt / WHIP);
        cx = lerp(pa.cam.x + pa.ox, cx, qq); cy = lerp(pa.cam.y, cy, qq); cz = lerp(pa.cam.z || 1, cz, qq);
      }
      if (portrait && a.focus) cx = lerp(cx, a.focus[0] + a.ox, 0.65);
      if (a.shake && !REDUCED && !paused) { cx += (Math.random() - 0.5) * 14 * a.shake; cy += (Math.random() - 0.5) * 14 * a.shake; }
      if (look) { cx = look[0] + a.ox; cy = look[1]; cz = look[2]; }
      world.setAttribute('transform', 'translate(800 450) scale(' + cz.toFixed(4) + ') translate(' + f1(-cx) + ' ' + f1(-cy) + ')');
      var mk = null;
      if (!REDUCED) {
        var dIn = cur.tin === 'wipe' ? WIPE : IRIS, dOut = cur.tout === 'wipe' ? WIPE : IRIS;
        if (t < dIn) mk = { kind: cur.tin, k: eOut(t / dIn), out: false };
        if (!cur.it.outro && !hold && cur.total - t < dOut) mk = { kind: cur.tout, k: eIn(Math.max(0, cur.total - t) / dOut), out: true };
      }
      drawMask(mk, a, cx, cy, cz);
      if (cur.videos.length) {
        var orc = ov.getBoundingClientRect();
        cur.videos.forEach(function (vd) {
          var on = vd.j === ai || (vd.j === ai - 1 && lt < WHIP);
          vd.v.style.display = on ? 'block' : 'none';
          if (on) {
            var r = vd.el.getBoundingClientRect();
            vd.v.style.left = (r.left - orc.left) + 'px'; vd.v.style.top = (r.top - orc.top) + 'px';
            vd.v.style.width = r.width + 'px'; vd.v.style.height = r.height + 'px';
          }
          var play = on && vd.j === ai && !paused;
          if (play !== vd.on) {
            vd.on = play;
            if (play && !REDUCED) { var pr = vd.v.play(); if (pr && pr.catch) pr.catch(function () {}); } else vd.v.pause();
          }
        });
      }
      var n1 = Math.round(capText.length * seg(t, 0.05, 0.75));
      if (whatEl.textContent.length !== n1) whatEl.textContent = capText.slice(0, n1);
      var showMenu = hold && t > 1.7;
      if (menuEl.hidden === showMenu) menuEl.hidden = !showMenu;
      if (showMenu && !menuFocused) { menuFocused = true; menuEl.querySelector('.tlt-mb').focus({ preventScroll: true }); }
      fillEl.style.width = (mode ? (k + Math.min(1, t / cur.total)) / seq.length * 100 : 0).toFixed(2) + '%';
    }
    function fireCues(a, b) {
      if (!Sound.on()) return;
      cur.cues.forEach(function (c) { if (c[0] > a && c[0] <= b) Sound.fx(c[1]); });
    }
    function frame(ts) {
      raf = 0;
      if (closed) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0, t1 = t;
      last = ts;
      if (!paused) {
        t += dt * speed * TEMPO; Tg += dt * speed * TEMPO;
        fireCues(t1, t);
        if (holding()) { if (t >= cur.total + MENU_WAIT) choose('short'); }
        else if (t >= cur.total && !cur.it.outro) build(k + 1);
        else if (cur.it.outro && t >= cur.total && !ended) {
          ended = true;
          ov.classList.add('tlt-ended');
          againBtn.focus({ preventScroll: true });
          stat('finished-' + mode);
        }
      }
      render();
      if (!paused) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (closed) return;
      if (paused) { render(); return; }
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    }
    function go(idx) { build(Math.max(0, Math.min(seq.length - 1, idx))); kick(); }
    function next() { if (holding()) choose('short'); else go(k + 1); }
    function prev() { if (!holding()) go(t > 1.5 ? k : k - 1); }
    function choose(md) {
      if (mode) return;
      mode = md;
      seq = makeSeq(md);
      buildMarks();
      menuEl.hidden = true;
      ov.classList.add('tlt-going');
      stat(md === 'full' ? 'full' : 'highlights');
      go(1);
    }
    function replay() {
      mode = null;
      menuFocused = false;
      seq = makeSeq('full');
      buildMarks();
      ov.classList.remove('tlt-going');
      go(0);
    }
    function setPaused(v) {
      paused = v;
      ppBtn.textContent = paused ? '▶' : '❚❚';
      ppBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
      Sound.pause(paused);
      kick();
    }
    var toastTimer = 0;
    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1900);
    }
    // link diretto al momento in corso: …/#film=<data della tappa>, oppure #film per il film dall'inizio
    function share() {
      var it = cur && cur.it, url = location.href.split('#')[0] + '#film' + (it && it.key ? '=' + it.key : '');
      function ok() { toast('link copied'); stat('link-copied'); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        ov.appendChild(ta);
        ta.select();
        try { if (document.execCommand('copy')) ok(); else toast(url); } catch (e) { toast(url); }
        ov.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, fallback); else fallback();
    }
    q('.tlt-prev').addEventListener('click', prev);
    q('.tlt-next').addEventListener('click', next);
    ppBtn.addEventListener('click', function () { setPaused(!paused); });
    spBtn.addEventListener('click', function () {
      speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
      spBtn.textContent = speed + '×';
    });
    sndBtn.addEventListener('click', function () {
      var on = Sound.set(!Sound.on());
      sndBtn.classList.toggle('on', on);
      sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && paused) Sound.pause(true);
      if (on) Sound.fx('pop');
    });
    q('.tlt-lnk').addEventListener('click', share);
    q('.tlt-x').addEventListener('click', function () { close(); });
    var px0 = null, py0 = 0;
    stage.addEventListener('pointerdown', function (e) { px0 = e.clientX; py0 = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (px0 === null) return;
      var dx = e.clientX - px0, dy = e.clientY - py0;
      px0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
      else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) setPaused(!paused);
    });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); setPaused(!paused); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    }
    var wasFs = false;
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
    function onFs() {
      if (fsEl() === ov) {
        wasFs = true;
        if (touch && screen.orientation && screen.orientation.lock) { try { var pr = screen.orientation.lock('landscape'); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
        layout();
      } else if (wasFs) { wasFs = false; close(); }
    }
    // la tappa più vicina a dove si è arrivati, per fermarci la timeline quando si chiude
    function itemIndex() {
      for (var i = k; i >= 0; i--) { var e = seq[i]; if (e && !e.intro && !e.outro && !e.chapter) return items.indexOf(e); }
      return 0;
    }
    var prevOverflow = document.documentElement.style.overflow;
    function close(action) {
      if (closed) return;
      closed = true;
      if (raf) cancelAnimationFrame(raf);
      Sound.stop();
      clearTimeout(toastTimer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      window.removeEventListener('resize', layout);
      [].forEach.call(vids.querySelectorAll('video'), function (v) { v.pause(); });
      if (fsEl() === ov) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { try { var pr = ex.call(document); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      }
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      document.documentElement.style.overflow = prevOverflow;
      if (opt.onClose) opt.onClose(itemIndex(), action);
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    window.addEventListener('resize', layout);
    document.documentElement.style.overflow = 'hidden';
    layout();
    onFs();

    // da dove partire: dal menu, oppure (link diretto o sviluppo) dalla tappa chiesta, nella versione completa
    var startIdx = 0, target = null;
    if (opt.key) target = items.filter(function (it) { return it.key === opt.key || it.toon === opt.key; })[0] || (/^\d+$/.test(opt.key) ? items[+opt.key - 1] : null);
    if (opt.item) target = opt.item > n ? 'outro' : items[opt.item - 1];
    if (target) {
      mode = 'full';
      seq = makeSeq('full');
      startIdx = target === 'outro' ? seq.length - 1 : Math.max(1, seq.indexOf(target));
      ov.classList.add('tlt-going');
      if (opt.key) stat('deep-link');
    } else if (!opt.item && opt.item !== 0) stat('open');
    buildMarks();
    build(startIdx);
    if (opt.t) { t = opt.t; Tg = opt.t; }
    setPaused(!!opt.paused);
    if (!holding()) ppBtn.focus({ preventScroll: true });
    return {
      close: close, next: next, prev: prev, choose: choose,
      pause: function (v) { setPaused(v === undefined ? true : !!v); },
      // per lo sviluppo: seek(i, t) va alla voce i della sequenza; item(n, t) alla tappa n nella versione completa
      seek: function (idx, tt) { build(idx); t = tt || 0; Tg = t; render(); },
      item: function (nn, tt) {
        if (!(nn >= 1)) { replay(); t = tt || 0; Tg = t; render(); return; }
        if (mode !== 'full') { mode = 'full'; seq = makeSeq('full'); buildMarks(); ov.classList.add('tlt-going'); }
        build(nn > n ? seq.length - 1 : seq.indexOf(items[nn - 1]));
        t = tt || 0; Tg = t; render();
      },
      // per lo sviluppo: camera fissa su (x, y) con zoom z; senza argomenti torna quella delle scene
      look: function (x, y, z) { look = x === undefined ? null : [x, y, z || 2]; render(); },
      seq: function () { return seq.length; }
    };
  }

  window.TLToon = { open: open };
})();
