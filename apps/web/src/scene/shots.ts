/**
 * Camera direction for the dispenser model, as plain data and pure maths so it
 * can be tested without a renderer. Coordinates are the model's illustrative
 * units (Y up), taken from scripts/build-dispenser-model.mjs.
 */
export type Vec3 = readonly [number, number, number];

/** Context around the fluid path, faded for close inspection of the valve. */
export const machineGroupIds = [
  "motion_gantry",
  "conveyor",
  "carrier_sensors",
  "laser_height_sensor",
  "lookup_camera",
  "weigh_station",
  "purge_station",
  "waste_bottle",
  "machine_enclosure",
] as const;

export const groupIds = [
  "bfs_bottle",
  "pickup_tube",
  "bfs_air",
  "feed_tube",
  "fluid_qd",
  "dj2200_valve",
  "valve_air",
  "coaxial_air",
  "air_cap",
  "nozzle",
  "vision_camera",
  "substrate_tray",
  "support_frame",
  "spray_visualization",
  "bfs_lid",
  "bfs_sensors",
  "needle_assembly",
  "valve_heater",
  "nozzle_nut",
  ...machineGroupIds,
] as const;
export type GroupId = (typeof groupIds)[number];

export type ReadingTarget = {
  part: GroupId;
  text: string;
  mesh: string;
  point: Vec3;
};

/** Source map: docs/S932_3D_Model_Sources.md. Anchors are mesh-local points. */
export const partAnnotations: Record<
  GroupId,
  { text: string; mesh: string; point: Vec3 }
> = {
  bfs_bottle: {
    text: "BFS flux bottle",
    mesh: "pressure-vessel",
    point: [0, 0, 0.68],
  },
  pickup_tube: {
    text: "BFS pickup tube",
    mesh: "internal-pickup",
    point: [0, 0, 0],
  },
  bfs_air: {
    text: "BFS fluid-pressure supply",
    mesh: "pressure-regulator",
    point: [0, 0, 0.14],
  },
  feed_tube: {
    text: "Flux tubing",
    mesh: "clear-feed-hose",
    point: [-1.8, 2.18, 0.1],
  },
  fluid_qd: {
    text: "Valve fluid QD",
    mesh: "quick-disconnect-collar",
    point: [0, 0, 0.21],
  },
  dj2200_valve: {
    text: "DJ2200 valve",
    mesh: "valve-housing",
    point: [0, 0, 0.45],
  },
  valve_air: {
    text: "Valve-actuation air",
    mesh: "actuation-air-line",
    point: [1.65, 1.62, 0.55],
  },
  coaxial_air: {
    text: "Coaxial atomizing air",
    mesh: "coaxial-air-line",
    point: [0.9, 0.35, 0.52],
  },
  air_cap: { text: "Air cap", mesh: "air-cap-body", point: [0, 0, 0.36] },
  nozzle: { text: "Nozzle", mesh: "nozzle-tip", point: [0, 0, 0.08] },
  vision_camera: {
    text: "Vision camera",
    mesh: "camera-body",
    point: [0, 0, 0.59],
  },
  substrate_tray: {
    text: "Substrate carrier",
    mesh: "carrier-deck",
    point: [1.9, 0.04, 0.85],
  },
  support_frame: {
    text: "Support frame",
    mesh: "base-plate",
    point: [2.9, 0.08, 1.5],
  },
  spray_visualization: {
    text: "Illustrative spray",
    mesh: "spray-cone",
    point: [0, 0, 0],
  },
  bfs_lid: { text: "BFS lid · three knobs", mesh: "bfs-lid", point: [0, 0, 0] },
  bfs_sensors: {
    text: "BFS level sensors",
    mesh: "level-sensor",
    point: [0, 0, 0],
  },
  needle_assembly: {
    text: "Needle, piston & spring",
    mesh: "needle-shaft",
    point: [0, 0, 0],
  },
  valve_heater: {
    text: "Valve heater",
    mesh: "heater-cover",
    point: [0, 0, 0.475],
  },
  nozzle_nut: {
    text: "Nozzle nut & gasket",
    mesh: "nozzle-nut",
    point: [0, 0, 0],
  },
  motion_gantry: {
    text: "XYZ motion stages",
    mesh: "x-carriage",
    point: [0, 0, 0],
  },
  conveyor: {
    text: "Conveyor rails & belts",
    mesh: "conveyor-rail",
    point: [0, 0, 0],
  },
  carrier_sensors: {
    text: "Carrier sensors & stops",
    mesh: "carrier-sensor",
    point: [0, 0, 0],
  },
  laser_height_sensor: {
    text: "Laser height sensor",
    mesh: "lhs-body",
    point: [0, 0, 0],
  },
  lookup_camera: {
    text: "Lookup camera & reticle",
    mesh: "lookup-camera-body",
    point: [0, 0, 0],
  },
  weigh_station: {
    text: "Inline weigh station",
    mesh: "scale-pan",
    point: [0, 0, 0],
  },
  purge_station: {
    text: "Purge cup & venturi",
    mesh: "purge-cup",
    point: [0, 0, 0],
  },
  waste_bottle: {
    text: "Refuse bottle & float",
    mesh: "refuse-bottle",
    point: [0, 0, 0],
  },
  machine_enclosure: {
    text: "Enclosure & interlocks",
    mesh: "rear-panel",
    point: [0, 0, 0],
  },
};

