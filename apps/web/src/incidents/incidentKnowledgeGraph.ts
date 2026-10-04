import type { Incident, KnowledgeGraph } from "@flowpilot/contracts";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\bs[-\s]?932\b/g, "s932")
    .replace(/\bdj[-\s]?2200\b/g, "dj2200")
    .replace(/\s+/g, " ")
    .trim();

function sameEquipment(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  return left === right || (/\bs932\b/.test(left) && /\bs932\b/.test(right));
}

// These are inspectable context matches, never evidence of a confirmed cause.
function libraryConnections(record: Incident, library: KnowledgeGraph) {
  const coverage =
    /\b(?:incomplete|insufficient|poor|uneven|partial) (?:flux )?coverage\b/i;
  return library.nodes.flatMap((node) => {
    const passage = node.sources?.find((source) =>
      source.configurations.some((configuration) =>
        sameEquipment(configuration, record.configuration),
      ),
    );
    if (node.kind === "Reference document" && passage)
      return [
        {
          node,
          relation: "equipment reference",
          citation: passage.id,
          match: passage.configurations.join(" / "),
        },
      ];
    if (node.kind !== "Symptom" && node.kind !== "Component") return [];
    const process = node.detail.split(" · ").at(-1) ?? "";
    if (!sameEquipment(process, record.configuration)) return [];
    if (
      node.kind === "Symptom" &&
      (normalize(node.label) === normalize(record.symptom) ||
        (coverage.test(node.label) && coverage.test(record.symptom)))
    )
      return [
        {
          node,
          relation: "related symptom topic",
          citation: `${record.id}@r${record.revision}`,
          match: node.label,
        },
      ];
    if (
      node.kind === "Component" &&
      /\bdj2200\b/.test(normalize(node.label)) &&
      /\bdj2200\b/.test(normalize(record.configuration))
    )
      return [
        {
          node,
          relation: "same component",
          citation: `${record.id}@r${record.revision}`,
          match: "DJ-2200",
        },
      ];
    return [];
  });
}

export function incidentKnowledgeGraph(
  records: Incident[],
  library: KnowledgeGraph,
): KnowledgeGraph {
  const nodes = new Map(library.nodes.map((node) => [node.id, node]));
  const edges = [...library.edges];
  for (const record of records) {
    const relatedLibrary = libraryConnections(record, library);
    const source = `incident:${record.id}`;
    const scope = `configuration:${record.configuration}`;
    const symptom = `symptom:${record.symptom.toLowerCase()}`;
    function node(id: string, kind: string, label: string, detail: string) {
      if (!nodes.has(id))
        nodes.set(id, {
          id,
          kind,
          label,
          detail,
          source_type: "experience",
          indexed_passages: 0,
          case_ids: [record.id],
        });
    }
    function connect(
      from: string,
      target: string,
      relation: string,
      evidenceIds: string[] = [],
      revision = record.revision,
    ) {
      edges.push({
        id: `${from}:${target}`,
        source: from,
        target,
        relation,
        case_id: record.id,
        citation: `${record.id}@r${revision}`,
        evidence_ids: evidenceIds,
        source_type: "experience",
        status: "recorded",
      });
    }
    node(
      source,
      "Case",
      record.symptom,
      `${record.id} · ${record.mode} · ${record.status}`,
    );
    node(
      scope,
      "Configuration",
      record.configuration,
      "Shared equipment configuration. Connections indicate context, not a confirmed cause.",
    );
    node(
      symptom,
      "Symptom",
      record.symptom,
      "Reported symptom shared by these investigations.",
    );
    connect(source, scope, "investigated configuration");
    connect(source, symptom, "reported symptom");
    function connectLibrary(from: string, revision = record.revision) {
      for (const link of relatedLibrary) {
        if (
          edges.some(
            (edge) => edge.source === from && edge.target === link.node.id,
          )
        )
          continue;
        edges.push({
          id: `${from}:${link.node.id}`,
          source: from,
          target: link.node.id,
          relation: link.relation,
          citation:
            link.node.kind === "Reference document"
              ? link.citation
              : `${record.id}@r${revision}`,
          evidence_ids: [],
          case_id: record.id,
          source_type: "experience",
          status: "topic_match",
          matched_text: link.match,
        });
      }
    }
    connectLibrary(scope);
    for (const finding of record.captured_knowledge ?? []) {
      const findingId = `knowledge:${record.id}:${finding.id}`;
      node(
        findingId,
        "Knowledge",
        finding.title,
        `${finding.summary}\nDemo finding · pending review · ${record.id}@r${finding.source_revision}`,
      );
      connect(
        source,
        findingId,
        "discovered in investigation",
        finding.evidence_ids,
        finding.source_revision,
      );
      connect(
        findingId,
        scope,
        "configuration context",
        finding.evidence_ids,
        finding.source_revision,
      );
      connect(
        findingId,
        symptom,
        "symptom context",
        finding.evidence_ids,
        finding.source_revision,
      );
      connectLibrary(findingId, finding.source_revision);
    }
    if (record.learning) {
      const id = `experience:${record.id}`;
      node(
        id,
        "Outcome",
        record.learning.summary,
        `${record.learning.status} · ${record.learning.outcome}`,
      );
      connect(
        source,
        id,
        `${record.learning.status} experience`,
        record.learning.evidence_ids,
        record.learning.source_revision,
      );
    }
  }
  return { nodes: [...nodes.values()], edges };
}
