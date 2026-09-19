"""Install verified local model weights; inference itself never downloads."""

import argparse
import hashlib
import json
import os
import shutil
import tempfile
import urllib.request
from pathlib import Path

from flowpilot.settings import Settings

ROOT = Path(__file__).resolve().parents[1]
WEIGHTS_URL = "https://download.pytorch.org/models/resnet18-f37072fd.pth"


def setup(source: Path | None = None) -> Path:
    manifest = json.loads((ROOT / "fixtures/vision/manifest.json").read_text())
    expected = manifest["backbone_sha256"]
    directory = Settings().vision_model_dir
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / "resnet18-f37072fd.pth"
    if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected:
        return destination
    handle, name = tempfile.mkstemp(prefix=".weights-", suffix=".tmp", dir=directory)
    os.close(handle)
    temporary = Path(name)
    try:
        if source is not None:
            shutil.copyfile(source, temporary)
        else:
            with urllib.request.urlopen(WEIGHTS_URL, timeout=60) as response:
                with temporary.open("wb") as output:
                    total = 0
                    while chunk := response.read(1024 * 1024):
                        total += len(chunk)
                        if total > 60 * 1024 * 1024:
                            raise RuntimeError("Model download exceeded expected size")
                        output.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != expected:
            raise RuntimeError("Model checksum mismatch; no weights installed")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, help="Import an already downloaded official checkpoint"
    )
    args = parser.parse_args()
    print(f"Vision model ready: {setup(args.source)}")