/** Individual meshes exposed when the needle assembly is lifted out. */
export const coreAnnotations = {
  piston: { text: "Air piston", mesh: "air-piston", point: [0, 0, 0.21] },
  spring: {
    text: "Return spring",
    mesh: "return-spring",
    point: [0.17, 1.595, 0],
  },
  needle: {
    text: "Metering needle",
    mesh: "needle-shaft",
    point: [0, 0, 0.07],
  },
  seat: { text: "Needle seat", mesh: "needle-seat", point: [0, 0, 0.19] },
} as const satisfies Record<
  string,
  { text: string; mesh: string; point: Vec3 }
>;
export type CoreId = keyof typeof coreAnnotations;

/**
 * Where each part moves when the machine is taken apart, at full separation.
 * The valve is the anchor; the liquid path parts move up and out along the
 * way the liquid travels, the outlet parts move down.
 */
export const explodeOffsets: Record<GroupId, Vec3> = {
  bfs_bottle: [-1.1, 0, 0],
  pickup_tube: [-1.1, 1.55, 0.5],
  bfs_air: [-1.6, 0.35, 0],
  feed_tube: [-0.5, 0.85, 0.35],
  fluid_qd: [-0.55, 0.35, 0.95],
  dj2200_valve: [0, 0, 0],
  valve_air: [0.65, 0.35, 0],
  coaxial_air: [0.75, -0.1, 0.35],
  // The outlet parts come forward, clear of the substrate below them.
  air_cap: [0, -0.15, 1.05],
  nozzle: [0, -0.3, 1.9],
  vision_camera: [0.9, 0, 0],
  substrate_tray: [0, -0.35, 0],
  support_frame: [0, 0, 0],
  spray_visualization: [0, -0.3, 1.9],
  bfs_lid: [-1.1, 1.25, 0],
  bfs_sensors: [-1.6, 0, 0.55],
  needle_assembly: [1.35, 0.65, 1.15],
  valve_heater: [-1.2, -0.2, 0.85],
  nozzle_nut: [0.8, -0.15, 1.1],
  motion_gantry: [0, 0.5, -0.5],
  conveyor: [0, -0.12, 0],
  carrier_sensors: [-0.35, 0.35, 0.5],
  laser_height_sensor: [0.4, 0.1, 0.65],
  lookup_camera: [0.55, 0.45, 0],
  weigh_station: [0.3, 0.35, 0.4],
  purge_station: [0.15, 0.5, 0.5],
  waste_bottle: [0.85, 0, 0.5],
  machine_enclosure: [0, 0.8, -2.4],
};

