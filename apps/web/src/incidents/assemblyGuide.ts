import { experimentShots } from "../scene/experimentShots.ts";
import { partAnnotations, type GroupId } from "../scene/shots.ts";
import type { FluidPoint, PlaybackStep } from "./experimentPlayback";

const flowParts: GroupId[] = [
  "bfs_air",
  "bfs_bottle",
  "pickup_tube",
  "feed_tube",
  "fluid_qd",
  "dj2200_valve",
  "valve_air",
  "coaxial_air",
  "air_cap",
  "nozzle",
];

/** Neutral drawing levels for the reference guide; no simulation run or result. */
const illustration: FluidPoint = {
  position: 0,
  mass: 1,
  coverage: 1,
  supplyPressure: 1,
  feedFlow: 1,
  pathOpen: 1,
  flowResistance: 1,
  valveDuty: 1,
  sprayWidth: 1,
  channels: false,
};

/** An assembly walkthrough grounded in the S932 reference, independent of experiments. */
export function assemblyGuide(componentIds: readonly string[]): {
  steps: PlaybackStep[];
} {
  const selected = flowParts.filter((id) => componentIds.includes(id));
  const parts = selected.length ? selected : flowParts;
  // Only reference views are used; the mechanism and response shots are omitted.
  const shots = experimentShots("restriction", parts);
  const descriptions = [
    {
      id: "establish",
      title: "Explore the S932 assembly",
      narration:
        "Inspect the labeled BFS flux bottle, pickup tube, valve fluid QD, DJ2200 valve, air cap and nozzle. Rotate the exploded view to see how the parts relate, then choose Next step.",
    },
    {
      id: "follow",
      title: "Trace the flux path",
      narration:
        "Flux travels from the BFS bottle through the pickup tube and flux tubing, then through the valve fluid quick-disconnect (QD) into the DJ2200 valve. The teal path illustrates that connection.",
    },
    {
      id: "apart",
      title: "Inspect the selected parts",
      narration: `Locate ${parts.map((id) => partAnnotations[id].text).join(", ")}. Each label stays attached to its part as you rotate the model. Separation illustrates the assembly relationship; it is not a disassembly sequence.`,
    },
    {
      id: "valve",
      title: "Identify the air supplies",
      narration:
        "The air supplies have separate roles: BFS fluid pressure drives flux from the bottle, valve-actuation air operates the DJ2200 valve, and coaxial atomizing air reaches the air cap. Follow the amber valve-air and blue coaxial-air lines on the model.",
    },
    {
      id: "nozzle",
      title: "Inspect the air cap and nozzle",
      narration:
        "The nozzle forms the final flux outlet. The air cap directs coaxial atomizing air around it to form the spray above the substrate carrier. Inspect the separated cap and nozzle; Play step briefly illustrates the flow and then holds the view.",
    },
  ];
  return {
    steps: descriptions.map(({ id, title, narration }) => {
      const shot = shots.find((item) => item.id === id)!;
      return {
        id,
        title,
        narration,
        caution:
          "Reference illustration only. Geometry, separation and flow are illustrative; no model run or machine measurement is shown.",
        shot,
        fluid: [illustration],
        control: illustration,
        condition: "start",
        mechanism: "restriction",
        modelNode: shot.labels[0] ?? "dj2200_valve",
        highlightIds: shot.labels,
        partStates: {},
        position: null,
      };
    }),
  };
}
