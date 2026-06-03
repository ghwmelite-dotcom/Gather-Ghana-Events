#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate bespoke Ghanaian wedding/event photography for Gather Ghana Events
using Gemini "Nano Banana" image models, saved into public/images/.

Setup:
    pip install google-genai pillow
    export GEMINI_API_KEY=...        # or set in the shell before running

Run:
    python scripts/gen-photos.py             # all images, flash model
    python scripts/gen-photos.py --pro       # higher-quality (slower) model
    python scripts/gen-photos.py --only hero,weddings

Output: public/images/<key>.png — keys match src/lib/images.js.
"""

import argparse
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "images"

FLASH = "gemini-2.5-flash-image"
PRO = "gemini-3-pro-image-preview"

# Shared style spine so the whole set feels like one editorial shoot.
STYLE = (
    "Editorial documentary photograph, authentic Ghanaian (West African) wedding in Accra. "
    "Real photography, natural light, shallow depth of field, warm filmic colour grade in "
    "plum, champagne gold and cream tones. Elegant, tasteful, premium. Rich detail in kente "
    "cloth, gold jewellery and beads. No text, no watermark, no logos, photorealistic."
)

# key -> (aspect_ratio, subject prompt)
MANIFEST = {
    "hero": ("16:9",
        "Wide hero shot of a beautifully styled outdoor Ghanaian wedding reception at golden "
        "hour — long tables dressed in cream linen, gold-rimmed glassware, lush florals, "
        "string lights, blurred elegant guests in the background."),
    "promise": ("3:4",
        "Close-up of a refined floral centrepiece with white and blush blooms, gold candle "
        "holders and kente-accented table runner, soft natural window light."),
    "about": ("3:4",
        "A joyful Ghanaian couple in elegant kente and lace attire sharing a quiet candid "
        "moment at their celebration, soft bokeh background."),
    "contact": ("16:9",
        "Intimate candlelit Ghanaian wedding table at dusk, warm glow across gold cutlery, "
        "florals and beaded details, cosy and inviting."),
    "weddings": ("4:3",
        "An outdoor Ghanaian wedding ceremony arch dressed in flowers and flowing fabric, "
        "couple in traditional kente during the engagement rites, guests seated elegantly."),
    "celebrations": ("4:3",
        "A vibrant Ghanaian milestone celebration — an outdooring/naming ceremony or "
        "anniversary — warm ambient lighting, beautifully styled décor, family in colourful "
        "traditional cloth, joyful atmosphere."),
    "corporate": ("4:3",
        "A polished corporate gala dinner in an elegant Accra venue, round tables with "
        "modern florals, ambient uplighting, sophisticated and brand-forward."),
    "g_garden": ("4:3",
        "A romantic garden Ghanaian wedding under trees with hanging florals and draped "
        "fabric, ceremony aisle lined with petals, soft afternoon light."),
    "g_anniversary": ("1:1",
        "A golden anniversary celebration table with gold and cream styling, candles and "
        "florals, two place settings, warm and tender."),
    "g_launch": ("1:1",
        "A modern brand launch gala in Accra, dramatic uplighting, sleek stage and florals, "
        "guests mingling with champagne, premium event production."),
    "g_naming": ("1:1",
        "A Ghanaian naming ceremony (outdooring) styled with white and gold décor, soft "
        "fabrics and florals, a tender family gathering, gentle morning light."),
    "g_rooftop": ("16:9",
        "A rooftop wedding reception at dusk over the Accra skyline, string lights, lounge "
        "seating, florals and gold accents, elegant guests, magic-hour glow."),
    "g_candlelit": ("1:1",
        "A candlelit dinner reception, long table awash in warm candle glow, florals and "
        "beaded gold details, intimate and luxurious."),
}


def load_key():
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    for p in [Path.home()/".claude"/"skills"/"design"/".env",
              Path.home()/".claude"/"skills"/".env",
              Path.home()/".claude"/".env"]:
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if line.startswith("GEMINI_API_KEY=") and "=" in line:
                    return line.split("=", 1)[1].strip('"\'')
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pro", action="store_true", help="Use the higher-quality model")
    ap.add_argument("--only", type=str, help="Comma list of keys to generate")
    args = ap.parse_args()

    key = load_key()
    if not key:
        print("ERROR: GEMINI_API_KEY not set (env or ~/.claude/.env). Cannot generate.")
        sys.exit(1)

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("ERROR: pip install google-genai pillow")
        sys.exit(1)

    client = genai.Client(api_key=key)
    model = PRO if args.pro else FLASH
    OUT.mkdir(parents=True, exist_ok=True)

    wanted = set(args.only.split(",")) if args.only else set(MANIFEST)
    items = [(k, v) for k, v in MANIFEST.items() if k in wanted]
    print(f"Generating {len(items)} images with {model} -> {OUT}\n")

    ok = 0
    for i, (k, (ratio, subject)) in enumerate(items):
        prompt = f"{STYLE}\n\nScene: {subject}\nAspect ratio {ratio}."
        print(f"[{i+1}/{len(items)}] {k} ({ratio}) ...", flush=True)
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    image_config=types.ImageConfig(aspect_ratio=ratio),
                ),
            )
            data = None
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.mime_type.startswith("image/"):
                    data = part.inline_data.data
                    break
            if not data:
                print(f"    no image returned for {k}")
                continue
            (OUT / f"{k}.png").write_bytes(data)
            ok += 1
            print(f"    saved {k}.png")
        except Exception as e:
            print(f"    error on {k}: {e}")
        if i < len(items) - 1:
            time.sleep(2)

    print(f"\nDone: {ok}/{len(items)} images in {OUT}")


if __name__ == "__main__":
    main()
