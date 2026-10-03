import { useEffect, useState } from "react";

/** Playback and reduced-motion state shared by every timeline. */
export function useTimelinePlayback() {
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    query.addEventListener("change", update);
    document.addEventListener("visibilitychange", pause);
    return () => {
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", pause);
      setPlaying(false);
    };
  }, []);
  return { playing, setPlaying, reduced };
}
