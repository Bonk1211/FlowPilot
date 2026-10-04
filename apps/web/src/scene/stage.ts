import * as THREE from "three";
import type { FluidPoint } from "../incidents/experimentPlayback";
import type { Mechanism } from "./experimentShots";
import {
  explodeAmounts,
  explodeOffsets,
  groupIds,
  settle,
  type GroupId,
  type Shot,
} from "./shots";

/** Everything the directed scene needs for one step. All values are illustrative. */
export type SceneDirection = {
  key: string;
  shot: Shot;
  fluid: FluidPoint[];
  control: FluidPoint;
  condition: "start" | "tested";
  mechanism: Mechanism;
};

const labelText: Record<GroupId, string> = {
  bfs_bottle: "BFS bottle",
  pickup_tube: "Pickup tube",
  bfs_air: "Reservoir air",
  feed_tube: "Feed tube",
  fluid_qd: "Quick disconnect",
  dj2200_valve: "DJ-2200 valve",
  valve_air: "Valve-actuation air",
  coaxial_air: "Atomizing air",
  air_cap: "Air cap",
  nozzle: "Nozzle",
  vision_camera: "Vision camera",
  substrate_tray: "Substrate",
  support_frame: "Frame",
  spray_visualization: "Spray",
};

// Liquid, reservoir air, valve-actuation air and atomizing air keep their own colours.
const flowColours = {
  liquid: [new THREE.Color(0x35d6c8), new THREE.Color(0x0d6f6b)],
  reservoir_air: [new THREE.Color(0xb48ad6), new THREE.Color(0x4f2f6b)],
  valve_air: [new THREE.Color(0xf0a64a), new THREE.Color(0x7a4a12)],
  atomizing_air: [new THREE.Color(0xa9d4f2), new THREE.Color(0x3d6c8f)],
} as const;
type FlowKind = keyof typeof flowColours;

const vertexShader = /* glsl */ `
uniform float uOffset;
uniform float uLength;
uniform float uRadius;
uniform float uThin;
uniform float uThinFrom;
varying float vS;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vS = uOffset + uv.x * uLength;
  // Downstream of a narrowing the liquid core draws thinner.
  float thin = uThinFrom < 0.0 ? 1.0 : mix(1.0, uThin, smoothstep(uThinFrom, uThinFrom + 0.08, vS));
  vec3 moved = position - normal * uRadius * (1.0 - thin);
  vNormal = normalize(normalMatrix * normal);
  vec4 view = modelViewMatrix * vec4(moved, 1.0);
  vView = -view.xyz;
  gl_Position = projectionMatrix * view;
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uDensity;
uniform float uPulse;
uniform float uStarve;
uniform float uThinFrom;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uDeep;
varying float vS;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float travel = vS - uTime * uSpeed;
  // Bright slugs move with the flow, so the liquid visibly travels.
  float slug = 0.5 + 0.5 * sin(travel * 22.0);
  // Unstable delivery: surges separated by gaps travel down the path.
  float wave = 0.5 + 0.5 * sin(travel * 7.0);
  float gate = mix(1.0, smoothstep(0.35, 0.6, wave), uPulse);
  float starve = uThinFrom < 0.0 ? 1.0 : mix(1.0, 1.0 - uStarve, smoothstep(uThinFrom, uThinFrom + 0.2, vS));
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
  vec3 colour = mix(uDeep, uColor, 0.45 + 0.55 * slug) + rim * 0.3;
  float alpha = uOpacity * uDensity * gate * starve * (0.72 + 0.28 * slug);
  gl_FragColor = vec4(colour, alpha);
}`;

type Core = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  kind: FlowKind;
  group: GroupId;
  offset: number;
  length: number;
};
type Shell = { material: THREE.Material & { opacity: number }; base: number };

