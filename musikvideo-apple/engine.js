/* engine.js — Bausteine für ein Video, das nur aus seek(t) besteht.
 * Kein Zustand zwischen Frames, kein Math.random: gleiches t ergibt dieselben Pixel.
 */
(function (root) {
  'use strict';

  var W = 1920, H = 1080, TAU = Math.PI * 2;
  // Gemessen an Electro Dreams (Arulo): 120,006 BPM, Takt 0 beginnt bei 0,062 s, Drop = Takt 8
  var T0 = 0.062, BEAT = 0.49997, BAR = BEAT * 4, DROP = T0 + 8 * BAR;

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var sstep = function (a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  var frac = function (x) { return x - Math.floor(x); };
  var beat = function (t) { return (t - T0) / BEAT; };
  function hash(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function h2(a, b) { return hash(a * 7919 + b * 104729 + 12345); }
  // Feder als geschlossene Sprungantwort: ein Wert mit vielen Zielen = Summe je einer Feder pro Änderung
  function spring(tau, f, z) {
    if (tau <= 0) return 0; if (tau > 30) return 1;
    var w = TAU * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + z * w / wd * Math.sin(wd * tau));
  }
  var ease = function (u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); };            // out
  var easeIO = function (u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  var mix = function (a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; };
  var rgba = function (c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : a).toFixed(3) + ')'; };
  var FONT = "Inter, -apple-system, 'SF Pro Display', 'Helvetica Neue', 'DejaVu Sans', Arial, sans-serif";

  // ---------- Audio-Analyse: alles aus den echten Samples der Musik ----------
  function Analysis(L, R, sr) {
    var n = L.length, RATE = 100, hop = Math.floor(sr / RATE), nb = Math.floor(n / hop);
    var low = new Float32Array(nb), mid = new Float32Array(nb), high = new Float32Array(nb), lp1 = 0, lp2 = 0, hp0 = 0;
    for (var b = 0; b < nb; b++) {
      var sl = 0, sm = 0, sh = 0;
      for (var k = 0; k < hop; k++) {
        var x = (L[b * hop + k] + R[b * hop + k]) * 0.5;
        lp1 += 0.018 * (x - lp1); lp2 += 0.25 * (x - lp2);
        var hp = x - lp2, hd = hp - hp0; hp0 = hp;
        sl += lp1 * lp1; sm += (lp2 - lp1) * (lp2 - lp1); sh += hd * hd;
      }
      low[b] = Math.sqrt(sl / hop); mid[b] = Math.sqrt(sm / hop); high[b] = Math.sqrt(sh / hop);
    }
    [low, mid, high].forEach(function (a) {
      var s = Array.prototype.slice.call(a).sort(function (p, q) { return p - q; }), p = s[Math.floor(s.length * 0.98)] || 1;
      for (var i = 0; i < a.length; i++) a[i] = Math.min(1, a[i] / p);
    });
    var NB = 28, N = 2048, win = new Float32Array(N), buf = new Float32Array(N), coef = [];
    for (var i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * i / (N - 1));
    for (i = 0; i < NB; i++) coef.push(2 * Math.cos(TAU * (60 * Math.pow(12000 / 60, i / (NB - 1))) / sr));
    function at(arr, t) { var x = t * RATE, i = Math.floor(x); return (i < 0 || i >= arr.length - 1) ? 0 : lerp(arr[i], arr[i + 1], x - i); }
    return {
      sr: sr, n: n, duration: n / sr, bands: NB,
      sample: function (i) { return i >= 0 && i < n ? (L[i] + R[i]) * 0.5 : 0; },
      low: function (t) { return at(low, t); }, mid: function (t) { return at(mid, t); }, high: function (t) { return at(high, t); },
      // Goertzel über 2048 Samples: echtes Spektrum in 28 log-Bändern
      spectrum: function (t, out) {
        var end = Math.floor(t * sr), st = end - N;
        if (st < 0 || end > n) { for (var j = 0; j < NB; j++) out[j] = 0; return out; }
        for (var i2 = 0; i2 < N; i2++) buf[i2] = (L[st + i2] + R[st + i2]) * 0.5 * win[i2];
        for (j = 0; j < NB; j++) {
          var c = coef[j], s1 = 0, s2 = 0;
          for (i2 = 0; i2 < N; i2++) { var s0 = buf[i2] + c * s1 - s2; s2 = s1; s1 = s0; }
          var mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (N / 4);
          out[j] = clamp((20 * Math.log10(mag + 1e-6) + 62 + j * 0.8) / 44, 0, 1);
        }
        return out;
      }
    };
  }

  // ---------- Zeichen-Helfer ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function font(c, size, weight) { c.font = (weight || 600) + ' ' + size + 'px ' + FONT; }
  function text(c, s, x, y, size, weight, color, align, base) {
    font(c, size, weight); c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'alphabetic'; c.fillText(s, x, y);
  }
  // Zahlen mit fester Ziffernbreite, damit zählende Werte nicht wackeln
  function digits(c, s, x, y, size, weight, color, align) {
    font(c, size, weight); var dw = c.measureText('0').width, total = 0, i, ws = [];
    for (i = 0; i < s.length; i++) { var w = /[0-9]/.test(s[i]) ? dw : c.measureText(s[i]).width; ws.push(w); total += w; }
    var px = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (i = 0; i < s.length; i++) { c.fillText(s[i], px + ws[i] / 2, y); px += ws[i]; }
    return total;
  }
  function measure(c, s, size, weight) { font(c, size, weight); return c.measureText(s).width; }

  root.Engine = { W: W, H: H, TAU: TAU, T0: T0, BEAT: BEAT, BAR: BAR, DROP: DROP, clamp: clamp, lerp: lerp, sstep: sstep, frac: frac, beat: beat, hash: hash, h2: h2,
    spring: spring, ease: ease, easeIO: easeIO, mix: mix, rgba: rgba, FONT: FONT, Analysis: Analysis, rr: rr, font: font, text: text, digits: digits, measure: measure };
})(typeof window !== 'undefined' ? window : globalThis);
