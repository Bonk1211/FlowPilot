import { groupIds, type GroupId, type Shot, type Vec3 } from "./shots.ts";

export type Mechanism =
  "restriction" | "unstable_delivery" | "material_condition";

/** The order the liquid meets each part, used to take parts apart in sequence. */
const flowOrder: GroupId[] = [
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

const isGroup = (id: string): id is GroupId =>
  (groupIds as readonly string[]).includes(id);

type Close = Pick<
  Shot,
  "name" | "position" | "target" | "fov" | "xray" | "labels" | "marker"
>;

/** Where each mechanism is shown up close, with the tested condition flowing. */
const closeUps: Record<Mechanism, Close> = {
  restriction: {
    name: "At an example narrowing",
    position: [
      [1.45, 2.35, 3.1],
      [1.0, 2.05, 2.65],
    ],
    target: [
      [-0.5, 1.55, 0],
      [-0.45, 1.48, 0],
    ],
    fov: [30, 26],
    xray: ["fluid_qd", "dj2200_valve"],
    labels: ["fluid_qd", "feed_tube"],
    marker: "narrowing",
  },
  unstable_delivery: {
    name: "At the reservoir",
    position: [
      [-0.35, 2.55, 3.45],
      [-0.85, 2.2, 3.0],
    ],
    target: [
      [-2.6, 1.3, 0.2],
      [-2.55, 1.2, 0.2],
    ],
    fov: [29, 25],
    xray: ["bfs_bottle", "bfs_air"],
    labels: ["bfs_air", "bfs_bottle", "pickup_tube"],
    marker: null,
  },
  material_condition: {
    name: "At the material",
    position: [
      [-0.3, 1.45, 3.85],
      [-0.8, 1.75, 3.3],
    ],
    target: [
      [-2.0, 1.0, 0.1],
      [-1.85, 1.25, 0.1],
    ],
    fov: [29, 26],
    xray: ["bfs_bottle"],
    labels: ["bfs_bottle", "feed_tube"],
    marker: null,
  },
};

const base = {
  explode: [] as GroupId[],
  ghost: [] as GroupId[],
  xray: [] as GroupId[],
  labels: [] as GroupId[],
  marker: null,
  deposit: "hidden",
} satisfies Partial<Shot>;
const quiet: GroupId[] = ["support_frame", "vision_camera"];

/**
 * The eight shots of one experiment: establish, follow the liquid, take apart
 * the parts that matter to this explanation, look where it would act, the
 * valve, the nozzle, the substrate, then reassemble.
 */
export function experimentShots(
  mechanism: Mechanism,
  componentIds: readonly string[],
): Shot[] {
  const focus = flowOrder.filter((id) => componentIds.includes(id));
  // Take apart the explanation's parts; the air cap moves too so the nozzle shows.
  const apart = [
    ...focus,
    ...(focus.includes("nozzle") && !focus.includes("air_cap")
      ? (["air_cap"] as GroupId[])
      : []),
  ].filter((id) => id !== "dj2200_valve");
  const keep = new Set<GroupId>([...apart, "dj2200_valve"]);
  const close = closeUps[mechanism];
  const along = (points: number[][]) => points as unknown as Vec3[];
  return [
    {
      ...base,
      id: "establish",
      name: "Establishing wide",
      durationMs: 7000,
      position: along([
        [8.8, 3.4, 7.6],
        [7.6, 3.9, 9.0],
        [6.0, 4.3, 10.2],
      ]),
      target: along([
        [-0.3, 0, 0],
        [-0.35, -0.05, 0],
        [-0.4, -0.1, 0],
      ]),
      fov: [38, 32],
    },
    {
      ...base,
      id: "follow",
      name: "Following the liquid",
      durationMs: 9000,
      position: along([
        [-0.3, 1.9, 5.4],
        [-0.2, 3.3, 4.6],
        [0.9, 2.5, 3.8],
        [2.3, 1.7, 4.1],
      ]),
      target: along([
        [-2.0, 0.9, 0.1],
        [-1.5, 1.85, 0.1],
        [-0.45, 1.3, 0],
        [0, 0.5, 0],
      ]),
      fov: [34, 30],
      ghost: quiet,
      xray: ["bfs_bottle", "fluid_qd", "dj2200_valve"],
      labels: ["bfs_bottle", "feed_tube", "fluid_qd", "dj2200_valve"],
    },
    {
      ...base,
      id: "apart",
      name: "Taking it apart",
      durationMs: 8000,
      position: along([
        [6.8, 3.8, 10.2],
        [6.0, 3.5, 10.9],
      ]),
      target: along([
        [-0.7, 0.75, 0.2],
        [-0.75, 0.6, 0.2],
      ]),
      fov: [35, 34],
      explode: apart,
      ghost: groupIds.filter((id) => !keep.has(id) && isGroup(id)),
      xray: focus.includes("bfs_bottle") ? ["bfs_bottle"] : [],
      labels: apart,
    },
    {
      ...base,
      ...close,
      id: "mechanism",
      durationMs: 7500,
      // Fade what is not this explanation's, so the close-up reads at once.
      ghost: [
        ...quiet,
        ...(
          ["bfs_bottle", "bfs_air", "valve_air", "coaxial_air"] as const
        ).filter((id) => !focus.includes(id)),
      ],
    },
    {
      ...base,
      id: "valve",
      name: "Inside the valve",
      durationMs: 7000,
      position: along([
        [2.7, 1.9, 3.7],
        [2.15, 1.45, 3.25],
      ]),
      target: along([
        [0.15, 0.95, 0],
        [0.1, 0.7, 0],
      ]),
      fov: [30, 27],
      ghost: [
        ...quiet,
        "bfs_bottle",
        "pickup_tube",
        "bfs_air",
        "substrate_tray",
      ],
      xray: ["dj2200_valve", "fluid_qd", "valve_air", "coaxial_air"],
      labels: ["dj2200_valve", "valve_air", "coaxial_air"],
    },
    {
      ...base,
      id: "nozzle",
      name: "Nozzle macro",
      durationMs: 7000,
      position: along([
        [1.0, -1.3, 1.7],
        [0.72, -1.5, 1.3],
      ]),
      target: along([
        [0, -1.7, 0],
        [0, -1.84, 0],
      ]),
      fov: [24, 21],
      ghost: quiet,
      xray: ["air_cap"],
      labels: ["air_cap", "nozzle"],
    },
    {
      ...base,
      id: "substrate",
      name: "Over the substrate",
      durationMs: 9000,
      position: along([
        [0.95, 0.25, 3.5],
        [0.5, 0.55, 3.0],
      ]),
      target: along([
        [0, -1.97, 0.25],
        [0, -1.98, 0.2],
      ]),
      fov: [34, 30],
      ghost: quiet,
      labels: ["substrate_tray"],
      deposit: "build",
    },
    {
      ...base,
      id: "readout",
      name: "Reassembled",
      durationMs: 7000,
      position: along([
        [6.6, 4.0, 9.0],
        [7.4, 4.6, 9.4],
      ]),
      target: along([
        [0, -0.2, 0],
        [0, -0.15, 0],
      ]),
      fov: [34, 36],
      deposit: "full",
    },
  ];
}
