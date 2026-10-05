import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { ProcedureStep } from "@flowpilot/contracts";
import { cameraPresets, modelNodes } from "../prototype/model";
import {
  partAnnotations,
  coreAnnotations,
  fitCameraFov,
  sampleCamera,
  type CameraFrame,
  type GroupId,
} from "../scene/shots";
import { Stage, type SceneDirection } from "../scene/stage";

type Props = {
  step: ProcedureStep;
  reset: number;
  reduced: boolean;
  onFailure: () => void;
  onInteract: () => void;
  /** Extra parts to highlight with the step's part; defaults to that part alone. */
  highlightIds?: readonly string[];
  /**
   * Illustrative levels from 0 to 1 for named meshes, such as simulated mass
   * for the fluid core or simulated coverage for the spray cone. They are
   * shown as glow or opacity and never describe a measurement.
   */
  partStates?: Readonly<Record<string, number>>;
  /**
   * Directed mode, fixed when the scene mounts: shots move the camera, parts
   * separate and the liquid, air, spray and deposit follow `direction`.
   */
  directed?: boolean;
  direction?: SceneDirection | null;
  /** Hold the entire step still; a newly selected paused step shows its final view. */
  paused?: boolean;
  /** How far the current shot has played, from 0 to 1, reported a few times a second. */
  onShotProgress?: (progress: number) => void;
};