function hash(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The directed scene's runtime: moves parts apart, fades or x-rays them,
 * names them with leader lines, and draws the liquid, the air paths, the
 * spray and the deposit from the simulated values it is given.
 */
export class Stage {
  private groups = new Map<GroupId, THREE.Object3D>();
  private home = new Map<GroupId, THREE.Vector3>();
  private anchors = new Map<GroupId, THREE.Vector3>();
  private shells = new Map<GroupId, Shell[]>();
  private cores: Core[] = [];
  private exploded: Partial<Record<GroupId, number>> = {};
  private faded: Partial<Record<GroupId, number>> = {};
  private seeThrough: Partial<Record<GroupId, number>> = {};
  private from = {
    exploded: {} as Partial<Record<GroupId, number>>,
    faded: {} as Partial<Record<GroupId, number>>,
    seeThrough: {} as Partial<Record<GroupId, number>>,
  };
  private droplets: THREE.InstancedMesh;
  private dropletCount: number;
  private deposit: THREE.Mesh;
  private depositCanvas: HTMLCanvasElement;
  private depositTexture: THREE.CanvasTexture;
  private depositDrawn = "";
  private marker: THREE.Mesh;
  private sprayCone: THREE.Mesh | null;
  private qdStart = -1;
  private labelLayer: HTMLDivElement;
  private lines: SVGSVGElement;
  private labels = new Map<
    GroupId,
    { box: HTMLDivElement; line: SVGLineElement }
  >();
  private markerLabel: HTMLDivElement;
  private matrix = new THREE.Matrix4();
  private scratch = new THREE.Vector3();
  private direction: SceneDirection | null = null;

  constructor(
    private root: THREE.Group,
    host: HTMLElement,
    detail: "low" | "high",
  ) {
    for (const id of groupIds) {
      const group = root.getObjectByName(id);
      if (!group) continue;
      this.groups.set(id, group);
      this.home.set(id, group.position.clone());
      const box = new THREE.Box3().setFromObject(group);
      this.anchors.set(id, box.getCenter(new THREE.Vector3()));
    }
    const liquidOrder = [
      "fluid-core-pickup",
      "visible-fluid-core",
      "fluid-core-qd",
      "fluid-core-valve",
      "fluid-core-nozzle",
    ];
    let travelled = 0;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const owner = this.ownerOf(object);
      if (!owner) return;
      const path = object.userData.flowPath as number[][] | undefined;
      if (!path) {
        if (object.name === "fluid-volume") return;
        const list = (
          Array.isArray(object.material) ? object.material : [object.material]
        ) as (THREE.Material & { opacity: number })[];
        this.shells.set(owner, [
          ...(this.shells.get(owner) ?? []),
          ...list.map((material) => ({ material, base: material.opacity })),
        ]);
        return;
      }
      const kind = object.userData.flowKind as FlowKind;
      const length = new THREE.CatmullRomCurve3(
        path.map((point) => new THREE.Vector3(...point)),
      ).getLength();
      const radius =
        (object.geometry as THREE.TubeGeometry).parameters?.radius ?? 0.025;
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 0.5 },
          uDensity: { value: 1 },
          uPulse: { value: 0 },
          uStarve: { value: 0 },
          uThin: { value: 1 },
          uThinFrom: { value: -1 },
          uOpacity: { value: 1 },
          uOffset: { value: 0 },
          uLength: { value: length },
          uRadius: { value: radius },
          uColor: { value: flowColours[kind][0] },
          uDeep: { value: flowColours[kind][1] },
        },
      });
      (object.material as THREE.Material).dispose();
      object.material = material;
      object.renderOrder = 2;
      this.cores.push({
        mesh: object,
        material,
        kind,
        group: owner,
        offset: 0,
        length,
      });
    });
    // Lay the liquid segments end to end so the flow is continuous.
    for (const name of liquidOrder) {
      const core = this.cores.find((item) => item.mesh.name === name);
      if (!core) continue;
      core.offset = travelled;
      core.material.uniforms.uOffset.value = travelled;
      // The example narrowing sits just before the quick disconnect.
      if (name === "fluid-core-qd") this.qdStart = travelled - 0.12;
      travelled += core.length;
    }

    // Spray droplets: one instanced mesh, moved with the nozzle.
    this.dropletCount = detail === "low" ? 160 : 380;
    this.droplets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.0055, 6, 4),
      new THREE.MeshBasicMaterial({
        color: 0x8ff0e6,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
      this.dropletCount,
    );
    this.droplets.frustumCulled = false;
    this.droplets.visible = false;
    this.groups.get("nozzle")?.add(this.droplets);

    // Deposit on the sample surface, one stripe per sequence position.
    this.depositCanvas = document.createElement("canvas");
    this.depositCanvas.width = 512;
    this.depositCanvas.height = 224;
    this.depositTexture = new THREE.CanvasTexture(this.depositCanvas);
    this.depositTexture.colorSpace = THREE.SRGBColorSpace;
    this.deposit = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.3),
      new THREE.MeshBasicMaterial({
        map: this.depositTexture,
        transparent: true,
        depthWrite: false,
        // Drawn as painted so the density differences survive tone mapping.
        toneMapped: false,
      }),
    );
    this.deposit.rotation.x = -Math.PI / 2;
    this.deposit.position.set(0, -1.968, 0);
    this.deposit.visible = false;
    this.groups.get("substrate_tray")?.add(this.deposit);

    // A marked example location for a narrowing; never an observed one.
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.018, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0xf0a64a, transparent: true }),
    );
    // Around the feed tube where it drops into the quick disconnect.
    this.marker.position.set(-0.52, 1.58, 0.01);
    this.marker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.45, -0.89, 0).normalize(),
    );
    this.marker.visible = false;
    this.groups.get("feed_tube")?.add(this.marker);

    this.sprayCone = (root.getObjectByName("spray-cone") as THREE.Mesh) ?? null;
    // The bottle's liquid glows softly through the vessel; it casts no shadow.
    const volume = root.getObjectByName("fluid-volume") as THREE.Mesh | null;
    if (volume) {
      (volume.material as THREE.Material).dispose();
      volume.material = new THREE.MeshBasicMaterial({
        color: 0x2fbdb2,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      volume.castShadow = false;
      volume.receiveShadow = false;
      volume.renderOrder = 1;
    }

    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "assembly-labels";
    this.labelLayer.setAttribute("aria-hidden", "true");
    this.lines = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.lines.classList.add("assembly-label-lines");
    this.labelLayer.append(this.lines);
    this.markerLabel = document.createElement("div");
    this.markerLabel.className = "assembly-label is-hypothetical";
    this.markerLabel.textContent = "Example location · hypothetical";
    this.labelLayer.append(this.markerLabel);
    host.append(this.labelLayer);
  }

  private ownerOf(object: THREE.Object3D): GroupId | null {
    let current: THREE.Object3D | null = object;
    while (current && current.parent && current.parent !== this.root)
      current = current.parent;
    const name = current?.name ?? "";
    return (groupIds as readonly string[]).includes(name)
      ? (name as GroupId)
      : null;
  }

  /** Start a new step: transitions leave from wherever the parts are now. */
  direct(direction: SceneDirection | null) {
    this.from = {
      exploded: { ...this.exploded },
      faded: { ...this.faded },
      seeThrough: { ...this.seeThrough },
    };
    this.direction = direction;
    this.depositDrawn = "";
  }

  get active() {
    return this.direction !== null;
  }

  /** The fluid point shown `progress` into the shot; a sweep moves through them. */
  private pointAt(progress: number) {
    const fluid = this.direction!.fluid;
    if (fluid.length === 1) return { point: fluid[0], shown: 1 };
    const span = progress * (fluid.length - 1);
    const index = Math.floor(span);
    const next = Math.min(fluid.length - 1, index + 1);
    const local = span - index;
    const a = fluid[index];
    const b = fluid[next];
    const mix = (key: Exclude<keyof FluidPoint, "channels">) =>
      a[key] + (b[key] - a[key]) * local;
    return {
      point: {
        position: mix("position"),
        mass: mix("mass"),
        coverage: mix("coverage"),
        supplyPressure: mix("supplyPressure"),
        feedFlow: mix("feedFlow"),
        pathOpen: mix("pathOpen"),
        flowResistance: mix("flowResistance"),
        valveDuty: mix("valveDuty"),
        sprayWidth: mix("sprayWidth"),
        channels: a.channels,
      },
      shown: index + 1,
    };
  }

  update(
    time: number,
    progress: number,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    const direction = this.direction;
    if (!direction) return;
    const { shot, mechanism, condition } = direction;
    const sweep = direction.fluid.length > 1 && shot.deposit === "build";
    const { point, shown } = this.pointAt(sweep ? progress : 1);
    const end = direction.fluid[direction.fluid.length - 1];

    // Parts apart, faded or see-through, eased from where they were.
    const apart = explodeAmounts(shot, progress);
    for (const id of groupIds) {
      const group = this.groups.get(id);
      if (!group) continue;
      const exploding = shot.explode.includes(id);
      this.exploded[id] = exploding
        ? Math.max(apart[id] ?? 0, 0)
        : settle(this.from.exploded[id] ?? 0, 0, progress);
      if (exploding && (this.from.exploded[id] ?? 0) > (apart[id] ?? 0))
        this.exploded[id] = this.from.exploded[id];
      this.faded[id] = settle(
        this.from.faded[id] ?? 0,
        shot.ghost.includes(id) ? 1 : 0,
        progress,
      );
      this.seeThrough[id] = settle(
        this.from.seeThrough[id] ?? 0,
        shot.xray.includes(id) ? 1 : 0,
        progress,
      );
      const offset = explodeOffsets[id];
      const amount = this.exploded[id] ?? 0;
      group.position
        .copy(this.home.get(id)!)
        .add(this.scratch.set(...offset).multiplyScalar(amount));
      const fade = 1 - 0.86 * (this.faded[id] ?? 0);
      const clear = 1 - 0.7 * (this.seeThrough[id] ?? 0);
      for (const shell of this.shells.get(id) ?? []) {
        const opacity = shell.base * fade * clear;
        shell.material.opacity = opacity;
        const transparent = opacity < 0.999 || shell.base < 1;
        // Opaque materials compile alpha out, so a switch needs a (cached) recompile.
        if (shell.material.transparent !== transparent) {
          shell.material.transparent = transparent;
          shell.material.needsUpdate = true;
        }
        shell.material.depthWrite = opacity > 0.6;
      }
    }

    // The liquid and the three air paths.
    const resistance = Math.max(1, point.flowResistance);
    const thick = Math.min(1, (resistance - 1) / 0.8);
    const pressures = direction.fluid.map((item) => item.supplyPressure);
    const swing =
      mechanism === "unstable_delivery" && condition === "tested"
        ? Math.max(...pressures, end.supplyPressure) -
          Math.min(...pressures, end.supplyPressure)
        : 0;
    const pulse =
      mechanism === "unstable_delivery" && condition === "tested"
        ? Math.min(0.95, Math.max(0.35, swing / 0.4))
        : 0;
    const narrowing =
      mechanism === "restriction" &&
      condition === "tested" &&
      this.qdStart >= 0;
    for (const core of this.cores) {
      const uniforms = core.material.uniforms;
      uniforms.uTime.value = time;
      uniforms.uOpacity.value = 1 - 0.8 * (this.faded[core.group] ?? 0);
      if (core.kind === "liquid") {
        uniforms.uSpeed.value =
          (0.65 * Math.max(0.15, point.feedFlow)) / resistance ** 1.6;
        uniforms.uDensity.value = 0.8 + 0.2 * Math.min(1, point.feedFlow);
        uniforms.uPulse.value = pulse;
        uniforms.uThinFrom.value = narrowing ? this.qdStart : -1;
        uniforms.uThin.value = narrowing
          ? Math.max(0.25, point.pathOpen ** 1.5)
          : 1;
        uniforms.uStarve.value = narrowing
          ? Math.min(0.7, 1 - point.feedFlow)
          : 0;
        (uniforms.uColor.value as THREE.Color)
          .copy(flowColours.liquid[0])
          .lerp(new THREE.Color(0x167f78), thick * 0.75);
      } else if (core.kind === "reservoir_air") {
        uniforms.uSpeed.value = 0.9;
        uniforms.uPulse.value = pulse;
        uniforms.uDensity.value =
          0.55 + 0.45 * Math.min(1, point.supplyPressure);
      } else if (core.kind === "valve_air") {
        uniforms.uSpeed.value = 1.1 * point.valveDuty;
        uniforms.uPulse.value = 0.85;
      } else {
        uniforms.uSpeed.value = 1.8;
        uniforms.uPulse.value = 0;
      }
    }
    const volume = this.root.getObjectByName(
      "fluid-volume",
    ) as THREE.Mesh | null;
    if (volume) {
      const material = volume.material as THREE.MeshBasicMaterial;
      material.opacity = 0.32 * (this.seeThrough.bfs_bottle ?? 0);
      material.color.setHex(0x2fbdb2).lerp(new THREE.Color(0x0e5f5a), thick);
      volume.visible = (this.seeThrough.bfs_bottle ?? 0) > 0.05;
    }

    // Spray: width follows simulated coverage, density follows feed flow.
    const showSpray = ["nozzle", "substrate", "readout", "establish"].includes(
      shot.id,
    );
    this.droplets.visible = showSpray;
    if (showSpray) {
      const width = 0.06 + 0.2 * Math.min(1, point.sprayWidth);
      const life = 0.55 * resistance;
      const size = 1 + 0.5 * thick;
      for (let index = 0; index < this.dropletCount; index += 1) {
        const seed = hash(index);
        const age = (time / life + seed) % 1;
        const gate =
          pulse > 0
            ? Math.sin((time - age * life) * 7 * 0.65) * 0.5 + 0.5 >
              pulse * 0.55
            : true;
        const live = hash(index + 991) < Math.min(1, point.feedFlow) && gate;
        const angle = hash(index + 17) * Math.PI * 2;
        const spread = Math.sqrt(hash(index + 53)) * width * age;
        const scale = live ? size * (1 - 0.35 * age) : 0;
        this.matrix.makeScale(scale, scale * 1.6, scale);
        this.matrix.setPosition(
          Math.cos(angle) * spread,
          -1.8 - age * 0.17,
          Math.sin(angle) * spread,
        );
        this.droplets.setMatrixAt(index, this.matrix);
      }
      this.droplets.instanceMatrix.needsUpdate = true;
    }
    if (this.sprayCone) {
      const width = 0.5 + 0.5 * Math.min(1, point.sprayWidth);
      this.sprayCone.scale.set(width, 1, width);
      const material = this.sprayCone.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = showSpray
        ? 0.04 + 0.1 * Math.min(1, point.feedFlow)
        : 0;
    }

    // Deposit, one stripe per sequence position reached so far.
    this.deposit.visible = shot.deposit !== "hidden";
    const count = shot.deposit === "full" ? direction.fluid.length : shown;
    const key = `${direction.key}:${shot.deposit}:${count}`;
    if (this.deposit.visible && key !== this.depositDrawn) {
      this.depositDrawn = key;
      this.drawDeposit(direction.fluid.slice(0, count), direction.fluid.length);
    }

    this.marker.visible = shot.marker === "narrowing";
    if (this.marker.visible) {
      const material = this.marker.material as THREE.MeshBasicMaterial;
      material.opacity = 0.65 + 0.35 * Math.sin(time * 3) ** 2;
    }
    this.place(camera, width, height, progress);
  }

  private drawDeposit(points: FluidPoint[], total: number) {
    const context = this.depositCanvas.getContext("2d");
    if (!context) return;
    const { width, height } = this.depositCanvas;
    context.clearRect(0, 0, width, height);
    const stripe = width / total;
    points.forEach((point, index) => {
      // Denser means more simulated coverage. The curve is steep so a change
      // from 0.98 to 0.68 shows; it is monotonic and illustrative, not a scale.
      const density = Math.max(0, Math.min(1, point.coverage)) ** 3;
      const x = index * stripe + stripe * 0.12;
      const w = stripe * 0.76;
      context.fillStyle = `rgba(6, 58, 56, ${0.1 + 0.8 * density})`;
      context.fillRect(x, height * 0.1, w, height * 0.8);
      context.fillStyle = `rgba(214, 255, 250, ${0.4 + 0.5 * density})`;
      const dots = Math.round(220 * density);
      for (let dot = 0; dot < dots; dot += 1) {
        const dx = hash(index * 400 + dot) * w;
        const dy = hash(index * 400 + dot + 211) * height * 0.8;
        context.fillRect(x + dx, height * 0.1 + dy, 2, 2);
      }
    });
    this.depositTexture.needsUpdate = true;
  }

  /**
   * Project each named part and place its label with a leader line. A label
   * shows while its part is near the middle of the frame, so callouts arrive
   * and leave as the camera passes, and labels on one side never overlap.
   */
  private place(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    progress: number,
  ) {
    const shot = this.direction!.shot;
    const wanted = new Set(shot.labels);
    const settled = progress > 0.2;
    const top = 52;
    this.lines.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const placed: {
      id: GroupId;
      x: number;
      y: number;
      left: boolean;
      labelY: number;
    }[] = [];
    for (const id of groupIds) {
      if (!wanted.has(id) || !settled) continue;
      const anchor = this.scratch
        .copy(this.anchors.get(id)!)
        .add(
          new THREE.Vector3(...explodeOffsets[id]).multiplyScalar(
            this.exploded[id] ?? 0,
          ),
        );
      if (id === "substrate_tray") anchor.set(0.9, -1.95, 0.35);
      const screen = anchor.project(camera);
      const x = (screen.x * 0.5 + 0.5) * width;
      const y = (-screen.y * 0.5 + 0.5) * height;
      const central =
        screen.z < 1 &&
        x > width * 0.12 &&
        x < width * 0.88 &&
        y > height * 0.1 &&
        y < height * 0.92;
      if (!central) continue;
      placed.push({ id, x, y, left: x < width / 2, labelY: y - 40 });
    }
    // Stack labels on each side so they never overlap or cover the badge.
    for (const left of [true, false]) {
      let floor = top;
      for (const item of placed
        .filter((entry) => entry.left === left)
        .sort((a, b) => a.labelY - b.labelY)) {
        item.labelY = Math.min(height - 16, Math.max(floor, item.labelY));
        floor = item.labelY + 30;
      }
    }
    const shown = new Set(placed.map((item) => item.id));
    for (const id of groupIds) {
      const label = this.labels.get(id);
      if (label && !shown.has(id)) {
        label.box.dataset.shown = "false";
        label.line.style.opacity = "0";
      }
    }
    for (const item of placed) {
      let label = this.labels.get(item.id);
      if (!label) {
        const box = document.createElement("div");
        box.className = "assembly-label";
        box.textContent = labelText[item.id];
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        this.lines.append(line);
        this.labelLayer.append(box);
        label = { box, line };
        this.labels.set(item.id, label);
      }
      // A label that would leave the frame on its side flips to the other side.
      const size = label.box.offsetWidth;
      const left = item.left
        ? item.x - 64 - size >= 8
        : item.x + 64 + size > width - 8;
      const labelX = left
        ? Math.max(size + 8, item.x - 64)
        : Math.min(width - size - 8, item.x + 64);
      label.box.dataset.shown = "true";
      label.box.style.transform = `translate(${labelX}px, ${item.labelY}px) translate(${left ? "-100%" : "0"}, -50%)`;
      label.line.setAttribute("x1", String(item.x));
      label.line.setAttribute("y1", String(item.y));
      label.line.setAttribute("x2", String(labelX));
      label.line.setAttribute("y2", String(item.labelY));
      label.line.style.opacity = "1";
    }
    const markerShown = shot.marker === "narrowing" && settled;
    if (markerShown) {
      const point = this.marker
        .getWorldPosition(new THREE.Vector3())
        .project(camera);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      this.markerLabel.style.transform = `translate(${Math.max(12, Math.min(width - 12, x))}px, ${Math.min(height - 16, y + 52)}px) translate(-50%, 0)`;
    }
    this.markerLabel.dataset.shown = String(markerShown);
  }

  dispose() {
    for (const core of this.cores) core.material.dispose();
    this.droplets.geometry.dispose();
    (this.droplets.material as THREE.Material).dispose();
    this.deposit.geometry.dispose();
    (this.deposit.material as THREE.Material).dispose();
    this.depositTexture.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.labelLayer.remove();
  }
}
