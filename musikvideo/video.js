/* video.js — jeder Frame ist reines JavaScript.
 * Es gibt kein Bild, kein Video, kein CSS und keinen Zustand zwischen Frames:
 * seek(t) zeichnet das komplette Bild aus der Zeit t und den Samples des Songs.
 * Gleiches t, gleiche Pixel (Zufall nur über seeded Hashes).
 */
(function (root) {
  'use strict';

  var W = 1920, H = 1080, CX = W / 2, CY = H / 2, HY = 610;           // HY = Horizont
  var MONO = "ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace";
  var SANS = "'Arial Black', 'Helvetica Neue', Impact, 'DejaVu Sans', Arial, sans-serif";
  var BEAT = 0.5, BAR = 2, TAU = Math.PI * 2;

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var sstep = function (a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  var frac = function (x) { return x - Math.floor(x); };
  function hash(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function h2(a, b) { return hash(a * 7919 + b * 104729 + 12345); }
  // Feder (geschlossene Sprungantwort, wie im Motion-Design-Skill): kein Zustand nötig
  function spring(tau, f, z) {
    if (tau <= 0) return 0; var w = TAU * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + z * w / wd * Math.sin(wd * tau));
  }
  function lastIdx(arr, t) { var lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
  var hsl = function (h, s, l, a) { return 'hsla(' + (((h % 360) + 360) % 360).toFixed(1) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a).toFixed(3) + ')'; };

  // Körper für die Drahtgitter
  var PHI = (1 + Math.sqrt(5)) / 2, ICO = [], ICOE = [], CUBE = [], CUBEE = [];
  [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
    .forEach(function (v) { var l = Math.hypot(v[0], v[1], v[2]); ICO.push([v[0] / l, v[1] / l, v[2] / l]); });
  for (var i = 0; i < 12; i++) for (var j = i + 1; j < 12; j++) if (Math.abs(Math.hypot(ICO[i][0] - ICO[j][0], ICO[i][1] - ICO[j][1], ICO[i][2] - ICO[j][2]) - 1.0515) < 0.02) ICOE.push([i, j]);
  for (i = 0; i < 8; i++) CUBE.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1]);
  for (i = 0; i < 8; i++) for (j = i + 1; j < 8; j++) { var x = i ^ j; if (x === 1 || x === 2 || x === 4) CUBEE.push([i, j]); }

  function create(canvas, song, opts) {
    opts = opts || {};
    var FPS = opts.fps || 30, TOTAL = song.duration, SR = song.sr, EV = song.events;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // ---------- statische Vorberechnungen (nur aus festen Seeds, nie aus der Zeit) ----------
    var stars = []; for (var s = 0; s < 280; s++) stars.push({ x: hash(s) * W, y: Math.pow(hash(s + 999), 1.4) * HY, r: 0.6 + hash(s + 5000) * 1.8, p: hash(s + 77) * TAU, v: 4 + hash(s + 31) * 14 });
    var GL = '01{}[]()<>=;:+-*/&|!?ƒλΣπ∂∫tfx'.split('');
    var RAIN = []; for (s = 0; s < 64; s++) RAIN.push({ x: s * 30 + 15, sp: 240 + 420 * hash(s + 1), len: 8 + Math.floor(hash(s + 2) * 14), off: hash(s + 3) * 4000, c: hash(s + 4) });
    var GRID = new Float32Array(6000), acc = 0;                    // Gitter-Position, aus der Geschwindigkeit integriert
    function gridSpeed(t) { return t < 8 ? lerp(0.5, 1.2, sstep(0, 8, t)) : t < 16 ? lerp(1.4, 5.5, Math.pow((t - 8) / 8, 2)) : t < 32 ? 3.2 : t < 40 ? 0.8 : t < 48 ? 3.6 : 0.5; }
    for (s = 0; s < GRID.length; s++) { GRID[s] = acc; acc += gridSpeed(s / 100) * 0.01; }
    var gridPos = function (t) { var x = clamp(t, 0, 59.98) * 100, k = Math.floor(x); return lerp(GRID[k], GRID[k + 1], x - k); };

    var sunC = document.createElement('canvas'); sunC.width = sunC.height = 640; var sx = sunC.getContext('2d');
    var post = document.createElement('canvas'); post.width = W; post.height = H; var px = post.getContext('2d');
    var vg = px.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,0,10,0.72)');
    px.fillStyle = vg; px.fillRect(0, 0, W, H);
    px.fillStyle = 'rgba(0,0,0,0.16)'; for (var yy = 0; yy < H; yy += 3) px.fillRect(0, yy, W, 1);

    // ---------- Audio-Zugriff ----------
    var lv = song.level, NB = 32, SPEC_N = 2048, win = new Float32Array(SPEC_N), sbuf = new Float32Array(SPEC_N), coef = [];
    for (s = 0; s < SPEC_N; s++) win[s] = 0.5 - 0.5 * Math.cos(TAU * s / (SPEC_N - 1));
    for (s = 0; s < NB; s++) coef.push(2 * Math.cos(TAU * (55 * Math.pow(12000 / 55, s / (NB - 1))) / SR));
    function level(arr, t) { var x = t * lv.rate, i = Math.floor(x); return (i < 0 || i >= arr.length - 1) ? 0 : lerp(arr[i], arr[i + 1], x - i); }
    function spectrum(t, out) { // Goertzel über 2048 Samples: echtes Spektrum, 32 log-Bänder
      var end = Math.floor(t * SR), st = end - SPEC_N;
      if (st < 0 || end > song.n) { for (var j = 0; j < NB; j++) out[j] = 0; return out; }
      for (var i = 0; i < SPEC_N; i++) sbuf[i] = (song.L[st + i] + song.R[st + i]) * 0.5 * win[i];
      for (j = 0; j < NB; j++) {
        var c = coef[j], s1 = 0, s2 = 0;
        for (i = 0; i < SPEC_N; i++) { var s0 = sbuf[i] + c * s1 - s2; s2 = s1; s1 = s0; }
        var mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (SPEC_N / 4);
        out[j] = clamp((20 * Math.log10(mag + 1e-6) + 64 + j * 0.7) / 46, 0, 1);
      }
      return out;
    }
    var spA = new Float32Array(NB), spB = new Float32Array(NB);
    function pulse(arr, t, tau) { var k = lastIdx(arr, t); return k < 0 ? 0 : Math.exp(-(t - arr[k]) / tau); }

    // ---------- Bausteine ----------
    function wire(V, E, rx, ry, rz, sc, cx, cy, col, lw, al) {
      var cax = Math.cos(rx), sax = Math.sin(rx), cay = Math.cos(ry), say = Math.sin(ry), caz = Math.cos(rz), saz = Math.sin(rz), P = [];
      for (var i = 0; i < V.length; i++) {
        var x = V[i][0], y = V[i][1], z = V[i][2], t1;
        t1 = y * cax - z * sax; z = y * sax + z * cax; y = t1;
        t1 = x * cay + z * say; z = -x * say + z * cay; x = t1;
        t1 = x * caz - y * saz; y = x * saz + y * caz; x = t1;
        var k = 1100 / (1100 + z * sc); P.push([cx + x * sc * k, cy + y * sc * k, k]);
      }
      ctx.lineCap = 'round'; ctx.strokeStyle = col;
      for (var pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = al * (pass ? 1 : 0.22); ctx.lineWidth = pass ? lw : lw * 4.5; ctx.beginPath();
        for (i = 0; i < E.length; i++) { ctx.moveTo(P[E[i][0]][0], P[E[i][0]][1]); ctx.lineTo(P[E[i][1]][0], P[E[i][1]][1]); }
        ctx.stroke();
      }
      ctx.globalAlpha = al; ctx.fillStyle = '#fff';
      for (i = 0; i < P.length; i++) { ctx.beginPath(); ctx.arc(P[i][0], P[i][1], 3 * P[i][2] + lw * 0.6, 0, TAU); ctx.fill(); }
    }

    function world(t, a, kp, b, pal) {
      if (a <= 0.001) return;
      ctx.save(); ctx.globalAlpha = a;
      var g = ctx.createLinearGradient(0, 0, 0, HY); g.addColorStop(0, '#04010c'); g.addColorStop(0.55, '#150434'); g.addColorStop(1, pal.sky);
      ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, HY + 100);
      // Sterne
      ctx.fillStyle = '#fff';
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i], x = (st.x + t * st.v) % W, al = (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2 + st.p), 2)) * clamp(1 - st.y / HY * 0.4, 0, 1);
        ctx.globalAlpha = a * al; ctx.fillRect(x, st.y, st.r, st.r);
      }
      ctx.globalAlpha = a;
      // Sonne (eigenes Offscreen-Canvas, Streifen per destination-out)
      var rise = sstep(1.5, 6.5, t), sunY = lerp(HY + 330, HY - 175, 1 - Math.pow(1 - rise, 3)), sc = 1 + 0.06 * kp + 0.012 * Math.sin(b * Math.PI);
      sx.clearRect(0, 0, 640, 640); sx.globalCompositeOperation = 'source-over';
      var sg = sx.createLinearGradient(0, 60, 0, 580); sg.addColorStop(0, pal.sun0); sg.addColorStop(0.5, pal.sun1); sg.addColorStop(1, pal.sun2);
      sx.fillStyle = sg; sx.beginPath(); sx.arc(320, 320, 260, 0, TAU); sx.fill();
      sx.globalCompositeOperation = 'destination-out';
      var ph = frac(b / 4);
      for (i = 0; i < 9; i++) { var yy = 340 + (i + ph) * 34, hh = 3 + (i + ph) * 3.4; sx.fillRect(0, yy, 640, hh); }
      sx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(CX, sunY, 80, CX, sunY, 620); gg.addColorStop(0, pal.glow); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * (0.5 + 0.3 * kp); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, HY + 60);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      ctx.drawImage(sunC, CX - 320 * sc, sunY - 320 * sc, 640 * sc, 640 * sc);
      // Berge
      for (var layer = 0; layer < 2; layer++) {
        ctx.beginPath(); ctx.moveTo(-20, HY);
        for (x = -20; x <= W + 20; x += 20) {
          var side = Math.pow(Math.abs(x - CX) / CX, 1.6), ph2 = layer * 2.1;
          var yv = HY - side * (150 - layer * 50) * (0.6 + 0.4 * Math.sin(x * 0.006 + ph2)) - side * 40 * Math.sin(x * 0.021 + ph2 * 3) - 6 - layer * 4;
          ctx.lineTo(x, yv);
        }
        ctx.lineTo(W + 20, HY); ctx.closePath(); ctx.fillStyle = layer ? '#0c0224' : '#12042e'; ctx.fill();
        ctx.strokeStyle = pal.ridge; ctx.lineWidth = 2; ctx.globalAlpha = a * (layer ? 0.4 : 0.8); ctx.stroke(); ctx.globalAlpha = a;
      }
      // Boden + Gitter
      var fg = ctx.createLinearGradient(0, HY, 0, H); fg.addColorStop(0, '#1b0446'); fg.addColorStop(1, '#07010f');
      ctx.fillStyle = fg; ctx.fillRect(-100, HY, W + 200, H - HY + 100);
      ctx.globalCompositeOperation = 'lighter';
      var gridA = a * sstep(0.8, 3, t), pos = gridPos(t), boost = 0.6 + 0.4 * kp;
      ctx.lineWidth = 2; ctx.strokeStyle = pal.grid;
      for (i = 0; i < 24; i++) {
        var u = (i + frac(pos)) / 24, y = HY + (H - HY) * Math.pow(u, 2.3);
        ctx.globalAlpha = gridA * boost * (0.12 + 0.88 * u); ctx.lineWidth = 1 + 3 * u;
        ctx.beginPath(); ctx.moveTo(-50, y); ctx.lineTo(W + 50, y); ctx.stroke();
      }
      for (var k = -16; k <= 16; k++) {
        ctx.globalAlpha = gridA * boost * 0.7 * (1 - Math.abs(k) / 20); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(CX + k * 4, HY); ctx.lineTo(CX + k * 230, H + 40); ctx.stroke();
      }
      var hg = ctx.createLinearGradient(0, HY - 30, 0, HY + 30); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, pal.horizon); hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * (0.55 + 0.45 * kp); ctx.fillStyle = hg; ctx.fillRect(0, HY - 30, W, 60);
      ctx.restore();
    }

    function rain(t, a) {
      if (a <= 0.01) return;
      ctx.save(); ctx.font = '26px ' + MONO; ctx.textAlign = 'center'; ctx.globalCompositeOperation = 'lighter';
      for (var c = 0; c < RAIN.length; c++) {
        var R = RAIN[c], head = (t * R.sp + R.off) % (H + R.len * 30 + 200);
        ctx.fillStyle = R.c < 0.5 ? '#19f3ff' : '#ff2e97';
        for (var j = 0; j < R.len; j++) {
          var y = head - j * 30; if (y < -30 || y > H + 30) continue;
          var ch = GL[Math.floor(hash(c * 977 + j * 131 + Math.floor(t * 7 + c * 0.37)) * GL.length)];
          if (j === 0) { ctx.globalAlpha = a; ctx.fillStyle = '#e6fffb'; ctx.fillText(ch, R.x, y); ctx.fillStyle = R.c < 0.5 ? '#19f3ff' : '#ff2e97'; }
          else { ctx.globalAlpha = a * 0.75 * Math.pow(1 - j / R.len, 1.6); ctx.fillText(ch, R.x, y); }
        }
      }
      ctx.restore();
    }

    function tunnel(t, a, kp, b, pal) {
      if (a <= 0.01) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      var N = 15;
      for (var i = 0; i < N; i++) {
        var u = frac(i / N + b * 0.07), sz = Math.pow(u, 2.4) * H * 0.95 * (1 + 0.07 * kp), ang = t * 0.35 + i * 0.21 + b * 0.02;
        var swx = Math.sin(t * 0.7 + i * 0.3) * sz * 0.12, swy = Math.cos(t * 0.5 + i * 0.4) * sz * 0.08;
        ctx.strokeStyle = hsl(pal.h0 + pal.hr * (0.5 + 0.5 * Math.sin(i * 0.7 + t * 1.1)), 100, 62);
        ctx.globalAlpha = a * clamp(u * 1.6, 0, 1);
        ctx.lineWidth = 1 + u * 6; ctx.beginPath();
        for (var q = 0; q < 4; q++) {
          var aa = ang + q * Math.PI / 2 + Math.PI / 4, px2 = CX + swx + Math.cos(aa) * sz, py2 = CY - 40 + swy + Math.sin(aa) * sz;
          if (q) ctx.lineTo(px2, py2); else ctx.moveTo(px2, py2);
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }

    function bursts(t, a, pal) {
      var k = lastIdx(EV.kick, t); if (k < 0 || a <= 0.01) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var q = 0; q < 4 && k - q >= 0; q++) {
        var age = t - EV.kick[k - q]; if (age > 1.5) break;
        // Schockring
        var rr = age * 1500, al = clamp(1 - age / 0.8, 0, 1) * 0.55 * a;
        if (al > 0) { ctx.globalAlpha = al; ctx.strokeStyle = pal.ring; ctx.lineWidth = 2 + 10 * (1 - age / 0.8); ctx.beginPath(); ctx.arc(CX, CY - 40, rr, 0, TAU); ctx.stroke(); }
        // Partikel
        var kid = k - q;
        for (var j = 0; j < 36; j++) {
          var ang = hash(kid * 53 + j) * TAU, v = 220 + 760 * h2(kid, j), life = 0.9 + 0.6 * h2(j, kid);
          if (age > life) continue;
          var x = CX + Math.cos(ang) * v * age, y = CY - 40 + Math.sin(ang) * v * age + 520 * age * age, f = 1 - age / life;
          ctx.globalAlpha = a * f; ctx.fillStyle = pal.part[j % 3]; var sz = 2 + 6 * f; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
      ctx.restore();
    }

    function eq(t, a, pal) {
      if (a <= 0.01) return;
      spectrum(t, spA); spectrum(t - 0.07, spB);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var bw = 38, gap = 14, x0 = CX - (NB * (bw + gap) - gap) / 2;
      for (var j = 0; j < NB; j++) {
        var v = Math.max(spA[j], spB[j] * 0.86), hgt = 24 + v * 230, x = x0 + j * (bw + gap);
        var g = ctx.createLinearGradient(0, 0, 0, hgt); g.addColorStop(0, pal.eq0); g.addColorStop(1, pal.eq1);
        ctx.globalAlpha = a * (0.55 + 0.45 * v); ctx.fillStyle = g; ctx.fillRect(x, 0, bw, hgt);
        ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(x, hgt, bw, 4);
      }
      ctx.restore();
    }

    function scope(t, y, amp, col, lw, a) { // Oszilloskop: die echten Samples
      var end = Math.floor(t * SR), n = 1024, st = end - n; if (st < 0 || end > song.n) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.strokeStyle = col;
      for (var pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = a * (pass ? 1 : 0.25); ctx.lineWidth = pass ? lw : lw * 5; ctx.beginPath();
        for (var i = 0; i < n; i += 4) {
          var v = (song.L[st + i] + song.R[st + i]) * 0.5, x = i / (n - 1) * W, yy = y - v * amp;
          if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function breakdown(t, a, b) {
      if (a <= 0.01) return;
      ctx.save(); ctx.globalAlpha = a;
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05011a'); g.addColorStop(1, '#14063c'); ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 3; k++) { // Aurora
        var cx = CX + 520 * Math.sin(t * 0.3 + k * 2.1), cy = 330 + 140 * Math.sin(t * 0.21 + k), r = 760;
        var rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, r); rg.addColorStop(0, hsl([185, 290, 330][k], 90, 55, 0.3)); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a; ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }
      // Fireflies
      ctx.fillStyle = '#cfeaff'; var lowv = level(lv.low, t);
      for (k = 0; k < 90; k++) {
        var hx = hash(k + 400), hy = hash(k + 900), x = hx * W + 90 * Math.sin(t * 0.4 + hx * 20), y = hy * H + 60 * Math.cos(t * 0.3 + hy * 13);
        ctx.globalAlpha = a * (0.15 + 0.85 * Math.pow(Math.sin(t * 1.4 + hx * 30) * 0.5 + 0.5, 3)); var rr = 1.5 + 3.5 * hash(k + 1300); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      }
      // Spirograph: wächst mit der Zeit
      var th = (t - 32) * 3.2, Rr = 300, rr2 = 77, d = 150, n = Math.floor(clamp(th, 0, 60) * 60);
      ctx.strokeStyle = hsl(285, 100, 70); ctx.lineWidth = 2; ctx.globalAlpha = a * 0.6; ctx.beginPath();
      for (k = 0; k <= n; k++) {
        var tt = k / 60, px2 = (Rr - rr2) * Math.cos(tt) + d * Math.cos((Rr - rr2) / rr2 * tt), py2 = (Rr - rr2) * Math.sin(tt) - d * Math.sin((Rr - rr2) / rr2 * tt);
        if (k) ctx.lineTo(CX + px2 * 0.95, CY + py2 * 0.95); else ctx.moveTo(CX + px2 * 0.95, CY + py2 * 0.95);
      }
      ctx.stroke();
      // Kreisförmige Wellenform aus den echten Samples
      var end = Math.floor(t * SR), nS = 1600, st = end - nS, sp = pulse(EV.snare, t, 0.12), scl = 1 + 0.12 * sp + 0.05 * lowv;
      if (st > 0 && end < song.n) {
        for (var pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = a * (pass ? 1 : 0.22); ctx.lineWidth = pass ? 3 : 14; ctx.strokeStyle = pass ? hsl(185, 100, 70) : hsl(185, 100, 55); ctx.beginPath();
          for (var i = 0; i <= 720; i++) {
            var ang = i / 720 * TAU + t * 0.2, v = (song.L[st + (i % 720) * 2] + song.R[st + (i % 720) * 2]) * 0.5, r = (270 + 380 * v) * scl;
            var x2 = CX + Math.cos(ang) * r, y2 = CY + Math.sin(ang) * r;
            if (i) ctx.lineTo(x2, y2); else ctx.moveTo(x2, y2);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function charge(t, a) { // Sog vor dem Drop: Ringe, die sich pro Beat zusammenziehen
      if (a <= 0.01) return;
      var per = t < 12 ? BEAT : t < 14 ? BEAT / 2 : t < 15.9 ? BEAT / 4 : 0.02, ph = frac(t / per), r = 1000 * Math.pow(1 - ph, 2.2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#19f3ff'; ctx.lineWidth = 3 + 8 * ph; ctx.globalAlpha = a * (0.15 + 0.6 * ph);
      ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.stroke(); ctx.restore();
    }

    // ---------- Text ----------
    var widthCache = {};
    function prefixWidths(text, font) {
      var key = font + '|' + text; if (widthCache[key]) return widthCache[key];
      ctx.font = font; var ch = Array.from(text), w = [0];
      for (var i = 1; i <= ch.length; i++) w.push(ctx.measureText(ch.slice(0, i).join('')).width);
      return (widthCache[key] = { ch: ch, w: w });
    }
    var LYR = [
      [6.0, 8.0, 'FRAME = f(t)', 0, 200, 0, 'title'],
      [8.0, 10, 'kein Video.', -20, 150, 1], [10, 12, 'keine Datei.', -20, 150, 1], [12, 14, 'nur Code …', -20, 150, 1], [14, 15.9, 'und die Zeit.', -20, 150, 1],
      [16, 18, 'JEDER FRAME', 330, 190, 0], [18, 20, 'IST REINES', 330, 190, 0], [20, 22, 'JAVASCRIPT', 330, 200, 0], [22, 24, 't → PIXEL', 330, 200, 0],
      [24, 26, 'SINUS · COSINUS', 330, 170, 0], [26, 28, 'NEON & RAUSCHEN', 330, 170, 0], [28, 30, 'ALLES BERECHNET', 330, 170, 0], [30, 32, 'NICHTS GEFILMT', 330, 170, 0],
      [32, 34, 'kein Pinsel,', 0, 140, 1], [34, 36, 'kein Stift —', 0, 140, 1], [36, 38, 'nur Mathe', 0, 140, 1], [38, 39.85, 'und ein Beat.', 0, 140, 1],
      [40, 42, 'FRAME = f(t)', 330, 190, 0], [42, 44, '60 × PRO SEKUNDE', 330, 160, 0], [44, 46, 'TANZ MIT DEM CODE', 330, 160, 0], [46, 48, '▶ main()', 330, 190, 0]
    ];
    function lyric(L, t, kp, big) {
      var age = t - L[0], dur = L[1] - L[0], serif = L[5] === 1, font = (serif ? 'italic 700 ' : '900 ') + L[4] + 'px ' + (serif ? "Georgia, 'DejaVu Serif', serif" : SANS);
      var m = prefixWidths(L[2], font), tw = m.w[m.w.length - 1], fs = L[4], maxW = 1700;
      if (tw > maxW) { fs = L[4] * maxW / tw; font = (serif ? 'italic 700 ' : '900 ') + fs.toFixed(1) + 'px ' + (serif ? "Georgia, 'DejaVu Serif', serif" : SANS); m = prefixWidths(L[2], font); tw = m.w[m.w.length - 1]; }
      var ex = clamp((t - (L[1] - 0.22)) / 0.22, 0, 1), y0 = CY + L[3], n = m.ch.length;
      ctx.save(); ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
      var split = big ? 3 + 14 * kp : 2;
      for (var i = 0; i < n; i++) {
        var u = clamp(spring(age - i * Math.min(0.035, 0.4 / n), 3.2, 0.55), 0, 1.15), x = CX - tw / 2 + m.w[i], y = y0 + (1 - u) * 110 - ex * 60;
        var al = clamp(u * 2, 0, 1) * (1 - ex); if (al <= 0) continue;
        ctx.save(); var cw = m.w[i + 1] - m.w[i]; ctx.translate(x + cw / 2, y); var sc = (0.7 + 0.3 * Math.min(u, 1.1)) * (1 + (big ? 0.05 * kp : 0)); ctx.scale(sc, sc);
        ctx.globalAlpha = al; ctx.strokeStyle = 'rgba(4,0,14,0.85)'; ctx.lineWidth = fs * 0.14; ctx.strokeText(m.ch[i], -cw / 2, 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * 0.9;
        ctx.fillStyle = '#19f3ff'; ctx.fillText(m.ch[i], -cw / 2 - split, 0); ctx.fillStyle = '#ff2e97'; ctx.fillText(m.ch[i], -cw / 2 + split, 0);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al; ctx.fillStyle = '#fff'; ctx.fillText(m.ch[i], -cw / 2, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    function terminal(t) {
      var a = 1 - sstep(5.5, 6.1, t); if (a <= 0 || t < 0.4) return;
      var lines = [[0.5, '$ node musikvideo.js', '#ff2e97'], [1.9, '> song.js geladen · 44100 Hz · 2 Kanäle · 0 Samples aus Dateien', '#19f3ff'],
        [3.2, '> for (t = 0; t < ' + Math.round(TOTAL) + '; t += 1 / ' + FPS + ') seek(t);', '#cfeaff'], [4.5, '> ▶ play()', '#ffd24a']];
      ctx.save(); ctx.font = '600 34px ' + MONO; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = a;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i], n = Math.floor((t - ln[0]) * 46); if (n <= 0) continue;
        var s = ln[1].slice(0, n), y = 140 + i * 62; ctx.fillStyle = 'rgba(4,0,14,0.8)'; ctx.fillRect(70, y - 40, ctx.measureText(ln[1]).width + 40, 56);
        ctx.fillStyle = ln[2]; ctx.fillText(s, 90, y);
        if (n < ln[1].length || (i === lines.length - 1 && Math.floor(t * 2) % 2 === 0)) ctx.fillRect(90 + ctx.measureText(s).width + 4, y - 30, 18, 38);
      }
      ctx.restore();
    }

    function endCard(t) {
      var a = sstep(48.0, 48.6, t); if (a <= 0) return;
      var kinds = {}; EV.notes.forEach(function (n) { kinds[n.v] = (kinds[n.v] || 0) + 1; });
      var notes = EV.notes.length, lines = [
        [48.9, 'frames: ' + Math.round(TOTAL * FPS) + ' · alle aus seek(t)'], [49.5, 'noten: ' + notes + ' · kicks: ' + EV.kick.length + ' · synthetisiert, Sample für Sample'],
        [50.1, 'dateien im Video: 0   ·   console.log(\'♪\');']];
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(3,0,12,' + (0.55 * a) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.font = '900 230px ' + SANS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var u = clamp(spring(t - 48.1, 2.8, 0.6), 0, 1.1); ctx.save(); ctx.translate(CX, CY - 130 + (1 - u) * 80); ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#19f3ff'; ctx.fillText('ENDE', -6, 0); ctx.fillStyle = '#ff2e97'; ctx.fillText('ENDE', 6, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.fillText('ENDE', 0, 0); ctx.restore();
      ctx.font = '600 38px ' + MONO; ctx.textAlign = 'left';
      for (var i = 0; i < lines.length; i++) {
        var n = Math.floor((t - lines[i][0]) * 100); if (n <= 0) continue; var s = lines[i][1].slice(0, n), w = ctx.measureText(lines[i][1]).width;
        ctx.fillStyle = i === 2 ? '#ffd24a' : '#cfeaff'; ctx.fillText(s, CX - w / 2, CY + 110 + i * 64);
      }
      ctx.restore();
    }

    var PAL1 = { sky: '#6a1478', sun0: '#ffd24a', sun1: '#ff6a2a', sun2: '#ff2e97', glow: 'rgba(255,60,160,0.55)', ridge: '#ff2e97', grid: '#19f3ff', horizon: 'rgba(255,90,200,0.9)',
      ring: '#19f3ff', part: ['#19f3ff', '#ff2e97', '#ffd24a'], eq0: '#19f3ff', eq1: '#ff2e97', h0: 185, hr: 145, ico: '#19f3ff', ico2: '#ff2e97', cube: '#ffd24a' };
    var PAL2 = { sky: '#7a2a10', sun0: '#fff2a8', sun1: '#ffb02a', sun2: '#ff3d6e', glow: 'rgba(255,150,40,0.6)', ridge: '#ffb02a', grid: '#ff6ac8', horizon: 'rgba(255,200,80,0.95)',
      ring: '#ffd24a', part: ['#ffd24a', '#ff2e97', '#ffffff'], eq0: '#ffd24a', eq1: '#ff2e97', h0: 300, hr: 110, ico: '#ffd24a', ico2: '#19f3ff', cube: '#ff2e97' };

    // ---------- seek(t): ein Frame ----------
    function seek(t) {
      t = clamp(t, 0, TOTAL - 0.001);
      var b = t / BEAT, kp = pulse(EV.kick, t, 0.14), sn = pulse(EV.snare, t, 0.1);
      var d1 = t >= 16 && t < 32, d2 = t >= 40 && t < 48, drop = d1 || d2, brk = t >= 32 && t < 40, build = t >= 8 && t < 16;
      var pal = d2 ? PAL2 : PAL1, buildR = build ? Math.pow((t - 8) / 8, 2) : 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, W, H);

      // Kamera: Zoom + Wackeln
      var zoom = 1 + 0.12 * buildR + (drop ? 0.035 * kp : 0), amp = (drop ? 9 * kp : 0) + 7 * buildR;
      ctx.save(); ctx.translate(CX + Math.sin(t * 91) * amp, CY + Math.cos(t * 83) * amp); ctx.scale(zoom, zoom); ctx.translate(-CX, -CY);

      var worldA = t < 24 ? 1 : t < 32 ? 0 : t < 40 ? 0 : t < 48 ? sstep(40, 40.3, t) : 0.45;
      if (t >= 23.85 && t < 24.15) worldA = 1 - sstep(23.85, 24.15, t);
      world(t, worldA, kp, b, pal);
      var rainA = t < 7 ? 0 : t < 16 ? sstep(7.5, 15.5, t) : t < 24 ? 0.3 : t < 32 ? 0.12 : t < 40 ? 0.22 : t < 48 ? 0.4 : 0.12;
      if (t < 32 || t >= 40) rain(t, rainA * (t >= 48 ? 1 - sstep(48, 49, t) * 0.5 : 1));
      breakdown(t, sstep(31.9, 32.15, t) * (1 - sstep(39.85, 40.02, t)), b);
      var tunA = t >= 24 && t < 32 ? sstep(24, 24.3, t) : t >= 40 && t < 48 ? 0.55 : 0;
      tunnel(t, tunA, kp, b, pal);
      if (build || (t >= 36.5 && t < 39.9)) charge(build ? t : t - 24, build ? sstep(8, 9, t) : 0.7);

      if (drop) {
        var ap = (d1 ? sstep(16, 16.01, t) : 1) * spring(t - (d1 ? 16 : 40), 3, 0.5), vanish = d1 ? 1 - sstep(31.7, 32, t) : 1 - sstep(47.7, 48, t);
        var sc = clamp(ap, 0, 1.2) * vanish * (1 + 0.2 * kp), cyc = CY - 40;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (sc > 0.01) {
          wire(ICO, ICOE, t * 0.45 + b * 0.0, t * 0.8, t * 0.2, 300 * sc, CX, cyc, pal.ico, 3, 0.95);
          wire(ICO, ICOE, -t * 0.7, -t * 0.5 + 1, t * 0.35, 170 * sc * (1 + 0.15 * sn), CX, cyc, pal.ico2, 3, 0.9);
          for (var k = 0; k < 6; k++) {
            var oa = t * 0.9 + k * TAU / 6, ox = Math.cos(oa) * 600 * sc, oz = Math.sin(oa) * 300 * sc, oy = Math.sin(oa * 2 + t) * 70;
            var kk = 1100 / (1100 + oz);
            wire(CUBE, CUBEE, t * 1.1 + k, t * 0.7 + k * 2, t * 0.4, 64 * sc * kk * (1 + 0.3 * kp), CX + ox * kk, cyc + oy + 90 * (kk - 1) * 0, pal.cube, 2.5, 0.9 * clamp(kk * 1.1, 0.3, 1));
          }
        }
        ctx.restore();
        bursts(t, vanish, pal);
        eq(t, vanish * (d1 ? sstep(16, 16.4, t) : sstep(40, 40.4, t)), pal);
        scope(t, CY - 40, 600, pal.ring, 3, 0.5 * vanish);
      } else if (!brk && t < 16) {
        var ia = sstep(2, 4, t);
        scope(t, HY - 20, 220 + 120 * buildR, '#19f3ff', 2.5, 0.3 * ia + 0.3 * buildR);
        if (build) bursts(t, 0.35 * sstep(8, 9, t), pal);
      }
      ctx.restore(); // Ende Kamera

      // Glitch auf Snare-Schlägen (Streifen werden um einige Pixel verschoben)
      var si = lastIdx(EV.snare, t);
      if (drop && si >= 0 && t - EV.snare[si] < 0.12) {
        var gf = 1 - (t - EV.snare[si]) / 0.12; ctx.globalAlpha = 1;
        for (var q = 0; q < 6; q++) {
          var sy = Math.floor(h2(si, q) * (H - 90)), sh = 14 + Math.floor(h2(q, si) * 70), dx = (h2(si + 3, q) - 0.5) * 220 * gf;
          ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh);
        }
      }

      // Look: Vignette + Scanlines
      ctx.drawImage(post, 0, 0);

      // Lyrics + Terminal (kamerafrei, bleiben lesbar)
      terminal(t);
      for (var i = 0; i < LYR.length; i++) if (t >= LYR[i][0] && t < LYR[i][1]) {
        if (LYR[i][6] === 'title') { var tt = t - LYR[i][0]; if (tt < 0.05) continue; }
        lyric(LYR[i], t, kp, drop);
      }
      endCard(t);

      // Blitze auf den Eckpunkten der Struktur + Atempause vor dem Drop
      var F = [[16, 1], [24, 0.35], [32, 0.5], [40, 1], [48, 0.8]];
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < F.length; i++) { var fa = t - F[i][0]; if (fa >= 0 && fa < 0.7) { ctx.globalAlpha = F[i][1] * Math.exp(-fa * 7); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); } }
      ctx.globalCompositeOperation = 'source-over';
      if ((t > 15.82 && t < 16) || (t > 39.82 && t < 40)) { ctx.globalAlpha = 0.86; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = 1;

      // HUD: der Beweis, dass es berechnet wird
      ctx.save(); ctx.font = '600 22px ' + MONO; ctx.fillStyle = 'rgba(207,234,255,0.8)'; ctx.textBaseline = 'top';
      var fr = Math.round(t * FPS), bar = Math.floor(t / BAR) + 1, bt = Math.floor(b % 4) + 1;
      ctx.fillText('frame ' + String(fr).padStart(4, '0') + '   t = ' + t.toFixed(3) + ' s   takt ' + String(bar).padStart(2, '0') + '.' + bt, 36, H - 62);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,210,74,0.85)'; ctx.fillText('100 % JavaScript · 0 Dateien', W - 36, H - 62);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(36, H - 26, W - 72, 4);
      var pg = ctx.createLinearGradient(36, 0, W - 36, 0); pg.addColorStop(0, '#19f3ff'); pg.addColorStop(1, '#ff2e97');
      ctx.fillStyle = pg; ctx.fillRect(36, H - 26, (W - 72) * clamp(t / TOTAL, 0, 1), 4);
      ctx.restore();
    }

    return { seek: seek, W: W, H: H, fps: FPS, duration: TOTAL };
  }

  root.Video = { create: create, W: W, H: H };
})(typeof window !== 'undefined' ? window : globalThis);
