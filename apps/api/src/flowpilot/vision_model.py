"""Frozen PatchCore-style detector for the fixed coupon demo inspection view.

Scores are nearest-neighbor distances, not probabilities or defect diagnoses.
Weights must be installed explicitly; request-time inference never downloads.
"""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


class VisionModelUnavailable(RuntimeError):
    pass


class PatchCoreDetector:
    def __init__(self, fixture_dir: Path, model_dir: Path):
        import torch
        from torchvision.models import resnet18
        from torchvision.models.feature_extraction import create_feature_extractor

        self.manifest = json.loads((fixture_dir / "manifest.json").read_text())
        weights = model_dir / "resnet18-f37072fd.pth"
        if not weights.is_file():
            raise VisionModelUnavailable("Vision model is not installed. Run npm run vision:setup.")
        if hashlib.sha256(weights.read_bytes()).hexdigest() != self.manifest["backbone_sha256"]:
            raise VisionModelUnavailable(
                "Vision model checksum mismatch. Run npm run vision:setup."
            )
        bank_path = fixture_dir / "memory-bank.npz"
        if hashlib.sha256(bank_path.read_bytes()).hexdigest() != self.manifest["memory_sha256"]:
            raise VisionModelUnavailable("Vision reference bank checksum mismatch.")
        torch.set_num_threads(4)
        backbone = resnet18(weights=None)
        backbone.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True))
        self.model = create_feature_extractor(backbone, {"layer2": "a", "layer3": "b"}).eval()
        self.model.requires_grad_(False)
        with np.load(bank_path, allow_pickle=False) as artifact:
            self.memory = torch.from_numpy(artifact["memory_bank"].copy())
        self.size = self.manifest["input_size"]
        self.roi = self.manifest["roi_normalized_ltrb"]
        self.threshold = self.manifest["threshold"]

    def predict(self, image: Image.Image) -> tuple[float, np.ndarray]:
        import torch
        import torch.nn.functional as functional
        from torchvision.transforms import functional as transforms

        left, top, right, bottom = self.roi
        image = image.crop(
            (
                int(left * image.width),
                int(top * image.height),
                int(right * image.width),
                int(bottom * image.height),
            )
        )
        image = image.resize((self.size, self.size), Image.Resampling.BICUBIC)
        tensor = transforms.normalize(
            transforms.to_tensor(image),
            self.manifest["normalization_mean"],
            self.manifest["normalization_std"],
        ).unsqueeze(0)
        with torch.inference_mode():
            features = self.model(tensor)
            a, b = [
                functional.avg_pool2d(features[key], 3, stride=1, padding=1) for key in ("a", "b")
            ]
            b = functional.interpolate(b, size=a.shape[-2:], mode="bilinear", align_corners=False)
            embedding = torch.cat((a, b), dim=1)
            patches = embedding.permute(0, 2, 3, 1).reshape(-1, embedding.shape[1])
            distances = torch.cat(
                [torch.cdist(chunk, self.memory).min(dim=1).values for chunk in patches.split(256)]
            )
            raw_map = functional.interpolate(
                distances.reshape(1, 1, *a.shape[-2:]),
                (self.size, self.size),
                mode="bilinear",
                align_corners=False,
            )[0, 0].numpy()
        return float(distances.max()), raw_map

    def heatmap(self, image: Image.Image, raw_map: np.ndarray) -> Image.Image:
        """Place the ROI heatmap in original coordinates, with one fixed color scale."""
        left, top, right, bottom = self.roi
        bounds = (
            int(left * image.width),
            int(top * image.height),
            int(right * image.width),
            int(bottom * image.height),
        )
        width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        intensity = np.asarray(
            Image.fromarray(raw_map).resize((width, height), Image.Resampling.BILINEAR)
        )
        intensity = np.clip(intensity / (self.threshold * 2), 0, 1)
        color = np.zeros((height, width, 3), dtype=np.float32)
        color[:, :, 0] = 255
        color[:, :, 1] = 210 * (1 - intensity)
        alpha = np.clip((intensity - 0.25) / 0.75, 0, 1)[:, :, None] * 0.65
        original = np.asarray(image.crop(bounds), dtype=np.float32)
        overlay = Image.fromarray((original * (1 - alpha) + color * alpha).astype(np.uint8))
        result = image.copy()
        result.paste(overlay, bounds[:2])
        return result
