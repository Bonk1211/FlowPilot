"""Build the v2 offline storyboard from shared raster measurements and scoring rules."""

import base64
import json
from pathlib import Path

from flowpilot.imaging import generate_raster, png, sample_measurement

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "fixtures/v2"
DEST.mkdir(exist_ok=True)

labels = {
    "fluid_path_restriction": "Fluid-path restriction",
    "atomization_fault": "Coaxial-air / atomization fault",
    "fluid_supply_fault": "Fluid-pressure / BFS supply fault",
    "alignment_fault": "Nozzle / alignment / recipe fault",
    "material_condition": "Material condition / idle purge",
}
rules = []


def rule(key, value, weights, explanation):
    rules.append(
        dict(key=key, value=value, weights=dict(zip(labels, weights)), explanation=explanation)
    )


rule(
    "incomplete_coverage",
    True,
    [15, 10, 15, 5, 10],
    "Incomplete coverage is compatible with several causes, not proof of restriction.",
)
rule(
    "coarse_deposits",
    True,
    [0, 35, 0, 0, 5],
    "Coarse deposits support an atomization check; mass is unknown from pixels.",
)
rule(
    "shifted_pattern",
    True,
    [0, 0, 0, 30, 0],
    "A shifted pattern warrants nozzle and offset checks.",
)
rule(
    "overspray",
    True,
    [0, 20, 0, 10, 0],
    "Material outside the boundary warrants air-cap and alignment checks.",
)
rule(
    "continuous",
    "yes",
    [25, 0, 10, 0, 5],
    "Reported falling flux weight supports restriction, supply, and material checks.",
)
rule(
    "intermittent",
    "yes",
    [-10, 30, 0, 0, 0],
    "Reported stable weight with blobs favors atomization over restriction.",
)
rule(
    "change",
    "yes",
    [5, 0, 20, 0, 0],
    "Rising fluid-pressure demand can accompany restriction or a supply fault; it proves neither.",
)
rule(
    "change",
    "unstable",
    [0, 0, 35, 0, 0],
    "Unstable actual pressure warrants checking the regulator, BFS, and connections.",
)
rule(
    "temperature",
    "yes",
    [0, 0, 0, 0, 40],
    "Downtime or material-condition concerns warrant stabilization and idle-purge review.",
)
rule(
    "service",
    "yes",
    [0, 0, 0, 40, 0],
    "A collision or setup change warrants nozzle straightness and offset checks.",
)
rule(
    "inspection",
    "no_obstruction_found",
    [-25, 15, 10, 0, 0],
    "A clear nozzle weakens nozzle restriction but cannot exclude an upstream restriction.",
)
rule(
    "inspection",
    "obstruction_found",
    [40, 0, 0, 0, 0],
    "Confirmed nozzle obstruction establishes a restriction; recovery still needs verification.",
)
(DEST / "scoring-rules.json").write_text(
    json.dumps(dict(version="2.0", labels=labels, rules=rules), indent=2) + "\n"
)

data = json.loads((ROOT / "fixtures/v1/golden-scenario.json").read_text(encoding="utf-8"))
replacements = {
    "Undersized epoxy dots": "Declining flux spray coverage",
    "undersized epoxy dots": "incomplete flux spray coverage",
    "Consistently undersized epoxy dots": "Declining flux spray coverage",
    "Precision epoxy dispensing": "S-932 / DJ-2200 atomized flux spraying",
    "partial_cartridge_nozzle_restriction": "fluid_path_restriction",
    "material_viscosity_change": "material_condition",
    "trapped_air_bubble": "atomization_fault",
    "Cartridge / nozzle restriction": "Fluid-path restriction",
    "Partial cartridge / nozzle restriction": "Nozzle restriction",
    "cartridge replacement": "nozzle replacement",
    "Inspect the cartridge and nozzle": "Inspect the nozzle and air cap",
    "No obstruction; review material conditions next.": "No nozzle obstruction; review air cap and pressure supply next.",
}


def replace(value):
    if isinstance(value, str):
        for old, new in replacements.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [replace(v) for v in value]
    if isinstance(value, dict):
        return {k: replace(v) for k, v in value.items()}
    return value


