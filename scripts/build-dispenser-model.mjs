import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { addMachineAssemblies } from "./s932-machine-assemblies.mjs";

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const metal = new THREE.MeshStandardMaterial({
  name: "brushed-aluminium",
  color: 0x91a0a7,
  metalness: 0.82,
  roughness: 0.3,
});
const darkMetal = new THREE.MeshStandardMaterial({
  name: "anodized-graphite",
  color: 0x1b2930,
  metalness: 0.7,
  roughness: 0.34,
});
const steel = new THREE.MeshStandardMaterial({
  name: "machined-steel",
  color: 0xd5dde0,
  metalness: 0.95,
  roughness: 0.18,
});
const polymer = new THREE.MeshStandardMaterial({
  name: "industrial-polymer",
  color: 0x17242a,
  metalness: 0.05,
  roughness: 0.62,
});
const brass = new THREE.MeshStandardMaterial({
  name: "brass-fittings",
  color: 0xb98432,
  metalness: 0.8,
  roughness: 0.26,
});
const teal = new THREE.MeshStandardMaterial({
  name: "fluid-path",
  color: 0x258b8e,
  metalness: 0.18,
  roughness: 0.45,
});
const amber = new THREE.MeshStandardMaterial({
  name: "actuation-air",
  color: 0xb06f22,
  metalness: 0.1,
  roughness: 0.5,
});
const purple = new THREE.MeshStandardMaterial({
  name: "reservoir-air",
  color: 0x76548e,
  metalness: 0.1,
  roughness: 0.5,
});
const glass = new THREE.MeshPhysicalMaterial({
  name: "glass-and-clear-tube",
  color: 0xb8e5e5,
  metalness: 0,
  roughness: 0.16,
  transparent: true,
  opacity: 0.58,
  transmission: 0.22,
});
// Atomizing (coaxial) air is drawn apart from the liquid path it surrounds.
const atomizingAir = new THREE.MeshStandardMaterial({
  name: "atomizing-air",
  color: 0x7fa6c4,
  metalness: 0.1,
  roughness: 0.5,
});
// Flow cores are restyled by the viewer; this material is only their fallback.
const flowCore = new THREE.MeshStandardMaterial({
  name: "flow-core",
  color: 0x35d6c8,
  metalness: 0,
  roughness: 0.3,
});
const lens = new THREE.MeshPhysicalMaterial({
  name: "camera-lens",
  color: 0x0b2636,
  metalness: 0.25,
  roughness: 0.08,
  transparent: true,
  opacity: 0.92,
});
const caution = new THREE.MeshStandardMaterial({
  name: "caution-yellow",
  color: 0xd8a827,
  metalness: 0.05,
  roughness: 0.5,
});

const root = new THREE.Group();
root.name = "generic_fluid_dispenser";
root.userData = {
  title: "ASYMTEK S-932 spray-flux system — illustrative reconstruction",
  geometryStatus:
    "Illustrative proportions; not manufacturer CAD or a dimensional reference",
  configuration: "BFS supply and DJ-2200 coaxial-air spray valve",
  sources: [
    "docs/Asymtek_S932_Consolidated_Reference.md",
    "docs/S932_3D_Model_Sources.md",
    "https://www.nordson.com/en/products/electronics-solutions-products/asymtek-dispensejet-dj-2200-spray-valve",
    "https://nc-p-001.sitecorecontenthub.cloud/api/public/content/347a9db638b24881971204d5e660d19f?v=51d7862b",
    "https://nc-p-001.sitecorecontenthub.cloud/api/public/content/31bd3f7e505044a0a6a86cb500602659",
  ],
};

function part(name) {
  const group = new THREE.Group();
  group.name = name;
  root.add(group);
  return group;
}

function mesh(
  group,
  geometry,
  material,
  position,
  rotation = [0, 0, 0],
  name = "detail",
) {
  const value = new THREE.Mesh(geometry, material);
  value.name = name;
  value.position.fromArray(position);
  value.rotation.set(...rotation);
  value.castShadow = true;
  value.receiveShadow = true;
  group.add(value);
  return value;
}

function box(group, size, position, material = metal, rotation, name) {
  return mesh(
    group,
    new THREE.BoxGeometry(...size),
    material,
    position,
    rotation,
    name,
  );
}

