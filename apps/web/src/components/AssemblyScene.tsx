import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  House,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ProcedureStep } from "@flowpilot/contracts";
import { cameraPresets, modelNodes } from "../prototype/model";

type Props = {
  step: ProcedureStep;
  reset: number;
  reduced: boolean;
  onFailure: () => void;
  onInteract: () => void;
};

type Material = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
type Runtime = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  parts: THREE.Group;
  goal: THREE.Vector3;
  target: THREE.Vector3;
  moving: boolean;
  reduced: boolean;
  highlight: string;
  kind: string;
  isolated: boolean;
};

const detailNames = [
  "fastener",
  "collar-grip",
  "knob-grip",
  "fixture-pin",
  "hose-clamp",
  "lens-detail",
  "nozzle-thread",
];

function isDetailName(name: string) {
  return detailNames.some(
    (detailName) => name === detailName || name.startsWith(`${detailName}_`),
  );
}

function materials(mesh: THREE.Mesh) {
  return (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  ) as Material[];
}

function prepareMaterials(parts: THREE.Group) {
  parts.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
    for (const material of materials(object)) {
      material.userData.baseColor = material.color.getHex();
      material.userData.baseEmissive = material.emissive?.getHex() ?? 0;
      material.userData.baseOpacity = material.opacity;
    }
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function semanticOwner(object: THREE.Object3D, root: THREE.Group) {
  let current: THREE.Object3D | null = object;
  while (current && current.parent && current.parent !== root)
    current = current.parent;
  return current?.name ?? "";
}

function dispose(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of materials(object)) material.dispose();
  });
}

