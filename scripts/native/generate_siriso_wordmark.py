"""Generate offline Siriso wordmarks from Syne ExtraBold (wght=800).
Development dependencies: fonttools and uharfbuzz. Runtime uses only SVG paths.
Font source: https://github.com/google/fonts/tree/54fb97bd69162b95b2aa2c3996ffd71466c1aec2/ofl/syne
"""
from pathlib import Path
from io import BytesIO
import hashlib
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "frontend/src/editor/core/assets/brand"
TEXT = "SIRISO PDF"

def number(value):
    return f"{value:.3f}".rstrip("0").rstrip(".") if value % 1 else str(int(value))

def generate():
    data = (BRAND / "fonts/Syne-Variable.ttf").read_bytes()
    variable = TTFont(BytesIO(data))
    assert any(axis.axisTag == "wght" and axis.maxValue >= 800 for axis in variable["fvar"].axes)
    font = instantiateVariableFont(variable, {"wght": 800}, inplace=False)
    assert font["OS/2"].usWeightClass == 800
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    shaped_font = hb.Font(hb.Face(data))
    shaped_font.set_variations({"wght": 800})
    buffer = hb.Buffer()
    buffer.add_str(TEXT)
    buffer.guess_segment_properties()
    hb.shape(shaped_font, buffer, {"kern": True})
    bounds = BoundsPen(glyphs)
    paths = []
    x = y = 0
    for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions):
        assert info.codepoint != 0, "Missing brand glyph"
        transform = (1, 0, 0, -1, x + pos.x_offset, -(y + pos.y_offset))
        pen = SVGPathPen(glyphs, ntos=number)
        glyphs[order[info.codepoint]].draw(TransformPen(pen, transform))
        glyphs[order[info.codepoint]].draw(TransformPen(bounds, transform))
        if pen.getCommands():
            paths.append((info.cluster >= TEXT.index("P"), pen.getCommands()))
        x += pos.x_advance
        y += pos.y_advance
    left, top, right, bottom = bounds.bounds
    padding = 5
    view = (left-padding, top-padding, right-left+2*padding, bottom-top+2*padding)
    width = round(view[2] / view[3] * 36)
    for variant, main in (("Black", "#242424"), ("White", "#FFFFFF"), ("Grey", "#777777")):
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="36" viewBox="{" ".join(map(number, view))}" role="img" aria-label="SIRISO PDF">',
            "<title>SIRISO PDF — Syne ExtraBold 800</title>",
            '<metadata>Syne 2.200; weight 800; outlined for offline rendering. See Syne-OFL.txt.</metadata>',
        ]
        for orange, path in paths:
            color = "#FA7900" if orange else main
            parts.append(f'<path fill="{color}" d="{path}"/>')
        parts.append("</svg>")
        (BRAND / f"modern-logo/SirisoPDFWordmark{variant}.svg").write_text("\n".join(parts)+"\n", encoding="utf-8")
    print(f"Syne ExtraBold 800: {len(paths)} glyphs; wordmark {width}x36; font SHA256 {hashlib.sha256(data).hexdigest()}")

if __name__ == "__main__":
    generate()
