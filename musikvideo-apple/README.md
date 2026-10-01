# Neun Apps. Ein Takt.

Ein 56-Sekunden-Musikvideo im Apple-Stil (1920×1080) zu **echter Musik**. Jeder Frame wird in JavaScript gezeichnet und
läuft auf dem Takt des Songs. Eine durchgehende Kamerafahrt führt über eine Wand aus neun App-Karten.

- **Musik:** „Electro Dreams“ von Arulo, aus der freien Bibliothek [Mixkit](https://mixkit.co/free-stock-music/)
  ([Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree), kommerziell nutzbar, keine Namensnennung nötig).
  Die Datei liegt **nicht** im Repository, `fetch_assets.sh` lädt sie. Verwendet wird der Anfang (56 s) mit Ausblenden.
- **Schrift:** Inter (SIL Open Font License), ebenfalls per `fetch_assets.sh`.
- **Karten:** Karten (Stadtplan mit Route), Wetter, Musik, Fitness, Kalender, Nachrichten, Aktien, Zuhause, Notizen.
  Alles eigene Oberflächen im Stil moderner Apple-Software, ohne Apple-Logos oder -Icons. **Alle Werte sind Beispieldaten.**
  (Die Musik-Karte zeigt dagegen echte Daten: Spektrum und Position des laufenden Songs.)
- **Reaktiv:** Pegel, Spektrum und Wellenform kommen aus den echten Samples der MP3. Der Takt (120,006 BPM, Takt 0 bei
  0,062 s, Drop bei 16,062 s) wurde am Song gemessen und gegen die im Browser dekodierte Datei geprüft.
- **Deterministisch:** `seek(t)` ohne Zustand und ohne Zufall. Gleiches `t` ergibt dieselben Pixel.

| Zeit | Takt | Inhalt |
|---|---|---|
| 0–8 s | 1–4 | Intro: „Ein Tag. Viele Momente. Ein Takt. Hör zu.“ auf Aurora |
| 8–16 s | 5–8 | Aufbau: Karten fliegen im Takt ein, Kamera zieht auf den Drop zu |
| 16–20 s | 9–10 | Drop: Wand, Flash, Welle |
| 20–48 s | 11–24 | sieben Szenen à 2 Takte: Karten, Wetter, Musik, Nachrichten, Kalender, Fitness, Aktien |
| 48–56 s | 25–28 | Break: zurück zur Wand, Endkarte, Ton blendet aus |

## Ansehen

```bash
./fetch_assets.sh               # einmalig: Musik + Schrift nach assets/
python3 -m http.server 8000     # dann http://localhost:8000/ öffnen und Start klicken
```
Leertaste = Pause, ←/→ = ±5 s, F = Vollbild. `index.html?t=26` zeigt einen einzelnen Frame.

## Als MP4 rendern

```bash
pip install playwright          # plus ein Chromium; CHROMIUM=/pfad/zu/chrome setzt den Browser
python render.py probe 17.8 24.4 31 46.5   # Kontaktbogen -> probe/sheet.png
python render.py full 30                   # out/neun-apps.mp4 (H.264 + AAC, -14 LUFS), ca. 5 Minuten
```

## Eine andere Musik nehmen

`engine.js` enthält das Raster (`T0`, `BEAT`, `DROP`), `scene.js` die Zeitleiste. Für einen anderen Titel: Datei in
`assets/` legen, Tempo, Takt-Offset und Drop messen (Bass-Energie pro Takt), die drei Konstanten ersetzen und die
Szenenlängen auf Takte legen.
