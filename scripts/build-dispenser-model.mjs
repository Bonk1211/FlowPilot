import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

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
  segments = 64,
) {
  return mesh(
    group,
    new THREE.CylinderGeometry(radii[0], radii[1], height, segments, 4),
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
    new THREE.TorusGeometry(radius, tube, 24, 72),
    material,
    position,
    rotation,
    name,
  );
}

function detailRing(group, radius, position, material, rotation, name) {
  return mesh(
    group,
    new THREE.TorusGeometry(radius, 0.006, 16, 48),
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
      96,
      radius,
      16,
      false,
    ),
    material,
    [0, 0, 0],
    [0, 0, 0],
    name,
  );
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
  const slot = box(
    group,
    [0.07, 0.012, 0.012],
    [position[0], position[1] + 0.03, position[2]],
    polymer,
  );
  slot.rotation.copy(screw.rotation);
}

const frame = new THREE.Group();
frame.name = "support_frame";
root.add(frame);
box(frame, [7.2, 0.16, 3.8], [0, -2.42, 0], darkMetal, undefined, "base-plate");
for (const x of [-3.35, 3.35]) {
  for (const z of [-1.65, 1.65]) {
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
for (const x of [-3.25, 3.25]) {
  box(
    frame,
    [0.18, 4.4, 0.18],
    [x, -0.15, 1.5],
    darkMetal,
    undefined,
    "upright",
  );
}
box(
  frame,
  [6.7, 0.18, 0.18],
  [0, 2.0, 1.5],
  darkMetal,
  undefined,
  "cross-rail",
);

const reservoir = part("bfs_bottle");
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
  reservoir,
  [0.72, 0.72],
  0.12,
  [-2.25, 1.58, 0.15],
  darkMetal,
  undefined,
  "reservoir-cap",
);
cylinder(
  reservoir,
  [0.42, 0.5],
  0.28,
  [-2.25, 1.78, 0.15],
  metal,
  undefined,
  "cap-collar",
);
ringStack(
  reservoir,
  16,
  0.425,
  [-2.25, 1.65, 0.15],
  0.017,
  1,
  darkMetal,
  [Math.PI / 2, 0, 0],
  "collar-grip",
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

const pickup = part("pickup_tube");
cylinder(
  pickup,
  [0.055, 0.055],
  1.52,
  [-2.25, 0.68, 0.15],
  teal,
  undefined,
  "internal-pickup",
  32,
);
cylinder(
  pickup,
  [0.1, 0.1],
  0.18,
  [-2.25, -0.09, 0.15],
  brass,
  undefined,
  "pickup-filter",
  32,
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
  0.06,
  [-3.22, 2.01, 0.4],
  glass,
  [Math.PI / 2, 0, 0],
  "gauge-glass",
  48,
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
tube(
  feed,
  [
    [-2.25, 1.75, 0.15],
    [-1.8, 2.18, 0.1],
    [-0.85, 2.08, 0.02],
    [-0.45, 1.45, 0],
  ],
  0.026,
  teal,
  "visible-fluid-core",
);
for (const x of [-1.65, -1.15, -0.7])
  torus(
    feed,
    0.105,
    0.018,
    [x, 2.13, 0.05],
    darkMetal,
    [Math.PI / 2, 0, 0],
    "hose-clamp",
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
  12,
  0.212,
  [-0.555, 1.31, 0],
  0.019,
  0,
  darkMetal,
  [0, Math.PI / 2, 0],
  "collar-grip",
);

const valve = part("dj2200_valve");
box(
  valve,
  [1.15, 1.65, 0.9],
  [0, 0.38, 0],
  darkMetal,
  undefined,
  "valve-housing",
);
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
  [0.34, 0.34],
  0.9,
  [0, 1.72, 0],
  darkMetal,
  undefined,
  "solenoid-coil",
  64,
);
cylinder(
  valve,
  [0.19, 0.19],
  0.35,
  [0, 2.34, 0],
  steel,
  undefined,
  "stroke-adjuster",
  48,
);
cylinder(
  valve,
  [0.28, 0.28],
  0.12,
  [0, 2.55, 0],
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
    [Math.cos(angle) * 0.285, 2.55, Math.sin(angle) * 0.285],
    metal,
    [0, -angle, 0],
    "knob-grip",
  );
}
ringStack(
  valve,
  12,
  0.282,
  [0, 2.485, 0],
  0.012,
  1,
  metal,
  [Math.PI / 2, 0, 0],
  "knob-grip",
);
cylinder(
  valve,
  [0.43, 0.43],
  0.32,
  [0, -0.67, 0],
  brass,
  undefined,
  "heater-collar",
  64,
);
ringStack(
  valve,
  16,
  0.432,
  [0, -0.815, 0],
  0.019,
  1,
  steel,
  [Math.PI / 2, 0, 0],
  "collar-grip",
);
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

const valveAir = part("valve_air");
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
    [0.35, -0.65, 0.15],
  ],
  0.065,
  teal,
  "coaxial-air-line",
);
cylinder(
  coaxAir,
  [0.13, 0.13],
  0.32,
  [0.35, -0.56, 0.15],
  brass,
  [0, 0, Math.PI / 2],
  "coaxial-fitting",
  32,
);

const airCap = part("air_cap");
cylinder(
  airCap,
  [0.39, 0.34],
  0.32,
  [0, -0.98, 0],
  steel,
  undefined,
  "air-cap-body",
  72,
);
torus(
  airCap,
  0.36,
  0.07,
  [0, -1.15, 0],
  darkMetal,
  [Math.PI / 2, 0, 0],
  "air-cap-retainer",
);
for (let index = 0; index < 8; index += 1) {
  const angle = (index / 8) * Math.PI * 2;
  cylinder(
    airCap,
    [0.028, 0.028],
    0.12,
    [Math.cos(angle) * 0.25, -1.16, Math.sin(angle) * 0.25],
    polymer,
    undefined,
    "air-port",
    16,
  );
}

const nozzle = part("nozzle");
cylinder(
  nozzle,
  [0.2, 0.1],
  0.42,
  [0, -1.33, 0],
  brass,
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
  10,
  0.135,
  [0, -1.51, 0],
  0.025,
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

const tray = part("substrate_tray");
box(
  tray,
  [4.8, 0.15, 2.45],
  [0, -2.18, 0],
  darkMetal,
  undefined,
  "carrier-base",
);
box(tray, [4.35, 0.08, 2.05], [0, -2.06, 0], metal, undefined, "carrier-deck");
box(
  tray,
  [3.65, 0.035, 1.55],
  [0, -1.99, 0],
  teal,
  undefined,
  "sample-surface",
);
for (const z of [-1.04, 1.04])
  box(
    tray,
    [4.65, 0.28, 0.12],
    [0, -1.98, z],
    steel,
    undefined,
    "fixture-rail",
  );
for (const x of [-2.2, 2.2])
  box(tray, [0.12, 0.28, 2.2], [x, -1.98, 0], steel, undefined, "end-stop");
for (const x of [-1.75, -0.6, 0.6, 1.75]) {
  for (const z of [-0.75, 0.75])
    cylinder(
      tray,
      [0.07, 0.07],
      0.09,
      [x, -1.92, z],
      darkMetal,
      undefined,
      "fixture-pin",
      24,
    );
}

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
