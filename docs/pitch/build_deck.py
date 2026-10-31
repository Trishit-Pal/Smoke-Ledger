"""Build the four-slide ESSEC Ventures deck.

The spoken script lives in essec-ventures-cergy.md. This file only places
the words that appear on the slides, and it copies each spoken block into
the speaker notes so the two stay together.

Run from the repo root:

    python docs/pitch/build_deck.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "essec-ventures-cergy.md"
OUT = ROOT / "essec-ventures-cergy.pptx"
FRAMES = ROOT / "frames"
LOG_FRAME = FRAMES / "log-entry.png"
HOUR_FRAME = FRAMES / "hour-of-day.png"
CAPTION = "One person’s own ledger. Not a customer base."

# DESIGN.md dark theme. Secondary text is #A9B3BF, which clears WCAG AA on
# #0B0F14. #5A6673 does not, so it is not used. The hairline uses rule-strong
# #3A4452: #2A333F disappears on a projector against this ground.
BG = RGBColor(0x0B, 0x0F, 0x14)
INK = RGBColor(0xE6, 0xEA, 0xEF)
SECONDARY = RGBColor(0xA9, 0xB3, 0xBF)
RULE = RGBColor(0x3A, 0x44, 0x52)

DISPLAY = "Georgia"
BODY = "Calibri"

SLIDE_W = Inches(13.333333)
SLIDE_H = Inches(7.5)

# Spoken and on-slide text. Checked after the file is written.
FORBIDDEN = re.compile(
    r"\b("
    r"streaks?|confetti|celebrat\w*|dpdp|compliant|encrypted|deeptech|"
    r"artificial intelligence|\bAI\b|sustainab\w*|deezer|contentsquare|"
    r"billion|million|\botp\b|cergy|revenue|tam|market size|"
    r"invitation to action|uncertainty"
    r")\b",
    re.IGNORECASE,
)

# Identity and traction phrases that must not appear as deck text.
IDENTITY = re.compile(
    r"gmail|\blogan\b|\+91|916794|\bparis\b|\+100%|100%|test european",
    re.IGNORECASE,
)


def _set_typeface(run, name: str) -> None:
    r_pr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = r_pr.find(qn(tag))
        if el is None:
            el = etree.SubElement(r_pr, qn(tag))
        el.set("typeface", name)


def add_text(
    slide,
    text: str,
    left,
    top,
    width,
    height,
    *,
    font: str,
    size: float,
    color: RGBColor,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    spacing: float = 1.05,
) -> None:
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    frame.auto_size = None
    frame.margin_left = Emu(0)
    frame.margin_right = Emu(0)
    frame.margin_top = Emu(0)
    frame.margin_bottom = Emu(0)
    try:
        frame._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])
    except Exception:
        pass

    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        run = p.add_run()
        run.text = line
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = False
        run.font.italic = False
        run.font.color.rgb = color
        _set_typeface(run, font)
    return box


def add_rule(slide, left, top, width) -> None:
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Pt(1.25))
    shape.fill.solid()
    shape.fill.fore_color.rgb = RULE
    shape.line.fill.background()
    # Drop the shadow a theme sometimes attaches.
    sp_pr = shape._element.spPr
    effect = sp_pr.find(qn("a:effectLst"))
    if effect is not None:
        sp_pr.remove(effect)


def paint(slide) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG


def add_plate(slide, path: Path, left, top, width):
    """A product crop with a hairline edge. Height follows the image."""
    from PIL import Image

    with Image.open(path) as im:
        aspect = im.size[0] / im.size[1]
    height = Emu(int(width / aspect))
    pad = Pt(1.25)
    frame = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        left - pad,
        top - pad,
        width + pad * 2,
        height + pad * 2,
    )
    frame.fill.background()
    frame.line.color.rgb = RULE
    frame.line.width = Pt(1.0)
    slide.shapes.add_picture(str(path), left, top, width=width, height=height)
    return height


def notes_for(slide, text: str) -> None:
    frame = slide.notes_slide.notes_text_frame
    frame.text = text.strip()


def spoken_blocks(markdown: str) -> list[str]:
    body = markdown.split("\n---\n", 1)[1]
    parts = re.split(r"\n## Slide \d+ — [^\n]+\n", body)
    return [p.strip() for p in parts if p.strip()]


def build() -> Presentation:
    markdown = SCRIPT.read_text(encoding="utf-8")
    spoken = spoken_blocks(markdown)
    if len(spoken) != 5:
        raise SystemExit(f"Expected 5 spoken blocks, found {len(spoken)}")

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    prs.core_properties.title = "Smoke Ledger — ESSEC Ventures"
    prs.core_properties.author = "ESSEC student"
    prs.core_properties.subject = "Incubation ask for a student project"
    blank = prs.slide_layouts[6]

    left = Inches(1.05)
    width = Inches(11.15)

    # Slide 1 — masthead once, then the problem.
    s1 = prs.slides.add_slide(blank)
    paint(s1)
    add_text(
        s1, "Smoke Ledger", left, Inches(1.35), width, Inches(0.42),
        font=DISPLAY, size=20, color=SECONDARY,
    )
    add_text(
        s1, "You cannot see\nwhat it cost.", left, Inches(1.95), Inches(10.4), Inches(2.15),
        font=DISPLAY, size=54, color=INK, spacing=0.95,
    )
    add_rule(s1, left, Inches(4.35), Inches(1.65))
    add_text(
        s1,
        "Just after a cigarette, or late at night.\n"
        "An adult, in India. The day is India time.\n"
        "Without that record, the only thing they have is guilt.\n"
        "How many sticks, and what they cost in rupees.",
        left, Inches(4.55), Inches(10.6), Inches(2.15),
        font=BODY, size=22, color=SECONDARY, spacing=1.12,
    )
    notes_for(s1, spoken[0])

    # Slide 2 — three readings, plus the log crop.
    s2 = prs.slides.add_slide(blank)
    paint(s2)
    text_w = Inches(6.15)
    plate_left = Inches(7.2)
    plate_w = Inches(5.45)
    add_text(
        s2, "One log. Three readings.", left, Inches(0.48), text_w, Inches(0.85),
        font=DISPLAY, size=32, color=INK,
    )
    add_text(
        s2, CAPTION, plate_left, Inches(0.48), plate_w, Inches(0.7),
        font=BODY, size=16, color=SECONDARY, spacing=1.05,
    )
    add_rule(s2, plate_left, Inches(1.28), Inches(1.45))
    add_plate(s2, LOG_FRAME, plate_left, Inches(1.48), plate_w)
    add_rule(s2, left, Inches(1.55), Inches(1.45))
    readings = [
        (Inches(1.85), "Today’s sticks"),
        (Inches(2.7), "Today’s rupees"),
        (Inches(3.55), "The week, against your own\nrecent baseline"),
    ]
    for top, line in readings:
        add_text(
            s2, line, left, top, text_w, Inches(0.8),
            font=DISPLAY, size=22, color=INK, spacing=1.0,
        )
    add_text(
        s2,
        "One tap, or the full line.\nFree. No ads. The data is not sold.",
        left, Inches(5.15), text_w, Inches(0.85),
        font=BODY, size=18, color=SECONDARY, spacing=1.1,
    )
    notes_for(s2, spoken[1])

    # Slide 3 — proof: the hour chart from one ledger.
    s3 = prs.slides.add_slide(blank)
    paint(s3)
    add_text(
        s3, "It reads the day back.", left, Inches(0.48), text_w, Inches(1.15),
        font=DISPLAY, size=32, color=INK, spacing=0.95,
    )
    add_text(
        s3, CAPTION, plate_left, Inches(0.48), plate_w, Inches(0.7),
        font=BODY, size=16, color=SECONDARY, spacing=1.05,
    )
    add_rule(s3, plate_left, Inches(1.28), Inches(1.45))
    add_plate(s3, HOUR_FRAME, plate_left, Inches(1.48), plate_w)
    add_rule(s3, left, Inches(1.85), Inches(1.45))
    proof_lines = [
        (Inches(2.1), "Mornings and evenings."),
        (Inches(2.85), "Quiet hours."),
        (Inches(3.6), "Today’s sticks. Today’s rupees."),
        (Inches(4.45), "A smoke-free run."),
    ]
    for top, line in proof_lines:
        add_text(
            s3, line, left, top, text_w, Inches(0.6),
            font=DISPLAY, size=22, color=INK,
        )
    notes_for(s3, spoken[2])

    # Slide 4 — the gap. Type only.
    s4 = prs.slides.add_slide(blank)
    paint(s4)
    add_text(
        s4, "Built. Free.\nNot in a pocket.", left, Inches(0.85), Inches(11.0), Inches(1.85),
        font=DISPLAY, size=44, color=INK, spacing=0.95,
    )
    add_rule(s4, left, Inches(2.9), Inches(1.65))
    add_text(
        s4,
        "The phone and the website share one calculation.\n"
        "Each person’s rows stay theirs.",
        left, Inches(3.25), Inches(10.6), Inches(0.9),
        font=BODY, size=22, color=INK, spacing=1.12,
    )
    add_text(
        s4,
        "Not medical advice. No text-message login.\n"
        "No customer base. I am an ESSEC student.\n"
        "The person this is for lives in India.",
        left, Inches(4.35), Inches(10.6), Inches(1.35),
        font=BODY, size=22, color=SECONDARY, spacing=1.12,
    )
    add_text(
        s4, "The core is free.", left, Inches(5.9), Inches(8), Inches(0.5),
        font=DISPLAY, size=28, color=INK,
    )
    notes_for(s4, spoken[3])

    # Slide 5 — the ask.
    s5 = prs.slides.add_slide(blank)
    paint(s5)
    add_text(
        s5, "A seat in ESSEC Ventures.", left, Inches(0.72), width, Inches(0.75),
        font=DISPLAY, size=36, color=INK,
    )
    add_rule(s5, left, Inches(1.62), Inches(1.65))
    add_text(
        s5,
        "The Centre’s incubation for a student project.",
        left, Inches(2.05), width, Inches(0.5),
        font=BODY, size=22, color=INK,
    )
    add_text(
        s5,
        "Coaching, and the school’s network,\nto name a first group I can reach.",
        left, Inches(2.85), Inches(10.2), Inches(1.15),
        font=BODY, size=22, color=SECONDARY, spacing=1.12,
    )
    add_text(
        s5,
        "And to decide what can sit beside a free ledger.",
        left, Inches(4.3), width, Inches(0.5),
        font=BODY, size=22, color=SECONDARY,
    )
    add_text(
        s5, "Not a cheque.", left, Inches(5.7), width, Inches(0.55),
        font=DISPLAY, size=28, color=INK,
    )
    notes_for(s5, spoken[4])

    return prs


def slide_text(prs: Presentation) -> str:
    chunks: list[str] = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                chunks.append(shape.text_frame.text)
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            chunks.append(slide.notes_slide.notes_text_frame.text)
    return "\n".join(chunks)


def main() -> None:
    prs = build()
    # Notes include the spoken script. Scan slides and notes, but the
    # campus warning lives only in the markdown header, above the rule,
    # and is not copied into the deck.
    if not LOG_FRAME.is_file() or not HOUR_FRAME.is_file():
        raise SystemExit("Missing cropped frames in docs/pitch/frames")
    blob = slide_text(prs)
    hits = sorted(set(m.group(0) for m in FORBIDDEN.finditer(blob)))
    if hits:
        raise SystemExit("Forbidden wording in the deck: " + ", ".join(hits))
    leaked = sorted(set(m.group(0) for m in IDENTITY.finditer(blob)))
    if leaked:
        raise SystemExit("Identity or traction wording in the deck: " + ", ".join(leaked))
    prs.save(OUT)
    spoken = spoken_blocks(SCRIPT.read_text(encoding="utf-8"))
    words = sum(len(re.findall(r"[A-Za-z0-9'’]+", block)) for block in spoken)
    print(f"Wrote {OUT}")
    print(f"Spoken words: {words} (~{words / 145:.1f} min at a calm pace)")


if __name__ == "__main__":
    sys.exit(main() or 0)
