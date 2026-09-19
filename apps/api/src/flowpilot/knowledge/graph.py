"""A sourced graph projection; shared nodes are associations, never causal proof."""

from sqlalchemy import select

from flowpilot.knowledge.models import (
    KnowledgeEdge,
    KnowledgeEntry,
    KnowledgeGraph,
    KnowledgeNode,
    LearningCase,
    LibraryOverview,
)
from flowpilot.knowledge.service import SYMPTOMS, conditions, source_signature
from flowpilot.knowledge.storage import KnowledgeRecord


def overview(session, q="", status="all", process="", symptom="", limit=40):
    from flowpilot.cases import Case, CaseRecord

    cases = [Case.model_validate(r.payload) for r in session.scalars(select(CaseRecord))]
    entries = {
        r.source_case_id: KnowledgeEntry.model_validate(r.payload)
        for r in session.scalars(select(KnowledgeRecord))
    }
    items = []
    groups = {}
    published = set()
    pending = 0
    for case in sorted(cases, key=lambda c: c.timeline[-1].timestamp, reverse=True):
        entry = entries.get(case.investigation.id)
        features = conditions(case)
        active_symptoms = [key for key in SYMPTOMS if features[key] == "true"]
        state = entry.status if entry else "recorded"
        version = entry.versions[-1] if entry else None
        if version and version.source.signature != source_signature(case) and state != "archived":
            state = "disputed"
        if state == "published":
            published.add(
                version.source.fingerprint if version.source.simulated else case.investigation.id
            )
        pending += state == "draft"
        item = LearningCase(
            id=case.investigation.id,
            title=case.investigation.title,
            process=case.investigation.process,
            state=case.investigation.state,
            updated_at=case.timeline[-1].timestamp,
            symptoms=active_symptoms,
            knowledge_id=entry.id if entry else None,
            knowledge_status=state,
            version=version.version if version else None,
            simulated=case.investigation.simulated,
            group_case_ids=[case.investigation.id],
        )
        if (
            q.casefold()
            not in (
                item.title
                + " "
                + item.id
                + " "
                + " ".join(active_symptoms)
                + " "
                + (version.content.lesson if version else "")
            ).casefold()
            or (status != "all" and state != status)
            or (process and process != item.process)
            or (symptom and symptom not in active_symptoms)
        ):
            continue
        # Group only reviewed-equivalent simulated experience. All records remain addressable.
        group = (item.id,)
        # Evidence IDs differ across repeated runs; compare reviewer interpretation instead.
        if version and item.simulated:
            group = (
                version.source.fingerprint,
                state,
                version.content.finding,
                version.content.outcome,
                version.content.check_focus,
                version.content.lesson,
            )
        if group in groups:
            groups[group].group_size += 1
            groups[group].group_case_ids.append(item.id)
        else:
            groups[group] = item
            items.append(item)
    visible = items[:limit]
    graph = build_graph(
        [
            (next(c for c in cases if c.investigation.id == i.id), entries.get(i.id), i)
            for i in visible
        ]
    )
    return LibraryOverview(
        saved_cases=len(cases),
        reusable_experiences=len(published),
        pending_review=pending,
        processes=sorted({c.investigation.process for c in cases}),
        cases=visible,
        graph=graph,
        total_matching=len(items),
        truncated=len(items) > limit,
    )


def build_graph(rows):
    nodes, edges = {}, []

    def node(id, kind, label, detail, case_id, href=None):
        if id not in nodes:
            nodes[id] = KnowledgeNode(id=id, kind=kind, label=label, detail=detail, href=href)
        if case_id not in nodes[id].case_ids:
            nodes[id].case_ids.append(case_id)

    for case, entry, item in rows:
        case_id = case.investigation.id
        version = entry.versions[-1] if entry else None
        citation = f"{entry.id}@v{version.version}" if entry else f"{case_id}@r{case.revision}"
        evidence = version.source.evidence if version else case.investigation.evidence
        case_node = f"case:{case_id}"
        node(
            case_node,
            "Case",
            item.title[:70],
            f"{item.knowledge_status} · {case_id}"
            + (f" · {item.group_size} equivalent records" if item.group_size > 1 else ""),
            case_id,
            f"/?case={case_id}",
        )

        def connect(kind, key, label, relation, evidence_keys, edge_state=None):
            target = f"{kind}:{case.investigation.process}:{key}"
            node(target, kind, label, relation + " · " + case.investigation.process, case_id)
            edges.append(
                KnowledgeEdge(
                    id=f"{case_id}:{kind}:{key}",
                    source=case_node,
                    target=target,
                    relation=relation,
                    citation=citation,
                    evidence_ids=[
                        e.id
                        for e in evidence
                        if e.key in evidence_keys and e.verification_state != "rejected"
                    ],
                    status=edge_state or item.knowledge_status,
                    case_id=case_id,
                )
            )

        for key in item.symptoms:
            connect("Symptom", key, key.replace("_", " ").capitalize(), "reported symptom", [key])
        if case.scenario_version == "2.0":
            connect(
                "Component",
                "nozzle",
                "DJ-2200 nozzle",
                "investigation scope",
                ["inspection", *SYMPTOMS],
            )

        prior = next(
            (s.ranking for s in case.diagnostic_history if s.trigger == "diagnose"), case.ranking
        )
        for cause in prior[:3]:
            if cause.score > 0:
                ids = {c.evidence_id for c in cause.contributions}
                connect(
                    "Possible cause",
                    cause.hypothesis_id,
                    cause.label,
                    "hypothesis, not confirmed",
                    [e.key for e in evidence if e.id in ids],
                    "hypothesis",
                )
        if version:
            content = version.content
            connect(
                "Finding",
                content.finding,
                content.finding.replace("_", " ").capitalize(),
                "reviewed inspection finding"
                if item.knowledge_status == "published"
                else "inspection interpretation · review status applies",
                ["inspection"],
            )
            if version.source.action:
                connect(
                    "Action",
                    version.source.action,
                    version.source.action.replace("_", " ").capitalize(),
                    "recorded action",
                    ["corrective_action"],
                )
            connect(
                "Outcome",
                content.outcome,
                content.outcome.replace("_", " ").capitalize(),
                "recorded outcome",
                ["inspection", "verification_passed", "recovery_checks"],
            )
    return KnowledgeGraph(nodes=list(nodes.values()), edges=edges)
