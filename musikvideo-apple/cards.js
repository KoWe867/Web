/* cards.js — neun App-Karten, jede eine Funktion draw(c, g) in Karten-Koordinaten (Ursprung oben links).
 * g.t = Videozeit, g.lt = Zeit seit Szenenstart (99 = Karte ist fertig animiert), g.s(beat, f, z) = Feder ab Beat,
 * g.low = echter Bass-Pegel der Musik (0..1), g.A = Audio-Analyse. Eigene Oberflächen, Beispieldaten.
 */
(function (root) {
  'use strict';
  var E = root.Engine, TAU = E.TAU, clamp = E.clamp, lerp = E.lerp, sstep = E.sstep, ease = E.ease, rr = E.rr, text = E.text, digits = E.digits, measure = E.measure, rgba = E.rgba, BEAT = E.BEAT;
  var BLUE = [10, 132, 255], GREEN = [48, 209, 88], RED = [255, 69, 58], ORANGE = [255, 159, 10], YELLOW = [255, 214, 10], PINK = [255, 55, 95], PURPLE = [191, 90, 242], TEAL = [100, 210, 255];
  var GRAY = '#8e8e93', WHITE = '#fff';

  function fmtDE(v, d) { var s = Math.abs(v).toFixed(d).replace('.', ','), p = s.split(','); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (v < 0 ? '-' : '') + p.join(','); }
  function sun(c, x, y, r, t, col) {
    c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = r * 0.16; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill();
    for (var i = 0; i < 8; i++) { var a = i / 8 * TAU + t * 0.25; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); c.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); c.stroke(); }
    c.restore();
  }
  function cloud(c, x, y, s, col) { // aus Kreisen und Balken
    c.fillStyle = col; c.beginPath(); c.arc(x - 0.3 * s, y, 0.28 * s, 0, TAU); c.arc(x + 0.02 * s, y - 0.18 * s, 0.36 * s, 0, TAU); c.arc(x + 0.38 * s, y, 0.26 * s, 0, TAU); c.fill();
    rr(c, x - 0.58 * s, y - 0.02 * s, 1.22 * s, 0.28 * s, 0.14 * s); c.fill();
  }
  function pill(c, x, y, w, h, fill) { rr(c, x, y, w, h, h / 2); c.fillStyle = fill; c.fill(); }

  // ---------- Karten (Stadtplan mit Route) ----------
  var ROUTE = [[170, 410], [170, 270], [450, 270], [450, 130], [870, 130]], SEG = [], RLEN = 0;
  for (var i = 1; i < ROUTE.length; i++) { var d = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); SEG.push(d); RLEN += d; }
  function routeAt(d) { for (var i = 0; i < SEG.length; i++) { if (d <= SEG[i] || i === SEG.length - 1) { var u = clamp(d / SEG[i], 0, 1); return [lerp(ROUTE[i][0], ROUTE[i + 1][0], u), lerp(ROUTE[i][1], ROUTE[i + 1][1], u)]; } d -= SEG[i]; } }
  function karten(c, g) {
    var w = g.w, h = g.h, rp = ease((g.lt - 0.7) / 2.4), sc = 1 + 0.1 * rp;
    c.fillStyle = '#3a3f48'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.scale(sc, sc); c.translate(-w / 2, -h / 2 + 20 * rp);
    for (var kx = -2; kx < 9; kx++) for (var ky = -2; ky < 6; ky++) {
      var hh = E.h2(kx + 20, ky + 20), x = 30 + 140 * kx + 14, y = -10 + 140 * ky + 14, col = hh < 0.12 ? '#1f3d2c' : hh < 0.55 ? '#262b33' : '#2a3039';
      rr(c, x, y, 112, 112, 14); c.fillStyle = col; c.fill();
      if (hh >= 0.12 && hh % 0.11 > 0.05) { rr(c, x + 18, y + 18, 34 + hh * 50, 30 + hh * 30, 6); c.fillStyle = '#313843'; c.fill(); }
    }
    c.strokeStyle = '#17324f'; c.lineWidth = 64; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-100, 500); c.bezierCurveTo(200, 330, 420, 600, 700, 380); c.bezierCurveTo(900, 230, 1100, 330, 1250, 300); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2; c.setLineDash([14, 14]);
    for (kx = -2; kx < 9; kx++) { c.beginPath(); c.moveTo(30 + 140 * kx, -150); c.lineTo(30 + 140 * kx, 800); c.stroke(); }
    for (ky = -2; ky < 6; ky++) { c.beginPath(); c.moveTo(-200, -10 + 140 * ky); c.lineTo(1300, -10 + 140 * ky); c.stroke(); }
    c.setLineDash([]);
    // Route
    var pts = function () { c.beginPath(); c.moveTo(ROUTE[0][0], ROUTE[0][1]); for (var i = 1; i < ROUTE.length; i++) c.lineTo(ROUTE[i][0], ROUTE[i][1]); };
    c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash([RLEN * rp, RLEN * 2]);
    pts(); c.strokeStyle = 'rgba(10,132,255,0.3)'; c.lineWidth = 38; c.stroke();
    pts(); c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 24; c.stroke();
    pts(); c.strokeStyle = '#2f8cff'; c.lineWidth = 15; c.stroke(); c.setLineDash([]);
    var p0 = ROUTE[0], dp = routeAt(RLEN * rp);
    var halo = 1 + 0.5 * ((g.t / BEAT) % 1);
    c.fillStyle = 'rgba(10,132,255,0.25)'; c.beginPath(); c.arc(dp[0], dp[1], 22 * halo, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(dp[0], dp[1], 15, 0, TAU); c.fill(); c.fillStyle = '#0a84ff'; c.beginPath(); c.arc(dp[0], dp[1], 10, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(p0[0], p0[1], 9, 0, TAU); c.fill();
    var pin = clamp(E.spring(g.lt - 3.1, 2.4, 0.5), 0, 1.3), pe = ROUTE[ROUTE.length - 1];
    if (pin > 0.01) {
      c.save(); c.translate(pe[0], pe[1]); c.scale(pin, pin); c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 4, 18, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff453a'; c.beginPath(); c.arc(0, -52, 28, Math.PI * 0.82, Math.PI * 0.18, false); c.lineTo(0, 0); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -52, 11, 0, TAU); c.fill(); c.restore();
    }
    c.restore();
    // Suchfeld und Infokarte
    var sa = g.s(1, 2.6, 0.8);
    c.save(); c.globalAlpha = clamp(sa, 0, 1); c.translate(0, (1 - sa) * -24);
    rr(c, 40, 34, 420, 82, 41); c.fillStyle = 'rgba(28,28,30,0.9)'; c.fill();
    c.strokeStyle = GRAY; c.lineWidth = 5; c.beginPath(); c.arc(86, 73, 14, 0, TAU); c.moveTo(97, 84); c.lineTo(110, 97); c.stroke();
    text(c, 'Büro', 132, 85, 34, 600, WHITE); c.restore();
    var sh = g.s(2, 2.2, 0.8);
    c.save(); c.translate(0, (1 - sh) * 220);
    rr(c, 40, h - 186, w - 80, 146, 40); c.fillStyle = 'rgba(28,28,30,0.94)'; c.fill();
    var mins = Math.round(lerp(19, 12, rp));
    digits(c, String(mins), 84, h - 94, 64, 700, WHITE); var mw = measure(c, String(mins), 64, 700) + 14;
    text(c, 'min', 84 + mw, h - 94, 34, 600, WHITE); text(c, '3,4 km  ·  Schnellste Route', 84, h - 58, 26, 500, GRAY);
    rr(c, w - 240, h - 154, 156, 82, 41); c.fillStyle = '#0a84ff'; c.fill(); text(c, 'Los', w - 162, h - 102, 36, 700, WHITE, 'center');
    c.restore();
  }

  // ---------- Wetter ----------
  function wetter(c, g) {
    var w = g.w, h = g.h, t = g.t, gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f6bf0'); gr.addColorStop(0.6, '#4f9cff'); gr.addColorStop(1, '#8cc4ff');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (var i = 0; i < 4; i++) { var cx = ((t * (14 + i * 5) + i * 260) % (w + 500)) - 250; c.globalAlpha = 0.13 + 0.03 * i; cloud(c, cx, 70 + i * 34, 90 + i * 14, '#fff'); }
    c.globalAlpha = 1;
    var s1 = g.s(0, 2, 0.8); sun(c, w - 150, 150, 110 * (0.7 + 0.3 * clamp(s1, 0, 1.1)) * (1 + 0.04 * g.low), t, '#ffd60a');
    text(c, 'Beispielstadt', 52, 84, 38, 600, WHITE);
    var temp = Math.round(lerp(12, 21, ease((g.lt - 0.3) / 1.6)));
    c.fillStyle = WHITE; digits(c, temp + '°', 40, 330, 230, 300, WHITE); text(c, 'Sonnig', 52, 394, 44, 500, 'rgba(255,255,255,0.92)'); text(c, 'H:24°   T:12°', 52, 438, 32, 500, 'rgba(255,255,255,0.8)');
    rr(c, 28, h - 186, w - 56, 158, 36); c.fillStyle = 'rgba(0,30,90,0.28)'; c.fill();
    var hours = ['Jetzt', '14', '15', '16', '17'], tmp = [21, 23, 24, 22, 19], cw = (w - 56) / 5;
    for (i = 0; i < 5; i++) {
      var u = clamp(g.s(1.5 + i * 0.5, 2.4, 0.75), 0, 1.2), x = 28 + cw * (i + 0.5);
      c.save(); c.globalAlpha = clamp(u, 0, 1); c.translate(0, (1 - u) * 26);
      text(c, hours[i], x, h - 144, 24, 500, 'rgba(255,255,255,0.85)', 'center');
      if (i === 3 || i === 4) cloud(c, x, h - 98, 36, '#fff'); else sun(c, x, h - 100, 46, t, '#ffd60a');
      text(c, tmp[i] + '°', x, h - 50, 32, 600, WHITE, 'center'); c.restore();
    }
  }

  // ---------- Musik (echtes Spektrum) ----------
  var spec = new Float32Array(28);
  function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function musik(c, g) {
    var w = g.w, h = g.h, t = g.t, aw = clamp(g.s(0, 2.4, 0.8), 0, 1.1);
    c.fillStyle = '#161618'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(60 + 220, 100 + 220); c.scale(aw, aw); c.translate(-220, -220);
    rr(c, 0, 0, 440, 440, 48); c.save(); c.clip(); c.fillStyle = '#1b0f2e'; c.fillRect(0, 0, 440, 440);
    var cols = [PINK, PURPLE, BLUE, ORANGE];
    for (var i = 0; i < 4; i++) {
      var bx = 220 + 170 * Math.cos(t * (0.45 + i * 0.13) + i * 1.7), by = 220 + 170 * Math.sin(t * (0.37 + i * 0.11) + i * 2.3), r = 230 + 60 * g.low;
      var rg = c.createRadialGradient(bx, by, 10, bx, by, r); rg.addColorStop(0, rgba(cols[i], 0.95)); rg.addColorStop(1, rgba(cols[i], 0)); c.fillStyle = rg; c.fillRect(0, 0, 440, 440);
    }
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3;
    for (i = 0; i < 3; i++) { var rp = (g.t / BEAT / 2 + i / 3) % 1; c.globalAlpha = (1 - rp) * 0.6; c.beginPath(); c.arc(220, 220, 40 + rp * 230, 0, TAU); c.stroke(); }
    c.globalAlpha = 1; c.restore(); c.restore();
    var tx = 540; c.save(); c.globalAlpha = clamp(g.s(1, 2.6, 0.9), 0, 1);
    text(c, 'Electro Dreams', tx, 218, 50, 700, WHITE); text(c, 'Arulo', tx, 266, 36, 500, 'rgb(255,95,125)');
    var pos = g.t, dur = g.A.duration, pw = w - tx - 56;
    rr(c, tx, 322, pw, 9, 4.5); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fill(); rr(c, tx, 322, Math.max(9, pw * clamp(pos / dur, 0, 1)), 9, 4.5); c.fillStyle = WHITE; c.fill();
    c.beginPath(); c.arc(tx + pw * clamp(pos / dur, 0, 1), 326.5, 11, 0, TAU); c.fill();
    text(c, mmss(pos), tx, 372, 24, 500, GRAY); text(c, '-' + mmss(dur - pos), tx + pw, 372, 24, 500, GRAY, 'right'); c.restore();
    var cy = 440, cx = tx + pw / 2, ca = clamp(g.s(2, 2.6, 0.9), 0, 1); c.save(); c.globalAlpha = ca; c.fillStyle = WHITE;
    [[-110, -1], [110, 1]].forEach(function (d) { c.beginPath(); c.moveTo(cx + d[0] - 18 * d[1], cy - 18); c.lineTo(cx + d[0] + 4 * d[1], cy); c.lineTo(cx + d[0] - 18 * d[1], cy + 18); c.closePath(); c.fill(); c.beginPath(); c.moveTo(cx + d[0] + 2 * d[1], cy - 18); c.lineTo(cx + d[0] + 24 * d[1], cy); c.lineTo(cx + d[0] + 2 * d[1], cy + 18); c.closePath(); c.fill(); });
    rr(c, cx - 22, cy - 28, 14, 56, 4); c.fill(); rr(c, cx + 8, cy - 28, 14, 56, 4); c.fill(); c.restore();
    g.A.spectrum(g.t, spec); var n = 28, bw = (pw - 4 * (n - 1)) / n;
    for (i = 0; i < n; i++) {
      var v = spec[i] * clamp(g.s(3 + i * 0.05, 2.2, 0.9), 0, 1), bh = 8 + v * 100, x = tx + i * (bw + 4);
      var gr = c.createLinearGradient(0, 560 - bh, 0, 560); gr.addColorStop(0, '#ff5f7d'); gr.addColorStop(1, '#bf5af2'); rr(c, x, 560 - bh, bw, bh, bw / 2); c.fillStyle = gr; c.fill();
    }
  }

  // ---------- Fitness ----------
  function ring(c, cx, cy, r, lw, p, col) {
    c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = rgba(col, 0.2); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    if (p <= 0.003) return; c.strokeStyle = rgba(col, 1); c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(p, 1.0), false); c.stroke();
    if (p > 1) { c.strokeStyle = rgba(col, 1); c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * (p - 1), false); c.stroke(); }
  }
  function fitness(c, g) {
    var w = g.w, h = g.h, rings = [[200, [255, 45, 85], 0.83, 'BEWEGEN', 498, 600, 'KCAL'], [152, [150, 240, 20], 0.8, 'TRAINING', 24, 30, 'MIN'], [104, [30, 229, 255], 0.75, 'STEHEN', 9, 12, 'STD']];
    c.fillStyle = '#121214'; c.fillRect(0, 0, w, h);
    for (var i = 0; i < 3; i++) {
      var R = rings[i], u = clamp(g.s(0.5 + i * 0.5, 1.5, 0.85), 0, 1.15);
      ring(c, 260, 330, R[0], 44, R[2] * u, R[1]);
      var ux = clamp(g.s(1 + i * 0.7, 2.4, 0.8), 0, 1), y = 150 + i * 150;
      c.save(); c.globalAlpha = ux; c.translate((1 - ux) * 40, 0);
      c.fillStyle = rgba(R[1], 1); c.font = '700 26px ' + E.FONT; c.letterSpacing = '3px'; c.textAlign = 'left'; c.fillText(R[3], 560, y); c.letterSpacing = '0px';
      var val = Math.round(R[4] * ease((g.lt - 0.4 - i * 0.35) / 1.6)); var tw = digits(c, String(val), 560, y + 74, 74, 700, WHITE);
      text(c, '/' + R[5] + ' ' + R[6], 560 + tw + 12, y + 74, 34, 600, GRAY); c.restore();
    }
  }

  // ---------- Kalender ----------
  function kalender(c, g) {
    var w = g.w, h = g.h; c.fillStyle = '#1c1c1e'; c.fillRect(0, 0, w, h);
    text(c, 'Oktober', 48, 92, 46, 700, '#ff453a'); text(c, '2026', 48 + measure(c, 'Oktober', 46, 700) + 14, 92, 46, 700, WHITE);
    var days = ['M', 'D', 'M', 'D', 'F', 'S', 'S'], nums = [28, 29, 30, 1, 2, 3, 4], cw = (w - 64) / 7;
    for (var i = 0; i < 7; i++) {
      var x = 32 + cw * (i + 0.5), u = clamp(g.s(0.5 + i * 0.12, 2.6, 0.8), 0, 1);
      c.globalAlpha = u; text(c, days[i], x, 150, 26, 600, i > 4 ? '#636366' : GRAY, 'center');
      if (i === 3) { c.fillStyle = '#ff453a'; c.beginPath(); c.arc(x, 200, 31 * u, 0, TAU); c.fill(); }
      text(c, String(nums[i]), x, 211, 32, 600, i === 3 ? WHITE : (i > 4 ? '#636366' : WHITE), 'center'); c.globalAlpha = 1;
    }
    var ev = [['09:00', 'Stand-up', BLUE], ['11:30', 'Design-Review', PURPLE], ['15:00', 'Fokuszeit', GREEN]];
    for (i = 0; i < 3; i++) {
      var s = clamp(g.s(1.5 + i, 2.4, 0.78), 0, 1.1), y = 262 + i * 116;
      c.save(); c.globalAlpha = clamp(s, 0, 1); c.translate((1 - s) * 140, 0);
      rr(c, 40, y, w - 80, 100, 26); c.fillStyle = rgba(ev[i][2], 0.2); c.fill(); rr(c, 40, y, 10, 100, 5); c.fillStyle = rgba(ev[i][2], 1); c.fill();
      text(c, ev[i][1], 76, y + 46, 34, 600, WHITE); text(c, ev[i][0], 76, y + 82, 26, 500, GRAY); c.restore();
    }
    var ny = lerp(250, 590, ease((g.lt - 1) / 2.6)), na = clamp(g.s(1, 2, 0.9), 0, 1);
    c.globalAlpha = na; c.fillStyle = '#ff453a'; c.fillRect(28, ny - 1.5, w - 56, 3); c.beginPath(); c.arc(30, ny, 9, 0, TAU); c.fill(); c.globalAlpha = 1;
  }

  // ---------- Nachrichten ----------
  function bubble(c, x, y, str, out, u) {
    c.font = '500 34px ' + E.FONT; var tw = c.measureText(str).width, bw = tw + 56, bh = 74, bx = out ? x - bw : x;
    c.save(); c.globalAlpha = clamp(u * 1.6, 0, 1); c.translate(out ? x : x, y + bh); c.scale(0.55 + 0.45 * Math.min(u, 1.08), 0.55 + 0.45 * Math.min(u, 1.08)); c.translate(out ? -x : -x, -(y + bh));
    rr(c, bx, y, bw, bh, 37); c.fillStyle = out ? '#0a84ff' : '#2c2c2e'; c.fill(); text(c, str, bx + 28, y + 50, 34, 500, WHITE); c.restore();
  }
  function nachrichten(c, g) {
    var w = g.w, h = g.h; c.fillStyle = '#111113'; c.fillRect(0, 0, w, h);
    rr(c, 0, 0, w, 112, 0); c.fillStyle = 'rgba(40,40,44,0.9)'; c.fill();
    var gr = c.createLinearGradient(0, 20, 0, 92); gr.addColorStop(0, '#a5a5ab'); gr.addColorStop(1, '#6b6b72'); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, 46, 30, 0, TAU); c.fill(); text(c, 'A', w / 2, 58, 32, 600, WHITE, 'center');
    text(c, 'Anna', w / 2, 100, 24, 500, GRAY, 'center');
    bubble(c, 48, 150, 'Bist du schon unterwegs?', false, g.s(1, 2.4, 0.7));
    bubble(c, w - 48, 244, 'Fast. Noch 12 Minuten.', true, g.s(2.5, 2.4, 0.7));
    if (g.lt > 3.5 * BEAT && g.lt < 5 * BEAT) {   // Tipp-Anzeige vor der dritten Nachricht
      rr(c, 48, 338, 130, 74, 37); c.fillStyle = '#2c2c2e'; c.fill();
      for (var i = 0; i < 3; i++) { var by = Math.sin(g.t * 9 - i * 0.9) * 6; c.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.3 * Math.sin(g.t * 9 - i * 0.9)).toFixed(2) + ')'; c.beginPath(); c.arc(88 + i * 22, 375 + by, 8, 0, TAU); c.fill(); }
    }
    bubble(c, 48, 338, 'Perfekt, ich bestelle schon.', false, g.lt > 5 * BEAT ? g.s(5, 2.4, 0.7) : 0);
    bubble(c, w - 48, 432, 'Bis gleich!', true, g.s(6.5, 2.4, 0.7));
    c.globalAlpha = clamp(g.s(7.5, 3, 1), 0, 1); text(c, 'Zugestellt', w - 52, 534, 24, 500, GRAY, 'right'); c.globalAlpha = 1;
    rr(c, 36, h - 84, w - 72, 56, 28); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; c.stroke(); text(c, 'Nachricht', 70, h - 46, 26, 500, '#636366');
  }

  // ---------- Aktien ----------
  var SER = (function () { var a = [], v = 0.2; for (var i = 0; i < 48; i++) { v += (E.h2(i, 7) - 0.38) * 0.14 + 0.012; a.push(clamp(v, 0, 1.2)); } var mn = Math.min.apply(0, a), mx = Math.max.apply(0, a); return a.map(function (x) { return (x - mn) / (mx - mn); }); })();
  function aktien(c, g) {
    var w = g.w, h = g.h; c.fillStyle = '#111113'; c.fillRect(0, 0, w, h);
    text(c, 'Beispiel AG', 56, 92, 40, 700, WHITE); text(c, 'BSP', 56 + measure(c, 'Beispiel AG', 40, 700) + 16, 92, 28, 600, GRAY);
    var pr = lerp(1180, 1284.6, ease((g.lt - 0.4) / 1.8)); digits(c, fmtDE(pr, 2), 56, 190, 92, 700, WHITE);
    var chg = clamp(g.s(2, 2.4, 0.8), 0, 1.1); c.save(); c.globalAlpha = clamp(chg, 0, 1); pill(c, w - 56 - 190, 118, 190, 64, 'rgba(48,209,88,0.2)'); text(c, '+2,4 %', w - 56 - 95, 162, 34, 700, '#30d158', 'center'); c.restore();
    var cx0 = 56, cx1 = w - 130, cy0 = 270, cy1 = 510, rp = ease((g.lt - 0.6) / 2.2);
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2; for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx0, cy0 + (cy1 - cy0) * i / 3); c.lineTo(w - 56, cy0 + (cy1 - cy0) * i / 3); c.stroke(); }
    var P = SER.map(function (v, k) { return [lerp(cx0, cx1, k / (SER.length - 1)), lerp(cy1, cy0, v)]; });
    var xr = lerp(cx0, cx1, rp);
    c.save(); c.beginPath(); c.rect(0, 0, xr, h); c.clip();
    c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (i = 1; i < P.length - 1; i++) { var mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; c.quadraticCurveTo(P[i][0], P[i][1], mx, my); } c.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    c.strokeStyle = '#30d158'; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    c.lineTo(P[P.length - 1][0], cy1 + 20); c.lineTo(P[0][0], cy1 + 20); c.closePath(); var ag = c.createLinearGradient(0, cy0, 0, cy1 + 20); ag.addColorStop(0, 'rgba(48,209,88,0.38)'); ag.addColorStop(1, 'rgba(48,209,88,0)'); c.fillStyle = ag; c.fill(); c.restore();
    var fi = rp * (P.length - 1), k0 = Math.min(P.length - 2, Math.floor(fi)), q = [lerp(P[k0][0], P[k0 + 1][0], fi - k0), lerp(P[k0][1], P[k0 + 1][1], fi - k0)];
    c.fillStyle = 'rgba(48,209,88,' + (0.25 * (1 - (g.t / BEAT) % 1)).toFixed(2) + ')'; c.beginPath(); c.arc(q[0], q[1], 14 + 22 * ((g.t / BEAT) % 1), 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 11, 0, TAU); c.fill(); c.fillStyle = '#30d158'; c.beginPath(); c.arc(q[0], q[1], 6, 0, TAU); c.fill();
    var lab = ['1T', '1W', '1M', '3M', '1J'], sel = lerp(1, 2, clamp(g.s(3.5, 3, 0.9), 0, 1)), bw = (w - 112) / 5;
    for (i = 0; i < 5; i++) text(c, lab[i], 56 + bw * (i + 0.5), h - 52, 28, 600, Math.abs(i - sel) < 0.5 ? WHITE : GRAY, 'center');
    pill(c, 56 + bw * (sel + 0.5) - 44, h - 90, 88, 54, 'rgba(255,255,255,0.12)'); text(c, lab[Math.round(sel)], 56 + bw * (sel + 0.5), h - 52, 28, 700, WHITE, 'center');
  }

  // ---------- Zuhause ----------
  function zuhause(c, g) {
    var w = g.w, h = g.h, b = E.beat(g.t), ph = E.frac(b / 8), lamp = sstep(0.0, 0.04, ph) * (1 - sstep(0.78, 0.82, ph));
    c.fillStyle = '#121214'; c.fillRect(0, 0, w, h); text(c, 'Zuhause', 40, 84, 46, 700, WHITE);
    var tw = (w - 72 - 20) / 2, th = 232, T = [[36, 110], [36 + tw + 20, 110], [36, 110 + th + 20], [36 + tw + 20, 110 + th + 20]];
    var u0 = clamp(g.s(0.5, 2.4, 0.8), 0, 1);
    for (var i = 0; i < 4; i++) {
      var u = i === 0 ? u0 : clamp(g.s(0.5 + i * 0.5, 2.4, 0.8), 0, 1), x = T[i][0], y = T[i][1]; c.save(); c.globalAlpha = Math.max(u, g.lt > 90 ? 1 : 0); c.translate(0, (1 - Math.max(u, g.lt > 90 ? 1 : 0)) * 30);
      rr(c, x, y, tw, th, 36); c.fillStyle = i === 0 ? rgba(mixc([44, 44, 46], [255, 214, 10], lamp * 0.92), 1) : '#2c2c2e'; c.fill();
      var dark = i === 0 && lamp > 0.5, tc = dark ? '#1c1c1e' : WHITE, sc2 = dark ? 'rgba(0,0,0,0.55)' : GRAY;
      if (i === 0) { c.fillStyle = dark ? '#1c1c1e' : '#8e8e93'; c.beginPath(); c.arc(x + 62, y + 70, 24, Math.PI, 0); c.lineTo(x + 52, y + 98); c.lineTo(x + 72, y + 98); c.closePath(); c.fill(); text(c, 'Wohnzimmer', x + 28, y + 170, 32, 700, tc); text(c, lamp > 0.5 ? 'An' : 'Aus', x + 28, y + 206, 28, 500, sc2); }
      if (i === 1) { c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.arc(x + tw / 2, y + 140, 70, Math.PI * 0.8, Math.PI * 2.2); c.stroke(); c.strokeStyle = '#ff9f0a'; c.beginPath(); c.arc(x + tw / 2, y + 140, 70, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * 0.62)); c.stroke(); digits(c, '21,5°', x + tw / 2, y + 156, 46, 700, WHITE, 'center'); text(c, 'Heizung', x + tw / 2, y + 36, 26, 600, GRAY, 'center'); }
      if (i === 2) { rr(c, x + 28, y + 56, 56, 44, 10); c.fillStyle = '#30d158'; c.fill(); c.strokeStyle = '#30d158'; c.lineWidth = 8; c.beginPath(); c.arc(x + 56, y + 56, 16, Math.PI, 0); c.stroke(); text(c, 'Haustür', x + 28, y + 170, 32, 700, WHITE); text(c, 'Verriegelt', x + 28, y + 206, 28, 500, GRAY); }
      if (i === 3) { for (var k = 0; k < 4; k++) { var bh = 14 + 46 * (0.5 + 0.5 * Math.sin(g.t * 5 + k * 1.7)) * (0.4 + 0.6 * g.low); rr(c, x + 28 + k * 22, y + 100 - bh, 12, bh, 6); c.fillStyle = '#ff375f'; c.fill(); } text(c, 'Küche', x + 28, y + 170, 32, 700, WHITE); text(c, 'Wiedergabe', x + 28, y + 206, 28, 500, GRAY); }
      c.restore();
    }
  }
  function mixc(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }

  // ---------- Notizen ----------
  function notizen(c, g) {
    var w = g.w, h = g.h, t = g.t; c.fillStyle = '#1c1c1e'; c.fillRect(0, 0, w, h);
    rr(c, 0, 0, w, 120, 0); c.fillStyle = '#2c2c2e'; c.fill(); c.fillStyle = '#ffd60a'; rr(c, 44, 36, 50, 50, 14); c.fill(); c.fillStyle = '#1c1c1e'; for (var i = 0; i < 3; i++) c.fillRect(56, 50 + i * 11, 26, 3);
    text(c, 'Notizen', 116, 76, 40, 700, WHITE);
    text(c, 'Ideen', 56, 220, 74, 800, WHITE);
    var lines = ['Neun Apps in einem Frame', 'Kamera fährt im Takt', 'Musik: Electro Dreams'], cyc = (t * 16) % 120, n = Math.floor(cyc), used = 0;
    for (i = 0; i < 3; i++) {
      var s = lines[i], k = clamp(n - used, 0, s.length + 4); used += s.length + 6; var shown = s.slice(0, Math.min(k, s.length));
      c.fillStyle = '#ffd60a'; c.beginPath(); c.arc(70, 300 + i * 88 - 10, 8, 0, TAU); c.fill(); text(c, shown, 104, 300 + i * 88, 40, 500, WHITE);
      if (k > 0 && k <= s.length + 3 && Math.floor(t * 2) % 2 === 0) { c.fillStyle = '#ffd60a'; c.fillRect(104 + measure(c, shown, 40, 500) + 4, 300 + i * 88 - 34, 4, 44); }
    }
  }

  root.Cards = {
    karten: { w: 1000, h: 640, draw: karten }, wetter: { w: 700, h: 640, draw: wetter }, musik: { w: 1000, h: 640, draw: musik },
    fitness: { w: 1000, h: 640, draw: fitness }, kalender: { w: 700, h: 640, draw: kalender }, nachrichten: { w: 1000, h: 640, draw: nachrichten },
    aktien: { w: 1000, h: 640, draw: aktien }, zuhause: { w: 700, h: 640, draw: zuhause }, notizen: { w: 1000, h: 640, draw: notizen }
  };
})(typeof window !== 'undefined' ? window : globalThis);
