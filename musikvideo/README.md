# FRAME = f(t): ein Musikvideo aus reinem JavaScript

51,5 Sekunden, 1920×1080. Das Video enthält **keine einzige Mediendatei**:

- **Ton:** `song.js` synthetisiert den Song Sample für Sample (Kick, Snare, Hats, Sägezahn-Bass mit Sidechain,
  Pad, Arpeggio, Lead, Riser, Echo, Hall). Kein WebAudio-Graph, keine Samples, 120 BPM, a-Moll.
- **Bild:** `video.js` definiert `seek(t)`. Jeder Frame wird allein aus der Zeit `t` und den Samples des Songs gezeichnet
  (Canvas 2D). Der Equalizer ist ein echtes Spektrum (Goertzel über 2048 Samples), die Oszilloskope zeigen die echten Samples.
- **Deterministisch:** kein `Math.random`, kein Zustand zwischen Frames. Gleiches `t` ergibt dieselben Pixel
  (geprüft: byte-identische Frames bei Sprüngen in der Zeit).

Der Aufbau folgt dem Prinzip aus `claude-motion-design`: ein reines `seek(t)`, Szenen auf einem Beat-Raster, der Drop
bei 16,0 s liegt auf dem Schlüsselmoment.

| Zeit | Takt | Teil |
|---|---|---|
| 0–8 s | 1–4 | Intro: Terminal, Synthwave-Welt, Titel |
| 8–16 s | 5–8 | Build: Code-Regen, Snare-Wirbel, Riser, Sog-Ringe |
| 16–32 s | 9–16 | Drop 1: Drahtgitter, Equalizer, Schockwellen, Tunnel ab 24 s |
| 32–40 s | 17–20 | Break: Aurora, Spirograph, kreisförmige Wellenform |
| 40–48 s | 21–24 | Drop 2: alles in Gelb/Magenta |
| 48–51,5 s | | Ausklang und Endkarte |

## Ansehen

`index.html` über einen beliebigen statischen Server öffnen (oder direkt als Datei) und auf **Start** klicken.
Die Musik wird beim Laden berechnet (ca. 3 s). Leertaste = Pause, ←/→ = ±5 s, F = Vollbild.
`index.html?t=26` zeigt einen einzelnen Frame.

```bash
python3 -m http.server 8000     # dann http://localhost:8000/
```

## Als MP4 rendern

```bash
node audio.js out/audio.wav            # nur den Ton als WAV (ohne Browser)
pip install playwright                 # einmalig, plus ein Chromium (CHROMIUM=/pfad/zu/chrome setzt den Browser)
python render.py probe 3 17 26 33 41   # Kontaktbogen -> probe/sheet.png
python render.py full 30               # out/musikvideo.mp4 (H.264, AAC, BT.709), ca. 4 Minuten
```