function cylinder(
  group,
  radii,
  height,
  position,
  material = metal,
  rotation = [0, 0, 0],
  name,
  segments = 32,
) {
  return mesh(
    group,
    new THREE.CylinderGeometry(radii[0], radii[1], height, segments, 1),
    material,
    position,
    rotation,
    name,
  );
}

function torus(
  group,
  radius,
  tube,
  position,
  material = metal,
  rotation = [0, 0, 0],
  name,
) {
  return mesh(
    group,
    new THREE.TorusGeometry(radius, tube, 12, 48),
    material,
    position,
    rotation,
    name,
  );
}

function detailRing(group, radius, position, material, rotation, name) {
  return mesh(
    group,
    new THREE.TorusGeometry(radius, 0.006, 8, 40),
    material,
    position,
    rotation,
    name,
  );
}

function ringStack(
  group,
  count,
  radius,
  start,
  step,
  axis,
  material,
  rotation,
  name,
) {
  for (let index = 0; index < count; index += 1) {
    const position = [...start];
    position[axis] += index * step;
    detailRing(group, radius, position, material, rotation, name);
  }
}

function tube(group, points, radius, material, name) {
  return mesh(
    group,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
      64,
      radius,
      10,
      false,
    ),
    material,
    [0, 0, 0],
    [0, 0, 0],
    name,
  );
}

/**
 * A thin core along a real flow path. Its UV runs along the path's length, and
 * the path points travel with the model so the viewer can follow them.
 */
function flowCore_(group, points, radius, name, kind) {
  const value = tube(group, points, radius, flowCore, name);
  value.userData = { flowPath: points, flowKind: kind };
  return value;
}

function fastener(group, position, rotation = [Math.PI / 2, 0, 0]) {
  const screw = cylinder(
    group,
    [0.055, 0.055],
    0.055,
    position,
    steel,
    rotation,
    "fastener",
    24,
  );
  const face = new THREE.Vector3(0, 0.032, 0).applyEuler(screw.rotation);
  const slot = box(
    group,
    [0.07, 0.012, 0.012],
    position.map((value, index) => value + face.getComponent(index)),
    polymer,
  );
  slot.rotation.copy(screw.rotation);
}

const frame = new THREE.Group();
frame.name = "support_frame";
root.add(frame);
box(
  frame,
  [7.2, 0.16, 4.8],
  [0, -2.42, -0.4],
  darkMetal,
  undefined,
  "base-plate",
);
for (const x of [-3.35, 3.35]) {
  for (const z of [-2.5, 1.65]) {
    cylinder(
      frame,
      [0.12, 0.12],
      0.35,
      [x, -2.65, z],
      polymer,
      undefined,
      "levelling-foot",
      32,
    );
  }
}

