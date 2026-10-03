"""Provider schemas preserve their structure; Pydantic still enforces local limits."""

import pytest
from flowpilot.gemini import response_schema
from flowpilot.incidents.models import AdaptiveQuestions
from pydantic import ValidationError


def test_response_schema_retains_structure_without_rejected_provider_constraints():
    original = AdaptiveQuestions.model_json_schema()
    sanitized = response_schema(original)
    assert sanitized["required"] == original["required"]
    assert sanitized["$defs"]["InvestigationQuestion"]["additionalProperties"] is False
    assert (
        sanitized["properties"]["candidates"]["items"]
        == original["properties"]["candidates"]["items"]
    )
    assert "maxItems" not in sanitized["properties"]["candidates"]
    assert "maxItems" in original["properties"]["candidates"]
    with pytest.raises(ValidationError):
        AdaptiveQuestions.model_validate({"candidates": [], "preferred_id": "missing"})
    with pytest.raises(ValidationError):
        AdaptiveQuestions.model_validate(
            {
                "candidates": [
                    {
                        "id": str(index),
                        "target_fact": "timing",
                        "prompt": "Records?",
                        "why": "Time alignment",
                    }
                    for index in range(4)
                ],
                "preferred_id": "0",
            }
        )
