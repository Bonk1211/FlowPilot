import { groupIds, machineGroupIds, type GroupId, type Shot } from "./shots.ts";

export type Mechanism =
  "restriction" | "unstable_delivery" | "material_condition";

/** The order the liquid meets each part, used to separate the illustrative model. */
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

type Close = Pick<
  Shot,
  "name" | "position" | "target" | "fov" | "xray" | "labels" | "marker"
>;

/** These views look at the separated parts, including their exploded offsets. */
const closeUps: Record<Mechanism, Close> = {
  restriction: {
    name: "Flux tubing and valve fluid QD",
    position: [[2.6, 3.5, 6.2]],
    target: [[-1.15, 1.95, 0.6]],
    fov: [38, 38],
    xray: ["fluid_qd", "dj2200_valve"],
    labels: ["fluid_qd", "feed_tube"],
    marker: "narrowing",
  },
  unstable_delivery: {
    name: "BFS supply and pickup tube",
    position: [[-0.6, 4.4, 7.9]],
    target: [[-3.8, 1.4, 0.4]],
    fov: [38, 38],
    xray: ["bfs_bottle", "bfs_air"],
    labels: ["bfs_air", "bfs_bottle", "pickup_tube"],
    marker: null,
  },
  material_condition: {
    name: "Flux bottle and tubing",
    position: [[1.3, 4.2, 8]],
    target: [[-2.8, 1.7, 0.3]],
    fov: [38, 38],
    xray: ["bfs_bottle"],
    labels: ["bfs_bottle", "feed_tube"],
    marker: null,
  },
};

const base = {
  durationMs: 1800,
  explode: [] as GroupId[],
  ghost: [] as GroupId[],
  xray: [] as GroupId[],
  labels: [] as GroupId[],
  marker: null,
  deposit: "hidden",
} satisfies Partial<Shot>;
const quiet: GroupId[] = ["support_frame", "vision_camera", ...machineGroupIds];

/** Eight inspectable steps. Each brief transition settles and waits for Next. */
export function experimentShots(
  mechanism: Mechanism,
  componentIds: readonly string[],
): Shot[] {
  const focus = flowOrder.filter((id) => componentIds.includes(id));
  const apart = [
    ...focus,
    ...(focus.includes("nozzle") && !focus.includes("air_cap")
      ? (["air_cap"] as GroupId[])
      : []),
  ].filter((id) => id !== "dj2200_valve");
  const keep = new Set<GroupId>([...apart, "dj2200_valve"]);
  const close = closeUps[mechanism];
  const shots: Shot[] = [
    {
      ...base,
      id: "establish",
      name: "Exploded assembly",
      position: [[7.4, 4.8, 12.5]],
      target: [[-1, 0.55, 0.5]],
      fov: [40, 40],
      explode: flowOrder.filter((id) => id !== "dj2200_valve"),
      ghost: quiet,
      labels: [
        "bfs_bottle",
        "pickup_tube",
        "fluid_qd",
        "dj2200_valve",
        "air_cap",
        "nozzle",
      ],
    },
    {
      ...base,
      id: "follow",
      name: "Exploded liquid path",
      position: [[3.4, 4.3, 11.3]],
      target: [[-1.9, 1.5, 0.4]],
      fov: [38, 38],
      explode: ["bfs_bottle", "pickup_tube", "feed_tube", "fluid_qd"],
      ghost: quiet,
      xray: ["bfs_bottle", "fluid_qd", "dj2200_valve"],
      labels: ["bfs_bottle", "pickup_tube", "feed_tube", "fluid_qd"],
    },
    {
      ...base,
      id: "apart",
      name: "Parts in this explanation",
      position: [[6.0, 4.4, 12]],
      target: [[-1.2, 0.8, 0.5]],
      fov: [38, 38],
      explode: apart,
      ghost: groupIds.filter((id) => !keep.has(id)),
      xray: focus.includes("bfs_bottle") ? ["bfs_bottle"] : [],
      labels: [...apart, "dj2200_valve"],
    },
    {
      ...base,
      ...close,
      id: "mechanism",
      explode: apart,
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
      name: "Valve and separate air supplies",
      position: [[5.3, 3.7, 8.4]],
      target: [[0.6, 0.6, 0.6]],
      fov: [39, 39],
      explode: ["fluid_qd", "valve_air", "coaxial_air", "air_cap", "nozzle"],
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
      name: "Separated air cap and nozzle",
      position: [[2.4, 0.3, 5.6]],
      target: [[0, -1.55, 1.5]],
      fov: [32, 32],
      explode: ["coaxial_air", "air_cap", "nozzle"],
      ghost: [...quiet, "substrate_tray"],
      labels: ["air_cap", "nozzle"],
    },
    {
      ...base,
      id: "substrate",
      name: "Deposit on the substrate carrier",
      durationMs: 2400,
      position: [[2.6, 2.2, 6.5]],
      target: [[0.4, -1.97, 0.25]],
      fov: [40, 40],
      ghost: quiet,
      labels: ["substrate_tray", "nozzle"],
      deposit: "build",
    },
    {
      ...base,
      id: "readout",
      name: "Reassembled result",
      position: [[7.4, 4.6, 9.4]],
      target: [[0, -0.15, 0]],
      fov: [36, 36],
      ghost: quiet,
      labels: ["substrate_tray"],
      deposit: "full",
    },
  ];
  // Keep the new lid and sensors with the separated BFS assembly. Outlet
  // fasteners also separate whenever the nozzle is inspected.
  return shots.map((shot) => {
    const explode: GroupId[] = [
      ...shot.explode,
      ...(shot.explode.includes("bfs_bottle")
        ? (["bfs_lid", "bfs_sensors"] as const)
        : []),
      ...(shot.explode.includes("nozzle") ? (["nozzle_nut"] as const) : []),
    ];
    const ghost: GroupId[] = [
      ...shot.ghost,
      ...(shot.ghost.includes("bfs_bottle")
        ? (["bfs_lid", "bfs_sensors"] as const)
        : []),
    ];
    return {
      ...shot,
      explode,
      ghost: ghost.filter((id) => !explode.includes(id)),
    };
  });
}