const reservoir = part("bfs_bottle");
const bfsLid = part("bfs_lid");
cylinder(
  reservoir,
  [0.68, 0.68],
  1.75,
  [-2.25, 0.65, 0.15],
  steel,
  undefined,
  "pressure-vessel",
);
cylinder(
  bfsLid,
  [0.72, 0.72],
  0.12,
  [-2.25, 1.58, 0.15],
  darkMetal,
  undefined,
  "bfs-lid",
);
cylinder(
  bfsLid,
  [0.28, 0.33],
  0.14,
  [-2.25, 1.71, 0.15],
  metal,
  undefined,
  "cap-collar",
);
torus(
  bfsLid,
  0.61,
  0.027,
  [-2.25, 1.505, 0.15],
  polymer,
  [Math.PI / 2, 0, 0],
  "lid-o-ring",
);
for (let index = 0; index < 3; index += 1) {
  const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
  const x = -2.25 + Math.cos(angle) * 0.56;
  const z = 0.15 + Math.sin(angle) * 0.56;
  cylinder(
    bfsLid,
    [0.045, 0.045],
    0.24,
    [x, 1.66, z],
    steel,
    undefined,
    "lid-clamping-stud",
  );
  cylinder(
    bfsLid,
    [0.115, 0.115],
    0.1,
    [x, 1.81, z],
    polymer,
    undefined,
    "lid-clamping-knob",
    12,
  );
  box(
    bfsLid,
    [0.25, 0.07, 0.11],
    [x, 1.82, z],
    polymer,
    [0, -angle, 0],
    "lid-knob-grip",
  );
}
cylinder(
  bfsLid,
  [0.115, 0.115],
  0.21,
  [-2.25, 1.85, 0.15],
  steel,
  undefined,
  "lid-fluid-outlet",
  6,
);
cylinder(
  bfsLid,
  [0.11, 0.11],
  0.19,
  [-2.75, 1.7, 0.28],
  brass,
  [0, 0, Math.PI / 2],
  "lid-pressure-port",
  6,
);
torus(
  bfsLid,
  0.082,
  0.018,
  [-2.25, 1.945, 0.15],
  polymer,
  [Math.PI / 2, 0, 0],
  "outlet-ferrule",
);
torus(
  reservoir,
  0.46,
  0.06,
  [-2.25, -0.22, 0.15],
  polymer,
  [Math.PI / 2, 0, 0],
  "lower-bumper",
);
box(
  reservoir,
  [1.65, 0.18, 1.05],
  [-2.25, -0.42, 0.15],
  darkMetal,
  undefined,
  "reservoir-cradle",
);
box(
  reservoir,
  [0.08, 0.7, 1.2],
  [-3.05, -0.05, 0.15],
  darkMetal,
  undefined,
  "mounting-bracket",
);
for (const y of [0.15, 0.7, 1.25])
  torus(
    reservoir,
    0.69,
    0.025,
    [-2.25, y, 0.15],
    metal,
    [Math.PI / 2, 0, 0],
    "vessel-band",
  );

const bfsSensors = part("bfs_sensors");
box(
  bfsSensors,
  [0.1, 1.65, 0.18],
  [-3.04, 0.62, 0.15],
  metal,
  undefined,
  "sensor-mounting-rail",
);
for (const [y, name] of [
  [0.45, "level-sensor"],
  [0.1, "empty-level-sensor"],
  [-0.2, "bottle-present-sensor"],
]) {
  box(
    bfsSensors,
    [0.18, 0.19, 0.22],
    [-2.95, y, 0.15],
    polymer,
    undefined,
    name,
  );
  cylinder(
    bfsSensors,
    [0.025, 0.025],
    0.01,
    [-2.95, y, 0.267],
    caution,
    [Math.PI / 2, 0, 0],
    "sensor-status-window",
    12,
  );
  fastener(bfsSensors, [-3.035, y, 0.25]);
}
tube(
  bfsSensors,
  [
    [-3.02, 0.45, 0.15],
    [-3.12, 0.65, 0.24],
    [-3.12, 1.3, 0.3],
  ],
  0.025,
  polymer,
  "level-sensor-cable",
);

const pickup = part("pickup_tube");
cylinder(
  pickup,
  [0.055, 0.055],
  1.52,
  [-2.25, 0.68, 0.15],
  glass,
  undefined,
  "internal-pickup",
  32,
);
cylinder(
  pickup,
  [0.055, 0.07],
  0.1,
  [-2.25, -0.09, 0.15],
  steel,
  undefined,
  "pickup-inlet",
  32,
);

flowCore_(
  pickup,
  [
    [-2.25, -0.12, 0.15],
    [-2.25, 0.6, 0.15],
    [-2.25, 1.44, 0.15],
    [-2.25, 1.75, 0.15],
  ],
  0.03,
  "fluid-core-pickup",
  "liquid",
);
// The liquid held in the bottle, seen when the vessel is drawn transparent.
cylinder(
  reservoir,
  [0.62, 0.62],
  1.2,
  [-2.25, 0.32, 0.15],
  flowCore,
  undefined,
  "fluid-volume",
);

