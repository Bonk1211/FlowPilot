"""A sourced graph projection; shared nodes are associations, never causal proof."""

import re

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
                + " "
                + item.process
                + " "
                + " ".join(c.label for c in case.ranking)
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
    documents, passages = add_references(session, graph, cases, q, process)
    return LibraryOverview(
        saved_cases=len(cases),
        reusable_experiences=len(published),
        pending_review=pending,
        processes=sorted({c.investigation.process for c in cases}),
        cases=visible,
        graph=graph,
        total_matching=len(items),
        truncated=len(items) > limit,
        reference_documents=documents,
        reference_passages=passages,
    )


def build_graph(rows):
    nodes, edges = {}, []

    def node(id, kind, label, detail, case_id, href=None):
        if id not in nodes:
            nodes[id] = KnowledgeNode(
                id=id,
                kind=kind,
                label=label,
                detail=detail,
                href=href,
                source_type="experience" if kind == "Case" else "shared",
            )
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


def add_references(session, graph, cases, query, process):
    from flowpilot.incidents.diagnostic import SourcePassage, is_s932
    from flowpilot.incidents.knowledge import (
        IncidentSourceDocument,
        SourceDocumentRecord,
        applicable_sources,
    )
    from flowpilot.incidents.rag import DOCUMENT_ID, INDEX_ID, RagIndexRecord

    latest = {}
    documents = [
        IncidentSourceDocument.model_validate(row.payload)
        for row in session.scalars(select(SourceDocumentRecord))
    ]
    for document in sorted(documents, key=lambda value: value.created_at):
        latest[document.content.document_id] = document.id
    index = session.get(RagIndexRecord, INDEX_ID)
    manifest = index.payload if index else {}
    sources = [
        SourcePassage.model_validate(value.model_dump(mode="json"))
        for value in applicable_sources(process, session=session)
        if value.source_id == latest[value.document_id]
        and (
            not process
            or value.applicable
            or (value.document_id == DOCUMENT_ID and is_s932(process))
        )
    ]
    totals = len({source.source_id for source in sources}), len(sources)
    sources.sort(
        key=lambda source: (
            source.document_id,
            tuple(int(part) for part in re.findall(r"\d+", source.section.split(" ", 1)[0])),
        )
    )
    if not process:
        for source in sources:
            source.limitation = source.limitation.replace(
                "Configuration does not exactly match this source revision.",
                "Choose a process to assess configuration applicability.",
            )
    groups = {}
    for source in sources:
        if (
            query.casefold()
            not in " ".join(
                (source.title, source.section, source.passage, source.document_id)
            ).casefold()
        ):
            continue
        groups.setdefault(source.source_id, []).append(source)
    concepts = [
        node for node in graph.nodes if node.kind in {"Component", "Symptom", "Possible cause"}
    ]
    case_processes = {case.investigation.id: case.investigation.process for case in cases}
    for source_id, passages in groups.items():
        source = passages[0]
        document_id = f"reference:{source_id}"
        graph.nodes.append(
            KnowledgeNode(
                id=document_id,
                kind="Reference document",
                label=source.title,
                detail=f"{source.revision} · {source.authority.replace('_', ' ')} · "
                f"{source.approval_status.replace('_', ' ')}",
                source_type="reference",
                sources=passages,
                indexed_passages=sum(
                    manifest.get("source_id") == source.source_id
                    and p.id.rsplit(":", 1)[-1] in manifest.get("documents", {})
                    for p in passages
                ),
            )
        )
        sections = {}
        for passage in passages:
            number = passage.section.split(" ", 1)[0].rstrip(".")
            # The importer retains subsections. Group their passages under major sections
            # to keep this map legible as the reference grows.
            section = number.split(".", 1)[0] if number[:1].isdigit() else passage.section
            sections.setdefault(section, []).append(passage)
        for section, excerpts in sections.items():
            node_id = f"{document_id}:{section}"
            first = excerpts[0]
            label = (
                first.section
                if first.section.split(" ", 1)[0].rstrip(".") == section
                else (f"{section} · {first.section.split(' ', 1)[-1]}")
            )
            node = KnowledgeNode(
                id=node_id,
                kind="Reference section",
                label=label,
                source_type="reference",
                detail=f"{len(excerpts)} passages · {source.approval_status.replace('_', ' ')}",
                sources=excerpts,
                indexed_passages=sum(
                    manifest.get("source_id") == source.source_id
                    and p.id.rsplit(":", 1)[-1] in manifest.get("documents", {})
                    for p in excerpts
                ),
            )
            graph.nodes.append(node)
            graph.edges.append(
                KnowledgeEdge(
                    id=f"{node_id}:contains",
                    source=document_id,
                    target=node_id,
                    relation="contains reference passages",
                    citation=first.id,
                    evidence_ids=[],
                    status=first.approval_status,
                    case_id="",
                    source_type="reference",
                )
            )
            for concept in concepts:
                compatible = any(
                    " ".join(case_processes.get(case_id, "").casefold().split())
                    in {" ".join(value.casefold().split()) for value in source.configurations}
                    or (
                        source.document_id == DOCUMENT_ID
                        and is_s932(case_processes.get(case_id, ""))
                    )
                    for case_id in concept.case_ids
                )
                pattern = topic_pattern(concept)
                if not compatible or pattern is None:
                    continue
                match = next(
                    (
                        (p, found)
                        for p in excerpts
                        if (found := re.search(pattern, p.passage, re.I))
                    ),
                    None,
                )
                if match is None:
                    continue
                passage, term = match
                node.case_ids = sorted(set(node.case_ids + concept.case_ids))
                graph.edges.append(
                    KnowledgeEdge(
                        id=f"{node_id}:topic:{concept.id}",
                        source=node_id,
                        target=concept.id,
                        relation="mentions topic",
                        citation=passage.id,
                        evidence_ids=[],
                        status="topic_match",
                        case_id="",
                        source_type="reference",
                        matched_text=term.group(),
                    )
                )
    return totals


def topic_pattern(node):
    # ponytail: inspectable text associations for the current S932 vocabulary;
    # replace with reviewed concept tags when importing more equipment families.
    label = node.label.casefold()
    if node.kind == "Component" and "nozzle" in label:
        return r"\bnozzles?\b"
    if node.kind == "Symptom" and "coverage" in label:
        return r"\b(?:incomplete|insufficient|poor|uneven|partial) coverage\b"
    if node.kind == "Possible cause":
        if "restriction" in label:
            return r"\b(?:restriction|restricted|obstruction)\b"
        if "bfs" in label:
            return r"\bBFS\b|\bfluid[- ]pressure\b"
        if "alignment" in label:
            return r"\balignment\b|\brecipe\b"
        if "material" in label:
            return r"\bmaterial condition\b|\bviscosity\b|\bidle\b|\bpurge\b"
    return None
