import { Cube, Eye, TreeStructure } from "@phosphor-icons/react";

const kinds = {
  observed: { label: "Observed", Icon: Eye },
  inferred: { label: "Inferred", Icon: TreeStructure },
  simulated: { label: "Simulated", Icon: Cube },
} as const;

/**
 * How a displayed state is known: Observed (recorded), Inferred (reasoned from
 * evidence) or Simulated (illustrative). The icon and words carry the meaning;
 * colour only reinforces it.
 */
export function StatusChip({
  kind,
  detail,
}: {
  kind: keyof typeof kinds;
  detail?: string;
}) {
  const { label, Icon } = kinds[kind];
  return (
    <span className="incident-tag incident-status" data-status={kind}>
      <Icon aria-hidden="true" />
      {detail ? `${label} · ${detail}` : label}
    </span>
  );
}
