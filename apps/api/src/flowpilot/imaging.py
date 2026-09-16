"""Controlled raster samples and independent threshold/component measurement."""

import math
import struct
import zlib
from typing import Literal

from flowpilot.investigations.models import Contract

SampleId = Literal["normal", "undersized", "oversized", "missing"]
WIDTH, HEIGHT = 360, 160
CENTERS = [(40 + col * 56, 48 + row * 64) for row in range(2) for col in range(6)]


class MeasuredDot(Contract):
    id: str
    x: float
    y: float
    diameter_px: float
    classification: Literal["normal", "undersized", "oversized", "missing"]
    position_error_px: float
    shape_consistency: float


class Measurement(Contract):
    sample_id: SampleId
    image_url: str
    simulated: Literal[True] = True
    width: int = WIDTH
    height: int = HEIGHT
    dots: list[MeasuredDot]
    mean_diameter_px: float
    variation_px: float
    deviation_px: float
    golden_min_px: float = 28
    golden_max_px: float = 32
    missing_count: int
    abnormal_count: int
    mean_position_error_px: float
    mean_shape_consistency: float
    passed: bool


def generate_raster(sample: SampleId) -> bytes:
    pixels = bytearray([255] * WIDTH * HEIGHT)
    radius = {"normal": 15, "undersized": 9, "oversized": 20, "missing": 15}[sample]
    for index, (cx, cy) in enumerate(CENTERS):
        if sample == "missing" and index == 5:
            continue
        for y in range(cy - radius, cy + radius):
            for x in range(cx - radius, cx + radius):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius**2:
                    pixels[y * WIDTH + x] = 30
    return bytes(pixels)


def png(pixels: bytes) -> bytes:
    def chunk(kind, payload):
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload))
        )

    rows = b"".join(b"\0" + pixels[y * WIDTH : (y + 1) * WIDTH] for y in range(HEIGHT))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


def measure(pixels: bytes, sample: SampleId) -> Measurement:
    # Measurement uses pixel intensities, never the sample's generation radius.
    remaining = {i for i, value in enumerate(pixels) if value < 128}
    components = []
    while remaining:
        seed = remaining.pop()
        stack, component = [seed], [seed]
        while stack:
            index = stack.pop()
            x, y = index % WIDTH, index // WIDTH
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                adjacent = ny * WIDTH + nx
                if 0 <= nx < WIDTH and 0 <= ny < HEIGHT and adjacent in remaining:
                    remaining.remove(adjacent)
                    stack.append(adjacent)
                    component.append(adjacent)
        xs, ys = [i % WIDTH for i in component], [i // WIDTH for i in component]
        components.append(
            (
                sum(xs) / len(xs) + 0.5,
                sum(ys) / len(ys) + 0.5,
                max(xs) - min(xs) + 1,
                max(ys) - min(ys) + 1,
                len(component),
            )
        )
    dots = []
    for index, (cx, cy) in enumerate(CENTERS):
        candidates = [c for c in components if math.hypot(c[0] - cx, c[1] - cy) < 24]
        component = min(candidates, key=lambda c: math.hypot(c[0] - cx, c[1] - cy), default=None)
        x, y, width, height, area = component or (cx, cy, 0, 0, 0)
        diameter = (width + height) / 2
        classification = (
            "missing"
            if not component
            else "undersized"
            if diameter < 28
            else "oversized"
            if diameter > 32
            else "normal"
        )
        dots.append(
            MeasuredDot(
                id=f"dot-{index}",
                x=x,
                y=y,
                diameter_px=diameter,
                classification=classification,
                position_error_px=round(math.hypot(x - cx, y - cy), 3),
                shape_consistency=round(min(1, area / (math.pi * (diameter / 2) ** 2)), 3)
                if diameter
                else 0,
            )
        )
    present = [d for d in dots if d.classification != "missing"]
    count = max(1, len(present))
    mean = sum(d.diameter_px for d in present) / count
    variation = math.sqrt(sum((d.diameter_px - mean) ** 2 for d in present) / count)
    abnormal = sum(d.classification != "normal" for d in dots)
    return Measurement(
        sample_id=sample,
        image_url=f"/api/demo/images/{sample}.png",
        dots=dots,
        mean_diameter_px=round(mean, 3),
        variation_px=round(variation, 3),
        deviation_px=round(mean - 30, 3),
        missing_count=len(dots) - len(present),
        abnormal_count=abnormal,
        passed=abnormal == 0,
        mean_position_error_px=round(sum(d.position_error_px for d in present) / count, 3),
        mean_shape_consistency=round(sum(d.shape_consistency for d in present) / count, 3),
    )


def sample_measurement(sample: SampleId) -> Measurement:
    return measure(generate_raster(sample), sample)