data = replace(data)
data["schema_version"] = data["fixture_version"] = "2.0"
data["investigation"]["schema_version"] = "2.0"
evidence = data["investigation"]["evidence"]
for e in evidence:
    if e["key"] == "mean_dot_diameter_px":
        e["key"], e["value"], e["unit"] = (
            "coverage_pct",
            (70.83 if e["id"] != "EV-VERIFY" else 100),
            "%",
        )
    if e["key"] == "undersized":
        e["key"] = "incomplete_coverage"
for e in evidence:
    if e["id"] == "EV-PERSIST":
        e.update(key="continuous", value="yes")
    if e["id"] == "EV-FOUND":
        e["value"] = "obstruction_found"
    if e["id"] == "EV-CLEAR":
        e["value"] = "no_obstruction_found"
symptom = dict(next(e for e in evidence if e["id"] == "EV-IMAGE"))
symptom.update(id="EV-SYMPTOM", key="incomplete_coverage", value=True, unit=None)
evidence.append(symptom)
for snapshot in data["snapshots"]:
    if "EV-IMAGE" in snapshot["evidence_ids"]:
        snapshot["evidence_ids"].append("EV-SYMPTOM")

data["images"] = []
for image_id, sample, label in [
    ("before", "incomplete", "Before action"),
    ("after", "normal", "Recovered spray"),
]:
    m = sample_measurement(sample).model_dump()
    m["image_url"] = (
        "data:image/png;base64," + base64.b64encode(png(generate_raster(sample))).decode()
    )
    image_evidence = ["EV-IMAGE", "EV-SYMPTOM"] if sample == "incomplete" else ["EV-VERIFY"]
    data["images"].append(dict(id=image_id, label=label, evidence_ids=image_evidence, **m))
data["verification"] = dict(
    before_image_id="before",
    after_image_id="after",
    passed=True,
    explanation="Synthetic recovery: full coverage, centered pattern, no coarse deposits or overspray; Prompted Setup, calibration, weight/pressure compliance, and first carriers in both lanes confirmed. Subsequent inspection explicitly not required in this demo profile.",
)
data["recovery_checks"] = dict(
    profile="synthetic_demo",
    prompted_setup="pass",
    calibration="pass",
    weight_within_limits="pass",
    pressure_within_limits="pass",
    limits_reference="Synthetic training profile; not ATRMS limits",
    expected_lanes=["A", "B"],
    first_carriers=[dict(lane=x, all_units_accepted="pass") for x in ["A", "B"]],
    subsequent_required="no",
    subsequent_trays_accepted=0,
    confirmed=True,
)
data["summary"]["verification"] = data["verification"]["explanation"]
data["summary"]["corrective_action"] = (
    "Simulated nozzle replacement recorded under the applicable site procedure"
)


def question(id, prompt, rationale, options):
    return dict(
        id=id,
        prompt=prompt,
        rationale=rationale,
        options=[dict(value=v, label=l, next_question_id=n) for v, l, n in options],
    )


def choices(next_id):
    return [("yes", "Yes", next_id), ("no", "No", next_id), ("unknown", "Not recorded", next_id)]


