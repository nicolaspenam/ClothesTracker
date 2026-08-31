#!/usr/bin/env python3
"""Generate PWA icons with the Python standard library only."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

GREEN = (33, 92, 72, 255)
CREAM = (251, 246, 234, 255)
INK = (28, 23, 17, 255)


def write_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def mix(a: tuple[int, ...], b: tuple[int, ...], t: float) -> tuple[int, ...]:
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(4))


def sd_round_rect(x: float, y: float, cx: float, cy: float, hw: float, hh: float, r: float) -> float:
    px = abs(x - cx) - (hw - r)
    py = abs(y - cy) - (hh - r)
    outside = math.hypot(max(px, 0.0), max(py, 0.0))
    inside = min(max(px, py), 0.0)
    return outside + inside - r


def sd_circle(x: float, y: float, cx: float, cy: float, r: float) -> float:
    return math.hypot(x - cx, y - cy) - r


def cover(distance: float) -> float:
    return max(0.0, min(1.0, 0.5 - distance))


def shirt_distance(x: float, y: float, size: int, full_bleed: bool) -> float:
    s = size / 512.0
    pad = 0 if full_bleed else 48 * s
    # Body
    body = sd_round_rect(x, y, size * 0.5, size * 0.58, 118 * s, 132 * s, 28 * s)
    # Sleeves
    left = sd_round_rect(x, y, size * 0.27, size * 0.42, 58 * s, 36 * s, 18 * s)
    right = sd_round_rect(x, y, size * 0.73, size * 0.42, 58 * s, 36 * s, 18 * s)
    shirt = min(body, left, right)
    # Neck hole
    neck = sd_circle(x, y, size * 0.5, size * 0.34, 34 * s)
    collar_cut = max(neck, (size * 0.34) - y)
    shirt = max(shirt, -collar_cut)
    # Keep artwork inside the tile
    bounds = sd_round_rect(
        x,
        y,
        size * 0.5,
        size * 0.5,
        size * 0.5 - pad,
        size * 0.5 - pad,
        96 * s if not full_bleed else 0,
    )
    return shirt if bounds < 0 else 1.0


def render(size: int, full_bleed: bool) -> bytes:
    pixels = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            if full_bleed:
                bg_d = -1.0
            else:
                bg_d = sd_round_rect(x + 0.5, y + 0.5, size / 2, size / 2, size * 0.46, size * 0.46, size * 0.18)
            shirt_d = shirt_distance(x + 0.5, y + 0.5, size, full_bleed)
            color = (0, 0, 0, 0)
            color = mix(color, GREEN, cover(bg_d))
            color = mix(color, CREAM, cover(shirt_d) * cover(bg_d + 0.5))
            # subtle neckline ink
            neckline = abs(sd_circle(x + 0.5, y + 0.5, size * 0.5, size * 0.34, 34 * size / 512) ) - 2
            if shirt_d < 2:
                color = mix(color, INK, cover(neckline) * 0.18)
            i = (y * size + x) * 4
            pixels[i : i + 4] = bytes(color)
    return bytes(pixels)


def main() -> None:
    out = Path("icons")
    out.mkdir(exist_ok=True)
    write_png(out / "icon-192.png", 192, 192, render(192, False))
    write_png(out / "icon-512.png", 512, 512, render(512, False))
    write_png(out / "icon-192-maskable.png", 192, 192, render(192, True))
    write_png(out / "icon-512-maskable.png", 512, 512, render(512, True))
    write_png(out / "apple-touch-icon.png", 180, 180, render(180, False))
    print("Wrote icons to", out.resolve())


if __name__ == "__main__":
    main()
