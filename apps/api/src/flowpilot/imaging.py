"""Idealized spray masks; pixel measurements do not measure mass or thickness."""

import math
from typing import Literal

from pydantic import Field

from flowpilot.investigations.models import Contract
from flowpilot.legacy_imaging import png

SampleId = Literal["normal", "incomplete", "coarse", "shifted", "overspray"]
WIDTH, HEIGHT = 360, 160
TARGET = (60, 40, 300, 120)
KOZ = (40, 20, 320, 140)


class Measurement(Contract):
    sample_id: SampleId
    image_url: str
    simulated: Literal[True] = True
    width: int = WIDTH
    height: int = HEIGHT
    target_bounds: list[int] = Field(default_factory=lambda: list(TARGET))
    keep_out_bounds: list[int] = Field(default_factory=lambda: list(KOZ))
    coverage_pct: float
    uncovered_area_px: int
    displacement_px: float
    outside_keep_out_px: int
    coarse_area_px: int
    passed: bool


def generate_raster(sample: SampleId) -> bytes:
    pixels = bytearray([255] * WIDTH * HEIGHT)
    x0, y0, x1, y1 = TARGET
    if sample == "incomplete":
        x1 = 230
    elif sample == "shifted":
        x0, x1 = x0 + 30, x1 + 30
    elif sample == "overspray":
        x0, x1 = 20, 340
    for y in range(y0, y1):
        for x in range(x0, x1):
            pixels[y * WIDTH + x] = 100
    if sample == "coarse":
        for y in range(70, 90):
            for x in range(260, 285):
                pixels[y * WIDTH + x] = 30
    return bytes(pixels)


def measure(pixels: bytes, sample: SampleId) -> Measurement:
    if len(pixels) != WIDTH * HEIGHT:
        raise ValueError("Unexpected raster dimensions")
    x0, y0, x1, y1 = TARGET
    k0, l0, k1, l1 = KOZ
    deposited = [(i % WIDTH + 0.5, i // WIDTH + 0.5) for i, p in enumerate(pixels) if p < 200]
    covered = sum(x0 <= x < x1 and y0 <= y < y1 for x, y in deposited)
    area = (x1 - x0) * (y1 - y0)
    outside = sum(not (k0 <= x < k1 and l0 <= y < l1) for x, y in deposited)
    coarse = sum(p < 60 for p in pixels)
    displacement = (
        math.hypot(
            sum(x for x, _ in deposited) / len(deposited) - (x0 + x1) / 2,
            sum(y for _, y in deposited) / len(deposited) - (y0 + y1) / 2,
        )
        if deposited
        else 0
    )
    return Measurement(
        sample_id=sample,
        image_url=f"/api/demo/images/{sample}.png",
        coverage_pct=round(100 * covered / area, 2),
        uncovered_area_px=area - covered,
        displacement_px=round(displacement, 2),
        outside_keep_out_px=outside,
        coarse_area_px=coarse,
        passed=covered == area and outside == 0 and coarse == 0 and displacement <= 1,
    )


def sample_measurement(sample: SampleId) -> Measurement:
    return measure(generate_raster(sample), sample)


__all__ = ["Measurement", "SampleId", "generate_raster", "measure", "png", "sample_measurement"]
