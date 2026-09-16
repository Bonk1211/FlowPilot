import type { ProcedureStep } from "@flowpilot/contracts";

export type ModelNodeId = ProcedureStep["model_node_id"];
export const modelNodes = {
  fluid_reservoir: {
    label: "Fluid reservoir",
    x: 35,
    y: 25,
    width: 130,
    height: 65,
  },
  feed_tube: { label: "Feed tube", x: 195, y: 40, width: 125, height: 38 },
  jet_actuator: {
    label: "Jet actuator",
    x: 195,
    y: 120,
    width: 125,
    height: 60,
  },
  service_cartridge: {
    label: "Service cartridge",
    x: 185,
    y: 210,
    width: 145,
    height: 50,
  },
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
  ModelNodeId,
  { label: string; x: number; y: number; width: number; height: number }
>;

// Future 3D coordinates are illustrative model units: Y up, camera looking toward target.
export const cameraPresets = {
  assembly_overview: { position: [6, 4, 8], target: [0, 0, 0] },
  cartridge_closeup: { position: [2, 1, 3], target: [0, -0.5, 0] },
  nozzle_closeup: { position: [1.5, 0, 2], target: [0, -1, 0] },
} satisfies Record<string, { position: number[]; target: number[] }>;
