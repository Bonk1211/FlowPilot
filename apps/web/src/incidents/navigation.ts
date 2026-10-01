import { useCallback, useEffect, useState, type MouseEvent } from "react";

export const incidentPages = {
  investigation: {
    label: "Investigation",
    description: "Compare explanations and choose the next useful check.",
  },
  evidence: {
    label: "Evidence",
    description:
      "Inspect images, original records and the source event timeline.",
  },
  simulation: {
    label: "Simulation",
    description: "Explore a hypothetical mechanism and its synthetic response.",
  },
  experiments: {
    label: "Experiments",
    description:
      "Review and authorize a fixed comparison of synthetic model conditions.",
  },
  handoff: {
    label: "Handoff",
    description:
      "Prepare the engineering handoff and inspect communication status.",
  },
  knowledge: {
    label: "Knowledge",
    description:
      "Review source documents and previously reviewed incident experience.",
  },
  review: {
    label: "Review",
    description:
      "Record the outcome, review reusable learning and inspect the audit history.",
  },
} as const;
export type IncidentPage = keyof typeof incidentPages;
export const pageNames = Object.keys(incidentPages) as IncidentPage[];

export type IncidentRoute = {
  incidentId: string | null;
  page: IncidentPage | null;
  invalid: boolean;
  visited: IncidentPage[];
};

function readRoute(): Omit<IncidentRoute, "visited"> {
  const path = window.location.pathname.replace(/\/$/, "");
  if (!path || path === "/incidents")
    return { incidentId: null, page: null, invalid: false };
  const match = path.match(/^\/incidents\/([^/]+)(?:\/(.*))?$/);
  if (!match) return { incidentId: null, page: null, invalid: true };
  let incidentId: string;
  try {
    incidentId = decodeURIComponent(match[1]);
  } catch {
    return { incidentId: null, page: null, invalid: true };
  }
  const page = match[2] ?? "investigation";
  return {
    incidentId,
    page: Object.hasOwn(incidentPages, page) ? (page as IncidentPage) : null,
    invalid: !Object.hasOwn(incidentPages, page),
  };
}

export function incidentPageUrl(id: string, page?: IncidentPage) {
  return `/incidents/${encodeURIComponent(id)}${page ? `/${page}` : ""}`;
}

export function useIncidentRoute() {
  const [route, setRoute] = useState<IncidentRoute>(() => {
    const initial = readRoute();
    return { ...initial, visited: initial.page ? [initial.page] : [] };
  });
  const readLocation = useCallback(() => {
    const next = readRoute();
    setRoute((current) => ({
      ...next,
      visited: [
        ...new Set([
          ...(current.incidentId === next.incidentId ? current.visited : []),
          ...(next.page ? [next.page] : []),
        ]),
      ],
    }));
  }, []);
  useEffect(() => {
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, [readLocation]);
  const navigate = useCallback(
    (path: string) => {
      if (window.location.pathname !== path)
        window.history.pushState(null, "", path);
      readLocation();
    },
    [readLocation],
  );
  function followLink(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.currentTarget.target === "_blank"
    )
      return;
    event.preventDefault();
    navigate(event.currentTarget.pathname);
  }
  return { route, navigate, followLink };
}