data["questions"] = [
    question(
        "frequency",
        "Which spray symptom was observed?",
        "Separate poor coverage from poor atomization.",
        [
            ("continuous", "Incomplete coverage", "continuous"),
            ("intermittent", "Blobs or line-end droplets", "intermittent"),
            ("unknown", "Not recorded", "continuous"),
        ],
    ),
    question(
        "continuous",
        "Has measured flux weight been falling?",
        "Weight must come from a measurement or technician report, never from the image.",
        choices("change"),
    ),
    question(
        "intermittent",
        "Does flux weight pass despite blobs or droplets?",
        "Stable weight does not establish acceptable atomization.",
        choices("change"),
    ),
    question(
        "change",
        "What does fluid pressure show?",
        "Distinguish rising demand from unstable actual pressure.",
        [
            ("yes", "Rising demand", "temperature"),
            ("unstable", "Unstable actual pressure", "temperature"),
            ("no", "Stable / no known change", "temperature"),
            ("unknown", "Not recorded", "temperature"),
        ],
    ),
    question(
        "temperature",
        "Any material-condition or idle-purge concerns?",
        "Review flux identity, pot life, stabilization, and downtime.",
        choices("service"),
    ),
    question(
        "service",
        "Was there a collision or recent setup change?",
        "Bent nozzles and incorrect offsets can shift a pattern.",
        choices(None),
    ),
]
data["first_question_id"] = "frequency"
data["recommendations"] = [
    dict(
        id="inspection",
        name="Nozzle and air-cap inspection",
        duration_minutes=10,
        required_parts=["Nozzle", "Air cap"],
        instructions="Review external hoses, connections, pattern and pressure observations first. Record only the result of a nozzle inspection permitted by the controlled site procedure.",
        rationale="A confirmed nozzle obstruction supports restriction; a clear nozzle redirects checks without excluding upstream restriction.",
        expected_outcomes=[
            "Obstruction found: record observation before corrective action.",
            "No obstruction found: check air cap, coaxial air, then pressure supply.",
        ],
        safety_note="Illustrative only. Stop processing and contain affected material. Follow the site certification and isolation procedure; EMO is not isolation.",
    ),
    dict(
        id="air_supply",
        name="Air-cap and pressure-supply checks",
        duration_minutes=10,
        required_parts=["Air cap", "Coaxial air", "BFS"],
        instructions="Check in order: air-cap installation/centering; coaxial air; fluid-pressure setpoint versus actual; BFS/QDs/tubing; valve condition through maintenance; material/pot life/idle purge; nozzle offsets and recipe teaching.",
        rationale="A clear nozzle does not exclude an upstream restriction. Start with atomization and supply checks, not an assumed viscosity fault.",
        expected_outcomes=[
            "Record further evidence with authorized personnel; this case remains open."
        ],
        safety_note="Internal valve, regulator, solenoid or electrical work belongs to authorized maintenance under the applicable isolation procedure.",
    ),
]
steps = [
    (
        "contain",
        "Stop and contain affected material",
        "substrate_tray",
        "assembly_overview",
        "Stop processing and segregate affected units under the applicable recovery procedure. Review alarms and pattern observations.",
        "Do not dry-cycle a production lot. The prototype does not release material.",
    ),
    (
        "supply",
        "Review the BFS and fluid path externally",
        "bfs_bottle",
        "assembly_overview",
        "Identify bottle, pickup, tubing and QDs. Review visible leaks, kinks, clamps and pressure observations without disconnecting fittings.",
        "Never open a pressurized BFS. EMO is not zero-energy isolation. Follow controlled pressure-release and LOTO requirements.",
    ),
    (
        "air",
        "Locate the coaxial air cap",
        "air_cap",
        "nozzle_closeup",
        "Identify the air cap around the nozzle and its separate coaxial-air supply. Compare centering and pattern observations.",
        "Use the approved service position and interlocked machine state. Never bypass interlocks.",
    ),
    (
        "nozzle",
        "Review the authorized nozzle observation",
        "nozzle",
        "nozzle_closeup",
        "Record a nozzle-only observation made by an authorized person under the applicable procedure. A clear nozzle says nothing definitive about upstream tubing or valve internals.",
        "No drilling, reaming, forced wire, unapproved air, valve IPA flushing, air-cap immersion, or internal QD solvent cleaning. Cleaning tools, PPE and settings require the controlled procedure.",
    ),
    (
        "restore",
        "Restore and hand off",
        "dj2200_valve",
        "valve_closeup",
        "Record the observation. Internal valve, micrometer, regulator, solenoid and electrical work require authorized maintenance. Restore guards and return to the prescribed idle-purge state.",
        "Heated purge surfaces may be hot. Expert feedback received; revised procedure approval pending.",
    ),
]
data["procedure_steps"] = [
    dict(
        step_id=a,
        title=b,
        model_node_id=c,
        camera_preset=d,
        highlight="warning" if i == 0 else "active",
        instruction=e,
        caution=f,
    )
    for i, (a, b, c, d, e, f) in enumerate(steps)
]
data["procedure_review"] = "feedback_received_approval_pending"
# Pending observations have separate provisional evidence and never confirm a cause.
for outcome, source_id, pending_id in [
    ("obstruction_found", "EV-FOUND", "EV-FOUND-PENDING"),
    ("no_obstruction_found", "EV-CLEAR", "EV-CLEAR-PENDING"),
]:
    pending = dict(next(e for e in evidence if e["id"] == source_id))
    pending.update(id=pending_id, verification_state="provisional")
    evidence.append(pending)
