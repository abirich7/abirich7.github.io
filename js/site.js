// site.js: menu, active nav, reveal on scroll, video player dialog, "show all edits", copy email,
// and the Yogic Insights chart. One small script, no libraries, no network requests.
// Loaded as a classic deferred script (not type="module") so the page also works opened from disk:
// browsers block module scripts on file:// pages.
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var on = function (t, e, f, o) { if (t) t.addEventListener(e, f, o); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: border on scroll, active section in the nav ---------- */
  var header = $('#site-header');
  var setScrolled = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
  setScrolled();
  on(window, 'scroll', setScrolled, { passive: true });

  var navLinks = $$('.nav a[data-nav]');
  if ('IntersectionObserver' in window && navLinks.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.dataset.nav === en.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['top', 'channels', 'work', 'experience', 'contact'].forEach(function (id) {
      var s = doc.getElementById(id);
      if (s) navIO.observe(s);
    });
  }

  /* ---------- Mobile menu (a <details> element) ---------- */
  var mnav = $('.mnav');
  if (mnav) {
    var summary = $('summary', mnav);
    $$('.mnav__panel a', mnav).forEach(function (a) { on(a, 'click', function () { mnav.open = false; }); });
    on(doc, 'keydown', function (e) {
      if (e.key === 'Escape' && mnav.open) { mnav.open = false; summary.focus(); }
    });
    on(doc, 'click', function (e) { if (mnav.open && !mnav.contains(e.target)) mnav.open = false; });
    // Close the menu when keyboard focus leaves it, so the fixed panel never hides the focused element.
    on(mnav, 'focusout', function (e) { if (mnav.open && e.relatedTarget && !mnav.contains(e.relatedTarget)) mnav.open = false; });
  }

  /* ---------- Reveal on scroll (skipped when the reader prefers less motion) ---------- */
  // Only items that are fully below the first screen once the page has loaded are hidden, so nothing
  // the reader can already see ever blinks out.
  function initReveal() {
    if (reduceMotion || !('IntersectionObserver' in window) || window.scrollY > 0) return;
    var vh = window.innerHeight;
    var items = $$('[data-reveal], .case, .xp > *, .contact__panel');
    var below = items.filter(function (el) { return el.getBoundingClientRect().top > vh + 40; });
    var reveal = function (el) {
      el.classList.add('rv-in');
      el.classList.remove('rv');
      setTimeout(function () { el.classList.remove('rv-in'); el.style.removeProperty('--d'); }, 1400);
    };
    var revIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        revIO.unobserve(en.target);
        reveal(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    below.forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.hasAttribute('data-reveal'); });
      var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', (i % 5) * 60 + 'ms');
      el.classList.add('rv');
      revIO.observe(el);
    });
    // Anchor jumps (nav links) skip past items; show anything already above the bottom of the screen.
    on(window, 'hashchange', function () {
      setTimeout(function () {
        $$('.rv').forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) { revIO.unobserve(el); reveal(el); } });
      }, 60);
    });
  }
  var startReveal = function () { (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(initReveal); };
  if (doc.readyState === 'complete') startReveal();
  else on(window, 'load', startReveal, { once: true });

  /* ---------- Toast and copy ---------- */
  var toastEl = $('#toast');
  var toastT = 0;
  function toast(msg) {
    if (!toastEl) return;
    clearTimeout(toastT);
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }
  function copyText(text) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { if (!done) finish(legacyCopy(text)); });
        setTimeout(function () { if (!done) finish(legacyCopy(text)); }, 800); // some browsers never settle the promise
      } else {
        finish(legacyCopy(text));
      }
    });
  }
  function legacyCopy(text) {
    var prev = doc.activeElement; // the temporary textarea takes focus; give it back afterwards
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    if (prev && prev.focus) prev.focus({ preventScroll: true });
    return ok;
  }
  $$('[data-copy]').forEach(function (b) {
    on(b, 'click', function () {
      var v = b.dataset.copy;
      copyText(v).then(function (ok) { toast(ok ? 'Email copied: ' + v : 'Could not copy. Email: ' + v); });
    });
  });

  /* ---------- Video player dialog (youtube-nocookie, created on open, removed on close) ---------- */
  var player = $('#player');
  var pFrame = $('#player-frame');
  var opener = null;
  function openPlayer(b) {
    var d = b.dataset;
    var start = parseInt(d.start || '0', 10) || 0;
    var short = d.format === 'short';
    var id = encodeURIComponent(d.video);
    player.classList.toggle('player--short', short);
    pFrame.dataset.ratio = short ? '9x16' : '16x9';
    $('#player-title').textContent = d.title;
    $('#player-credit').textContent = d.credit || '';
    var f;
    if (location.protocol === 'file:') {
      // YouTube refuses embeds from pages opened from disk (no referrer), so say so instead of showing its error.
      f = doc.createElement('p');
      f.className = 'player__offline';
      f.textContent = 'The video plays here on the live site. On a copy opened from disk, use "Open on YouTube".';
    } else {
      f = doc.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?start=' + start + '&autoplay=1&rel=0&playsinline=1';
      f.title = d.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
    }
    pFrame.replaceChildren(f);
    $('#player-yt').href = short ? 'https://www.youtube.com/shorts/' + id
      : 'https://www.youtube.com/watch?v=' + id + (start ? '&t=' + start + 's' : '');
    opener = b;
    if (typeof player.showModal === 'function') player.showModal();
    else window.open($('#player-yt').href, '_blank', 'noopener');
  }
  function closePlayer() { pFrame.replaceChildren(); player.close(); }
  if (player) {
    $$('.vcard[data-video]').forEach(function (b) { on(b, 'click', function () { openPlayer(b); }); });
    on(player, 'close', function () {
      pFrame.replaceChildren();
      if (opener) { opener.focus(); opener = null; }
    });
    // Esc fires 'cancel' at once and 'close' a frame later: stop the video straight away.
    on(player, 'cancel', function () { pFrame.replaceChildren(); });
    // Close on a backdrop click only when the press also started on the backdrop.
    var downOnBackdrop = false;
    on(player, 'pointerdown', function (e) { downOnBackdrop = e.target === player; });
    on(player, 'click', function (e) { if (e.target === player && downOnBackdrop) closePlayer(); downOnBackdrop = false; });
    $$('[data-close]', player).forEach(function (b) { on(b, 'click', closePlayer); });
  }

  /* ---------- Keerthi edits: show all 13 ---------- */
  // The extra 7 are in the HTML unhidden, so they still show without JavaScript; hide them here.
  var extras = $$('#keerthi-edits [data-extra]');
  extras.forEach(function (li) { li.hidden = true; });
  var more = $('#edits-toggle');
  if (more) {
    on(more, 'click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true';
      extras.forEach(function (li) { li.hidden = !open; });
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Show fewer edits' : 'Show all 13 edits';
      if (open) {
        // Move focus to the first card that just appeared, so keyboard users land on the new content.
        var first = extras.length && $('.vcard', extras[0]);
        if (first) first.focus();
      } else {
        more.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /* ---------- Yogic Insights chart ----------
     Source: data/yogic_insights.json (months[]: m, posts, uniqueViews, cumulativeUniqueViews).
     Embedded here so the page works from file:// without fetching JSON.
     Each row: [month posted, posts that month (repeats included), lifetime views (to 27 Sep 2026) of the
     videos posted that month, running total of those lifetime views]. These are NOT views the page got
     in that month, so never label them "monthly views" or "views by <month>". */
  var Y = [
    ['2019-05', 1, 5803, 5803], ['2019-06', 0, 0, 5803], ['2019-07', 0, 0, 5803], ['2019-08', 2, 498760, 504563],
    ['2019-09', 0, 0, 504563], ['2019-10', 0, 0, 504563], ['2019-11', 0, 0, 504563], ['2019-12', 1, 50683, 555246],
    ['2020-01', 2, 1601124, 2156370], ['2020-02', 0, 0, 2156370], ['2020-03', 15, 5621667, 7778037], ['2020-04', 18, 13173367, 20951404],
    ['2020-05', 3, 1914176, 22865580], ['2020-06', 7, 7639046, 30504626], ['2020-07', 21, 7486970, 37991596], ['2020-08', 15, 7669069, 45660665],
    ['2020-09', 13, 7196802, 52857467], ['2020-10', 14, 10676180, 63533647], ['2020-11', 20, 12997675, 76531322], ['2020-12', 20, 6865915, 83397237],
    ['2021-01', 4, 806106, 84203343], ['2021-02', 12, 2739439, 86942782], ['2021-03', 4, 329318, 87272100], ['2021-04', 2, 84939, 87357039],
    ['2021-05', 0, 0, 87357039], ['2021-06', 0, 0, 87357039], ['2021-07', 0, 0, 87357039], ['2021-08', 0, 0, 87357039],
    ['2021-09', 3, 89892, 87446931], ['2021-10', 0, 0, 87446931], ['2021-11', 0, 0, 87446931], ['2021-12', 2, 15972, 87462903]
  ];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var NS = 'http://www.w3.org/2000/svg';
  var monthName = function (m) { return MON[parseInt(m.slice(5), 10) - 1] + ' ' + m.slice(0, 4); };
  var fmt = function (v, dp) {
    if (v >= 1e6) return (v / 1e6).toFixed(dp == null ? 2 : dp) + 'M';
    if (v >= 1e3) return Math.round(v / 1e3) + 'K';
    return String(v);
  };
  var full = function (v) { return v.toLocaleString('en-US'); };
  function S(tag, attrs, parent, text) {
    var e = doc.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  // Monotone cubic path (Fritsch-Carlson): smooth, never overshoots a flat stretch.
  function monoPath(p) {
    var n = p.length, dx = [], ms = [], t = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; ms[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
    t[0] = ms[0]; t[n - 1] = ms[n - 2];
    for (i = 1; i < n - 1; i++) {
      t[i] = ms[i - 1] * ms[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / ms[i - 1] + (dx[i] + 2 * dx[i - 1]) / ms[i]);
    }
    var r = function (v) { return Math.round(v * 10) / 10; };
    var d = 'M' + r(p[0][0]) + ',' + r(p[0][1]);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i] / 3;
      d += 'C' + r(p[i][0] + h) + ',' + r(p[i][1] + t[i] * h) + ' ' + r(p[i + 1][0] - h) + ',' + r(p[i + 1][1] - t[i + 1] * h) + ' ' + r(p[i + 1][0]) + ',' + r(p[i + 1][1]);
    }
    return d;
  }

  var mount = $('#yogic-chart');
  var tbody = $('#yogic-table tbody');
  if (tbody) {
    Y.forEach(function (row) {
      var tr = doc.createElement('tr');
      [monthName(row[0]), String(row[1]), full(row[2]), full(row[3])].forEach(function (txt, i) {
        var c = doc.createElement(i ? 'td' : 'th');
        if (!i) c.setAttribute('scope', 'row');
        c.textContent = txt;
        tr.appendChild(c);
      });
      tbody.appendChild(tr);
    });
  }

  var chart = null;
  function drawChart() {
    var W = Math.round(mount.clientWidth);
    if (!W || (chart && chart.W === W)) return;
    var cp = W < 560;
    var n = Y.length;
    var m = { l: cp ? 36 : 46, r: cp ? 8 : 14, t: cp ? 30 : 34 };
    var H1 = cp ? 190 : 270, GAP = cp ? 34 : 40, H2 = cp ? 42 : 54, XB = 26;
    var top1 = m.t, base1 = top1 + H1, top2 = base1 + GAP, base2 = top2 + H2, H = base2 + XB;
    var pw = W - m.l - m.r, bw = pw / n;
    var cx = function (i) { return m.l + bw * (i + 0.5); };
    var y1 = function (v) { return base1 - (v / 1e8) * H1; };
    var y2 = function (v) { return base2 - (v / 24) * H2; };

    mount.replaceChildren();
    var svg = S('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }, mount);
    var defs = S('defs', null, svg);
    var gr = S('linearGradient', { id: 'yi-fill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    S('stop', { offset: 0, 'stop-color': '#ff7a2f', 'stop-opacity': 0.22 }, gr);
    S('stop', { offset: 1, 'stop-color': '#ff7a2f', 'stop-opacity': 0.02 }, gr);

    // Main panel: gridlines and y ticks (0 to 100M)
    [0, 25e6, 50e6, 75e6, 1e8].forEach(function (v) {
      var yy = Math.round(y1(v)) + 0.5;
      S('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, 'class': v ? 'c-grid' : 'c-base' }, svg);
      S('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', 'class': 'c-t' }, svg, v ? (v / 1e6) + 'M' : '0');
    });
    // Strip: posts per month
    S('text', { x: m.l, y: top2 - 12, 'class': 'c-t' }, svg, 'POSTS PER MONTH');
    [0, 10, 20].forEach(function (v) {
      var yy = Math.round(y2(v)) + 0.5;
      S('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, 'class': v ? 'c-grid' : 'c-base' }, svg);
      if (v) S('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', 'class': 'c-t' }, svg, String(v));
    });
    var bwid = Math.min(14, bw * 0.62);
    var bars = Y.map(function (row, i) {
      if (!row[1]) return null;
      var x = cx(i) - bwid / 2, yt = y2(row[1]), h = base2 - yt, r = Math.min(3, bwid / 2, h);
      var d = 'M' + x + ',' + base2 + 'V' + (yt + r) + 'Q' + x + ',' + yt + ' ' + (x + r) + ',' + yt + 'H' + (x + bwid - r) + 'Q' + (x + bwid) + ',' + yt + ' ' + (x + bwid) + ',' + (yt + r) + 'V' + base2 + 'Z';
      return S('path', { d: d, 'class': 'c-bar' }, svg);
    });
    // Year ticks under the strip
    Y.forEach(function (row, i) {
      var jan = row[0].slice(5) === '01';
      if (!i || jan) {
        var xx = Math.round(cx(i)) + 0.5;
        S('line', { x1: xx, x2: xx, y1: base2, y2: base2 + 5, 'class': 'c-base' }, svg);
        S('text', { x: xx, y: base2 + 19, 'text-anchor': i ? 'middle' : 'start', 'class': 'c-t' }, svg, row[0].slice(0, 4));
      }
    });
    // Cumulative views: area wash + 2px line
    var pts = Y.map(function (row, i) { return [cx(i), y1(row[3])]; });
    var d = monoPath(pts);
    S('path', { d: d + 'L' + cx(n - 1) + ',' + base1 + 'L' + cx(0) + ',' + base1 + 'Z', fill: 'url(#yi-fill)' }, svg);
    S('path', { d: d, 'class': 'c-line' }, svg);

    // Selective labels: the biggest step (videos posted in Apr 2020), and the end point
    var ia = 11; // Apr 2020
    var ax = cx(ia), ay = y1(Y[ia][3]);
    S('circle', { cx: ax, cy: ay, r: 4.5, 'class': 'c-dot' }, svg);
    var la = S('text', { x: ax - 12, y: ay - 18, 'text-anchor': 'end', 'class': 'c-lab' }, svg);
    S('line', { x1: ax - 4, y1: ay - 4, x2: ax - 10, y2: ay - 13, 'class': 'c-lead' }, svg);
    S('tspan', { 'class': 'b' }, la, '+' + fmt(Y[ia][2], 1));
    la.appendChild(doc.createTextNode(cp ? ' (Apr 2020)' : ' from videos posted in Apr 2020'));
    var ex = cx(n - 1), ey = y1(Y[n - 1][3]);
    S('circle', { cx: ex, cy: ey, r: 4.5, 'class': 'c-dot' }, svg);
    var le = S('text', { x: ex, y: ey - 14, 'text-anchor': 'end', 'class': 'c-lab' }, svg);
    S('tspan', { 'class': 'b' }, le, fmt(Y[n - 1][3], 1));
    le.appendChild(doc.createTextNode(cp ? ' in all' : ' on all 149 videos'));

    // Crosshair + tooltip (pointer and keyboard)
    var xh = S('g', { 'class': 'c-xh' }, svg);
    var xl = S('line', { y1: top1 - 6, y2: base2 }, xh);
    var xd = S('circle', { r: 5, 'class': 'c-dot' }, xh);
    var tip = doc.createElement('div');
    tip.className = 'chart__tip';
    tip.setAttribute('aria-hidden', 'true');
    mount.appendChild(tip);

    chart = { W: W, i: -1, n: n, m: m, bw: bw, cx: cx, show: show, hide: hide };

    function line(parts) {
      var p = doc.createElement('div');
      parts.forEach(function (q) {
        if (q === 'k1' || q === 'k2') { var k = doc.createElement('i'); if (q === 'k2') k.className = 'k2'; p.appendChild(k); }
        else if (typeof q === 'string') p.appendChild(doc.createTextNode(q));
        else { var b = doc.createElement('b'); b.textContent = q[0]; p.appendChild(b); }
      });
      return p;
    }
    function show(i) {
      i = clamp(i, 0, n - 1);
      chart.i = i;
      var row = Y[i], x = Math.round(cx(i)) + 0.5;
      xl.setAttribute('x1', x); xl.setAttribute('x2', x);
      xd.setAttribute('cx', cx(i)); xd.setAttribute('cy', y1(row[3]));
      xh.classList.add('is-on');
      bars.forEach(function (b, j) { if (b) b.classList.toggle('is-on', j === i); });
      var head = doc.createElement('strong');
      head.textContent = monthName(row[0]);
      tip.replaceChildren(head,
        line(['k1', [fmt(row[3])], ' on videos posted up to this month']),
        line([[fmt(row[2])], ' on videos posted this month']),
        line(['k2', [String(row[1])], row[1] === 1 ? ' post' : ' posts (incl. repeats)']));
      var tw = tip.offsetWidth || 190;
      var left = cx(i) + 14;
      if (left + tw > W) left = cx(i) - 14 - tw;
      tip.style.transform = 'translate(' + Math.round(clamp(left, 0, W - tw)) + 'px,' + Math.round(top1) + 'px)';
      tip.classList.add('is-on');
    }
    function hide() {
      chart.i = -1;
      xh.classList.remove('is-on');
      tip.classList.remove('is-on');
      bars.forEach(function (b) { if (b) b.classList.remove('is-on'); });
    }
  }

  if (mount) {
    var idxAt = function (e) {
      var r = mount.getBoundingClientRect();
      return clamp(Math.floor((e.clientX - r.left - chart.m.l) / chart.bw), 0, chart.n - 1);
    };
    on(mount, 'pointermove', function (e) { if (chart) chart.show(idxAt(e)); });
    on(mount, 'pointerdown', function (e) { if (chart) chart.show(idxAt(e)); });
    on(mount, 'pointerleave', function () { if (chart && doc.activeElement !== mount) chart.hide(); });
    on(mount, 'focus', function () { if (chart) chart.show(chart.i >= 0 ? chart.i : chart.n - 1); });
    on(mount, 'blur', function () { if (chart) chart.hide(); });
    on(mount, 'keydown', function (e) {
      if (!chart) return;
      var i = chart.i < 0 ? chart.n - 1 : chart.i;
      var next = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: chart.n - 1 }[e.key];
      if (next == null) { if (e.key === 'Escape') chart.hide(); return; }
      e.preventDefault();
      chart.show(next);
    });
    drawChart();
    if ('ResizeObserver' in window) {
      var rT = 0;
      new ResizeObserver(function () { clearTimeout(rT); rT = setTimeout(drawChart, 80); }).observe(mount);
    } else {
      on(window, 'resize', drawChart);
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { if (chart) { chart.W = 0; drawChart(); } });
  }
})();
