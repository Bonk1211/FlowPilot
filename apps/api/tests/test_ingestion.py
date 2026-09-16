import json
import shutil
import subprocess

import pytest
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult
from flowpilot.settings import ROOT, fixture_path

CASES = json.loads(fixture_path("v1/parser-cases.json").read_text(encoding="utf-8"))
DEMO_TEXT = fixture_path("demo-industry-machine.log").read_bytes().decode("utf-8")
CASES.append({"name": "demo", "text": DEMO_TEXT, "timezoneOffset": "+08:00"})


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
def test_reference_parity(case):
    """Compare all fields, IDs, warnings, units and raw provenance to the JS reference."""
    node = shutil.which("node")
    assert node, "Node.js is required for parser parity tests"
    request = {
        "text": case["text"],
        "sourceName": "parity-machine.log",
        "timezoneOffset": case["timezoneOffset"],
    }
    reference = subprocess.run(
        [node, str(ROOT / "scripts/parser-reference.mjs")],
        input=json.dumps(request),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    result = parse_industry_event_log(
        request["text"],
        source_name=request["sourceName"],
        timezone_offset=request["timezoneOffset"],
    )
    assert result == json.loads(reference.stdout)
    assert IngestionResult.model_validate(result).model_dump(exclude_unset=True) == result


def test_demo_facts_remain_provisional_and_do_not_imply_quality():
    result = parse_industry_event_log(DEMO_TEXT, timezone_offset="+08:00")
    assert result["stats"] == {
        "eventCount": 15,
        "recognizedEventCount": 15,
        "unknownEventCount": 0,
        "runCount": 2,
    }
    candidates = result["evidenceCandidates"]
    assert {item["verificationState"] for item in candidates} == {"provisional"}
    assert {item["key"] for item in candidates} == {
        "machine_run_status",
        "time_between_boards",
        "fiducial_score",
        "fiducial_position",
        "frame_location_correction",
        "frame_location_relative_to_base",
        "height_sense_result",
    }
    assert all(
        "boardId" not in event["fields"]
        for event in result["events"]
        if event["kind"] not in ("run_started", "run_finished")
    )


def test_digest_is_content_based_but_provenance_uses_filename():
    first = parse_industry_event_log(DEMO_TEXT, source_name="first.log")
    renamed = parse_industry_event_log(DEMO_TEXT, source_name="renamed.log")
    assert first["sourceDigest"] == renamed["sourceDigest"]
    assert first["events"][0]["id"] == renamed["events"][0]["id"]
    assert renamed["events"][0]["sourceRef"].startswith("renamed.log#L")
    changed = parse_industry_event_log(DEMO_TEXT + "\n")
    assert first["sourceDigest"] != changed["sourceDigest"]


@pytest.mark.parametrize("offset", ["UTC", "+24:00", "+08:60", "08:00", 8])
def test_invalid_timezone_rejected(offset):
    with pytest.raises(TypeError):
        parse_industry_event_log(DEMO_TEXT, timezone_offset=offset)


def test_invalid_inputs_rejected():
    with pytest.raises(TypeError):
        parse_industry_event_log(None)
    with pytest.raises(TypeError):
        parse_industry_event_log("", source_name="")
