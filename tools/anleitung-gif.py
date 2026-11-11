"""Baut docs/anleitung/anleitung.gif aus den gerenderten Schritten.

Je Schritt zwei Bilder: kurz ohne Markierungen, dann länger mit Ring und Nummern.
"""
import pathlib
from PIL import Image

wurzel = pathlib.Path(__file__).resolve().parent.parent
ziel = wurzel / "docs" / "anleitung"
roh = pathlib.Path(__file__).resolve().parent / "roh"
BREITE = 880

bilder, dauer = [], []
for mit in sorted(ziel.glob("schritt-*.png")):
    ohne = roh / (mit.stem + "-ohne.png")
    for datei, ms in ((ohne, 900), (mit, 4600)):
        im = Image.open(datei).convert("RGB")
        im = im.resize((BREITE, round(im.height * BREITE / im.width)), Image.LANCZOS)
        bilder.append(im)
        dauer.append(ms)

# Eine gemeinsame Palette für alle Bilder, damit nichts flackert.
streifen = Image.new("RGB", (BREITE, bilder[0].height * len(bilder)))
for i, im in enumerate(bilder):
    streifen.paste(im, (0, i * im.height))
palette = streifen.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
fertig = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in bilder]
fertig[0].save(ziel / "anleitung.gif", save_all=True, append_images=fertig[1:], duration=dauer, loop=0, optimize=False, disposal=1)
print((ziel / "anleitung.gif").stat().st_size // 1024, "KB,", len(fertig), "Bilder")