export type Shot = {
  id: string;
  /** Short name of the camera move, for the step list. */
  name: string;
  durationMs: number;
  /** Keyframes the camera passes through; the target is what it looks at. */
  position: Vec3[];
  target: Vec3[];
  fov: readonly [number, number];
  /** Parts separated in this shot, in the order they move apart. */
  explode: GroupId[];
  /** Parts drawn faint so the subject stands out. */
  ghost: GroupId[];
  /** Parts whose shells turn see-through so the flow inside shows. */
  xray: GroupId[];
  /** Parts named on screen with a leader line. */
  labels: GroupId[];
  /** Mesh-level names for the exposed valve internals. */
  coreLabels?: CoreId[];
  /** A fine outline identifies the subject of a reference-guide shot. */
  spotlight?: GroupId[];
  /** Let the camera approach before beginning the separation. */
  separationStart?: number;
  /** A marked, hypothetical location where the mechanism could act. */
  marker: "narrowing" | null;
  /** How the deposit on the substrate is shown. */
  deposit: "hidden" | "build" | "full";
};

export type CameraFrame = {
  position: Vec3;
  target: Vec3;
  fov: number;
};

/** Keep the same horizontal subject space when the viewer becomes portrait. */
export function fitCameraFov(fov: number, aspect: number, availableHeight = 1) {
  const scale = Math.max(
    1,
    0.9 / Math.max(0.1, aspect),
    1 / Math.max(0.1, availableHeight),
  );
  return (Math.atan(Math.tan((fov * Math.PI) / 360) * scale) * 360) / Math.PI;
}

const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));

/** Zero slope at both ends, so a move starts and settles without a jolt. */
export function smootherstep(t: number) {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** A point on a Catmull-Rom spline through `points`, t from 0 to 1. */
export function catmullRom(points: readonly Vec3[], t: number): Vec3 {
  if (points.length === 1) return points[0];
  const span = clamp(t) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(span));
  const local = span - index;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const l2 = local * local;
  const l3 = l2 * local;
  return [0, 1, 2].map(
    (axis) =>
      0.5 *
      (2 * p1[axis] +
        (-p0[axis] + p2[axis]) * local +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * l2 +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * l3),
  ) as unknown as Vec3;
}

/**
 * Where the camera is `elapsedMs` into a shot. The camera leaves from wherever
 * it was (`from`), so cutting between shots never jumps; under reduced motion
 * the shot is a clean cut to its final frame.
 */
export function sampleCamera(
  shot: Shot,
  elapsedMs: number,
  from: CameraFrame | null,
  reduced: boolean,
): CameraFrame & { progress: number } {
  const progress = reduced ? 1 : clamp(elapsedMs / shot.durationMs);
  const eased = smootherstep(progress);
  const positions = from ? [from.position, ...shot.position] : shot.position;
  const targets = from ? [from.target, ...shot.target] : shot.target;
  const startFov = from?.fov ?? shot.fov[0];
  // Settle on the first keyframe's framing early, then drift to the last.
  const fov =
    eased < 0.35
      ? lerp(startFov, shot.fov[0], eased / 0.35)
      : lerp(shot.fov[0], shot.fov[1], (eased - 0.35) / 0.65);
  return {
    position: catmullRom(positions, eased),
    target: catmullRom(targets, eased),
    fov,
    progress,
  };
}

/**
 * Move from each part's current separation: newly selected parts leave in
 * order, while parts no longer selected return together.
 */
export function explodeAmounts(
  shot: Shot,
  progress: number,
  from: Partial<Record<GroupId, number>> = {},
): Partial<Record<GroupId, number>> {
  const delay = shot.separationStart ?? 0;
  progress = clamp((progress - delay) / (1 - delay));
  const count = shot.explode.length;
  return Object.fromEntries([
    ...Object.entries(from).map(([id, amount]) => [
      id,
      settle(amount, 0, progress),
    ]),
    ...shot.explode.map((id, order) => {
      const start = count > 1 ? (order / count) * 0.45 : 0;
      return [
        id,
        lerp(from[id] ?? 0, 1, smootherstep((progress - start) / 0.4)),
      ];
    }),
  ]);
}

/** Ease a value from where it was toward where the shot wants it. */
export function settle(from: number, to: number, progress: number) {
  return lerp(from, to, smootherstep(progress / 0.4));
}