const bfsAir = part("bfs_air");
tube(
  bfsAir,
  [
    [-3.7, 1.65, 0.4],
    [-3.2, 1.65, 0.4],
    [-2.75, 1.73, 0.28],
  ],
  0.055,
  purple,
  "reservoir-pressure-line",
);
flowCore_(
  bfsAir,
  [
    [-3.7, 1.65, 0.4],
    [-3.2, 1.65, 0.4],
    [-2.75, 1.73, 0.28],
  ],
  0.022,
  "air-core-reservoir",
  "reservoir_air",
);
cylinder(
  bfsAir,
  [0.14, 0.14],
  0.35,
  [-3.25, 1.65, 0.4],
  brass,
  [0, 0, Math.PI / 2],
  "pressure-regulator",
  40,
);
cylinder(
  bfsAir,
  [0.25, 0.25],
  0.1,
  [-3.22, 1.95, 0.4],
  darkMetal,
  [Math.PI / 2, 0, 0],
  "pressure-gauge",
  48,
);
cylinder(
  bfsAir,
  [0.21, 0.21],
  0.025,
  [-3.22, 1.95, 0.468],
  glass,
  [Math.PI / 2, 0, 0],
  "gauge-glass",
  48,
);
const gaugeFace = new THREE.MeshStandardMaterial({
  name: "gauge-dial",
  color: 0xe4e6dc,
  roughness: 0.8,
});
cylinder(
  bfsAir,
  [0.21, 0.21],
  0.01,
  [-3.22, 1.95, 0.454],
  gaugeFace,
  [Math.PI / 2, 0, 0],
  "gauge-dial",
);
box(
  bfsAir,
  [0.016, 0.14, 0.012],
  [-3.25, 1.99, 0.469],
  darkMetal,
  [0, 0, -0.6],
  "gauge-pointer",
);
box(
  bfsAir,
  [0.38, 0.29, 0.29],
  [-3.25, 1.61, 0.4],
  metal,
  undefined,
  "regulator-body",
);
cylinder(
  bfsAir,
  [0.145, 0.145],
  0.18,
  [-3.25, 1.38, 0.4],
  polymer,
  undefined,
  "regulator-adjustment",
  16,
);

const feed = part("feed_tube");
tube(
  feed,
  [
    [-2.25, 1.75, 0.15],
    [-1.8, 2.18, 0.1],
    [-0.85, 2.08, 0.02],
    [-0.45, 1.45, 0],
  ],
  0.085,
  glass,
  "clear-feed-hose",
);
flowCore_(
  feed,
  [
    [-2.25, 1.75, 0.15],
    [-1.8, 2.18, 0.1],
    [-0.85, 2.08, 0.02],
    [-0.45, 1.45, 0],
  ],
  0.026,
  "visible-fluid-core",
  "liquid",
);
torus(
  feed,
  0.105,
  0.02,
  [-1.3, 2.18, 0.06],
  darkMetal,
  [0, Math.PI / 2, 0],
  "hose-p-clip",
);
box(
  feed,
  [0.08, 0.19, 0.055],
  [-1.3, 2.04, 0.06],
  metal,
  undefined,
  "hose-clip-tab",
);
fastener(feed, [-1.3, 2.02, 0.09]);
cylinder(
  feed,
  [0.13, 0.13],
  0.13,
  [-2.25, 1.79, 0.15],
  steel,
  undefined,
  "supply-compression-nut",
  6,
);
torus(
  feed,
  0.084,
  0.015,
  [-2.25, 1.88, 0.15],
  brass,
  [Math.PI / 2, 0, 0],
  "supply-tube-ferrule",
);

const qd = part("fluid_qd");
cylinder(
  qd,
  [0.15, 0.15],
  0.42,
  [-0.37, 1.31, 0],
  steel,
  [0, 0, Math.PI / 2],
  "quick-disconnect-body",
  48,
);
cylinder(
  qd,
  [0.21, 0.21],
  0.2,
  [-0.45, 1.31, 0],
  brass,
  [0, 0, Math.PI / 2],
  "quick-disconnect-collar",
  48,
);
for (let index = 0; index < 10; index += 1) {
  const angle = (index / 10) * Math.PI * 2;
  box(
    qd,
    [0.22, 0.035, 0.035],
    [-0.45, 1.31 + Math.cos(angle) * 0.205, Math.sin(angle) * 0.205],
    darkMetal,
    [0, 0, Math.PI / 2],
    "collar-grip",
  );
}
ringStack(
  qd,
  6,
  0.212,
  [-0.555, 1.31, 0],
  0.038,
  0,
  darkMetal,
  [0, Math.PI / 2, 0],
  "collar-grip",
);
cylinder(
  qd,
  [0.165, 0.165],
  0.12,
  [-0.18, 1.31, 0],
  steel,
  [0, 0, Math.PI / 2],
  "qd-hex-adaptor",
  6,
);
torus(
  qd,
  0.126,
  0.018,
  [-0.12, 1.31, 0],
  polymer,
  [0, Math.PI / 2, 0],
  "qd-seal",
);
cylinder(
  qd,
  [0.115, 0.115],
  0.11,
  [-0.45, 1.48, 0],
  steel,
  undefined,
  "hose-compression-ferrule",
  6,
);

