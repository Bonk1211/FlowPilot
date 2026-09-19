"""Photo intake and immutable local anomaly assessments."""

import hashlib
import io
import json
import re
import shutil
import threading
import uuid
import warnings
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import Field, model_validator
from starlette.concurrency import run_in_threadpool

from flowpilot.investigations.models import Contract
from flowpilot.settings import ROOT, Settings
from flowpilot.vision_model import PatchCoreDetector, VisionModelUnavailable

FIXTURE_DIR = ROOT / "fixtures" / "vision"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
MAX_IMAGE_EDGE = 4096
MIN_IMAGE_EDGE = 224
ASSESSMENT_ID = re.compile(r"VIS-[0-9a-f]{64}\Z")
EXAMPLES = {
    "incomplete": ("Incomplete coverage", "incomplete-coverage.png"),
    "coarse": ("Coarse deposits", "coarse-deposits.png"),
    "normal": ("Uniform coating", "normal.png"),
}
router = APIRouter(prefix="/api/vision", tags=["vision"])
_model: PatchCoreDetector | None = None
_model_key: str | None = None
_inference_lock = threading.Lock()


class VisionAssessment(Contract):
    kind: Literal["vision"] = "vision"
    assessment_id: str
    image_url: str
    heatmap_url: str
    width: int
    height: int
    model_id: str
    preprocessing_id: str
    raw_score: float = Field(ge=0, allow_inf_nan=False)
    threshold: float = Field(gt=0, allow_inf_nan=False)
    result: Literal["anomaly", "within_reference"]
    passed: bool
    timestamp: str

    @model_validator(mode="after")
    def check_decision(self):
        anomaly = self.raw_score > self.threshold
        if self.passed == anomaly or (self.result == "anomaly") != anomaly:
            raise ValueError("Assessment decision must match its frozen score and threshold")
        return self


class VisionExample(Contract):
    id: Literal["incomplete", "coarse", "normal"]
    label: str
    image_url: str


def storage_dir() -> Path:
    return Settings().vision_storage_dir


def _assessment_dir(assessment_id: str) -> Path:
    if not ASSESSMENT_ID.fullmatch(assessment_id):
        raise HTTPException(404, "Photo assessment not found")
    return storage_dir() / assessment_id


def load_assessment(assessment_id: str) -> VisionAssessment:
    directory = _assessment_dir(assessment_id)
    try:
        result = VisionAssessment.model_validate_json((directory / "assessment.json").read_text())
        if result.assessment_id != assessment_id:
            raise ValueError("Assessment identity mismatch")
        return result
    except FileNotFoundError as exc:
        raise HTTPException(404, "Photo assessment not found") from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(503, "Stored photo assessment could not be read") from exc


def _decode_image(payload: bytes) -> Image.Image:
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Upload a PNG or JPEG image smaller than 8 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as source:
                if source.format not in {"PNG", "JPEG"} or getattr(source, "n_frames", 1) != 1:
                    raise HTTPException(415, "Only single-frame PNG and JPEG photos are supported")
                width, height = source.size
                if (
                    min(width, height) < MIN_IMAGE_EDGE
                    or max(width, height) > MAX_IMAGE_EDGE
                    or width * height > MAX_IMAGE_PIXELS
                ):
                    raise HTTPException(422, "Photo edges must be 224–4096 px, up to 16 megapixels")
                source.load()
                normalized = ImageOps.exif_transpose(source).convert("RGB")
                # Recreate pixel storage so EXIF, comments and original metadata are discarded.
                return Image.frombytes("RGB", normalized.size, normalized.tobytes())
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise HTTPException(
            422, "The image could not be decoded; upload a valid PNG or JPEG"
        ) from exc


def _detector() -> PatchCoreDetector:
    global _model, _model_key
    model_dir = Settings().vision_model_dir
    artifact_hash = hashlib.sha256((FIXTURE_DIR / "manifest.json").read_bytes()).hexdigest()
    key = f"{model_dir.resolve()}:{artifact_hash}"
    if _model is None or _model_key != key:
        try:
            _model = PatchCoreDetector(FIXTURE_DIR, model_dir)
            _model_key = key
        except (VisionModelUnavailable, ImportError, OSError, ValueError, RuntimeError) as exc:
            raise HTTPException(
                503, "Photo analysis is unavailable. Run npm run vision:setup."
            ) from exc
    return _model


