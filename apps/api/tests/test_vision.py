import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot import vision
from flowpilot.settings import ROOT
from PIL import Image


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FLOWPILOT_VISION_STORAGE_DIR", str(tmp_path / "assessments"))
    app = FastAPI()
    app.include_router(vision.router)
    with TestClient(app) as client:
        yield client


def image_bytes(size=(224, 224), image_format="PNG"):
    output = io.BytesIO()
    Image.new("RGB", size, (220, 170, 40)).save(output, format=image_format)
    return output.getvalue()


def test_examples_are_read_only(client, tmp_path):
    examples = client.get("/api/vision/examples").json()
    assert [example["id"] for example in examples] == ["incomplete", "coarse", "normal"]
    for example in examples:
        assert client.get(example["image_url"]).headers["content-type"] == "image/png"
    assert not (tmp_path / "assessments").exists()
    assert client.post("/api/vision/examples/unknown/assess").status_code == 404


@pytest.mark.parametrize(
    "mime,payload,status",
    [
        ("application/octet-stream", b"image", 415),
        ("image/png", b"not an image", 422),
        ("image/jpeg", b"", 413),
        ("image/png", image_bytes(image_format="GIF"), 415),
        ("image/png", image_bytes((223, 224)), 422),
        ("image/png", image_bytes((4097, 224)), 422),
    ],
)
def test_rejects_invalid_images(client, mime, payload, status):
    response = client.post(
        "/api/vision/assessments", content=payload, headers={"content-type": mime}
    )
    assert response.status_code == status


def test_upload_size_is_bounded_with_and_without_content_length(client, monkeypatch):
    monkeypatch.setattr(vision, "MAX_UPLOAD_BYTES", 32)
    assert (
        client.post(
            "/api/vision/assessments", content=b"x" * 33, headers={"content-type": "image/png"}
        ).status_code
        == 413
    )
    response = client.post(
        "/api/vision/assessments",
        content=iter([b"x" * 16, b"x" * 17]),
        headers={"content-type": "image/png"},
    )
    assert response.status_code == 413


@pytest.mark.parametrize("assessment_id", ["bad-id", "VIS-abc", "VIS-" + "f" * 64])
def test_unknown_assessment_never_escapes_storage(client, assessment_id):
    assert client.get(f"/api/vision/assessments/{assessment_id}/image").status_code == 404


def test_missing_model_returns_actionable_error(client, tmp_path, monkeypatch):
    monkeypatch.setenv("FLOWPILOT_VISION_MODEL_DIR", str(tmp_path / "missing-model"))
    response = client.post(
        "/api/vision/assessments", content=image_bytes(), headers={"content-type": "image/png"}
    )
    assert response.status_code == 503
    assert "npm run vision:setup" in response.json()["detail"]
    assert not (tmp_path / "assessments").exists()


def test_decode_strips_metadata_and_applies_exif_orientation():
    image = Image.new("RGB", (224, 320))
    exif = Image.Exif()
    exif[274] = 6
    exif[315] = "Private source label"
    payload = io.BytesIO()
    image.save(payload, format="JPEG", exif=exif)
    decoded = vision._decode_image(payload.getvalue())
    assert decoded.size == (320, 224)
    assert not decoded.info
    assert not decoded.getexif()


@pytest.mark.skipif(
    not (ROOT / ".cache/vision/model/resnet18-f37072fd.pth").is_file(),
    reason="Run npm run vision:setup to verify the real local model",
)
def test_real_examples_scores_persist_and_deduplicate(client, monkeypatch, tmp_path):
    monkeypatch.setenv("FLOWPILOT_VISION_MODEL_DIR", str(ROOT / ".cache/vision/model"))
    expected = {"normal": 1.5048033, "incomplete": 3.2035763, "coarse": 3.8990941}
    for name, score in expected.items():
        response = client.post(f"/api/vision/examples/{name}/assess")
        assert response.status_code == 200, response.text
        assessment = response.json()
        assert assessment["raw_score"] == pytest.approx(score, abs=0.01)
        assert assessment["threshold"] == pytest.approx(1.8810041, abs=0.001)
        assert assessment["passed"] is (name == "normal")
        assert assessment["result"] == ("within_reference" if name == "normal" else "anomaly")
        assert vision.load_assessment(assessment["assessment_id"]).model_dump() == assessment
        source = client.get(assessment["image_url"])
        overlay = client.get(assessment["heatmap_url"])
        assert source.status_code == overlay.status_code == 200
        assert Image.open(io.BytesIO(source.content)).size == (1254, 1254)
        assert Image.open(io.BytesIO(overlay.content)).size == (1254, 1254)
        repeated = client.post(
            "/api/vision/assessments",
            content=source.content,
            headers={"content-type": "image/png", "x-filename": "renamed.png"},
        )
        assert repeated.json() == assessment
    directories = list((tmp_path / "assessments").iterdir())
    assert len(directories) == 3
    assert all(path.name.startswith("VIS-") for path in directories)
    # Persisted records remain readable after the in-memory model is discarded.
    monkeypatch.setattr(vision, "_model", None)
    assert vision.load_assessment(assessment["assessment_id"]).raw_score > 0


def test_inconsistent_assessment_decision_is_rejected():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        vision.VisionAssessment(
            assessment_id="VIS-" + "a" * 64,
            image_url="/image",
            heatmap_url="/heatmap",
            width=224,
            height=224,
            model_id="model",
            preprocessing_id="preprocessing",
            raw_score=3,
            threshold=2,
            result="within_reference",
            passed=True,
            timestamp="2026-09-19T00:00:00Z",
        )


def test_dotenv_path_overrides_are_used_for_storage_and_model(tmp_path, monkeypatch):
    model_dir = tmp_path / "custom-model"
    storage = tmp_path / "custom-assessments"
    dotenv = tmp_path / ".env"
    dotenv.write_text(
        f"FLOWPILOT_VISION_STORAGE_DIR={storage}\nFLOWPILOT_VISION_MODEL_DIR={model_dir}\n"
    )
    monkeypatch.delenv("FLOWPILOT_VISION_STORAGE_DIR", raising=False)
    monkeypatch.delenv("FLOWPILOT_VISION_MODEL_DIR", raising=False)
    monkeypatch.setitem(vision.Settings.model_config, "env_file", dotenv)
    monkeypatch.setattr(vision, "_model", None)
    monkeypatch.setattr(vision, "_model_key", None)
    loaded = []
    marker = object()

    def construct(_fixture_dir, path):
        loaded.append(path)
        return marker

    monkeypatch.setattr(vision, "PatchCoreDetector", construct)
    assert vision.storage_dir() == storage
    assert vision._detector() is marker
    assert loaded == [model_dir]