export default function AssemblyScene({
  step,
  reset,
  reduced,
  onFailure,
  onInteract,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const callbacks = useRef({ onFailure, onInteract });
  const [isolated, setIsolated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const detail =
    typeof window !== "undefined" && window.innerWidth < 1024 ? "low" : "high";

  useEffect(() => {
    callbacks.current = { onFailure, onInteract };
  }, [onFailure, onInteract]);

  useEffect(() => {
    const current = runtime.current;
    if (current) current.isolated = isolated;
  }, [isolated]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      callbacks.current.onFailure();
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x10191e, 0.025);
    scene.add(new THREE.HemisphereLight(0xeaf7f5, 0x17242b, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x65c8c4, 2.1);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const fill = new THREE.PointLight(0xd8b56b, 1.2, 18);
    fill.position.set(-3, 1, 4);
    scene.add(fill);

    const groundMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.34,
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 9),
      groundMaterial,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.85;
    ground.receiveShadow = true;
    scene.add(ground);

    const empty = new THREE.Group();
    scene.add(empty);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
    camera.position.set(7.5, 4.8, 9.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.86;
    const state: Runtime = {
      camera,
      controls,
      parts: empty,
      goal: camera.position.clone(),
      target: new THREE.Vector3(),
      moving: false,
      reduced: false,
      highlight: "",
      kind: "none",
      isolated: false,
    };
    runtime.current = state;

    new GLTFLoader().load(
      "/models/generic-fluid-dispenser.glb",
      (gltf) => {
        const parts = (gltf.scene.getObjectByName("generic_fluid_dispenser") ??
          gltf.scene.children[0]) as THREE.Group | undefined;
        if (!parts || disposed) {
          if (parts) dispose(parts);
          return;
        }
        const required = [
          "bfs_bottle",
          "feed_tube",
          "dj2200_valve",
          "fluid_qd",
          "air_cap",
          "nozzle",
          "vision_camera",
          "substrate_tray",
        ];
        if (!required.every((name) => parts.getObjectByName(name))) {
          dispose(parts);
          callbacks.current.onFailure();
          return;
        }
        prepareMaterials(parts);
        if (detail === "low") {
          parts.traverse((object) => {
            if (isDetailName(object.name)) object.visible = false;
          });
        }
        scene.remove(state.parts);
        state.parts = parts;
        scene.add(parts);
        setLoaded(true);
      },
      undefined,
      () => callbacks.current.onFailure(),
    );

    const interact = () => {
      state.moving = false;
      callbacks.current.onInteract();
    };
    controls.addEventListener("start", interact);
    const contextLost = (event: Event) => {
      event.preventDefault();
      callbacks.current.onFailure();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resize.observe(container);

    let frame = 0;
    let lastRender = 0;
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (time - lastRender < 42) return;
      lastRender = time;
      if (state.moving) {
        camera.position.lerp(state.goal, state.reduced ? 1 : 0.1);
        controls.target.lerp(state.target, state.reduced ? 1 : 0.1);
        if (
          camera.position.distanceTo(state.goal) < 0.005 &&
          controls.target.distanceTo(state.target) < 0.005
        )
          state.moving = false;
      }
      state.parts.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const owner = semanticOwner(object, state.parts);
        const active = owner === state.highlight && state.kind !== "none";
        for (const material of materials(object)) {
          const baseColor =
            material.userData.baseColor ?? material.color.getHex();
          const baseEmissive = material.userData.baseEmissive ?? 0;
          const baseOpacity = material.userData.baseOpacity ?? 1;
          material.color.setHex(
            active
              ? state.kind === "warning"
                ? 0xd9963b
                : 0x40c8ba
              : baseColor,
          );
          material.emissive?.setHex(active ? 0x164c47 : baseEmissive);
          if (material.emissive) {
            material.emissiveIntensity =
              active && !state.reduced
                ? 0.52 + Math.sin(time / 500) * 0.12
                : active
                  ? 0.48
                  : 0;
          }
          const faded = state.isolated && owner && owner !== state.highlight;
          material.transparent = faded || baseOpacity < 1;
          material.opacity = faded ? Math.min(baseOpacity, 0.16) : baseOpacity;
          material.depthWrite = !faded;
        }
      });
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.removeEventListener("start", interact);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      dispose(state.parts);
      ground.geometry.dispose();
      groundMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [detail]);

  useEffect(() => {
    const current = runtime.current;
    const preset =
      cameraPresets[step.camera_preset as keyof typeof cameraPresets];
    if (!current || !preset || !modelNodes[step.model_node_id]) {
      callbacks.current.onFailure();
      return;
    }
    current.goal.fromArray(preset.position);
    current.target.fromArray(preset.target);
    current.highlight = step.model_node_id;
    current.kind = step.highlight;
    current.reduced = reduced;
    current.moving = true;
    setIsolated(false);
  }, [step, reset, reduced]);

  function adjust(kind: "left" | "right" | "up" | "down" | "in" | "out") {
    const current = runtime.current;
    if (!current) return;
    current.moving = false;
    callbacks.current.onInteract();
    const offset = current.camera.position.clone().sub(current.controls.target);
    if (kind === "in" || kind === "out") {
      offset.multiplyScalar(kind === "in" ? 0.82 : 1.18).clampLength(1.2, 20);
    } else if (kind === "left" || kind === "right") {
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        kind === "left" ? -0.2 : 0.2,
      );
    } else {
      current.controls.target.y += kind === "up" ? 0.2 : -0.2;
    }
    current.camera.position.copy(current.controls.target).add(offset);
    current.controls.update();
  }

  function overview() {
    const current = runtime.current;
    if (!current) return;
    current.goal.set(7.5, 4.8, 9.5);
    current.target.set(0, -0.15, 0);
    current.moving = true;
    setIsolated(false);
  }

  return (
    <>
      <div
        ref={host}
        className="assembly-canvas"
        role="img"
        aria-label={`Detailed generic fluid-dispenser assembly. Highlighted part: ${modelNodes[step.model_node_id]?.label ?? "unknown"}`}
        data-node-id={step.model_node_id}
        data-camera-preset={step.camera_preset}
        data-highlighted={step.highlight !== "none"}
        data-reduced-motion={reduced}
        data-model-detail={detail}
        data-model-loaded={loaded}
      />
      {!loaded && <p role="status">Loading detailed assembly…</p>}
      <div className="assembly-tools" aria-label="Camera controls">
        <button
          type="button"
          className="secondary assembly-tool-labelled"
          onClick={overview}
        >
          <House aria-hidden="true" />
          Overview
        </button>
        <button
          type="button"
          className="secondary assembly-tool-labelled"
          aria-pressed={isolated}
          onClick={() => setIsolated((value) => !value)}
        >
          <Eye aria-hidden="true" />
          {isolated ? "Show all" : "Isolate"}
        </button>
        {(
          [
            ["left", "Orbit left", ArrowLeft],
            ["right", "Orbit right", ArrowRight],
            ["up", "Pan up", ArrowUp],
            ["down", "Pan down", ArrowDown],
            ["in", "Zoom in", MagnifyingGlassPlus],
            ["out", "Zoom out", MagnifyingGlassMinus],
          ] as const
        ).map(([kind, label, Icon]) => (
          <button
            type="button"
            className="secondary assembly-tool-icon"
            key={kind}
            aria-label={label}
            title={label}
            onClick={() => adjust(kind)}
          >
            <Icon aria-hidden="true" />
          </button>
        ))}
      </div>
    </>
  );
}
