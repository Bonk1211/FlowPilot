import type { ProcedureStep } from "@flowpilot/contracts";

export type ModelNodeId = ProcedureStep["model_node_id"];
const activeNodes = {
  bfs_bottle: {
    label: "BFS bottle",
    x: 35,
    y: 25,
    width: 130,
    height: 65,
  },
  feed_tube: { label: "Feed tube", x: 195, y: 40, width: 125, height: 38 },
  dj2200_valve: {
    label: "DJ-2200 valve",
    x: 195,
    y: 180,
    width: 125,
    height: 60,
  },
  fluid_qd: {
    label: "Fluid QD",
    x: 195,
    y: 105,
    width: 125,
    height: 40,
  },
  pickup_tube: { label: "Pickup tube", x: 35, y: 110, width: 130, height: 38 },
  air_cap: { label: "Air cap", x: 340, y: 285, width: 100, height: 38 },
  coaxial_air: { label: "Coaxial air", x: 365, y: 80, width: 140, height: 38 },
  valve_air: { label: "Valve air", x: 365, y: 130, width: 140, height: 38 },
  bfs_air: { label: "BFS pressure", x: 35, y: 180, width: 130, height: 38 },
  nozzle: { label: "Nozzle", x: 215, y: 290, width: 85, height: 38 },
  vision_camera: {
    label: "Vision camera",
    x: 370,
    y: 190,
    width: 130,
    height: 60,
  },
  substrate_tray: {
    label: "Substrate tray",
    x: 100,
    y: 365,
    width: 315,
    height: 45,
  },
} satisfies Record<
  Exclude<
    ModelNodeId,
    "fluid_reservoir" | "jet_actuator" | "service_cartridge"
  >,
  { label: string; x: number; y: number; width: number; height: number }
>;

export const modelNodes = {
  ...activeNodes,
  fluid_reservoir: activeNodes.bfs_bottle,
  jet_actuator: activeNodes.dj2200_valve,
  service_cartridge: activeNodes.fluid_qd,
};
export const activeModelNodes = activeNodes;
// Illustrative 3D coordinates are illustrative model units: Y up, camera looking toward target.
export const cameraPresets = {
  assembly_overview: { position: [6, 4, 8], target: [0, 0, 0] },
  valve_closeup: { position: [2, 1, 3], target: [0, -0.5, 0] },
  nozzle_closeup: { position: [1.5, 0, 2], target: [0, -1, 0] },
} satisfies Record<string, { position: number[]; target: number[] }>;
