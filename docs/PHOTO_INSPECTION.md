# Photo inspection demo

## Run

From the repository root, run `uv sync --locked`, `npm run vision:setup`, `npm run db:migrate`, then `npm run dev`. The UI is at http://127.0.0.1:5173 and the API at http://127.0.0.1:8000. The setup script installs checksum-verified ImageNet ResNet18 weights (~45 MB) under `.cache/vision/model`. Inference never downloads weights; a missing model produces an actionable error rather than a fabricated result.

## Three presentation images

1. **Incomplete coverage:** analyze the default photo; start an investigation; choose incomplete coverage, falling measured weight, stable pressure, and unknown material/setup context. Review the diagnosis, follow the existing 3D guide and record an obstruction. Record the completed corrective action, then follow the recovery flow below.
2. **Coarse deposits:** choose the coarse example and analyze it. In discovery choose blobs/droplets and weight passing despite the visible issue. Record a clear nozzle after the inspection. The case hands off for air-cap/coaxial-air and pressure checks; it does not invent an implemented repair branch.
3. **Recovery:** analyze the uniform-coating example or upload a matching post-action inspection photo. Confirm the equipment recovery observations, then verify and resolve. A still-abnormal photo or incomplete recovery observations leave the case open. The saved summary retains the before/after photos and heatmaps.

“Analyze photo” performs model inference for both examples and uploads. Subsequent requests for identical normalized pixels and the same frozen model reuse their persisted result. File names and example IDs do not determine the diagnosis or visual result. The older raster flow remains accessible at `/?samples=raster`; existing cases retain their renderer and recovery contract.

## What the model does

A frozen ImageNet ResNet18 extracts layer2/layer3 patch features. A compact normal memory bank supplies nearest-neighbor distances. The image score is the maximum patch distance. This is a **PatchCore-style simplified implementation**, not a paper-equivalent official WRN50 model or a trained defect classifier.

Inputs are decoded, oriented, converted to RGB, cropped to the center 60% (normalized .20,.20,.80,.80), and resized to 224×224. The heatmap is placed back into its original-image position and uses the same color scale for every photo. Use a matching top-down close-up; the detector has not been validated for arbitrary machine photos or other products. It ignores defects outside the configured inspection region.

One normal image supplied the memory bank. A second normal image supplied a provisional operating threshold of 1.25 times its normal score. The threshold was fixed before the missing-coating experiment. That normal image is a calibration reference, not an independent normal test. With this fixed recipe, the selected examples scored approximately 1.505 (normal), 3.204 (missing coating), and 3.899 (coarse deposit), against a threshold of 1.881. The strongest heatmap points fell inside the selected defects. These few examples establish a working demo, not an accuracy estimate or a validated false-positive rate.

All three example photos are AI-generated illustrations; the visibly amber material does not establish the visibility or physical appearance of real transparent flux. Related defect edits were kept out of the normal bank. Generated edits may change surrounding texture. See `fixtures/vision/manifest.json` for the frozen recipe and hashes. Source images and experiment results were generated during development; there is no claim of factory data or production validation.

## Evidence and case rules

Photo analysis is persisted as `VisionAssessment`, separately from pixel coverage/area measurements. Its `passed` field means only “within this normal-reference threshold.” It is not a probability, defect class, mechanical diagnosis, mass measurement, or production release decision.

The model contributes a provisional `visual_anomaly_detected` observation with source `model_inference`. The operator's discovery answer supplies the reported symptom. Only the technician's confirmed inspection establishes a nozzle obstruction. Rejecting the model observation does not reject independent operator observations. A normal-looking photo does not suppress an operator-reported problem.

Photo cases require a photo assessment at verification. Both assessments must have the same model, preprocessing and threshold; old raster results cannot bypass that requirement. The visual result and existing equipment recovery checks must both pass. Calibration escalation and explicit confirmation remain enforced by the server. Old v1/v2 cases remain readable without a database migration.

## Files and reproducibility

- `fixtures/vision/`: three presentation images, compact normal memory bank, model manifest and provenance.
- `.cache/vision/model/`: downloaded backbone weights, ignored by Git.
- `.cache/vision/assessments/`: normalized photos, heatmaps and immutable JSON results, ignored by Git. Repeated identical inputs reuse the same directory. Retain these while saved cases reference them.
- `FLOWPILOT_VISION_STORAGE_DIR` / `FLOWPILOT_VISION_MODEL_DIR`: optional absolute-path overrides.

Uploads accept single-frame PNG/JPEG, up to 8 MB, dimensions 224–4096 px and at most 16 megapixels. EXIF orientation is applied and metadata is stripped. Invalid input and model unavailability are shown as errors; no fallback score is generated.

API tests check upload boundaries, real example inference, result persistence, evidence correction and recovery gates. Browser tests run against a separate database and photo-storage directory. Run `npm run check` and `npm run test:e2e` after installing model weights. For machines using installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome`.
