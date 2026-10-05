import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const clamp = THREE.MathUtils.clamp;
const ease = (n: number) => {
  const t = clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ))
      return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
  textures.forEach((item) => item.dispose());
}

export function StoryScene({
  progress,
  reduced,
}: {
  progress: RefObject<number>;
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(reduced);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  useEffect(() => {
    reducedMotion.current = reduced;
  }, [reduced]);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;
    const setup = () => {
      const container = host.current!;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
      } catch {
        setStatus("fallback");
        return;
      }
      let disposed = false;
      let dirty = true;
      let previous = -1;
      let mobile = false;
      const styles = getComputedStyle(container);
      const token = (name: string) => styles.getPropertyValue(name).trim();
      const colors = {
        background: token("--surface-shell"),
        panel: token("--surface-instrument-panel"),
        teal: token("--selection-active-on-instrument"),
        tealInk: token("--text-selection"),
        paper: token("--surface-workspace"),
        ink: token("--text-primary"),
        muted: token("--text-muted"),
        line: token("--border-default"),
        metal: token("--border-on-instrument"),
        amber: token("--state-provisional-on-instrument"),
      };
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      container.append(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(colors.background);
      scene.fog = new THREE.Fog(colors.background, 23, 48);
      const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 100);
      const environment = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(renderer);
      const environmentMap = generator.fromScene(environment, 0.04);
      scene.environment = environmentMap.texture;
      environment.dispose();
      generator.dispose();
      scene.add(
        new THREE.HemisphereLight(colors.paper, colors.background, 1.7),
      );
      const key = new THREE.DirectionalLight(colors.paper, 3.2);
      key.position.set(2, 8, 7);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, {
        left: -9,
        right: 9,
        top: 9,
        bottom: -9,
        near: 0.1,
        far: 35,
      });
      key.shadow.bias = -0.0008;
      scene.add(key);
      const rim = new THREE.DirectionalLight(colors.teal, 2.4);
      rim.position.set(-6, 3, -3);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(colors.paper, 1.8);
      fill.position.set(-3, 2, 5);
      scene.add(fill);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshBasicMaterial({ color: colors.background }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.87;
      floor.receiveShadow = true;
      scene.add(floor);
      const grid = new THREE.GridHelper(26, 52, colors.tealInk, colors.metal);
      grid.position.y = -2.86;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.1;
      scene.add(grid);
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(4.8, 0.012, 6, 160),
        new THREE.MeshBasicMaterial({
          color: colors.tealInk,
          transparent: true,
          opacity: 0.4,
        }),
      );
      orbit.rotation.x = Math.PI / 2;
      orbit.position.y = -2.84;
      scene.add(orbit);
      const machine = new THREE.Group();
      scene.add(machine);
      const parts: {
        object: THREE.Object3D;
        initial: THREE.Vector3;
        direction: THREE.Vector3;
      }[] = [];
      new GLTFLoader().load(
        "/models/generic-fluid-dispenser.glb?v=s932-detail-1",
        (gltf) => {
          if (disposed) {
            disposeTree(gltf.scene);
            return;
          }
          const model =
            gltf.scene.getObjectByName("generic_fluid_dispenser") ?? gltf.scene;
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = true;
              object.receiveShadow = true;
              // The workspace model contains small fasteners; hide them on phones.
              if (mobile && /fastener|grip|thread/.test(object.name))
                object.visible = false;
            }
          });
          machine.add(model);
          model.updateMatrixWorld(true);
          model.children.forEach((object) => {
            const direction = new THREE.Box3()
              .setFromObject(object)
              .getCenter(new THREE.Vector3())
              .normalize();
            parts.push({ object, initial: object.position.clone(), direction });
          });
          dirty = true;
          setStatus("ready");
        },
        undefined,
        () => {
          if (!disposed) setStatus("fallback");
        },
      );

      // Native 3D cards use the actual workspace's paper, typography, labels and hierarchy.
      function cardTexture(
        kicker: string,
        title: string[],
        detail: string,
        kind: "event" | "plan" = "event",
      ) {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 600;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = colors.paper;
        ctx.fillRect(0, 0, 1024, 600);
        ctx.fillStyle = colors.tealInk;
        ctx.fillRect(0, 0, 1024, 9);
        ctx.fillStyle = colors.tealInk;
        ctx.font = '500 25px "IBM Plex Mono"';
        ctx.fillText(kicker, 48, 78);
        ctx.fillStyle = colors.ink;
        ctx.font = '500 62px "IBM Plex Sans"';
        title.forEach((line, i) => ctx.fillText(line, 48, 180 + i * 76));
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(48, 400);
        ctx.lineTo(976, 400);
        ctx.stroke();
        ctx.fillStyle = colors.muted;
        ctx.font = '28px "IBM Plex Sans"';
        ctx.fillText(detail, 48, 452);
        ctx.fillStyle = colors.tealInk;
        ctx.font = '24px "IBM Plex Mono"';
        ctx.fillText(
          kind === "event" ? "SOURCE LINKED   ↗" : "PROPOSED / REVIEW",
          48,
          536,
        );
        ctx.strokeStyle = colors.tealInk;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(782, 534);
        ctx.lineTo(828, 518);
        ctx.lineTo(865, 533);
        ctx.lineTo(913, 489);
        ctx.lineTo(964, 508);
        ctx.stroke();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return texture;
      }
      function plane(texture: THREE.Texture, w: number, h: number) {
        return new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
      }
      function card(event: THREE.Texture, plan: THREE.Texture) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 1.64, 0.085),
          new THREE.MeshStandardMaterial({
            color: colors.metal,
            metalness: 0.5,
            roughness: 0.3,
          }),
        );
        body.castShadow = true;
        group.add(body);
        const front = plane(event, 2.78, 1.63);
        front.position.z = 0.055;
        group.add(front);
        const next = plane(plan, 2.78, 1.63);
        next.position.z = 0.068;
        group.add(next);
        scene.add(group);
        return { group, front, next };
      }
      const cards = [
        card(
          cardTexture(
            "00:55 / CONTEXT",
            ["Material container", "changed"],
            "Operator note · context / change",
          ),
          cardTexture(
            "POSSIBLE CAUSE",
            ["Hardware &", "fluid delivery"],
            "Compare the physical evidence",
            "plan",
          ),
        ),
        card(
          cardTexture(
            "01:00 / LAST KNOWN GOOD",
            ["Coating within", "the known boundary"],
            "Inspection image · source linked",
          ),
          cardTexture(
            "POSSIBLE CAUSE",
            ["Software &", "process settings"],
            "Review the recorded parameters",
            "plan",
          ),
        ),
        card(
          cardTexture(
            "01:08 / FIRST KNOWN BAD",
            ["Coverage begins", "to fall"],
            "Inspection image · source linked",
          ),
          cardTexture(
            "NEXT USEFUL CHECK",
            ["Compare delivery", "conditions"],
            "Record what supports each cause",
            "plan",
          ),
        ),
      ];
      const rootCard = plane(
        cardTexture(
          "INVESTIGATION / START",
          ["Progressively insufficient", "flux coverage"],
          "Start with the observed symptom",
          "plan",
        ),
        2.85,
        1.67,
      );
      rootCard.position.set(0, 2.5, -0.5);
      scene.add(rootCard);
      function tube(points: number[][]) {
        const curve = new THREE.CatmullRomCurve3(
          points.map(
            (p) => new THREE.Vector3(...(p as [number, number, number])),
          ),
        );
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 80, 0.015, 6, false),
          new THREE.MeshBasicMaterial({ color: colors.teal }),
        );
        scene.add(mesh);
        return mesh;
      }
      const timeline = tube([
        [-2.8, -0.38, 0.1],
        [-1.4, -0.4, 0.25],
        [0.1, -1.05, 0.6],
        [1.6, -1.08, 0.9],
        [3, -1.75, 1.2],
      ]);
      const graph = [
        tube([
          [0, 1.65, -0.5],
          [0, 1.4, -0.5],
          [-2.35, 1.4, -0.1],
          [-2.35, 1.05, 0.1],
        ]),
        tube([
          [0, 1.65, -0.5],
          [0, 1.4, -0.5],
          [2.35, 1.4, -0.1],
          [2.35, 1.05, 0.1],
        ]),
        tube([
          [-2.35, -0.65, 0.1],
          [-2.35, -1.1, 0.25],
          [0, -1.1, 0.5],
          [0, -1.25, 0.7],
        ]),
        tube([
          [2.35, -0.65, 0.1],
          [2.35, -1.1, 0.25],
          [0, -1.1, 0.5],
          [0, -1.25, 0.7],
        ]),
      ];
      const timelinePositions = [
        new THREE.Vector3(-2.8, 0.65, 0),
        new THREE.Vector3(0.1, 0, 0.6),
        new THREE.Vector3(3, -0.65, 1.2),
      ];
      const planPositions = [
        new THREE.Vector3(-2.35, 0.25, 0.1),
        new THREE.Vector3(2.35, 0.25, 0.1),
        new THREE.Vector3(0, -1.95, 0.7),
      ];
      const report = new THREE.Group();
      scene.add(report);
      for (let i = 2; i >= 0; i--) {
        const paper = new THREE.Mesh(
          new THREE.BoxGeometry(4.05, 5.6, 0.045),
          new THREE.MeshStandardMaterial({
            color: colors.paper,
            roughness: 0.6,
            metalness: 0,
          }),
        );
        paper.position.set(-i * 0.14, i * 0.08, -i * 0.1);
        paper.rotation.z = i * 0.035;
        paper.castShadow = true;
        report.add(paper);
      }
      const reportCanvas = document.createElement("canvas");
      reportCanvas.width = 1024;
      reportCanvas.height = 1420;
      const ctx = reportCanvas.getContext("2d")!;
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, 1024, 1420);
      ctx.fillStyle = colors.tealInk;
      ctx.fillRect(0, 0, 1024, 12);
      ctx.font = '600 48px "IBM Plex Sans"';
      ctx.fillText("FLOWPILOT", 75, 118);
      ctx.fillStyle = colors.muted;
      ctx.font = '22px "IBM Plex Mono"';
      ctx.fillText("ENGINEERING ASSESSMENT", 75, 165);
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(75, 204);
      ctx.lineTo(948, 204);
      ctx.stroke();
      ctx.fillStyle = colors.ink;
      ctx.font = '600 68px "IBM Plex Sans"';
      ctx.fillText("Technical assessment", 75, 304);
      ctx.fillText("report", 75, 380);
      ctx.font = '28px "IBM Plex Sans"';
      ctx.fillText("Progressively insufficient flux coverage", 75, 445);
      ctx.fillStyle = colors.tealInk;
      ctx.font = '23px "IBM Plex Mono"';
      ctx.fillText("S932  /  DRAFT FOR REVIEW", 75, 513);
      const sections = [
        ["01", "TIMELINE OF EVENTS", "Source records. Ordered. Traceable."],
        [
          "02",
          "INVESTIGATION PLAN",
          "Possible causes and the next useful checks.",
        ],
        ["03", "ENGINEER HANDOFF", "Context, findings and open questions."],
      ];
      sections.forEach(([n, title, body], i) => {
        const y = 630 + i * 190;
        ctx.fillStyle = colors.tealInk;
        ctx.font = '28px "IBM Plex Mono"';
        ctx.fillText(n, 75, y);
        ctx.fillStyle = colors.ink;
        ctx.font = '500 28px "IBM Plex Sans"';
        ctx.fillText(title, 145, y);
        ctx.fillStyle = colors.muted;
        ctx.font = '26px "IBM Plex Sans"';
        ctx.fillText(body, 145, y + 50);
        ctx.strokeStyle = colors.line;
        ctx.beginPath();
        ctx.moveTo(145, y + 85);
        ctx.lineTo(935, y + 85);
        ctx.stroke();
      });
      ctx.fillStyle = colors.panel;
      ctx.fillRect(75, 1170, 874, 135);
      ctx.fillStyle = colors.paper;
      ctx.font = '27px "IBM Plex Sans"';
      ctx.fillText("Cause remains unconfirmed.", 107, 1222);
      ctx.fillStyle = colors.teal;
      ctx.font = '23px "IBM Plex Sans"';
      ctx.fillText("Review the evidence before the next action.", 107, 1265);
      ctx.fillStyle = colors.muted;
      ctx.font = '20px "IBM Plex Mono"';
      ctx.fillText("ILLUSTRATIVE INVESTIGATION / SOURCES RETAINED", 75, 1370);
      const reportTexture = new THREE.CanvasTexture(reportCanvas);
      reportTexture.colorSpace = THREE.SRGBColorSpace;
      reportTexture.anisotropy = 4;
      const reportFace = plane(reportTexture, 4.035, 5.59);
      reportFace.position.z = 0.04;
      report.add(reportFace);
      const particleCount = 108;
      const particles = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.024, 6, 6),
        new THREE.MeshBasicMaterial({ color: colors.teal }),
        particleCount,
      );
      scene.add(particles);
      const dummy = new THREE.Object3D();
      const point = new THREE.Vector3();
      const cameraPoints = [
        new THREE.Vector3(8, 4.6, 12.7),
        new THREE.Vector3(0.8, 2.1, 17.2),
        new THREE.Vector3(1.2, 1.4, 15.3),
        new THREE.Vector3(0.9, 1.2, 13.3),
      ];
      const look = new THREE.Vector3(0, -0.2, 0);
      function resize() {
        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;
        mobile = width <= 760;
        camera.aspect = width / height;
        camera.setViewOffset(
          width,
          height,
          mobile ? 0 : -width * 0.205,
          mobile ? height * 0.17 : 0,
          width,
          height,
        );
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        dirty = true;
      }
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      function render() {
        if (disposed || document.hidden) return;
        const scroll = clamp(progress.current, 0, 1);
        const phase = reducedMotion.current
          ? Math.round(scroll * 3)
          : scroll * 3;
        if (!dirty && Math.abs(previous - phase) < 0.00001) return;
        dirty = false;
        previous = phase;
        const index = clamp(Math.floor(phase), 0, 2);
        const blend = ease(phase - index);
        camera.position.lerpVectors(
          cameraPoints[index],
          cameraPoints[index + 1],
          blend,
        );
        camera.position.multiplyScalar(
          mobile
            ? (2.2 - ease(phase - 2) * 0.2) *
                Math.max(1, 760 / container.clientHeight)
            : Math.max(1, 1.6 / camera.aspect),
        );
        camera.lookAt(look);
        // Preserve the same foreground contrast when the phone camera pulls back.
        const fog = scene.fog as THREE.Fog;
        fog.near = camera.position.length() + 8;
        fog.far = fog.near + 25;
        const emergence = ease((phase - 0.12) / 0.83);
        const planBlend = ease((phase - 1.15) / 0.7);
        const reportBlend = ease((phase - 2.12) / 0.84);
        machine.visible = phase < 0.98;
        machine.rotation.y = -0.18 + phase * 0.7;
        machine.rotation.z = -emergence * 0.12;
        machine.scale.setScalar(1 - emergence * 0.88);
        machine.position.set(0, -emergence * 1.8, -emergence * 1.5);
        parts.forEach(({ object, initial, direction }) =>
          object.position
            .copy(initial)
            .addScaledVector(direction, ease((phase - 0.25) / 0.55) * 2.8),
        );
        cards.forEach(({ group, front, next }, i) => {
          point.copy(timelinePositions[i]).lerp(planPositions[i], planBlend);
          point.lerp(
            new THREE.Vector3((i - 1) * 0.15, -0.15, i * 0.09),
            reportBlend,
          );
          group.position.copy(point);
          group.position.y += (1 - emergence) * (-2 - i * 0.12);
          group.rotation.set(
            0.04 * (1 - planBlend),
            -0.2 * (1 - planBlend) - reportBlend * 0.25,
            (i - 1) * 0.025 * (1 - reportBlend),
          );
          group.scale.setScalar(
            Math.max(0.001, emergence * (1 - reportBlend * 0.98)),
          );
          group.visible = phase > 0.08 && reportBlend < 0.995;
          (front.material as THREE.MeshBasicMaterial).opacity = 1 - planBlend;
          (next.material as THREE.MeshBasicMaterial).opacity = planBlend;
        });
        rootCard.visible = planBlend > 0.01 && reportBlend < 0.98;
        rootCard.scale.setScalar(
          Math.max(0.001, planBlend * (1 - reportBlend)),
        );
        rootCard.rotation.y = -reportBlend * 0.5;
        timeline.visible = emergence > 0.01 && planBlend < 0.97;
        timeline.scale.setScalar(Math.max(0.001, emergence));
        (timeline.material as THREE.MeshBasicMaterial).transparent = true;
        (timeline.material as THREE.MeshBasicMaterial).opacity = 1 - planBlend;
        graph.forEach((line, i) => {
          line.visible = planBlend > 0.05 && reportBlend < 0.97;
          line.scale.setScalar(1 - reportBlend * 0.4);
          line.geometry.setDrawRange(
            0,
            Math.floor(
              clamp(planBlend * 1.4 - i * 0.12, 0, 1) *
                line.geometry.index!.count,
            ),
          );
        });
        report.visible = reportBlend > 0.005;
        report.scale.setScalar(Math.max(0.001, reportBlend));
        report.position.set(0, -0.1, 0);
        report.rotation.set(0.04, -0.24 + (1 - reportBlend) * 0.7, -0.035);
        particles.count =
          phase < 0.3
            ? Math.max(12, Math.floor(clamp(phase / 0.3, 0, 1) * particleCount))
            : particleCount;
        particles.visible = phase < 2.98;
        for (let i = 0; i < particleCount; i++) {
          const x = ((i % 12) - 5.5) * 0.24;
          const z = (Math.floor(i / 12) - 4) * 0.13;
          point
            .set(x, -1.95, z)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), machine.rotation.y);
          const cardIndex = i % 3;
          const offset = (Math.floor(i / 3) / 36 - 0.5) * 2.5;
          const destination = timelinePositions[cardIndex]
            .clone()
            .add(new THREE.Vector3(offset, -1.02, 0.07));
          point.lerp(destination, emergence);
          point.y += Math.sin(emergence * Math.PI) * (1 + (i % 7) * 0.13);
          const end = planPositions[cardIndex]
            .clone()
            .add(new THREE.Vector3(offset * 0.6, -0.88, 0));
          point.lerp(end, planBlend);
          point.lerp(
            new THREE.Vector3(
              -1.5 + (i % 18) * 0.17,
              0.65 - Math.floor(i / 18) * 0.35,
              0.07,
            ),
            reportBlend,
          );
          dummy.position.copy(point);
          dummy.scale.setScalar(1 - reportBlend * 0.9);
          dummy.updateMatrix();
          particles.setMatrixAt(i, dummy.matrix);
        }
        particles.instanceMatrix.needsUpdate = true;
        orbit.rotation.z = phase * 0.14;
        grid.rotation.y = phase * 0.025;
        renderer.render(scene, camera);
        container.dataset.renderProgress = scroll.toFixed(4);
        container.dataset.scenePhase = phase.toFixed(3);
      }
      renderer.setAnimationLoop(render);
      const visibility = () => {
        renderer.setAnimationLoop(document.hidden ? null : render);
        dirty = true;
      };
      document.addEventListener("visibilitychange", visibility);
      const contextLost = (event: Event) => {
        event.preventDefault();
        setStatus("fallback");
        renderer.setAnimationLoop(null);
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      return () => {
        disposed = true;
        renderer.setAnimationLoop(null);
        observer.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener(
          "webglcontextlost",
          contextLost,
        );
        disposeTree(scene);
        environmentMap.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };
    // Draw the UI-inspired card textures only after the actual brand fonts load.
    void document.fonts.ready.then(() => {
      if (!cancelled) teardown = setup();
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [progress]);

  return (
    <div
      ref={host}
      className="story-canvas"
      data-renderer={status}
      role="img"
      aria-label="Scroll-driven 3D story: a dispensing machine becomes connected evidence cards, a branching investigation plan, then an engineer's report."
    >
      {status === "loading" && (
        <p className="story-scene-status" role="status">
          Preparing the 3D story…
        </p>
      )}
      {status === "fallback" && (
        <div className="story-fallback">
          <ol>
            <li>
              <strong>Dispense</strong>Observe the coating.
            </li>
            <li>
              <strong>Timeline</strong>Connect the source records.
            </li>
            <li>
              <strong>Plan</strong>Compare possible causes.
            </li>
            <li>
              <strong>Report</strong>Share the investigation.
            </li>
          </ol>
          <p>3D is unavailable on this device. Scroll to explore the story.</p>
        </div>
      )}
    </div>
  );
}
