/* song.js — der komplette Song, Sample für Sample in reinem JavaScript.
 * Keine Audiodatei, kein WebAudio-Graph: build() rechnet 44,1 kHz Stereo selbst aus.
 * Läuft identisch im Browser (window.Song) und in Node (require). Gleiche Eingabe, gleiche Samples.
 *
 * 120 BPM, a-Moll, Akkorde Am – F – C – G (je ein Takt = 2 s)
 *   Takt  0– 3   0– 8 s  Intro   (Pad, Arpeggio, ab Takt 2 Hats + Kick)
 *   Takt  4– 7   8–16 s  Build   (Four-on-the-floor, Riser, Snare-Wirbel)
 *   Takt  8–15  16–32 s  Drop 1  (Bass mit Sidechain, Lead-Hook)
 *   Takt 16–19  32–40 s  Break   (Pad, weicher Lead, Riser)
 *   Takt 20–23  40–48 s  Drop 2  (alles, Hook eine Oktave doppelt)
 *   danach 3,5 s Ausklang
 */
(function (root) {
  'use strict';

  var SR = 44100, BPM = 120, BEAT = 60 / BPM, BAR = 4 * BEAT, BARS = 24;
  var MUSIC = BARS * BAR, TOTAL = MUSIC + 3.5, N = Math.ceil(TOTAL * SR);
  var TAU = Math.PI * 2;

  function rng(seed) { // mulberry32: deterministisch
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var Z = function () { return new Float32Array(N); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };

  // Akkorde (Stimmführung eng) und Bass-Grundtöne
  var CHORDS = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
  var ROOTS = [33, 29, 36, 31];
  // Lead-Hook in Achteln, 0 = Pause
  var HOOK = [[76, 0, 72, 0, 76, 79, 0, 76], [77, 0, 72, 0, 77, 81, 0, 77],
              [76, 0, 72, 0, 76, 79, 0, 84], [74, 0, 71, 0, 74, 79, 0, 74]];
  var ARP16 = [0, 2, 1, 3, 2, 4, 3, 5, 4, 3, 2, 4, 1, 3, 0, 2];
  var ARP8 = [0, 1, 2, 4, 3, 2, 1, 3];

  function build() {
    var r = rng(1337);
    var mL = Z(), mR = Z(), ldL = Z(), ldR = Z(), bass = Z(), drum = Z(), fxL = Z(), fxR = Z();
    var wL = Z(), wR = Z(); // Send-Bus für Echo und Hall
    var ev = { kick: [], snare: [], hat: [], crash: [], notes: [], drops: [16, 40, 48] };

    // ---------- Stimmen ----------
    // Detunte Sägezahn-Stimme (PolyBLEP), 2-Pol-Tiefpass mit Hüllkurve. Stereo über Detune-Verteilung.
    function blep(p, dt) {
      if (p < dt) { p /= dt; return p + p - p * p - 1; }
      if (p > 1 - dt) { p = (p - 1) / dt; return p * p + p + p + 1; }
      return 0;
    }
    function saw(outL, outR, t0, dur, f, o) {
      var i0 = Math.floor(t0 * SR), n = Math.min(N - i0, Math.floor((dur + o.rel) * SR));
      if (i0 < 0 || n <= 0) return;
      var ratio = [Math.pow(2, -o.det / 1200), 1, Math.pow(2, o.det / 1200)];
      var dt = [f * ratio[0] / SR, f * ratio[1] / SR, f * ratio[2] / SR];
      var ph = [r(), r(), r()], l1 = 0, l2 = 0, r1 = 0, r2 = 0;
      var pw = o.pan === undefined ? 0.5 : o.pan; // 0 = links, 1 = rechts (Equal-Power)
      var gl = Math.SQRT2 * Math.cos(pw * Math.PI / 2), gr = Math.SQRT2 * Math.sin(pw * Math.PI / 2);
      for (var k = 0; k < n; k++) {
        var tt = k / SR;
        var env = Math.min(1, tt / o.atk);
        if (tt > dur) { var q = 1 - (tt - dur) / o.rel; env *= q * q; }
        if (o.dec) env *= o.sus + (1 - o.sus) * Math.exp(-tt / o.dec);
        var fc = o.c1 + (o.c0 - o.c1) * Math.exp(-tt / o.cd);
        var a = 1 - Math.exp(-TAU * fc / SR);
        var s0 = 0, s1 = 0, s2 = 0;
        for (var v = 0; v < 3; v++) {
          ph[v] += dt[v]; if (ph[v] >= 1) ph[v] -= 1;
          var s = 2 * ph[v] - 1 - blep(ph[v], dt[v]);
          if (v === 0) s0 = s; else if (v === 1) s1 = s; else s2 = s;
        }
        var xl = (s0 * 0.8 + s1 * 0.55 + s2 * 0.2) * gl;
        var xr = (s0 * 0.2 + s1 * 0.55 + s2 * 0.8) * gr;
        if (o.sub) { var sb = Math.sin(TAU * f * 0.5 * tt) * o.sub; xl += sb; xr += sb; }
        l1 += a * (xl - l1); l2 += a * (l1 - l2);
        r1 += a * (xr - r1); r2 += a * (r1 - r2);
        var g = env * o.gain, i = i0 + k;
        outL[i] += l2 * g; outR[i] += r2 * g;
        if (o.wet) { wL[i] += l2 * g * o.wet; wR[i] += r2 * g * o.wet; }
      }
    }
    function bassNote(t0, dur, f, gain) {
      var i0 = Math.floor(t0 * SR), n = Math.min(N - i0, Math.floor((dur + 0.06) * SR));
      var ph = 0, y1 = 0, y2 = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, dt = f / SR;
        ph += dt; if (ph >= 1) ph -= 1;
        var env = Math.min(1, tt / 0.004) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.06) : 1);
        var fc = 160 + 520 * Math.exp(-tt / 0.12), a = 1 - Math.exp(-TAU * fc / SR);
        var x = 2 * ph - 1 - blep(ph, dt);
        y1 += a * (x - y1); y2 += a * (y1 - y2);
        bass[i0 + k] += (y2 * 0.75 + Math.sin(TAU * f * tt) * 0.8) * env * gain;
      }
    }
    function kick(t, g) {
      ev.kick.push(t);
      var i0 = Math.floor(t * SR), n = Math.floor(0.55 * SR), ph = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, f = 46 + 110 * Math.exp(-tt / 0.03);
        ph += TAU * f / SR;
        var s = Math.sin(ph) * Math.exp(-tt / 0.2) + (r() * 2 - 1) * Math.exp(-tt / 0.004) * 0.35;
        drum[i0 + k] += s * g * 1.1;
      }
    }
    function snare(t, g) {
      ev.snare.push(t);
      var i0 = Math.floor(t * SR), n = Math.floor(0.3 * SR), prev = 0, ph = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, w = r() * 2 - 1, hp = w - prev; prev = w;
        ph += TAU * (190 - 60 * Math.min(1, tt / 0.1)) / SR;
        var s = hp * 0.55 * Math.exp(-tt / 0.09) + Math.sin(ph) * 0.5 * Math.exp(-tt / 0.045);
        drum[i0 + k] += s * g;
        wL[i0 + k] += s * g * 0.18; wR[i0 + k] += s * g * 0.18;
      }
    }
    function clap(t, g) { // drei kurze Rauschstöße + Schwanz
      var i0 = Math.floor(t * SR), n = Math.floor(0.25 * SR), prev = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, w = r() * 2 - 1, hp = (w - prev) * 0.5; prev = w;
        var e = Math.exp(-tt / 0.07) * 0.5 + (tt < 0.03 ? (Math.sin(tt * 1500) > 0 ? 0.5 : 0) : 0);
        drum[i0 + k] += hp * e * g;
      }
    }
    function hat(t, g, open) {
      ev.hat.push(t);
      var i0 = Math.floor(t * SR), n = Math.floor((open ? 0.22 : 0.06) * SR), prev = 0, prev2 = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, w = r() * 2 - 1, hp = w - 2 * prev + prev2; prev2 = prev; prev = w;
        drum[i0 + k] += hp * 0.2 * Math.exp(-tt / (open ? 0.07 : 0.014)) * g;
      }
    }
    function crash(t, g) {
      ev.crash.push(t);
      var i0 = Math.floor(t * SR), n = Math.min(N - i0, Math.floor(3 * SR)), p1 = 0, p2 = 0;
      for (var k = 0; k < n; k++) {
        var tt = k / SR, wl = r() * 2 - 1, wr = r() * 2 - 1;
        var e = Math.exp(-tt / 0.9) * g * 0.35, hl = wl - p1, hr = wr - p2; p1 = wl; p2 = wr;
        fxL[i0 + k] += hl * e; fxR[i0 + k] += hr * e;
        wL[i0 + k] += hl * e * 0.15; wR[i0 + k] += hr * e * 0.15;
      }
    }
    function riser(t0, t1) {
      var i0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR), a1 = 0, a2 = 0, b1 = 0, b2 = 0, ph = 0;
      for (var k = 0; k < n; k++) {
        var u = k / n, fc = 200 * Math.pow(50, u), a = 1 - Math.exp(-TAU * fc / SR);
        var wl = r() * 2 - 1, wr = r() * 2 - 1;
        a1 += a * (wl - a1); a2 += a * (a1 - a2); b1 += a * (wr - b1); b2 += a * (b1 - b2);
        ph += TAU * (150 * Math.pow(14, u * u)) / SR;
        var amp = u * u * 0.6, tone = Math.sin(ph) * u * u * u * 0.07;
        fxL[i0 + k] += a2 * amp * 1.4 + tone; fxR[i0 + k] += b2 * amp * 1.4 + tone;
      }
    }
    function roll(t0, t1) { // Snare-Wirbel mit schrumpfendem Abstand
      for (var t = t0; t < t1 - 0.12;) {
        var u = (t - t0) / (t1 - t0);
        snare(t, lerp(0.25, 0.85, u));
        t += lerp(BEAT / 2, BEAT / 8, u);
      }
    }

    // ---------- Arrangement ----------
    var section = function (b) { return b < 4 ? 0 : b < 8 ? 1 : b < 16 ? 2 : b < 20 ? 3 : 4; };
    var PAD_GAIN = [0.2, 0.2, 0.12, 0.3, 0.14];

    for (var b = 0; b < BARS; b++) {
      var T = b * BAR, sec = section(b), ci = b % 4, ch = CHORDS[ci];
      var drop = sec === 2 || sec === 4;

      // Pad: drei Töne, lange Hüllkurve, Filter öffnet sich im Verlauf
      for (var c = 0; c < 3; c++) {
        saw(mL, mR, T, BAR, mtof(ch[c]), { gain: PAD_GAIN[sec], det: 9, atk: 0.5, rel: 0.7, c0: 700, c1: 1400 + b * 40, cd: 0.8,
          pan: 0.5, wet: 0.35 });
        ev.notes.push({ t: T, d: BAR, m: ch[c], v: 'pad' });
      }

      // Arpeggio
      var pool = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 24, ch[2] + 24];
      var step = sec === 0 && b < 2 ? 0.5 : (drop || sec === 4) ? 0.25 : 0.5;
      var arpG = sec === 0 ? (b < 2 ? 0.2 : 0.25) : sec === 1 ? 0.26 : sec === 3 ? 0.2 : 0.27;
      var nsteps = Math.round(4 / step);
      for (var s = 0; s < nsteps; s++) {
        if (sec === 0 && b < 2 && s % 2) continue;           // Intro: nur jede zweite Achtel
        var m = pool[(step === 0.25 ? ARP16[s % 16] : ARP8[s % 8]) % 6];
        var pan = 0.25 + 0.5 * ((s * 0.37) % 1);
        saw(mL, mR, T + s * step * BEAT * 1, step * BEAT * 0.9, mtof(m),
          { gain: arpG, det: 6, atk: 0.003, rel: 0.12, c0: 4200, c1: 900, cd: 0.09, pan: pan, wet: sec === 3 ? 0.9 : 0.55 });
        ev.notes.push({ t: T + s * step * BEAT, d: step * BEAT, m: m, v: 'arp' });
      }

      // Bass (Build ab Takt 4: Viertel, Drop: Achtel mit Oktavsprung)
      if (b >= 4 && sec !== 3) {
        var rootM = ROOTS[ci], pat = [0, 0, 12, 0, 0, 12, 0, 7];
        var steps = drop ? 8 : 4, len = BAR / steps;
        for (var q = 0; q < steps; q++) {
          var tb = T + q * len;
          if (b === 7 && q >= steps - (drop ? 2 : 1)) continue;   // Atempause vor dem Drop
          var semi = drop ? pat[q] : 0;
          bassNote(tb, len * 0.85, mtof(rootM + semi), drop ? 0.55 : 0.4);
          ev.notes.push({ t: tb, d: len * 0.85, m: rootM + semi, v: 'bass' });
        }
      }

      // Lead-Hook
      if (sec === 2 || sec === 3 || sec === 4) {
        var hook = HOOK[ci], soft = sec === 3;
        for (var h = 0; h < 8; h++) {
          if (!hook[h]) continue;
          var th = T + h * BEAT / 2, mm = hook[h];
          var lo = { gain: soft ? 0.12 : 0.17, det: 14, atk: 0.006, rel: 0.25, c0: 5200, c1: 1500, cd: 0.25, dec: 0.5, sus: 0.55,
            pan: 0.5, wet: soft ? 1.0 : 0.6 };
          saw(ldL, ldR, th, BEAT * 0.45, mtof(mm), lo);
          ev.notes.push({ t: th, d: BEAT * 0.45, m: mm, v: 'lead' });
          if (sec === 4) {
            saw(ldL, ldR, th, BEAT * 0.45, mtof(mm + 12), { gain: 0.07, det: 10, atk: 0.006, rel: 0.2, c0: 6500, c1: 2200, cd: 0.2, pan: 0.7, wet: 0.6 });
            if (h % 2 === 0) saw(ldL, ldR, th + BEAT / 4, BEAT * 0.2, mtof(mm + 7), { gain: 0.06, det: 8, atk: 0.004, rel: 0.1, c0: 5000, c1: 1800, cd: 0.1, pan: 0.3, wet: 0.5 });
          }
        }
      }

      // Drums
      var dr = {
        kick: (b >= 2 && b < 8) || sec === 2 || sec === 4 || b === 19,
        hat8: b >= 2 && b < 8, hat16: sec === 2 || sec === 4
      };
      for (var bt = 0; bt < 4; bt++) {
        var tk = T + bt * BEAT;
        if (dr.kick) {
          var every = b < 4 ? bt % 2 === 0 : true;                     // bar 2-3: 1 & 3
          if (b === 19) every = bt < 3 && bt % 2 === 0;
          if ((b === 7 || b === 19) && bt === 3) every = false;
          if (every) kick(tk, b < 4 ? 0.7 : 1);
        }
        if ((sec === 2 || sec === 4 || b === 4 || b === 5) && (bt === 1 || bt === 3)) {
          snare(tk, sec === 2 || sec === 4 ? 0.9 : 0.55);
          if (sec === 2 || sec === 4) clap(tk, 0.55);
        }
        if (dr.hat8) { hat(tk, 0.5, false); hat(tk + BEAT / 2, 0.8, true); }
        if (dr.hat16) {
          for (var sx = 0; sx < 4; sx++) {
            var th2 = tk + sx * BEAT / 4;
            if (sx === 2) hat(th2, 0.9, true); else hat(th2, sx % 2 ? 0.35 : 0.55, false);
          }
        }
      }
    }

    roll(12, 16); roll(37, 40);
    riser(8, 16); riser(34, 40);
    crash(16, 1); crash(24, 0.5); crash(32, 0.6); crash(40, 1); crash(44, 0.4); crash(48, 1.2);

    // Schlussakkord
    [57, 60, 64, 69, 72].forEach(function (m, idx) {
      saw(ldL, ldR, 48, 0.8, mtof(m), { gain: 0.12, det: 12, atk: 0.005, rel: 1.8, c0: 6000, c1: 1200, cd: 0.6, pan: 0.2 + idx * 0.15, wet: 0.9 });
      ev.notes.push({ t: 48, d: 0.8, m: m, v: 'lead' });
    });
    kick(48, 1.1);
    bassNote(48, 1.4, mtof(33), 0.6); ev.notes.push({ t: 48, d: 1.4, m: 33, v: 'bass' });

    // ---------- Mix ----------
    // Sidechain: Kicks drücken Pad, Arp und Bass; vor den Drops kurze Atempause
    var duck = new Float32Array(N), kicks = ev.kick, kp = 0, last = -1;
    for (var i = 0; i < N; i++) {
      var ts = i / SR;
      while (kp < kicks.length && kicks[kp] <= ts) { last = kicks[kp]; kp++; }
      duck[i] = last < 0 ? 1 : 1 - 0.78 * Math.exp(-(ts - last) / 0.13);
    }
    function breath(ts) { return (ts > 15.82 && ts < 16) || (ts > 39.82 && ts < 40) ? 0.12 : 1; }

    // Echo (punktierte Achtel, Ping-Pong) + Schroeder-Hall auf dem Send-Bus
    var dly = Math.round(BEAT * 0.75 * SR), eL = new Float32Array(N), eR = new Float32Array(N);
    for (i = 0; i < N; i++) {
      eL[i] = wL[i] + (i >= dly ? 0.38 * eR[i - dly] : 0);
      eR[i] = wR[i] + (i >= dly ? 0.38 * eL[i - dly] : 0);
    }
    function reverb(inp, delays, ap) {
      var out = new Float32Array(N), bufs = delays.map(function (d) { return new Float32Array(d); });
      var pos = delays.map(function () { return 0; }), lp = delays.map(function () { return 0; });
      var apB = ap.map(function (d) { return new Float32Array(d); }), apP = ap.map(function () { return 0; });
      for (var k = 0; k < N; k++) {
        var x = inp[k], sum = 0;
        for (var c = 0; c < bufs.length; c++) {
          var bb = bufs[c], y = bb[pos[c]];
          lp[c] += 0.35 * (y - lp[c]);
          bb[pos[c]] = x * 0.3 + lp[c] * 0.84;
          if (++pos[c] >= bb.length) pos[c] = 0;
          sum += y;
        }
        for (var a = 0; a < apB.length; a++) {
          var ab = apB[a], z = ab[apP[a]], v = sum + z * 0.5;
          ab[apP[a]] = v; sum = z - v * 0.5;
          if (++apP[a] >= ab.length) apP[a] = 0;
        }
        out[k] = sum;
      }
      return out;
    }
    var rvL = reverb(eL, [1557, 1617, 1491, 1422], [225, 556]);
    var rvR = reverb(eR, [1580, 1640, 1514, 1445], [248, 579]);

    var L = new Float32Array(N), R = new Float32Array(N), peak = 0;
    for (i = 0; i < N; i++) {
      var tsec = i / SR, gb = breath(tsec), d = duck[i];
      var xl = (mL[i] * d + bass[i] * d + ldL[i]) * gb + drum[i] * 0.9 + fxL[i] + eL[i] * 0.3 + rvL[i] * 0.55;
      var xr = (mR[i] * d + bass[i] * d + ldR[i]) * gb + drum[i] * 0.9 + fxR[i] + eR[i] * 0.3 + rvR[i] * 0.55;
      xl = Math.tanh(xl * 0.9); xr = Math.tanh(xr * 0.9);
      L[i] = xl; R[i] = xr;
      var pk = Math.max(Math.abs(xl), Math.abs(xr)); if (pk > peak) peak = pk;
    }
    var norm = 0.8 / peak, fade = Math.floor(0.4 * SR);
    for (i = 0; i < N; i++) {
      var f = i > N - fade ? (N - i) / fade : 1;
      L[i] *= norm * f; R[i] *= norm * f;
    }

    // Pegelverläufe (100 Hz) für die Bilder: tief / mittel / hoch, auf 0..1 normiert
    var RATE = 100, hop = Math.floor(SR / RATE), nb = Math.floor(N / hop);
    var low = new Float32Array(nb), mid = new Float32Array(nb), high = new Float32Array(nb), lp1 = 0, lp2 = 0, hpPrev = 0;
    for (var bI = 0; bI < nb; bI++) {
      var sl = 0, sm = 0, sh = 0;
      for (var k2 = 0; k2 < hop; k2++) {
        var xm = (L[bI * hop + k2] + R[bI * hop + k2]) * 0.5;
        lp1 += 0.018 * (xm - lp1);        // ≈ 125 Hz
        lp2 += 0.25 * (xm - lp2);         // ≈ 2,1 kHz
        var hp = xm - lp2, hd = hp - hpPrev; hpPrev = hp;
        sl += lp1 * lp1; sm += (lp2 - lp1) * (lp2 - lp1); sh += hd * hd;
      }
      low[bI] = Math.sqrt(sl / hop); mid[bI] = Math.sqrt(sm / hop); high[bI] = Math.sqrt(sh / hop);
    }
    [low, mid, high].forEach(function (a) {
      var s = Array.prototype.slice.call(a).sort(function (x, y) { return x - y; }), p = s[Math.floor(s.length * 0.98)] || 1;
      for (var q2 = 0; q2 < a.length; q2++) a[q2] = Math.min(1, a[q2] / p);
    });

    ev.notes.sort(function (a, b2) { return a.t - b2.t; });
    ev.kick.sort(function (a, b2) { return a - b2; }); ev.snare.sort(function (a, b2) { return a - b2; });
    return { sr: SR, n: N, L: L, R: R, events: ev, level: { rate: RATE, low: low, mid: mid, high: high }, duration: TOTAL };
  }

  var Song = { SR: SR, BPM: BPM, BEAT: BEAT, BAR: BAR, BARS: BARS, MUSIC: MUSIC, TOTAL: TOTAL, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = Song; else root.Song = Song;
})(typeof window !== 'undefined' ? window : globalThis);
