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
  coreLabels?: Shot["coreLabels"];
  spotlight?: GroupId[];
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
      "Start with the completed machine. Follow the labels from the BFS supply to the DJ2200 spray head, then peel back each assembly to see what is inside.",
    position: [8.1, 5.6, 13.2],
    target: [-0.7, 0.6, 0.1],
    fov: 42,
    labels: ["bfs_bottle", "dj2200_valve", "conveyor", "machine_enclosure"],
    context: [...groupIds],
  },
  {
    id: "reveal",
    title: "Reveal the dispensing assembly",
    narration:
      "The enclosure moves back to expose the working assembly. The highlighted BFS bottle supplies the spray head; the carrier sits below the nozzle.",
    position: [6.5, 4.1, 11.3],
    target: [-0.8, 0.35, 0.1],
    fov: 40,
    labels: ["bfs_bottle", "dj2200_valve", "substrate_tray"],
    spotlight: ["bfs_bottle", "dj2200_valve"],
    explode: ["machine_enclosure"],
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
      "The lid lifts first, then the pickup tube and fittings separate. Follow the labeled path from the flux bottle to the valve quick-disconnect.",
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
      "machine_enclosure",
      "bfs_lid",
      "bfs_bottle",
      "bfs_sensors",
      "pickup_tube",
      "feed_tube",
      "fluid_qd",
    ],
    xray: ["bfs_bottle"],
    spotlight: ["bfs_bottle"],
    context: ["bfs_air"],
  },
  {
    id: "head",
    title: "Move in to the spray head",
    narration:
      "The camera follows the fluid connection to the assembled DJ2200. Locate the valve body, heater and air cap before opening the head.",
    position: [3.4, 2.4, 7.8],
    target: [0, 0.35, 0.2],
    fov: 35,
    labels: ["dj2200_valve", "fluid_qd", "valve_heater", "air_cap"],
    spotlight: ["dj2200_valve"],
    explode: ["machine_enclosure"],
    context: [
      "needle_assembly",
      "nozzle",
      "nozzle_nut",
      "valve_air",
      "coaxial_air",
    ],
  },
  {
    id: "apart",
    title: "Look inside the DJ2200",
    narration:
      "The fluid fitting and heater move aside, then the needle assembly lifts out of the valve body. Watch each part separate before moving into the core.",
    position: [4.1, 3, 8.1],
    target: [0.1, 0.65, 0.6],
    fov: 36,
    labels: ["dj2200_valve", "needle_assembly", "valve_heater", "fluid_qd"],
    explode: [
      "machine_enclosure",
      "fluid_qd",
      "valve_heater",
      "needle_assembly",
    ],
    spotlight: ["needle_assembly"],
    xray: ["dj2200_valve"],
    context: ["nozzle", "nozzle_nut", "air_cap"],
  },
  {
    id: "core",
    title: "Inside the needle assembly",
    narration:
      "Follow the labels down the exposed core: return spring, air piston, metering needle and seat. These parts control the liquid outlet inside the valve.",
    position: [3.3, 2.35, 7.5],
    target: [1.35, 1.15, 1.15],
    fov: 35,
    labels: [],
    coreLabels: ["spring", "piston", "needle", "seat"],
    spotlight: ["needle_assembly"],
    explode: [
      "machine_enclosure",
      "fluid_qd",
      "valve_heater",
      "needle_assembly",
    ],
    xray: ["dj2200_valve"],
  },
  {
    id: "valve",
    title: "Identify the three air supplies",
    narration:
      "Reservoir air drives flux, valve air actuates the piston, and coaxial air atomizes the spray. Colors identify the three circuits.",
    position: [5.1, 4, 11.1],
    target: [-0.35, 1, 0.5],
    fov: 40,
    labels: ["bfs_air", "valve_air", "coaxial_air", "dj2200_valve"],
    spotlight: ["valve_air"],
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
      "Inspect the nozzle, nut, gasket and air cap. The cap supplies atomizing air around the liquid outlet.",
    position: [2.9, 0.6, 6.5],
    target: [0.15, -1.4, 1.3],
    fov: 34,
    labels: ["air_cap", "nozzle_nut", "nozzle", "valve_heater"],
    spotlight: ["nozzle"],
    explode: ["coaxial_air", "air_cap", "nozzle_nut", "nozzle"],
    context: ["coaxial_air"],
  },
  {
    id: "motion",
    title: "Explore motion and transport",
    narration:
      "X/Y guides and the Z carriage position the head. Below, conveyor belts move carriers past sensors and stops.",
    position: [7.5, 5.3, 12.2],
    target: [0, 0.25, -0.5],
    fov: 42,
    labels: ["motion_gantry", "conveyor", "carrier_sensors", "substrate_tray"],
    spotlight: ["motion_gantry"],
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
      "Inspect the head camera, height sensor, upward-facing lookup camera and weigh station. Placement varies with machine configuration.",
    position: [6, 3.3, 8.1],
    target: [1.9, -0.65, 0.05],
    fov: 36,
    labels: [
      "vision_camera",
      "laser_height_sensor",
      "lookup_camera",
      "weigh_station",
    ],
    spotlight: ["vision_camera"],
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
      "Purge waste flows through the venturi to the refuse bottle. Its float and full sensor monitor collected fluid.",
    position: [7.5, 2.4, 8],
    target: [3, -1.1, 1.4],
    fov: 36,
    labels: ["purge_station", "waste_bottle", "weigh_station"],
    spotlight: ["purge_station"],
    explode: ["purge_station", "waste_bottle"],
    xray: ["waste_bottle"],
    context: ["lookup_camera"],
  },
  {
    id: "assembled",
    title: "Return to the assembled machine",
    narration:
      "Parts return to their assembled positions. Rotate to inspect the enclosure, interlocks and emergency stop, or revisit any step.",
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
        ...(view.spotlight ?? []),
      ]);
      const shot: Shot = {
        id: view.id,
        name: view.title,
        durationMs: 3200,
        position: [view.position],
        target: [view.target],
        fov: [view.fov ?? 38, view.fov ?? 38],
        labels: view.labels,
        coreLabels: view.coreLabels,
        spotlight: view.spotlight,
        separationStart: 0.22,
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
        modelNode: view.spotlight?.[0] ?? view.labels[0],
        highlightIds: view.spotlight ?? view.labels,
        partStates: {},
        position: null,
      };
    }),
  };
}
