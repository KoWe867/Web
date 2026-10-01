/* scene.js — die Zeitleiste. seek(t) zeichnet einen kompletten Frame aus t und der Musik.
 * Eine durchgehende Kamerafahrt über eine Wand aus Karten; Szenen liegen auf dem Taktraster der Musik.
 *  0.0– 8.1 s  Intro: Text auf Aurora (Takt 0–3)
 *  8.1–16.1 s  Aufbau: Karten fliegen im Takt ein, Kamera zieht auf den Drop zu (Takt 4–7)
 * 16.1–20.1 s  Drop: Wand, Flash, Welle
 * 20.1–48.1 s  sieben Szenen à 4 s (je 2 Takte), Kamera fährt von Karte zu Karte
 * 48.1–56   s  Break: zurück zur Wand, Endkarte, Ton blendet aus
 */
(function (root) {
  'use strict';
  var E = root.Engine, Cards = root.Cards, W = E.W, H = E.H, TAU = E.TAU, clamp = E.clamp, lerp = E.lerp, sstep = E.sstep, spring = E.spring;
  var T0 = E.T0, BEAT = E.BEAT, BAR = E.BAR, DROP = E.DROP, DUR = 56, S0 = DROP + 4, SL = 4, END = DROP + 32;
  var VIOLET = [110, 80, 255];

  // Wand: 3×3 Raster, Kartenmitten in Welt-Einheiten
  var POS = { karten: [-920, -710], wetter: [0, -710], musik: [920, -710], fitness: [-920, 0], kalender: [0, 0], nachrichten: [920, 0], aktien: [-920, 710], zuhause: [0, 710], notizen: [920, 710] };
  var ORDER = ['kalender', 'wetter', 'nachrichten', 'zuhause', 'fitness', 'musik', 'karten', 'aktien', 'notizen'];   // Einflug-Reihenfolge
  var SCENES = [
    { card: 'karten', acc: [10, 132, 255], cap: ['Immer auf dem Weg.', ' Ohne Umwege.'] },
    { card: 'wetter', acc: [100, 210, 255], cap: ['Das Wetter im Blick.', ' Bevor es losgeht.'] },
    { card: 'musik', acc: [191, 90, 242], cap: ['Deine Musik.', ' In deinem Takt.'] },
    { card: 'nachrichten', acc: [48, 209, 88], cap: ['Bleib in Kontakt.', ' Antwort in Sekunden.'] },
    { card: 'kalender', acc: [255, 159, 10], cap: ['Dein Tag, geplant.', ' Auf einen Blick.'] },
    { card: 'fitness', acc: [255, 69, 58], cap: ['Jede Bewegung zählt.', ' Jeder Ring auch.'] },
    { card: 'aktien', acc: [52, 199, 140], cap: ['Zahlen im Fluss.', ' Alles im Plus.'] }
  ];
  var WALLZ = 0.47, FOCUSZ = Math.min(1700 / 1000, 740 / 640);
  SCENES.forEach(function (s, i) { s.t0 = S0 + i * SL; s.t1 = s.t0 + SL; var p = POS[s.card]; s.cam = [FOCUSZ, p[0], p[1] + 70 / FOCUSZ]; });

  // Wert mit vielen Zielen = Summe je einer Feder pro Änderung
  function springSum(t, v0, keys, f, z) {
    var out = v0.slice(), prev = v0;
    for (var i = 0; i < keys.length; i++) { var u = spring(t - keys[i].t, f, z); for (var j = 0; j < out.length; j++) out[j] += (keys[i].v[j] - prev[j]) * u; prev = keys[i].v; }
    return out;
  }
  var CAMKEYS = [{ t: DROP, v: [Math.log(WALLZ), 0, 0] }];
  SCENES.forEach(function (s) { CAMKEYS.push({ t: s.t0, v: [Math.log(s.cam[0]), s.cam[1], s.cam[2]] }); });
  CAMKEYS.push({ t: END, v: [Math.log(WALLZ * 0.97), 0, 0] });
  var ACCKEYS = [{ t: DROP, v: VIOLET }]; SCENES.forEach(function (s) { ACCKEYS.push({ t: s.t0, v: s.acc }); }); ACCKEYS.push({ t: END, v: VIOLET });

  function camera(t) {
    var z, x, y, b0 = T0 + 4 * BAR;
    if (t < DROP) {
      var u = clamp((t - b0) / (DROP - b0), 0, 1); z = Math.exp(lerp(Math.log(1.25), Math.log(0.52), Math.pow(u, 2.2))); x = Math.sin(t * 0.3) * 24; y = Math.cos(t * 0.23) * 16;
    } else {
      var s0 = [Math.log(0.52), 0, 0], k = CAMKEYS.slice(); k[0] = { t: DROP, v: [Math.log(WALLZ), 0, 0] };
      var v = springSum(t, s0, k, 1.4, 0.86); z = Math.exp(v[0]); x = v[1]; y = v[2];
      for (var i = 0; i < SCENES.length; i++) { var d = (t - SCENES[i].t0 - 0.28) / 0.3; z *= 1 - 0.2 * Math.exp(-d * d); }          // kurzer Zoom-Out während der Fahrt
      var dd = (t - END - 0.28) / 0.3; z *= 1 - 0.1 * Math.exp(-dd * dd);
      x += Math.sin(t * 0.4) * 10; y += Math.cos(t * 0.31) * 8;
    }
    return { z: z, x: x, y: y };
  }
  function accent(t) { return t < DROP ? VIOLET : springSum(t, VIOLET, ACCKEYS, 1.0, 0.97); }

  function create(canvas, A, opts) {
    opts = opts || {}; var FPS = opts.fps || 30; canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d'), bw = {};
    var vg = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.98); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    var appear = {}; ORDER.forEach(function (n, i) { appear[n] = T0 + (17 + 1.5 * i) * BEAT; });

    function background(t, acc, low, I) {
      c.fillStyle = '#050507'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
      var amp = I * (0.8 + 0.35 * low), cs = [acc, E.mix(acc, [90, 60, 220], 0.6), acc], P = [[0.3 + Math.sin(t * 0.17) * 0.14, 0.32 + Math.cos(t * 0.13) * 0.12, 1000, 0.36], [0.76 + Math.cos(t * 0.11) * 0.15, 0.66 + Math.sin(t * 0.15) * 0.14, 900, 0.3], [0.5 + Math.sin(t * 0.07) * 0.2, 1.02, 1100, 0.24]];
      for (var i = 0; i < 3; i++) { var g = c.createRadialGradient(P[i][0] * W, P[i][1] * H, 10, P[i][0] * W, P[i][1] * H, P[i][2]); g.addColorStop(0, E.rgba(cs[i], P[i][3] * amp)); g.addColorStop(1, E.rgba(cs[i], 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      c.globalCompositeOperation = 'source-over';
    }

    // Wörter steigen aus einer Maske auf (zweifarbig möglich)
    function rise(parts, cx, cy, size, weight, t, t0, t1, grad) {
      if (t < t0 || t > t1 + 0.05) return; var toks = [], total = 0;
      parts.forEach(function (p) { p[0].split(/(?<= )/).forEach(function (w) { var wd = E.measure(c, w, size, weight); toks.push({ s: w, col: p[1], w: wd }); total += wd; }); });
      c.save(); c.beginPath(); c.rect(cx - total / 2 - 30, cy - size * 0.95, total + 60, size * 1.3); c.clip(); var x = cx - total / 2, ex = sstep(t1 - 0.3, t1, t);
      toks.forEach(function (k, i) {
        var u = spring(t - t0 - i * 0.06, 2.4, 0.78), a = clamp(u * 1.5, 0, 1) * (1 - ex); c.globalAlpha = a;
        E.text(c, k.s, x, cy + (1 - Math.min(u, 1.05)) * size * 0.95 - ex * size * 0.5, size, weight, k.col === 'grad' ? grad : k.col); x += k.w;
      }); c.restore();
    }
    function bandFlash(t, t0, str, amp) { var d = t - t0; if (d < 0 || d > 0.8) return; c.globalAlpha = amp * Math.exp(-d * 6); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }

    function drawCard(name, t, alpha, pop, Z, lt, low, sc) {
      var C = Cards[name], p = POS[name], R = 56; if (alpha <= 0.004 || pop <= 0.002) return;
      c.save(); c.globalAlpha = alpha; c.translate(p[0], p[1] + (1 - Math.min(pop, 1)) * 200); var s = (0.55 + 0.45 * Math.min(pop, 1.08)) * sc; c.scale(s, s); c.translate(-C.w / 2, -C.h / 2);
      c.save(); c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 70 * Z * s; c.shadowOffsetY = 28 * Z * s; E.rr(c, 0, 0, C.w, C.h, R); c.fillStyle = '#1c1c1e'; c.fill(); c.restore();
      c.save(); E.rr(c, 0, 0, C.w, C.h, R); c.clip();
      C.draw(c, { w: C.w, h: C.h, t: t, lt: lt, A: A, low: low, s: function (b, f, z) { return spring(lt - b * BEAT, f || 2.4, z || 0.75); } });
      var sh = c.createLinearGradient(0, 0, 0, C.h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, C.w, C.h * 0.5); c.restore();
      E.rr(c, 1, 1, C.w - 2, C.h - 2, R - 1); c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 2; c.stroke(); c.restore();
    }

    function seek(t) {
      t = clamp(t, 0, DUR - 0.0001);
      var low = A.low(t), acc = accent(t), cam = camera(t), b = E.beat(t);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      background(t, acc, low, sstep(0.3, 3.5, t) * (t > DROP ? 1.15 : 1));

      // ---- Intro-Text (Takt 0–3) ----
      var grad = c.createLinearGradient(0, H / 2 - 110, 0, H / 2 + 60); grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#a9a9b8');
      if (t < T0 + 4 * BAR + 0.1) {
        var L = [[T0 + BEAT, T0 + 4 * BEAT, [['Ein Tag.', 'grad']]], [T0 + 4 * BEAT, T0 + 8 * BEAT, [['Viele Momente.', 'grad']]], [T0 + 8 * BEAT, T0 + 12 * BEAT, [['Ein Takt.', 'grad']]], [T0 + 12 * BEAT, T0 + 16 * BEAT, [['Hör zu.', 'grad']]]];
        L.forEach(function (l) { rise(l[2], W / 2, H / 2 + 60, 168, 800, t, l[0], l[1], grad); });
        var sa = sstep(T0 + 12 * BEAT - 0.2, T0 + 13 * BEAT, t) * (1 - sstep(T0 + 16 * BEAT - 0.3, T0 + 16 * BEAT + 0.4, t));
        if (sa > 0.01) { // die Musik selbst als Linie: echte Samples
          var end = Math.floor(t * A.sr), n = 1400, st = end - n; c.save(); c.globalAlpha = sa * 0.9; c.strokeStyle = E.rgba(E.mix(acc, [255, 255, 255], 0.35), 1); c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
          for (var i = 0; i < n; i += 4) { var v = A.sample(st + i) * 3.2, x = i / (n - 1) * W; i ? c.lineTo(x, H * 0.8 - v * 900) : c.moveTo(x, H * 0.8 - v * 900); } c.stroke(); c.restore();
        }
      }

      // ---- Welt: Kamera + Karten ----
      var f6 = SCENES.map(function (s) { return sstep(s.t0 - 0.15, s.t0 + 0.55, t) * (1 - sstep(s.t1 - 0.2, s.t1 + 0.5, t)); });
      var nonf = t < DROP ? 1 : t < S0 ? 1 - 0.84 * sstep(17.1, 17.7, t) : t < END ? lerp(0.16, 0.14, sstep(S0, S0 + 0.6, t)) : lerp(0.14, 0.5, sstep(END, END + 1, t));
      if (t >= END + 1.4) nonf = lerp(0.5, 0.09, sstep(END + 1.4, END + 2.4, t));
      c.save(); c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
      Object.keys(POS).forEach(function (name) {
        var pop = t < appear[name] ? 0 : spring(t - appear[name], 2.6, 0.62), al = clamp(pop * 1.6, 0, 1), si = -1, lt = 99;
        SCENES.forEach(function (s, i) { if (s.card === name) { si = i; if (t >= s.t0 && t < s.t1) lt = t - s.t0; } });   // 99 = fertig animiert
        if (t >= DROP) al *= si >= 0 ? lerp(nonf, 1, f6[si]) : nonf;
        var d = Math.hypot(POS[name][0] / 920, POS[name][1] / 710), rip = t > DROP + d * 0.1 ? Math.exp(-(t - DROP - d * 0.1) / 0.35) : 0;
        var sc = 1 + 0.012 * low + (t < S0 ? 0.04 * rip : 0);
        drawCard(name, t, al, pop, cam.z, lt, low, sc);
      });
      c.restore();

      // ---- Wand-Titel nach dem Drop ----
      var wt0 = DROP + 1.3, wt1 = S0 - 0.15; var sc2 = sstep(wt0, wt0 + 0.5, t) * (1 - sstep(wt1 - 0.2, wt1, t)); if (sc2 > 0.01) { var sg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 900); sg.addColorStop(0, 'rgba(0,0,0,' + (0.55 * sc2).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H); } rise([['Neun Apps. ', '#fff'], ['Reines JavaScript.', '#c7c7cc']], W / 2, H / 2 + 50, 104, 800, t, wt0, wt1);

      // ---- Szenen-Untertitel (mit dunklem Verlauf, damit abgedunkelte Nachbarkarten nicht durchscheinen) ----
      var sg2 = sstep(S0 - 0.2, S0 + 0.4, t) * (1 - sstep(END - 0.1, END + 0.5, t));
      if (sg2 > 0.01) { var bg = c.createLinearGradient(0, 850, 0, H); bg.addColorStop(0, 'rgba(5,5,7,0)'); bg.addColorStop(0.35, 'rgba(5,5,7,' + (0.92 * sg2).toFixed(3) + ')'); bg.addColorStop(1, 'rgba(5,5,7,' + (0.96 * sg2).toFixed(3) + ')'); c.fillStyle = bg; c.fillRect(0, 850, W, H - 850); }
      SCENES.forEach(function (s) { rise([[s.cap[0], '#fff'], [s.cap[1], '#8e8e93']], W / 2, 968, 56, 700, t, s.t0 + 0.95, s.t1 - 0.45); });
      if (t > S0 && t < END) { c.globalAlpha = 0.5; E.text(c, 'Beispieldaten', W - 48, H - 36, 22, 500, '#8e8e93', 'right'); c.globalAlpha = 1; }

      // ---- Endkarte (dunkler Verlauf hinter dem Text) ----
      var es = sstep(END + 0.6, END + 1.8, t); if (es > 0.01) { var eg = c.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 1000); eg.addColorStop(0, 'rgba(5,5,7,' + (0.8 * es).toFixed(3) + ')'); eg.addColorStop(1, 'rgba(5,5,7,' + (0.35 * es).toFixed(3) + ')'); c.fillStyle = eg; c.fillRect(0, 0, W, H); }
      var e0 = END + 0.1, e1 = END + 3.9;
      rise([['Alles aus Code.', '#fff']], W / 2, H / 2 + 40, 150, 800, t, e0, e1);
      var e2 = END + 4.1; if (t > e2) {
        var yy = [[H / 2 - 20, 'Jeder Frame. Jede Karte. Reines JavaScript.', 58, 700, '#fff'], [H / 2 + 52, 'Musik: „Electro Dreams“ von Arulo · Mixkit Stock Music Free License', 30, 500, '#a1a1a8'], [H / 2 + 100, 'Alle Daten in den Karten sind Beispieldaten. App-Oberflächen frei gestaltet.', 30, 500, '#a1a1a8']];
        yy.forEach(function (r, i) { rise([[r[1], r[4]]], W / 2, r[0], r[2], r[3], t, e2 + i * 0.25, 99); });
      }

      // ---- Flashes: Drop und Szenenwechsel ----
      bandFlash(t, DROP, '', 0.85); SCENES.forEach(function (s) { bandFlash(t, s.t0, '', 0.07); }); bandFlash(t, END, '', 0.1);
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      // kleiner Frame-Zähler: der Beweis, dass es berechnet wird
      c.globalAlpha = 0.4; E.text(c, 'frame ' + String(Math.round(t * FPS)).padStart(4, '0') + '   t = ' + t.toFixed(3) + ' s   takt ' + String(Math.floor(b / 4) + 1).padStart(2, '0') + '.' + (Math.floor(((b % 4) + 4) % 4) + 1), 40, H - 36, 20, 500, '#fff'); c.globalAlpha = 1;
      var fo = sstep(DUR - 1.4, DUR - 0.05, t); if (fo > 0) { c.globalAlpha = fo; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    }
    return { seek: seek, duration: DUR, fps: FPS };
  }
  root.Scene = { create: create, DUR: DUR, DROP: DROP, SCENES: SCENES };
})(typeof window !== 'undefined' ? window : globalThis);