flowCore_(
  qd,
  [
    [-0.45, 1.45, 0],
    [-0.47, 1.36, 0],
    [-0.3, 1.31, 0],
    [0, 1.31, 0],
  ],
  0.026,
  "fluid-core-qd",
  "liquid",
);

const valve = part("dj2200_valve");
flowCore_(
  valve,
  [
    [0, 1.31, 0],
    [0, 0.4, 0],
    [0, -0.6, 0],
    [0, -0.95, 0],
  ],
  0.028,
  "fluid-core-valve",
  "liquid",
);
box(valve, [1.15, 1.65, 0.9], [0, 0.38, 0], metal, undefined, "valve-housing");
box(valve, [1.3, 0.18, 1.05], [0, 1.18, 0], metal, undefined, "upper-manifold");
box(
  valve,
  [1.28, 0.16, 1.04],
  [0, -0.42, 0],
  metal,
  undefined,
  "lower-manifold",
);
cylinder(
  valve,
  [0.27, 0.27],
  0.74,
  [0, 1.64, 0],
  metal,
  undefined,
  "piston-bonnet",
  32,
);
cylinder(
  valve,
  [0.19, 0.19],
  0.35,
  [0, 2.13, 0],
  steel,
  undefined,
  "stroke-adjuster",
  48,
);
cylinder(
  valve,
  [0.28, 0.28],
  0.12,
  [0, 2.4, 0],
  polymer,
  undefined,
  "adjustment-knob",
  48,
);
for (let index = 0; index < 12; index += 1) {
  const angle = (index / 12) * Math.PI * 2;
  box(
    valve,
    [0.04, 0.14, 0.04],
    [Math.cos(angle) * 0.285, 2.4, Math.sin(angle) * 0.285],
    metal,
    [0, -angle, 0],
    "knob-grip",
  );
}
ringStack(
  valve,
  6,
  0.282,
  [0, 2.335, 0],
  0.024,
  1,
  metal,
  [Math.PI / 2, 0, 0],
  "knob-grip",
);
torus(
  valve,
  0.23,
  0.035,
  [0, 1.99, 0],
  darkMetal,
  [Math.PI / 2, 0, 0],
  "micrometer-lock",
);
for (let index = 0; index < 8; index += 1) {
  box(
    valve,
    [index % 2 ? 0.025 : 0.055, 0.007, 0.01],
    [0, 2.02 + index * 0.034, 0.194],
    polymer,
    undefined,
    "micrometer-graduation",
  );
}
box(
  valve,
  [0.72, 0.22, 0.04],
  [0, 0.6, 0.47],
  metal,
  undefined,
  "identity-plate",
);
box(
  valve,
  [0.48, 0.08, 0.055],
  [0, 0.63, 0.505],
  caution,
  undefined,
  "identity-stripe",
);
for (const x of [-0.48, 0.48]) {
  for (const y of [-0.32, 1.08]) fastener(valve, [x, y, 0.46]);
}
box(
  valve,
  [0.24, 1.9, 0.22],
  [-0.75, 0.48, 0.22],
  darkMetal,
  undefined,
  "mounting-spine",
);
box(
  valve,
  [0.45, 0.16, 1.25],
  [-0.85, 0.52, 0.25],
  metal,
  undefined,
  "mounting-clamp",
);

