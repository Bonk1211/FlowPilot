import { groupIds, type GroupId, type Shot } from "../scene/shots.ts";
import type { FluidPoint, PlaybackStep } from "./experimentPlayback";

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

type GuideView = {
  id: string;
  title: string;
  narration: string;
  position: Shot["position"][number];
  target: Shot["target"][number];
  labels: GroupId[];
  explode?: GroupId[];
  xray?: GroupId[];
  /** Additional context left opaque around the labeled components. */
  context?: GroupId[];
  fov?: number;
};

const views: GuideView[] = [
  {
    id: "establish",
    title: "Explore the S932 assembly",
    narration:
      "Explore the BFS supply, DJ2200 spray head and machine around them. Labels attach to individual parts. Rotate to inspect this separated view, then choose Next step for a closer look at each assembly.",
    position: [8.1, 5.6, 13.2],
    target: [-0.7, 0.6, 0.1],
    fov: 42,
    labels: [
      "bfs_bottle",
      "pickup_tube",
      "fluid_qd",
      "dj2200_valve",
      "air_cap",
      "nozzle",
    ],
    explode: [
      "bfs_bottle",
      "bfs_lid",
      "bfs_sensors",
      "pickup_tube",
      "feed_tube",
      "fluid_qd",
      "air_cap",
      "nozzle_nut",
      "nozzle",
    ],
    context: [
      "motion_gantry",
      "conveyor",
      "substrate_tray",
      "support_frame",
      "valve_heater",
      "bfs_lid",
      "bfs_sensors",
      "feed_tube",
      "valve_air",
      "coaxial_air",
      "nozzle_nut",
    ],
  },
  {
    id: "follow",
    title: "Trace the flux path",
    narration:
      "The BFS holder carries the flux bottle, level sensors and a sealed lid with three knobs. Flux travels up the pickup tube, through the lid fitting and tubing, and into the valve fluid quick-disconnect. The separated lid reveals the bottle opening and seal.",
    position: [-0.6, 4.3, 9.1],
    target: [-2.8, 1.5, 0.3],
    labels: [
      "bfs_bottle",
      "bfs_lid",
      "bfs_sensors",
      "pickup_tube",
      "feed_tube",
      "fluid_qd",
    ],
    explode: [
      "bfs_bottle",
      "bfs_lid",
      "bfs_sensors",
      "pickup_tube",
      "feed_tube",
      "fluid_qd",
    ],
    xray: ["bfs_bottle"],
    context: ["bfs_air"],
  },
  {
    id: "apart",
    title: "Look inside the DJ2200",
    narration:
      "The manufacturer’s parts list identifies a piston, compression spring, micrometer, needle and seat. This exploded illustration separates the needle assembly and heater from the machined valve body so their relationship is visible. Internal shapes and spacing are approximate.",
    position: [4.1, 3, 8.1],
    target: [0.1, 0.65, 0.6],
    fov: 36,
    labels: ["dj2200_valve", "needle_assembly", "valve_heater", "fluid_qd"],
    explode: ["fluid_qd", "needle_assembly", "valve_heater"],
    xray: ["dj2200_valve"],
    context: ["nozzle", "nozzle_nut", "air_cap"],
  },
  {
    id: "valve",
    title: "Identify the three air supplies",
    narration:
      "BFS pressure drives flux from the bottle. Valve-actuation air operates the DJ2200 piston. Coaxial air reaches the air cap and assists atomization. Their regulators, fittings and hoses are modeled separately; the colors identify each circuit.",
    position: [5.1, 4, 11.1],
    target: [-0.35, 1, 0.5],
    fov: 40,
    labels: ["bfs_air", "valve_air", "coaxial_air", "dj2200_valve"],
    explode: ["valve_air", "coaxial_air"],
    context: [
      "bfs_bottle",
      "bfs_lid",
      "feed_tube",
      "fluid_qd",
      "air_cap",
      "nozzle",
      "valve_heater",
    ],
  },
  {
    id: "nozzle",
    title: "Inspect the air cap and nozzle",
    narration:
      "The nozzle, retaining nut and gasket are separate from the surrounding coaxial air cap. The cap’s annular passage supplies atomizing air around the liquid outlet. Inspect these separated components above the carrier; this view is not a disassembly procedure.",
    position: [2.9, 0.6, 6.5],
    target: [0.15, -1.4, 1.3],
    fov: 34,
    labels: ["air_cap", "nozzle_nut", "nozzle", "valve_heater"],
    explode: ["coaxial_air", "air_cap", "nozzle_nut", "nozzle"],
    context: ["coaxial_air"],
  },
  {
    id: "motion",
    title: "Explore motion and transport",
    narration:
      "The X/Y guides position the head, while the Z carriage supports vertical movement. Encoder strips, drive pulleys and a cable chain are visible behind the head. Below, four conveyor rails carry belts and five pulleys each, with carrier sensors and stops alongside.",
    position: [7.5, 5.3, 12.2],
    target: [0, 0.25, -0.5],
    fov: 42,
    labels: ["motion_gantry", "conveyor", "carrier_sensors", "substrate_tray"],
    explode: ["motion_gantry", "carrier_sensors", "substrate_tray"],
    context: [
      "support_frame",
      "dj2200_valve",
      "valve_heater",
      "nozzle",
      "air_cap",
    ],
  },
  {
    id: "vision",
    title: "Inspect vision and calibration",
    narration:
      "The head camera and laser height sensor inspect the work area. A separate upward-facing lookup camera uses reticle glass at the service station. The adjacent scale provides the inline weigh station. Their exact positions depend on the installed machine configuration.",
    position: [6, 3.3, 8.1],
    target: [1.9, -0.65, 0.05],
    fov: 36,
    labels: [
      "vision_camera",
      "laser_height_sensor",
      "lookup_camera",
      "weigh_station",
    ],
    explode: [
      "vision_camera",
      "laser_height_sensor",
      "lookup_camera",
      "weigh_station",
    ],
    context: ["dj2200_valve", "valve_heater", "nozzle", "air_cap"],
  },
  {
    id: "service",
    title: "Follow the purge and waste system",
    narration:
      "The service station includes the purge cup, lid and seals. Waste tubing runs through the venturi system to a refuse bottle, whose float and full sensor monitor collected fluid. The view separates the station and bottle to expose the connections.",
    position: [7.5, 2.4, 8],
    target: [3, -1.1, 1.4],
    fov: 36,
    labels: ["purge_station", "waste_bottle", "weigh_station"],
    explode: ["purge_station", "waste_bottle"],
    xray: ["waste_bottle"],
    context: ["lookup_camera"],
  },
  {
    id: "assembled",
    title: "Return to the assembled machine",
    narration:
      "The parts return to their assembled positions. The partial enclosure keeps the working area visible, with the interlocks and emergency stop shown for orientation. Revisit any step or rotate the model to explore the details at your own pace.",
    position: [8.1, 5.6, 13.2],
    target: [0, 0.35, -0.2],
    fov: 42,
    labels: [
      "machine_enclosure",
      "motion_gantry",
      "bfs_bottle",
      "dj2200_valve",
      "conveyor",
      "purge_station",
    ],
    context: [...groupIds],
  },
];

/** Reference walkthrough, independent of incident results or a simulation run. */
export function assemblyGuide(): {
  steps: PlaybackStep[];
} {
  return {
    steps: views.map((view) => {
      const visible = new Set([
        ...view.labels,
        ...(view.context ?? []),
        ...(view.explode ?? []),
      ]);
      const shot: Shot = {
        id: view.id,
        name: view.title,
        durationMs: 2200,
        position: [view.position],
        target: [view.target],
        fov: [view.fov ?? 38, view.fov ?? 38],
        labels: view.labels,
        explode: view.explode ?? [],
        xray: view.xray ?? [],
        ghost: groupIds.filter((id) => !visible.has(id)),
        marker: null,
        deposit: "hidden",
      };
      return {
        id: view.id,
        title: view.title,
        narration: view.narration,
        caution:
          "Document-informed illustration. Dimensions, arrangement and separation are approximate, not a service procedure or measured machine data.",
        shot,
        fluid: [illustration],
        control: illustration,
        condition: "start",
        mechanism: "restriction",
        modelNode: view.labels[0],
        highlightIds: view.labels,
        partStates: {},
        position: null,
      };
    }),
  };
}
