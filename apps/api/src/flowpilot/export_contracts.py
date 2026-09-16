"""Print deterministic OpenAPI, including domain contracts without fake endpoints."""

import json

from pydantic.json_schema import models_json_schema

from flowpilot.diagnosis.models import AgentFinding
from flowpilot.main import app
from flowpilot.procedures.models import ProcedureStep


def export_schema():
    schema = app.openapi()
    _, extra = models_json_schema(
        [(AgentFinding, "validation"), (ProcedureStep, "validation")],
        ref_template="#/components/schemas/{model}",
    )
    schema["components"]["schemas"].update(extra["$defs"])
    return schema


if __name__ == "__main__":
    print(json.dumps(export_schema(), sort_keys=True))
