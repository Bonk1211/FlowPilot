import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ProcedureStep } from "@flowpilot/contracts";
import { cameraPresets, modelNodes } from "../prototype/model";

type Props = {
  step: ProcedureStep;
  reset: number;
  reduced: boolean;
  onFailure: () => void;
  onInteract: () => void;
};

// Code-built illustrative geometry. Stable names are shared with the 2D guide.
function assembly() {
  const group = new THREE.Group();
  const parts: [keyof typeof modelNodes, THREE.BufferGeometry, number[]][] = [
    [
      "bfs_bottle",
      new THREE.CylinderGeometry(0.55, 0.55, 1.3, 32),
      [-1.8, 1.6, 0],
    ],
    [
      "feed_tube",
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.8, 1, 0),
          new THREE.Vector3(-1.6, 0.7, 0),
          new THREE.Vector3(-0.8, 0.8, 0),
          new THREE.Vector3(0, 1.1, 0),
        ]),
        32,
        0.1,
        8,
        false,
      ),
      [0, 0, 0],
    ],
    ["dj2200_valve", new THREE.BoxGeometry(0.9, 2, 0.8), [0, 0.3, 0]],
    [
      "fluid_qd",
      new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24),
      [-0.8, 0.8, 0],
    ],
    ["nozzle", new THREE.CylinderGeometry(0.24, 0.07, 0.6, 24), [0, -0.975, 0]],
    [
      "pickup_tube",
      new THREE.CylinderGeometry(0.04, 0.04, 1, 12),
      [-1.8, 1.4, 0.4],
    ],
    ["air_cap", new THREE.TorusGeometry(0.28, 0.08, 12, 24), [0, -1.05, 0]],
    ["vision_camera", new THREE.BoxGeometry(0.65, 0.65, 0.9), [1.35, -0.3, 0]],
    ["substrate_tray", new THREE.BoxGeometry(3.7, 0.12, 2), [0, -1.75, 0]],
  ];
  for (const [id, geometry, position] of parts) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x78999f,
        metalness: 0.25,
        roughness: 0.5,
      }),
    );
    mesh.name = id;
    mesh.position.set(position[0], position[1], position[2]);
    group.add(mesh);
  }
  const airPaths: [keyof typeof modelNodes, THREE.Vector3[], number][] = [
    [
      "coaxial_air",
      [
        new THREE.Vector3(2, 1.6, 0),
        new THREE.Vector3(0.7, 0, 0),
        new THREE.Vector3(0, -1.05, 0),
      ],
      0x175b70,
    ],
    [
      "valve_air",
      [new THREE.Vector3(1.8, 2, 0), new THREE.Vector3(0, 1.2, 0)],
      0x8b5a19,
    ],
    [
      "bfs_air",
      [new THREE.Vector3(-3, 2.4, 0), new THREE.Vector3(-1.8, 2.25, 0)],
      0x78549c,
    ],
  ];
  for (const [id, points, color] of airPaths) {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        24,
        0.05,
        8,
        false,
      ),
      new THREE.MeshStandardMaterial({ color }),
    );
    tube.name = id;
    tube.userData.baseColor = color;
    group.add(tube);
  }
  const cap = group.getObjectByName("air_cap");
  if (cap) cap.rotation.x = Math.PI / 2;
  const qd = group.getObjectByName("fluid_qd");
  if (qd) qd.rotation.z = Math.PI / 2;
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x94b8c4,
      transparent: true,
      opacity: 0.25,
    }),
  );
  plume.position.set(0, -1.475, 0);
  plume.userData.baseColor = 0x94b8c4;
  group.add(plume);
  return group;
}

export default function AssemblyScene({
  step,
  reset,
  reduced,
  onFailure,
  onInteract,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    parts: THREE.Group;
    goal: THREE.Vector3;
    target: THREE.Vector3;
    moving: boolean;
    reduced: boolean;
    highlight: string;
    kind: string;
  } | null>(null);
  const callbacks = useRef({ onFailure, onInteract });
  useEffect(() => {
    callbacks.current = { onFailure, onInteract };
  }, [onFailure, onInteract]);
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      callbacks.current.onFailure();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x30404b, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    scene.add(light);
    const parts = assembly();
    scene.add(parts);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    camera.position.set(6, 4, 8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 18;
    const state = {
      camera,
      controls,
      parts,
      goal: camera.position.clone(),
      target: new THREE.Vector3(),
      moving: false,
      reduced: false,
      highlight: "",
      kind: "none",
    };
    runtime.current = state;
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
      renderer.setSize(width, height);
    });
    resize.observe(container);
    let frame = 0;
    const render = (time: number) => {
      if (state.moving) {
        camera.position.lerp(state.goal, state.reduced ? 1 : 0.1);
        controls.target.lerp(state.target, state.reduced ? 1 : 0.1);
        if (
          camera.position.distanceTo(state.goal) < 0.005 &&
          controls.target.distanceTo(state.target) < 0.005
        )
          state.moving = false;
        controls.update();
      }
      for (const part of parts.children) {
        const mesh = part as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardMaterial
        >;
        const active = part.name === state.highlight && state.kind !== "none";
        mesh.material.color.setHex(
          active
            ? state.kind === "warning"
              ? 0xf5ab5f
              : 0x5bdbc3
            : (mesh.userData.baseColor ?? 0x78999f),
        );
        mesh.material.emissive.setHex(active ? 0x245c50 : 0x000000);
        mesh.material.emissiveIntensity =
          active && !state.reduced ? 0.6 + Math.sin(time / 450) * 0.25 : 0.6;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.removeEventListener("start", interact);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      for (const part of parts.children) {
        const mesh = part as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
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
  }, [step, reset, reduced]);
  function adjust(kind: "left" | "right" | "up" | "down" | "in" | "out") {
    const current = runtime.current;
    if (!current) return;
    current.moving = false;
    callbacks.current.onInteract();
    const offset = current.camera.position.clone().sub(current.controls.target);
    if (kind === "in" || kind === "out") {
      offset.multiplyScalar(kind === "in" ? 0.85 : 1.15).clampLength(1.2, 18);
    } else if (kind === "left" || kind === "right") {
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        kind === "left" ? -0.2 : 0.2,
      );
    } else {
      const shift = kind === "up" ? 0.2 : -0.2;
      current.controls.target.y += shift;
    }
    current.camera.position.copy(current.controls.target).add(offset);
    current.controls.update();
  }
  return (
    <>
      <div
        ref={host}
        className="assembly-canvas"
        role="img"
        aria-label={`3D dispensing assembly. Highlighted part: ${modelNodes[step.model_node_id]?.label ?? "unknown"}`}
        data-node-id={step.model_node_id}
        data-camera-preset={step.camera_preset}
        data-highlighted={step.highlight !== "none"}
        data-reduced-motion={reduced}
      />
      <div className="assembly-tools" aria-label="Camera controls">
        {(["left", "right", "up", "down", "in", "out"] as const).map((kind) => (
          <button
            type="button"
            className="secondary"
            key={kind}
            onClick={() => adjust(kind)}
          >
            {kind === "in" || kind === "out"
              ? "Zoom"
              : kind === "up" || kind === "down"
                ? "Pan"
                : "Orbit"}{" "}
            {kind}
          </button>
        ))}
      </div>
    </>
  );
}
