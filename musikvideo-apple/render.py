"""Rendert das Video offline: Playwright ruft seek(t) für jeden Frame auf, ffmpeg macht daraus MP4.
  python render.py probe 3 7 12 20 28 36 44 49   -> probe/sheet.png (Kontaktbogen)
  python render.py full [fps]                    -> out/neun-apps.mp4 (mit der echten Musik als Ton)
Voraussetzungen: pip install playwright && node, ffmpeg im PATH."""
import asyncio, http.server, os, shutil, subprocess, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).parent
PORT = 8766


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(HERE), **k)
        def log_message(self, *a): pass
    h = Quiet
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def open_page(p, fps):
    # CHROMIUM=/pfad/zu/chrome überschreibt; sonst Playwrights eigener Browser
    exe = os.environ.get("CHROMIUM")
    b = await p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--no-sandbox"])
    pg = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
    await pg.goto(f"http://127.0.0.1:{PORT}/index.html?render=1&fps={fps}")
    await pg.wait_for_function("window.ready === true", timeout=120000)
    return b, pg, errs


async def grab(pg, t, fmt="jpeg"):
    await pg.evaluate(f"seek({t})")
    el = await pg.query_selector("#stage")
    return await el.screenshot(type=fmt, **({"quality": 94} if fmt == "jpeg" else {}))


async def probe(times):
    out = HERE / "probe"; shutil.rmtree(out, ignore_errors=True); out.mkdir()
    async with async_playwright() as p:
        b, pg, errs = await open_page(p, 30)
        for i, t in enumerate(times):
            (out / f"p_{i:02d}.png").write_bytes(await grab(pg, t, "png"))
        await b.close()
    if errs: print("SEITENFEHLER:", errs[:8])
    cols = 2; rows = -(-len(times) // cols)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "p_%02d.png"), "-vf", f"scale=960:-1,tile={cols}x{rows}:padding=6:color=white",
                    "-frames:v", "1", str(out / "sheet.png")], check=True)
    print("probe ->", out / "sheet.png")


async def full(fps):
    out = HERE / "out"; out.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b, pg, errs = await open_page(p, fps)
        dur = await pg.evaluate("Scene.DUR")
        n = int(dur * fps)
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-", "-i", str(HERE / "assets" / "electro-dreams.mp3"),
                               "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
                               "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                               "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100,afade=t=out:st={dur - 1.9}:d=1.8", "-c:a", "aac", "-b:a", "256k", "-t", str(dur), "-movflags", "+faststart", str(out / "neun-apps.mp4")], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(await grab(pg, i / fps))
            if i % 60 == 0: print(f"frame {i}/{n}", flush=True)
        ff.stdin.close(); ff.wait(); await b.close()
    if errs: print("SEITENFEHLER:", errs[:8])
    print("video ->", out / "neun-apps.mp4")


if __name__ == "__main__":
    srv = serve()
    if sys.argv[1] == "probe": asyncio.run(probe([float(x) for x in sys.argv[2:]]))
    elif sys.argv[1] == "full": asyncio.run(full(int(sys.argv[2]) if len(sys.argv) > 2 else 30))