type Material = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
type Runtime = {
  camera: THREE.PerspectiveCamera;
  framingFov: number;
  framingSpace: number;
  controls: OrbitControls;
  parts: THREE.Group;
  goal: THREE.Vector3;
  target: THREE.Vector3;
  moving: boolean;
  reduced: boolean;
  highlight: ReadonlySet<string>;
  targets: Record<string, number>;
  shown: Record<string, number>;
  kind: string;
  isolated: boolean;
  stage: Stage | null;
  director: {
    direction: SceneDirection;
    start: number;
    from: CameraFrame | null;
    paused: boolean;
    pausedAt: number;
    elapsed: number;
    reported: number;
  } | null;
  pending: SceneDirection | null;
  playbackPaused: boolean;
  needsRender: boolean;
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

const lowLevel = new THREE.Color(0xe0a23c);
const fullLevel = new THREE.Color(0x35d6c8);

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

function startShot(state: Runtime, direction: SceneDirection) {
  const replayFrom =
    state.director?.direction.key === direction.key
      ? state.director.from
      : null;
  state.stage?.direct(direction);
  state.needsRender = true;
  const settled = state.playbackPaused || state.reduced;
  state.director = {
    direction,
    start: performance.now(),
    from: replayFrom ?? {
      position: state.camera.position.toArray() as [number, number, number],
      target: state.controls.target.toArray() as [number, number, number],
      fov: state.framingFov,
    },
    paused: settled,
    pausedAt: settled ? direction.shot.durationMs : 0,
    elapsed: settled ? direction.shot.durationMs : 0,
    reported: 0,
  };
  if (settled) {
    const frame = sampleCamera(
      direction.shot,
      direction.shot.durationMs,
      null,
      true,
    );
    state.camera.position.set(...frame.position);
    state.controls.target.set(...frame.target);
    state.framingFov = frame.fov;
    state.camera.fov = fitCameraFov(
      frame.fov,
      state.camera.aspect,
      state.framingSpace,
    );
    state.camera.updateProjectionMatrix();
    state.controls.update();
  }
}

/** The viewer took the camera: hold the shot where it is. */
function pauseShot(state: Runtime) {
  const director = state.director;
  if (!director || director.paused) return;
  director.paused = true;
  // Hold the frame actually on screen; sampling the clock here would advance
  // the flow once more after Pause while leaving the camera on the old frame.
  director.pausedAt = director.elapsed;
}

export default function AssemblyScene({
  step,
  reset,
  reduced,
  onFailure,
  onInteract,
  highlightIds,
  partStates,
  directed = false,
  direction = null,
  paused = false,
  onShotProgress,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const highlightKey = highlightIds?.join(",");
  const partStatesKey = partStates ? JSON.stringify(partStates) : undefined;
  const runtime = useRef<Runtime | null>(null);
  const callbacks = useRef({ onFailure, onInteract, onShotProgress });
  const [isolated, setIsolated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Resizing adjusts the camera; retain the scene and its active tour step.
  const [detail] = useState<"low" | "high">(() =>
    typeof window !== "undefined" && window.innerWidth < 1024 ? "low" : "high",
  );

  useEffect(() => {
    callbacks.current = { onFailure, onInteract, onShotProgress };
  }, [onFailure, onInteract, onShotProgress]);

  useEffect(() => {
    const current = runtime.current;
    if (current) {
      current.isolated = isolated;
      current.needsRender = true;
    }
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
    // Broad reflections keep machined parts readable as the camera turns.
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmrem.fromScene(environment, 0.06);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = 0.65;
    environment.dispose();
    pmrem.dispose();
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
      framingFov: camera.fov,
      framingSpace: 1,
      controls,
      parts: empty,
      goal: camera.position.clone(),
      target: new THREE.Vector3(),
      moving: false,
      reduced: false,
      highlight: new Set<string>(),
      targets: {},
      shown: {},
      kind: "none",
      isolated: false,
      stage: null,
      director: null,
      pending: null,
      playbackPaused: paused,
      needsRender: true,
    };
    runtime.current = state;
    // Development only: lets the camera work be inspected from the browser console.
    if (import.meta.env.DEV && directed)
      Object.assign(window, { __flowpilotScene: { state, renderer, scene } });

    new GLTFLoader().load(
      "/models/generic-fluid-dispenser.glb?v=s932-detail-1",
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
        if (directed) {
          state.stage = new Stage(parts, container, detail);
          if (state.pending) startShot(state, state.pending);
          state.pending = null;
        }
        setLoaded(true);
      },
      undefined,
      () => callbacks.current.onFailure(),
    );

    const interact = () => {
      state.moving = false;
      pauseShot(state);
      callbacks.current.onInteract();
    };
    controls.addEventListener("start", interact);
    const cameraChanged = () => {
      state.needsRender = true;
    };
    controls.addEventListener("change", cameraChanged);
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
      if (container.closest('[data-reference="true"]')) {
        const reserved = width < 700 ? height * 0.36 + 300 : 345;
        state.framingSpace = Math.min(1, (height - reserved) / (height * 0.72));
        camera.setViewOffset(width, height, 0, height * 0.1, width, height);
      } else {
        state.framingSpace = 1;
        camera.clearViewOffset();
      }
      camera.fov = fitCameraFov(
        state.framingFov,
        camera.aspect,
        state.framingSpace,
      );
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      state.needsRender = true;
    });
    resize.observe(container);
    if (container.closest('[data-reference="true"]'))
      container
        .closest(".guided-viewport")
        ?.querySelectorAll(".guided-console, .guided-auxiliary")
        .forEach((panel) => resize.observe(panel));

    let frame = 0;
    let lastRender = 0;
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      // The directed scene animates every frame; otherwise about 24 frames a second is enough.
      if (!state.stage?.active && time - lastRender < 42) return;
      lastRender = time;
      const director = state.director;
      if (state.stage?.active && director) {
        const elapsed = director.paused
          ? director.pausedAt
          : Math.min(
              performance.now() - director.start,
              director.direction.shot.durationMs,
            );
        director.elapsed = elapsed;
        const shot = sampleCamera(
          director.direction.shot,
          elapsed,
          director.from,
          state.reduced,
        );
        if (!director.paused) {
          camera.position.set(...shot.position);
          controls.target.set(...shot.target);
          state.framingFov = shot.fov;
          const fov = fitCameraFov(shot.fov, camera.aspect, state.framingSpace);
          if (Math.abs(camera.fov - fov) > 0.01) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
          }
        } else if (state.moving) {
          camera.position.lerp(state.goal, state.reduced ? 1 : 0.1);
          controls.target.lerp(state.target, state.reduced ? 1 : 0.1);
          if (camera.position.distanceTo(state.goal) < 0.005)
            state.moving = false;
        }
        controls.update();
        // A held step only redraws for camera interaction or another visible change.
        if (director.paused && !state.needsRender) return;
        state.needsRender = false;
        camera.updateMatrixWorld(true);
        // Camera, flow, spray and marker share the step clock and freeze together.
        state.stage.update(
          state.reduced
            ? 1.3
            : Math.min(elapsed, director.direction.shot.durationMs) / 1000,
          shot.progress,
          camera,
          container.clientWidth,
          container.clientHeight,
          state.isolated ? state.highlight : null,
        );
        if (
          director.reported >= 0 &&
          (time - director.reported > 120 || shot.progress === 1)
        ) {
          director.reported = shot.progress === 1 ? -1 : time;
          callbacks.current.onShotProgress?.(shot.progress);
        }
        if (shot.progress === 1) {
          director.paused = true;
          director.pausedAt = director.direction.shot.durationMs;
        }
        renderer.render(scene, camera);
        return;
      }
      if (state.moving) {
        camera.position.lerp(state.goal, state.reduced ? 1 : 0.1);
        controls.target.lerp(state.target, state.reduced ? 1 : 0.1);
        if (
          camera.position.distanceTo(state.goal) < 0.005 &&
          controls.target.distanceTo(state.target) < 0.005
        )
          state.moving = false;
      }
      for (const name of Object.keys(state.shown))
        if (!(name in state.targets)) delete state.shown[name];
      for (const [name, target] of Object.entries(state.targets)) {
        const shown = state.shown[name] ?? target;
        state.shown[name] = state.reduced
          ? target
          : shown + (target - shown) * 0.25;
      }
      state.parts.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.name === "spray-cone") {
          const width = 0.5 + 0.5 * (state.shown[object.name] ?? 1);
          object.scale.set(width, 1, width);
        }
        const owner = semanticOwner(object, state.parts);
        const active =
          !!owner && state.highlight.has(owner) && state.kind !== "none";
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
          const faded = state.isolated && owner && !state.highlight.has(owner);
          const transparent = !!faded || baseOpacity < 1;
          // Opaque materials compile alpha out, so a switch needs a (cached) recompile.
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
          material.opacity = faded ? Math.min(baseOpacity, 0.16) : baseOpacity;
          material.depthWrite = !faded;
          const level = state.shown[object.name] ?? state.shown[owner];
          if (level !== undefined && !faded) {
            if (object.name === "spray-cone") {
              material.transparent = true;
              material.opacity = Math.min(1, 0.05 + 0.75 * level);
            } else if (material.emissive) {
              // Full levels glow teal; low levels dim toward amber.
              material.emissive.copy(lowLevel).lerp(fullLevel, level);
              // A large surface needs a gentler glow than a thin line.
              material.emissiveIntensity =
                owner === "substrate_tray"
                  ? 0.05 + 0.55 * level
                  : 0.2 + 1.4 * level;
            }
          }
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
      controls.removeEventListener("change", cameraChanged);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      state.stage?.dispose();
      dispose(state.parts);
      ground.geometry.dispose();
      groundMaterial.dispose();
      environmentMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
    // `directed` is fixed for the scene's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  useEffect(() => {
    const current = runtime.current;
    const preset =
      cameraPresets[step.camera_preset as keyof typeof cameraPresets];
    if (!current || !preset || !modelNodes[step.model_node_id]) {
      callbacks.current.onFailure();
      return;
    }
    if (!current.stage) {
      current.goal.fromArray(preset.position);
      current.target.fromArray(preset.target);
    }
    current.highlight = new Set(
      highlightKey ? highlightKey.split(",") : [step.model_node_id],
    );
    current.kind = step.highlight;
    current.reduced = reduced;
    current.moving = !directed;
    if (reduced && current.director)
      startShot(current, current.director.direction);
    setIsolated(false);
  }, [step, reset, reduced, highlightKey, directed]);

  // A new step starts its shot; Reset view (reset) replays it from the current framing.
  const directionKey = direction?.key;
  useEffect(() => {
    const current = runtime.current;
    if (!current || !direction) return;
    current.playbackPaused = paused;
    if (current.stage) startShot(current, direction);
    else current.pending = direction;
    // The key stands in for the direction, which is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionKey, reset]);

  useLayoutEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.playbackPaused = paused;
    const director = current.director;
    if (!director) return;
    if (paused) pauseShot(current);
    else if (director.paused) {
      director.start = performance.now() - director.pausedAt;
      director.paused = false;
    }
  }, [paused]);

  useEffect(() => {
    const current = runtime.current;
    if (current) current.targets = partStates ? { ...partStates } : {};
    // The key stands in for the object, which is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partStatesKey]);

  function adjust(kind: "left" | "right" | "up" | "down" | "in" | "out") {
    const current = runtime.current;
    if (!current) return;
    current.moving = false;
    pauseShot(current);
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
    if (current.director) {
      pauseShot(current);
      callbacks.current.onInteract();
    }
    setIsolated(false);
  }

  return (
    <>
      <div
        ref={host}
        className="assembly-canvas"
        role="img"
        aria-label={`Detailed generic fluid-dispenser assembly. Highlighted ${highlightIds && highlightIds.length > 1 ? "parts" : "part"}: ${
          (highlightIds ?? [step.model_node_id])
            .map(
              (id) =>
                partAnnotations[id as GroupId]?.text ??
                modelNodes[id as keyof typeof modelNodes]?.label,
            )
            .filter(Boolean)
            .join(", ") || "unknown"
        }.${direction?.shot.coreLabels?.length ? ` Internal parts: ${direction.shot.coreLabels.map((id) => coreAnnotations[id].text).join(", ")}.` : ""}${partStatesKey ? " Glow and spray levels are simulated and illustrative, not measured." : ""}`}
        data-node-id={step.model_node_id}
        data-highlight-ids={highlightKey}
        data-part-states={partStatesKey}
        data-camera-preset={step.camera_preset}
        data-highlighted={step.highlight !== "none"}
        data-reduced-motion={reduced}
        data-model-detail={detail}
        data-model-loaded={loaded}
        data-shot={direction?.shot.id}
        data-condition={direction?.condition}
        data-paused={paused}
      />
      {!loaded && <p role="status">Loading detailed assembly…</p>}
      <div
        className="assembly-tools assembly-camera-tools"
        aria-label="Camera controls"
      >
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