found = next(s for s in data["snapshots"] if s["id"] == "found")
found["state"] = "inspection_recommended"
found["evidence_ids"] = [
    "EV-FOUND-PENDING" if id == "EV-FOUND" else id for id in found["evidence_ids"]
]
found["timeline"] = list(next(s for s in data["snapshots"] if s["id"] == "inspection")["timeline"])
clear = dict(found)
clear.update(
    id="clear",
    title="Confirm the clear-nozzle observation",
    next_snapshot_id="negative",
    evidence_ids=[
        "EV-CLEAR-PENDING" if id == "EV-FOUND-PENDING" else id for id in found["evidence_ids"]
    ],
)
data["snapshots"].append(clear)
next(o for o in data["outcomes"] if o["outcome"] == "no_obstruction_found")["next_snapshot_id"] = (
    "clear"
)

lookup = {e["id"]: e for e in evidence}
for snapshot in data["snapshots"]:
    if snapshot["recommendation_id"]:
        snapshot["recommendation_id"] = (
            "air_supply" if snapshot["id"] == "negative" else "inspection"
        )
    if not snapshot["ranking"]:
        continue
    ranking = []
    for hypothesis, label in labels.items():
        contributions = [
            dict(evidence_id=id, weight=r["weights"][hypothesis], explanation=r["explanation"])
            for id in snapshot["evidence_ids"]
            for r in rules
            if not (
                lookup[id]["key"] == "inspection" and lookup[id]["verification_state"] != "verified"
            )
            and lookup[id]["key"] == r["key"]
            and lookup[id]["value"] == r["value"]
            and r["weights"][hypothesis]
        ]
        ranking.append(
            dict(
                hypothesis_id=hypothesis,
                label=label,
                score=sum(c["weight"] for c in contributions),
                confirmed=hypothesis == "fluid_path_restriction"
                and snapshot["id"] in ["corrective", "verification", "verified", "summary"],
                contributions=contributions,
                missing_evidence=["Product limits and authorized process checks"],
            )
        )
    snapshot["ranking"] = sorted(ranking, key=lambda c: -c["score"])
initial = next(s for s in data["snapshots"] if s["id"] == "diagnosis")
data["findings"] = [
    dict(
        agent="material_process_specialist"
        if c["hypothesis_id"] in ["material_condition", "alignment_fault"]
        else "fluid_path_specialist",
        hypothesis_id=c["hypothesis_id"],
        supporting_evidence_ids=[s["evidence_id"] for s in c["contributions"] if s["weight"] > 0],
        conflicting_evidence_ids=[s["evidence_id"] for s in c["contributions"] if s["weight"] < 0],
        missing_evidence=c["missing_evidence"],
        source_refs=[],
        confidence_band="low",
        summary=c["label"] + ": compare cited observations; compatibility is not proof.",
    )
    for c in initial["ranking"]
]
data["findings"].append(
    dict(
        agent="diagnostic_critic",
        hypothesis_id="fluid_path_restriction",
        supporting_evidence_ids=[],
        conflicting_evidence_ids=[],
        missing_evidence=["Product limits and authorized process checks"],
        source_refs=[],
        confidence_band="low",
        summary="A falling weight trend cannot identify a unique cause. Machine PASS and weight calibration do not establish spray quality.",
    )
)
(DEST / "golden-scenario.json").write_text(json.dumps(data, indent=2) + "\n")
reported = replace(
    json.loads((ROOT / "fixtures/v1/reported-investigation.json").read_text(encoding="utf-8"))
)
reported["schema_version"] = "2.0"
(DEST / "reported-investigation.json").write_text(json.dumps(reported, indent=2) + "\n")