def assess_image(payload: bytes) -> VisionAssessment:
    image = _decode_image(payload)
    normalized = io.BytesIO()
    image.save(normalized, format="PNG")
    normalized_bytes = normalized.getvalue()
    manifest_bytes = (FIXTURE_DIR / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    identity = hashlib.sha256(normalized_bytes + b"\0" + manifest_bytes).hexdigest()
    assessment_id = f"VIS-{identity}"
    directory = _assessment_dir(assessment_id)
    # The same photo+frozen model has one immutable result, even with different filenames.
    with _inference_lock:
        if (directory / "assessment.json").is_file():
            return load_assessment(assessment_id)
        detector = _detector()
        score, raw_map = detector.predict(image)
        anomaly = score > detector.threshold
        assessment = VisionAssessment(
            assessment_id=assessment_id,
            image_url=f"/api/vision/assessments/{assessment_id}/image",
            heatmap_url=f"/api/vision/assessments/{assessment_id}/heatmap",
            width=image.width,
            height=image.height,
            model_id=manifest["model_id"],
            preprocessing_id=manifest["preprocessing_id"],
            raw_score=score,
            threshold=detector.threshold,
            result="anomaly" if anomaly else "within_reference",
            passed=not anomaly,
            timestamp=datetime.now(UTC).isoformat(),
        )
        parent = storage_dir()
        parent.mkdir(parents=True, exist_ok=True)
        temporary = parent / f".tmp-{uuid.uuid4().hex}"
        temporary.mkdir()
        try:
            (temporary / "image.png").write_bytes(normalized_bytes)
            detector.heatmap(image, raw_map).save(temporary / "heatmap.png", format="PNG")
            (temporary / "assessment.json").write_text(assessment.model_dump_json(indent=2))
            try:
                temporary.rename(directory)
            except OSError:
                # A second API worker may have finished the same deterministic assessment.
                if (directory / "assessment.json").is_file():
                    return load_assessment(assessment_id)
                raise
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
        return assessment


def _example_path(example_id: str) -> Path:
    if example_id not in EXAMPLES:
        raise HTTPException(404, "Example photo not found")
    return FIXTURE_DIR / EXAMPLES[example_id][1]


@router.get("/examples", response_model=list[VisionExample])
def examples() -> list[VisionExample]:
    return [
        VisionExample(id=key, label=value[0], image_url=f"/api/vision/examples/{key}/image")
        for key, value in EXAMPLES.items()
    ]


@router.get("/examples/{example_id}/image")
def example_image(example_id: str) -> FileResponse:
    return FileResponse(_example_path(example_id), media_type="image/png")


@router.post("/examples/{example_id}/assess", response_model=VisionAssessment)
def assess_example(example_id: str) -> VisionAssessment:
    return assess_image(_example_path(example_id).read_bytes())


@router.post("/assessments", response_model=VisionAssessment)
async def upload_assessment(request: Request) -> VisionAssessment:
    if request.headers.get("content-type", "").split(";", 1)[0].strip() not in {
        "image/png",
        "image/jpeg",
    }:
        raise HTTPException(415, "Send the photo as image/png or image/jpeg")
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Upload a PNG or JPEG image smaller than 8 MB")
        except ValueError as exc:
            raise HTTPException(400, "Invalid content length") from exc
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Upload a PNG or JPEG image smaller than 8 MB")
        data.extend(chunk)
    return await run_in_threadpool(assess_image, bytes(data))


@router.get("/assessments/{assessment_id}/{asset}")
def assessment_image(assessment_id: str, asset: str) -> FileResponse:
    if asset not in {"image", "heatmap"}:
        raise HTTPException(404, "Assessment image not found")
    load_assessment(assessment_id)
    path = _assessment_dir(assessment_id) / f"{asset}.png"
    if not path.is_file():
        raise HTTPException(404, "Assessment image not found")
    return FileResponse(path, media_type="image/png")
