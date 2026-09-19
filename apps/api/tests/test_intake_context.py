from flowpilot.ingestion.models import LogPreviewRequest
from flowpilot.intake import LogContextRequest, log_context
from flowpilot.settings import ROOT


def context(slug="incomplete-coverage", board=None, transform=lambda text: text):
    text = (ROOT / f"fixtures/logs/synthetic-{slug}.log").read_text()
    return log_context(
        LogContextRequest(log=LogPreviewRequest(text=transform(text)), board_id=board)
    )


def test_matching_log_windows_and_no_future_measurements():
    incomplete = context()
    assert incomplete.board_id == "103"
    assert incomplete.signals["continuous"].answer == "yes"
    assert incomplete.signals["intermittent"].answer == "no"
    assert incomplete.signals["change"].answer == "no"
    assert len(incomplete.signals["continuous"].source_refs) == 3
    assert set(context(board="101").signals) == {"intermittent"}
    assert "continuous" not in context(board="102").signals
    coarse = context("coarse-deposits")
    assert coarse.signals["continuous"].answer == "no"
    assert coarse.signals["intermittent"].answer == "yes"
    assert all(run.complete and run.status == "PASS" for run in incomplete.parsed.runs)
    # PASS does not suppress a measured out-of-range weight.
    assert incomplete.signals["intermittent"].answer == "no"


def test_changed_units_recipe_targets_and_missing_samples_do_not_infer_trend():
    for old, new in [
        ("18.000 mg", "18.000 g"),
        ("Measured = 18.000 mg,Target = 20.000", "Measured = 18.000 mg,Target = 19.500"),
        ("Measured = 18.000 mg", "Missing = 18.000 mg"),
    ]:
        assert "continuous" not in context(transform=lambda text: text.replace(old, new)).signals
    assert (
        "continuous"
        not in context(
            transform=lambda text: text.replace(
                "Board #102,Recipe = FLUX-A", "Board #102,Recipe = FLUX-B"
            )
        ).signals
    )
    assert (
        "change"
        not in context(
            transform=lambda text: text.replace("Actual = 1.490", "Actual = 1.000")
        ).signals
    )


def test_out_of_order_log_retains_events_without_inferring_trends():
    result = context(transform=lambda text: text.replace("09:01:08.000", "08:59:08.000"))
    assert not result.signals
    assert result.parsed.stats.eventCount > 30