// OEM spares establish these components; spacing is illustrative for inspection.
const needleAssembly = part("needle_assembly");
needleAssembly.userData = {
  source: "DJ-2200 spares list, September 2024, pp. 2–3",
  geometryStatus: "Illustrative internals",
};
cylinder(
  needleAssembly,
  [0.07, 0.07],
  1.48,
  [0, 0.3, 0],
  steel,
  undefined,
  "needle-shaft",
);
cylinder(
  needleAssembly,
  [0.07, 0.022],
  0.44,
  [0, -0.66, 0],
  steel,
  undefined,
  "tapered-needle",
);
cylinder(
  needleAssembly,
  [0.21, 0.21],
  0.14,
  [0, 1.08, 0],
  steel,
  undefined,
  "air-piston",
);
torus(
  needleAssembly,
  0.205,
  0.024,
  [0, 1.08, 0],
  polymer,
  [Math.PI / 2, 0, 0],
  "piston-seal",
);
cylinder(
  needleAssembly,
  [0.11, 0.11],
  0.14,
  [0, 1.22, 0],
  steel,
  undefined,
  "piston-lock-nut",
  6,
);
const springPoints = Array.from({ length: 121 }, (_, index) => {
  const angle = (index / 120) * Math.PI * 12;
  return [
    Math.cos(angle) * 0.17,
    1.3 + (index / 120) * 0.59,
    Math.sin(angle) * 0.17,
  ];
});
tube(needleAssembly, springPoints, 0.024, steel, "return-spring");
cylinder(
  needleAssembly,
  [0.22, 0.22],
  0.075,
  [0, 1.94, 0],
  steel,
  undefined,
  "spring-retainer",
);
cylinder(
  needleAssembly,
  [0.19, 0.19],
  0.11,
  [0, -0.88, 0],
  steel,
  undefined,
  "needle-seat",
);
torus(
  needleAssembly,
  0.13,
  0.026,
  [0, -0.965, 0],
  polymer,
  [Math.PI / 2, 0, 0],
  "needle-seat-seal",
);

const heater = part("valve_heater");
box(
  heater,
  [1.05, 0.4, 0.95],
  [0, -0.62, 0],
  polymer,
  undefined,
  "heater-cover",
);
box(
  heater,
  [0.9, 0.29, 0.12],
  [0, -0.62, -0.49],
  darkMetal,
  undefined,
  "heater-backplate",
);
for (const x of [-0.42, 0.42]) {
  for (const y of [-0.74, -0.5]) fastener(heater, [x, y, 0.485]);
}
tube(
  heater,
  [
    [0.52, -0.58, -0.25],
    [0.76, -0.28, -0.25],
    [0.68, 0.2, -0.29],
  ],
  0.028,
  amber,
  "heater-lead",
);
cylinder(
  heater,
  [0.23, 0.23],
  0.22,
  [0, -0.89, 0],
  steel,
  undefined,
  "heated-lower-body",
  6,
);

const nozzleNut = part("nozzle_nut");
cylinder(
  nozzleNut,
  [0.22, 0.22],
  0.16,
  [0, -1.15, 0],
  steel,
  undefined,
  "nozzle-nut",
  6,
);
torus(
  nozzleNut,
  0.18,
  0.02,
  [0, -1.045, 0],
  polymer,
  [Math.PI / 2, 0, 0],
  "nozzle-gasket",
);

const valveAir = part("valve_air");
box(
  valveAir,
  [0.42, 1.18, 0.62],
  [0.86, 1.0, 0.12],
  polymer,
  undefined,
  "actuation-solenoid",
);
box(
  valveAir,
  [0.43, 0.1, 0.63],
  [0.86, 1.62, 0.12],
  darkMetal,
  undefined,
  "solenoid-connector",
);
box(
  valveAir,
  [0.28, 0.15, 0.025],
  [0.86, 1.29, 0.445],
  metal,
  undefined,
  "solenoid-identity-plate",
);
fastener(valveAir, [0.86, 0.51, 0.45]);
tube(
  valveAir,
  [
    [2.95, 1.62, 0.55],
    [1.65, 1.62, 0.55],
    [0.62, 1.5, 0.25],
  ],
  0.055,
  amber,
  "actuation-air-line",
);
flowCore_(
  valveAir,
  [
    [2.95, 1.62, 0.55],
    [1.65, 1.62, 0.55],
    [0.62, 1.5, 0.25],
  ],
  0.022,
  "air-core-valve",
  "valve_air",
);
cylinder(
  valveAir,
  [0.11, 0.11],
  0.28,
  [0.67, 1.46, 0.22],
  brass,
  [0, 0, Math.PI / 2],
  "actuation-fitting",
  32,
);

