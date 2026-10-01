// node audio.js [out.wav]  — rechnet den Song und schreibt 16-bit-Stereo-WAV (kein Browser nötig)
const fs = require('fs'), Song = require('./song.js');
const out = process.argv[2] || 'musikvideo.wav';
const t0 = Date.now(), s = Song.build();
const data = Buffer.alloc(44 + s.n * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + s.n * 4, 4); data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(s.sr, 24); data.writeUInt32LE(s.sr * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(s.n * 4, 40);
const q = (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
for (let i = 0; i < s.n; i++) { data.writeInt16LE(q(s.L[i]), 44 + i * 4); data.writeInt16LE(q(s.R[i]), 46 + i * 4); }
fs.writeFileSync(out, data);
console.log(`${out}: ${(s.n / s.sr).toFixed(2)} s, ${s.events.notes.length} Noten, ${s.events.kick.length} Kicks, Synthese ${Date.now() - t0} ms`);
