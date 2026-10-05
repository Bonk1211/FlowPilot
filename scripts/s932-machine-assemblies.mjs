/**
 * Illustrative S-932 working assemblies, in the viewer's arbitrary scene units.
 * Component identities come from Asymtek_S932_Consolidated_Reference.md §§2,
 * 4, 8 and 9. That secondary reference supplies no CAD or installation drawings;
 * shapes, spacing, fasteners and cable routes below are visual approximations.
 */
export function addMachineAssemblies({
  THREE,
  part,
  box,
  cylinder,
  torus,
  tube,
  fastener,
  metal,
  darkMetal,
  steel,
  polymer,
  brass,
  glass,
  lens,
  caution,
}) {
  const quarter = Math.PI / 2;
  const housing = new THREE.MeshStandardMaterial({
    name: "machine-painted-housing",
    color: 0xbac8cf,
    metalness: 0.25,
    roughness: 0.46,
  });
  const belt = new THREE.MeshStandardMaterial({
    name: "conveyor-esd-belt",
    color: 0x344c43,
    metalness: 0.04,
    roughness: 0.8,
  });
  const indicator = new THREE.MeshStandardMaterial({
    name: "sensor-indicator",
    color: 0x5ba980,
    emissive: 0x174b2e,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const emergency = new THREE.MeshStandardMaterial({
    name: "emergency-stop-red",
    color: 0xb93530,
    roughness: 0.5,
  });

  // §§8.3, 8.6 A3/A5/A6/A12 and 9: guides, encoders, Z head and spring.
  const gantry = part("motion_gantry");
  // Keep the complete motion carriage behind the exposed valve in front views.
  gantry.scale.z = -1;
  box(
    gantry,
    [1.55, 0.58, 0.54],
    [0, 2.85, 1.2],
    metal,
    undefined,
    "x-carriage",
  );
  for (const x of [-3.35, 3.35]) {
    box(
      gantry,
      [0.24, 5.08, 0.28],
      [x, 0.2, 1.35],
      darkMetal,
      undefined,
      "gantry-column",
    );
    box(
      gantry,
      [0.66, 0.14, 0.76],
      [x, -2.25, 1.35],
      steel,
      undefined,
      "column-foot",
    );
    box(
      gantry,
      [0.35, 0.24, 3.05],
      [x, 2.77, 0],
      metal,
      undefined,
      "y-guide-beam",
    );
    box(
      gantry,
      [0.085, 0.085, 2.8],
      [x, 2.94, 0],
      steel,
      undefined,
      "y-linear-guide",
    );
    box(
      gantry,
      [0.14, 0.032, 2.76],
      [x + 0.12, 2.92, 0],
      polymer,
      undefined,
      "y-encoder-strip",
    );
    box(
      gantry,
      [0.44, 0.18, 0.55],
      [x, 3.01, 1.05],
      darkMetal,
      undefined,
      "y-bearing-block",
    );
  }
  box(
    gantry,
    [6.9, 0.36, 0.46],
    [0, 2.82, 1.4],
    darkMetal,
    undefined,
    "x-axis-crossbeam",
  );
  for (const y of [2.67, 2.99]) {
    box(
      gantry,
      [6.55, 0.072, 0.1],
      [0, y, 1.12],
      steel,
      undefined,
      "x-linear-guide",
    );
  }
  box(
    gantry,
    [6.3, 0.037, 0.042],
    [0, 3.1, 1.14],
    polymer,
    undefined,
    "x-encoder-strip",
  );
  box(
    gantry,
    [0.19, 0.12, 0.12],
    [0.46, 3.08, 1.08],
    darkMetal,
    undefined,
    "x-encoder-reader",
  );
  box(
    gantry,
    [0.54, 0.48, 0.52],
    [3.53, 2.79, 1.36],
    darkMetal,
    undefined,
    "x-drive-motor",
  );
  for (const x of [-3.12, 3.12]) {
    cylinder(
      gantry,
      [0.17, 0.17],
      0.12,
      [x, 2.8, 1.04],
      steel,
      [quarter, 0, 0],
      "x-drive-pulley",
      32,
    );
  }
  for (const y of [2.64, 2.96]) {
    box(
      gantry,
      [6.22, 0.034, 0.055],
      [0, y, 0.99],
      polymer,
      undefined,
      "x-drive-belt",
    );
  }
  box(
    gantry,
    [0.75, 2.75, 0.19],
    [0, 1.29, 0.78],
    darkMetal,
    undefined,
    "z-slide-backplate",
  );
  for (const x of [-0.25, 0.25]) {
    box(
      gantry,
      [0.072, 2.46, 0.09],
      [x, 1.29, 0.64],
      steel,
      undefined,
      "z-linear-guide",
    );
    box(
      gantry,
      [0.2, 0.38, 0.21],
      [x, 0.66, 0.56],
      metal,
      undefined,
      "z-bearing-block",
    );
  }
  box(
    gantry,
    [0.85, 0.56, 0.16],
    [0, 0.64, 0.48],
    metal,
    undefined,
    "valve-mounting-bulkhead",
  );
  box(
    gantry,
    [0.31, 0.47, 0.3],
    [0.48, 2.29, 0.79],
    darkMetal,
    undefined,
    "z-axis-motor",
  );
  cylinder(
    gantry,
    [0.055, 0.055],
    2.25,
    [0.48, 1.14, 0.75],
    steel,
    undefined,
    "z-axis-drive-shaft",
    24,
  );
  const spring = Array.from({ length: 121 }, (_, index) => {
    const angle = (index / 120) * Math.PI * 20;
    return [
      -0.48 + Math.cos(angle) * 0.09,
      1.16 + index * 0.009,
      0.79 + Math.sin(angle) * 0.09,
    ];
  });
  tube(gantry, spring, 0.016, steel, "z-counterbalance-spring");
  for (let index = 0; index < 12; index += 1) {
    box(
      gantry,
      [0.18, 0.15, 0.3],
      [-2.7 + index * 0.22, 3.2, 1.4],
      polymer,
      undefined,
      "cable-chain-link",
    );
  }
  tube(
    gantry,
    [
      [-0.2, 3.2, 1.4],
      [0.12, 3.24, 1.48],
      [0.62, 2.69, 1.36],
      [0.64, 1.2, 0.94],
    ],
    0.055,
    polymer,
    "head-cable-loom",
  );
  for (const x of [-0.61, 0.61]) fastener(gantry, [x, 2.85, 0.92]);

  // §8.5 and §8.6 A9 explicitly describe four rails, five pulleys per rail.
  const conveyor = part("conveyor");
  for (const z of [0.94, -0.94, -1.18, -2.36]) {
    box(
      conveyor,
      [4.8, 0.22, 0.14],
      [0, -2.08, z],
      metal,
      undefined,
      "conveyor-rail",
    );
    box(
      conveyor,
      [4.64, 0.052, 0.15],
      [0, -1.97, z],
      belt,
      undefined,
      "conveyor-belt-upper",
    );
    box(
      conveyor,
      [4.64, 0.038, 0.13],
      [0, -2.23, z],
      belt,
      undefined,
      "conveyor-belt-return",
    );
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) {
      cylinder(
        conveyor,
        [0.12, 0.12],
        0.19,
        [x, -2.1, z],
        darkMetal,
        [quarter, 0, 0],
        "conveyor-pulley",
        24,
      );
      cylinder(
        conveyor,
        [0.042, 0.042],
        0.205,
        [x, -2.1, z],
        steel,
        [quarter, 0, 0],
        "pulley-hub",
        16,
      );
    }
  }
  for (const x of [-2.16, 2.16]) {
    box(
      conveyor,
      [0.17, 0.12, 3.54],
      [x, -2.32, -0.71],
      darkMetal,
      undefined,
      "conveyor-crossmember",
    );
  }

  // §§8.2, 8.6 A15/A16 and 12.2: carrier sensors, stops and clamping lifters.
  const sensors = part("carrier_sensors");
  for (const [x, z] of [
    [-2.2, 1.03],
    [2.2, 1.03],
    [-2.2, -2.44],
    [2.2, -2.44],
  ]) {
    box(
      sensors,
      [0.25, 0.19, 0.14],
      [x, -1.83, z],
      darkMetal,
      undefined,
      "carrier-sensor",
    );
    box(
      sensors,
      [0.045, 0.06, 0.014],
      [x + 0.06, -1.79, z + 0.08],
      indicator,
      undefined,
      "carrier-sensor-indicator",
    );
    cylinder(
      sensors,
      [0.043, 0.043],
      0.02,
      [x, -1.83, z - Math.sign(z) * 0.08],
      lens,
      [quarter, 0, 0],
      "carrier-sensor-optic",
      16,
    );
    box(
      sensors,
      [0.3, 0.27, 0.045],
      [x, -2.04, z + Math.sign(z) * 0.06],
      steel,
      undefined,
      "sensor-bracket",
    );
  }
  for (const z of [0, -1.77]) {
    box(
      sensors,
      [0.34, 0.24, 0.23],
      [1.95, -2.15, z],
      darkMetal,
      undefined,
      "pneumatic-stop-block",
    );
    cylinder(
      sensors,
      [0.043, 0.043],
      0.28,
      [1.95, -1.95, z],
      steel,
      undefined,
      "carrier-stop-pin",
      20,
    );
    for (const x of [-0.8, 0.8]) {
      box(
        sensors,
        [0.42, 0.14, 0.22],
        [x, -2.15, z],
        metal,
        undefined,
        "carrier-clamping-block",
      );
      cylinder(
        sensors,
        [0.06, 0.06],
        0.15,
        [x, -2.3, z],
        steel,
        undefined,
        "carrier-lifter",
        20,
      );
    }
  }

  // §§2.2, 8.6 A22, 9: separate LHS with a downward-facing protected optic.
  const lhs = part("laser_height_sensor");
  box(
    lhs,
    [0.34, 0.63, 0.38],
    [1, -0.3, 0.1],
    darkMetal,
    undefined,
    "lhs-body",
  );
  box(lhs, [0.46, 0.12, 0.48], [1, 0.06, 0.1], metal, undefined, "lhs-mount");
  box(
    lhs,
    [0.48, 0.14, 0.48],
    [1, -0.64, 0.1],
    steel,
    undefined,
    "lhs-protective-cover",
  );
  cylinder(
    lhs,
    [0.1, 0.1],
    0.025,
    [1, -0.723, 0.1],
    lens,
    undefined,
    "lhs-optical-window",
    32,
  );
  box(
    lhs,
    [0.19, 0.16, 0.014],
    [1, -0.29, 0.299],
    caution,
    undefined,
    "lhs-laser-warning-plate",
  );
  tube(
    lhs,
    [
      [1.09, 0.1, 0.2],
      [1.22, 0.67, 0.36],
      [0.67, 1.19, 0.83],
    ],
    0.035,
    polymer,
    "lhs-signal-cable",
  );

  // §§8.6 A18/A20/A24: upward lookup lens/cover and reticle glass.
  const lookup = part("lookup_camera");
  box(
    lookup,
    [0.65, 0.45, 0.65],
    [2.8, -1.8, -1],
    darkMetal,
    undefined,
    "lookup-camera-body",
  );
  box(
    lookup,
    [0.76, 0.075, 0.76],
    [2.8, -2.08, -1],
    metal,
    undefined,
    "lookup-camera-base",
  );
  cylinder(
    lookup,
    [0.205, 0.205],
    0.22,
    [2.8, -1.48, -1],
    darkMetal,
    undefined,
    "lookup-lens-barrel",
    40,
  );
  cylinder(
    lookup,
    [0.17, 0.17],
    0.025,
    [2.8, -1.355, -1],
    lens,
    undefined,
    "lookup-lens",
    40,
  );
  box(
    lookup,
    [0.53, 0.035, 0.53],
    [2.8, -1.29, -1],
    glass,
    undefined,
    "reticle-glass",
  );
  for (const [size, point] of [
    [
      [0.34, 0.004, 0.007],
      [2.8, -1.27, -1],
    ],
    [
      [0.007, 0.004, 0.34],
      [2.8, -1.27, -1],
    ],
  ])
    box(lookup, size, point, darkMetal, undefined, "reticle-crosshair");
  box(
    lookup,
    [0.52, 0.04, 0.5],
    [3.25, -1.45, -1],
    metal,
    [0, 0, -0.6],
    "lookup-camera-cover",
  );
  tube(
    lookup,
    [
      [3.13, -1.8, -1.1],
      [3.38, -2.03, -1.31],
      [3.39, -2.21, -1.6],
    ],
    0.038,
    polymer,
    "lookup-camera-cable",
  );

  // §§2.2, 8.2, 8.6 A18/A19: scale and tactile sensor on service deck.
  const scale = part("weigh_station");
  cylinder(
    scale,
    [0.28, 0.28],
    0.05,
    [2.6, -1.6, 0.1],
    steel,
    undefined,
    "scale-pan",
    48,
  );
  box(
    scale,
    [0.73, 0.3, 0.67],
    [2.6, -1.83, 0.1],
    housing,
    undefined,
    "scale-body",
  );
  cylinder(
    scale,
    [0.08, 0.08],
    0.11,
    [2.6, -1.69, 0.1],
    steel,
    undefined,
    "scale-pan-support",
    24,
  );
  box(
    scale,
    [0.22, 0.06, 0.022],
    [2.6, -1.83, 0.449],
    lens,
    undefined,
    "scale-readout",
  );
  box(
    scale,
    [0.19, 0.17, 0.19],
    [3.16, -1.79, 0.1],
    darkMetal,
    undefined,
    "tactile-sensor-base",
  );
  cylinder(
    scale,
    [0.046, 0.046],
    0.13,
    [3.16, -1.65, 0.1],
    steel,
    undefined,
    "tactile-sensor-probe",
    20,
  );
  box(
    scale,
    [1.38, 0.09, 0.9],
    [2.87, -2.08, 0.1],
    metal,
    undefined,
    "service-station-deck",
  );
  for (const [x, z] of [
    [2.35, -0.23],
    [3.33, -0.23],
    [2.87, 0.39],
  ]) {
    cylinder(
      scale,
      [0.065, 0.065],
      0.16,
      [x, -2.18, z],
      steel,
      undefined,
      "station-leveling-screw",
      24,
    );
  }

  // §4.3 and §8.6 A26: heated cup, seal, refuse hose and vacuum venturi.
  const purge = part("purge_station");
  cylinder(
    purge,
    [0.275, 0.24],
    0.34,
    [2.6, -1.6, 1.2],
    metal,
    undefined,
    "purge-cup",
    48,
  );
  cylinder(
    purge,
    [0.225, 0.225],
    0.018,
    [2.6, -1.421, 1.2],
    polymer,
    undefined,
    "purge-cup-opening",
    40,
  );
  torus(
    purge,
    0.25,
    0.031,
    [2.6, -1.4, 1.2],
    steel,
    [quarter, 0, 0],
    "purge-cup-lid-rim",
  );
  torus(
    purge,
    0.27,
    0.018,
    [2.6, -1.45, 1.2],
    polymer,
    [quarter, 0, 0],
    "purge-cup-o-ring",
  );
  cylinder(
    purge,
    [0.285, 0.285],
    0.11,
    [2.6, -1.72, 1.2],
    brass,
    undefined,
    "purge-heater-band",
    40,
  );
  box(
    purge,
    [0.63, 0.09, 0.65],
    [2.6, -1.85, 1.2],
    darkMetal,
    undefined,
    "purge-station-base",
  );
  box(
    purge,
    [0.14, 0.12, 0.028],
    [2.6, -1.72, 1.494],
    caution,
    undefined,
    "purge-hot-surface-plate",
  );
  for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    cylinder(
      purge,
      [0.038, 0.038],
      0.1,
      [2.6 + Math.cos(angle) * 0.3, -1.96, 1.2 + Math.sin(angle) * 0.3],
      steel,
      undefined,
      "purge-mounting-screw",
      16,
    );
  }
  cylinder(
    purge,
    [0.09, 0.09],
    0.49,
    [2.9, -2.08, 1.2],
    brass,
    [0, 0, quarter],
    "vacuum-venturi",
    32,
  );
  cylinder(
    purge,
    [0.12, 0.12],
    0.06,
    [3.03, -2.08, 1.2],
    darkMetal,
    [0, 0, quarter],
    "venturi-locking-ring",
    24,
  );
  tube(
    purge,
    [
      [2.6, -1.82, 1.2],
      [2.58, -2.1, 1.2],
      [2.66, -2.1, 1.2],
    ],
    0.043,
    polymer,
    "purge-drain-hose",
  );
  tube(
    purge,
    [
      [2.44, -1.73, 1.22],
      [2.28, -1.88, 1.3],
      [2.28, -2.19, 1.52],
    ],
    0.026,
    polymer,
    "purge-heater-cable",
  );

  const waste = part("waste_bottle");
  cylinder(
    waste,
    [0.34, 0.34],
    1.1,
    [3.25, -1.3, 1.8],
    glass,
    undefined,
    "refuse-bottle",
    48,
  );
  cylinder(
    waste,
    [0.36, 0.36],
    0.13,
    [3.25, -0.69, 1.8],
    darkMetal,
    undefined,
    "refuse-bottle-lid",
    40,
  );
  cylinder(
    waste,
    [0.047, 0.047],
    0.75,
    [3.34, -1.14, 1.8],
    steel,
    undefined,
    "refuse-float-stem",
    20,
  );
  cylinder(
    waste,
    [0.105, 0.105],
    0.12,
    [3.34, -1.08, 1.8],
    polymer,
    undefined,
    "refuse-level-float",
    24,
  );
  box(
    waste,
    [0.22, 0.14, 0.2],
    [3.37, -0.56, 1.8],
    darkMetal,
    undefined,
    "refuse-full-sensor",
  );
  cylinder(
    waste,
    [0.075, 0.075],
    0.17,
    [3.1, -0.61, 1.8],
    brass,
    undefined,
    "refuse-inlet-fitting",
    24,
  );
  box(
    waste,
    [0.79, 0.1, 0.79],
    [3.25, -1.91, 1.8],
    metal,
    undefined,
    "refuse-bottle-holder",
  );
  tube(
    waste,
    [
      [3.16, -2.08, 1.2],
      [3.52, -2.02, 1.38],
      [3.65, -0.6, 1.68],
      [3.1, -0.51, 1.8],
    ],
    0.045,
    polymer,
    "refuse-transfer-hose",
  );
  tube(
    waste,
    [
      [3.46, -0.55, 1.8],
      [3.69, -0.5, 1.78],
      [3.73, -1.9, 1.72],
    ],
    0.025,
    polymer,
    "refuse-sensor-cable",
  );

  // §§2.2, 8.6 A27/A30, 12.2: partial cutaway, hood strut/interlock and EMO.
  // The open front is intentional so the teaching model exposes its assemblies.
  const enclosure = part("machine_enclosure");
  box(
    enclosure,
    [7.5, 0.46, 0.09],
    [0, 0.3, -2.65],
    housing,
    undefined,
    "rear-panel",
  );
  box(
    enclosure,
    [7.5, 0.75, 0.09],
    [0, -1.92, -2.65],
    housing,
    undefined,
    "lower-rear-panel",
  );
  for (const x of [-3.85, 3.85]) {
    box(
      enclosure,
      [0.15, 5.12, 0.15],
      [x, 0.28, -2.62],
      housing,
      undefined,
      "enclosure-rear-post",
    );
    box(
      enclosure,
      [0.12, 0.18, 4.3],
      [x, 2.82, -0.525],
      housing,
      undefined,
      "hood-side-frame",
    );
    box(
      enclosure,
      [0.095, 0.81, 4.35],
      [x, -1.99, -0.485],
      housing,
      undefined,
      "lower-side-panel",
    );
    box(
      enclosure,
      [0.12, 0.52, 0.13],
      [x, 2.48, 1.6],
      darkMetal,
      undefined,
      "hood-hinge-mount",
    );
  }
  box(
    enclosure,
    [7.8, 0.18, 0.18],
    [0, 2.82, -2.63],
    housing,
    undefined,
    "hood-rear-frame",
  );
  // A visible strut suggests the access hood without placing opaque doors ahead
  // of the labelled parts; its working geometry is not a service instruction.
  tube(
    enclosure,
    [
      [-3.84, 1.55, 1.58],
      [-3.84, 2.01, 1.37],
    ],
    0.065,
    darkMetal,
    "door-strut-cylinder",
  );
  tube(
    enclosure,
    [
      [-3.84, 1.97, 1.39],
      [-3.84, 2.57, 1.1],
    ],
    0.029,
    steel,
    "door-strut-rod",
  );
  box(
    enclosure,
    [0.14, 0.24, 0.18],
    [-3.74, 2.3, 1.58],
    darkMetal,
    undefined,
    "hood-interlock",
  );
  box(
    enclosure,
    [0.76, 0.88, 0.15],
    [-3.48, 0.64, 1.74],
    darkMetal,
    undefined,
    "tool-control-panel",
  );
  box(
    enclosure,
    [0.63, 0.49, 0.025],
    [-3.48, 0.79, 1.83],
    lens,
    undefined,
    "tool-pc-screen",
  );
  box(
    enclosure,
    [0.73, 0.1, 0.32],
    [-3.48, 0.16, 1.82],
    metal,
    undefined,
    "control-keyboard-shelf",
  );
  cylinder(
    enclosure,
    [0.155, 0.155],
    0.03,
    [-3.48, 0.38, 1.84],
    caution,
    [quarter, 0, 0],
    "emo-yellow-surround",
    32,
  );
  cylinder(
    enclosure,
    [0.095, 0.095],
    0.1,
    [-3.48, 0.38, 1.89],
    emergency,
    [quarter, 0, 0],
    "front-emo",
    32,
  );
  cylinder(
    enclosure,
    [0.15, 0.15],
    0.03,
    [3.34, 0.32, -2.71],
    caution,
    [quarter, 0, 0],
    "rear-emo-surround",
    32,
  );
  cylinder(
    enclosure,
    [0.09, 0.09],
    0.09,
    [3.34, 0.32, -2.75],
    emergency,
    [quarter, 0, 0],
    "rear-emo",
    32,
  );
}