const coaxAir = part("coaxial_air");
tube(
  coaxAir,
  [
    [2.95, 1.15, 0.7],
    [2.05, 1.1, 0.7],
    [0.9, 0.35, 0.52],
    [1.0, -1.18, 0.52],
    [0.385, -1.68, 0.2],
  ],
  0.065,
  atomizingAir,
  "coaxial-air-line",
);
flowCore_(
  coaxAir,
  [
    [2.95, 1.15, 0.7],
    [2.05, 1.1, 0.7],
    [0.9, 0.35, 0.52],
    [1.0, -1.18, 0.52],
    [0.385, -1.68, 0.2],
  ],
  0.026,
  "air-core-coaxial",
  "atomizing_air",
);
cylinder(
  coaxAir,
  [0.075, 0.075],
  0.15,
  [0.385, -1.68, 0.2],
  steel,
  [0, 0, Math.PI / 2],
  "coaxial-fitting",
  32,
);

const airCap = part("air_cap");
// An annular outlet surrounds the liquid nozzle; no unsupported port count.
mesh(
  airCap,
  new THREE.LatheGeometry(
    [
      [0.13, -0.055],
      [0.36, -0.055],
      [0.39, -0.025],
      [0.39, 0.035],
      [0.35, 0.065],
      [0.13, 0.065],
      [0.13, -0.055],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)),
    48,
  ),
  steel,
  [0, -1.68, 0],
  [0, 0, 0],
  "air-cap-body",
);
torus(
  airCap,
  0.2,
  0.025,
  [0, -1.6, 0],
  darkMetal,
  [Math.PI / 2, 0, 0],
  "air-cap-retainer",
);

const nozzle = part("nozzle");
flowCore_(
  nozzle,
  [
    [0, -0.95, 0],
    [0, -1.4, 0],
    [0, -1.8, 0],
  ],
  0.02,
  "fluid-core-nozzle",
  "liquid",
);
cylinder(
  nozzle,
  [0.2, 0.1],
  0.42,
  [0, -1.33, 0],
  steel,
  undefined,
  "nozzle-cone",
  72,
);
cylinder(
  nozzle,
  [0.105, 0.055],
  0.28,
  [0, -1.68, 0],
  steel,
  undefined,
  "nozzle-tip",
  64,
);
torus(
  nozzle,
  0.2,
  0.035,
  [0, -1.13, 0],
  polymer,
  [Math.PI / 2, 0, 0],
  "nozzle-seal",
);
ringStack(
  nozzle,
  5,
  0.18,
  [0, -1.19, 0],
  0.018,
  1,
  steel,
  [Math.PI / 2, 0, 0],
  "nozzle-thread",
);

const camera = part("vision_camera");
box(
  camera,
  [1.05, 0.82, 1.18],
  [2.05, -0.15, 0.05],
  darkMetal,
  undefined,
  "camera-body",
);
box(
  camera,
  [0.85, 0.55, 0.12],
  [2.05, -0.15, -0.59],
  metal,
  undefined,
  "camera-face",
);
cylinder(
  camera,
  [0.28, 0.28],
  0.42,
  [2.05, -0.15, -0.82],
  darkMetal,
  [Math.PI / 2, 0, 0],
  "lens-barrel",
  72,
);
ringStack(
  camera,
  8,
  0.284,
  [2.05, -0.15, -1.01],
  0.055,
  2,
  steel,
  [0, 0, 0],
  "lens-detail",
);
cylinder(
  camera,
  [0.23, 0.23],
  0.05,
  [2.05, -0.15, -1.05],
  lens,
  [Math.PI / 2, 0, 0],
  "front-element",
  72,
);
box(
  camera,
  [0.28, 1.35, 0.25],
  [2.65, 0.33, 0.42],
  metal,
  [0, 0, -0.35],
  "camera-mount",
);
tube(
  camera,
  [
    [2.45, 0.3, 0.5],
    [2.9, 0.75, 0.7],
    [3.1, 1.45, 0.85],
  ],
  0.055,
  polymer,
  "camera-cable",
);
for (const x of [1.63, 2.47])
  for (const y of [-0.46, 0.16]) fastener(camera, [x, y, -0.55]);
// Head optics face the work area; the separate lookup camera faces upward.
// Rotate around the body centre, preserving mesh-local annotation coordinates.
for (const child of camera.children)
  child.position.sub(new THREE.Vector3(2.05, -0.15, 0.05));
camera.rotation.x = -Math.PI / 2;
camera.position.set(1.75, 0.6, -0.2);

const tray = part("substrate_tray");
for (const [z, width, suffix] of [
  [0, 1.75, ""],
  [-1.77, 1, "-rear"],
]) {
  box(
    tray,
    [4.6, 0.12, width],
    [0, -2.18, z],
    darkMetal,
    undefined,
    `carrier-base${suffix}`,
  );
  box(
    tray,
    [4.35, 0.08, width],
    [0, -2.06, z],
    metal,
    undefined,
    `carrier-deck${suffix}`,
  );
  box(
    tray,
    [3.65, 0.035, width - 0.2],
    [0, -1.99, z],
    teal,
    undefined,
    `sample-surface${suffix}`,
  );
  for (const x of [-2.1, 2.1]) {
    box(
      tray,
      [0.1, 0.16, width],
      [x, -1.98, z],
      steel,
      undefined,
      "carrier-end-stop",
    );
    for (const offset of [-1, 1]) {
      cylinder(
        tray,
        [0.055, 0.055],
        0.06,
        [x, -1.87, z + offset * (width / 2 - 0.1)],
        darkMetal,
        undefined,
        "carrier-locating-pin",
        16,
      );
    }
  }
  for (const x of [-1.7, 1.7]) {
    cylinder(
      tray,
      [0.07, 0.07],
      0.008,
      [x, -1.967, z + width / 2 - 0.2],
      brass,
      undefined,
      "substrate-fiducial",
      24,
    );
  }
}

for (const [group, y, z, name] of [
  [valveAir, 1.62, 0.55, "valve"],
  [coaxAir, 1.15, 0.7, "coaxial"],
]) {
  box(
    group,
    [0.3, 0.28, 0.28],
    [3.12, y, z],
    metal,
    undefined,
    `${name}-regulator-body`,
  );
  cylinder(
    group,
    [0.13, 0.13],
    0.14,
    [3.12, y + 0.21, z],
    polymer,
    undefined,
    `${name}-regulator-knob`,
    16,
  );
  cylinder(
    group,
    [0.16, 0.16],
    0.07,
    [3.12, y, z + 0.18],
    darkMetal,
    [Math.PI / 2, 0, 0],
    `${name}-gauge`,
  );
  cylinder(
    group,
    [0.135, 0.135],
    0.012,
    [3.12, y, z + 0.225],
    gaugeFace,
    [Math.PI / 2, 0, 0],
    `${name}-gauge-face`,
  );
  box(
    group,
    [0.012, 0.09, 0.01],
    [3.1, y + 0.025, z + 0.235],
    darkMetal,
    [0, 0, -0.55],
    `${name}-gauge-pointer`,
  );
}

addMachineAssemblies({
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
});

const plume = new THREE.Group();
plume.name = "spray_visualization";
root.add(plume);
const plumeMaterial = new THREE.MeshPhysicalMaterial({
  name: "illustrative-spray",
  color: 0x65c8c4,
  transparent: true,
  opacity: 0.13,
  roughness: 0.2,
  depthWrite: false,
});
mesh(
  plume,
  new THREE.ConeGeometry(0.62, 0.78, 64, 1, true),
  plumeMaterial,
  [0, -1.9, 0],
  [0, 0, Math.PI],
  "spray-cone",
);

root.traverse((object) => {
  if (object.isMesh) {
    object.geometry.computeVertexNormals();
  }
});

const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
});
const output = resolve("apps/web/public/models/generic-fluid-dispenser.glb");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(binary));
console.log(
  `Generated ${output} (${Math.round(binary.byteLength / 1024)} KiB)`,
);
