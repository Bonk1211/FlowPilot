import type { Core, NodeSingular } from "cytoscape";

/** Local springs let a dragged node pull its neighbors without rerunning the layout. */
export function attachElasticDrag(
  cy: Core,
  motion: MediaQueryList,
  onGrab: () => void,
) {
  let frame = 0;
  let previousTime = 0;
  let offset = { x: 0, y: 0 };
  let origin = { x: 0, y: 0 };
  let root: NodeSingular | null = null;
  let bodies: {
    node: NodeSingular;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weight: number;
  }[] = [];

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    bodies = [];
    root = null;
    cy.elements().removeClass("elastic-root elastic-link");
  }

  function tick(time: number) {
    frame = 0;
    const dt = Math.min(
      1 / 30,
      Math.max(1 / 240, (time - previousTime) / 1000),
    );
    previousTime = time;
    let moving = false;
    cy.batch(() => {
      for (const body of bodies) {
        if (body.node.locked() || body.node.grabbed()) continue;
        const targetX = body.x + offset.x * body.weight;
        const targetY = body.y + offset.y * body.weight;
        const point = body.node.position();
        body.vx += ((targetX - point.x) * 140 - body.vx * 14) * dt;
        body.vy += ((targetY - point.y) * 140 - body.vy * 14) * dt;
        const settled =
          Math.hypot(targetX - point.x, targetY - point.y) < 0.15 &&
          Math.hypot(body.vx, body.vy) < 0.3;
        body.node.position(
          settled
            ? { x: targetX, y: targetY }
            : { x: point.x + body.vx * dt, y: point.y + body.vy * dt },
        );
        if (settled) body.vx = body.vy = 0;
        else moving = true;
      }
    });
    if (moving) frame = window.requestAnimationFrame(tick);
    else if (!root?.grabbed()) stop();
  }

  function start() {
    if (frame || !bodies.length) return;
    previousTime = performance.now();
    frame = window.requestAnimationFrame(tick);
  }

  const grab = (event: { target: NodeSingular }) => {
    stop();
    onGrab();
    if (motion.matches) return;
    root = event.target;
    origin = { ...root.position() };
    offset = { x: 0, y: 0 };
    const neighbors = root.neighborhood().nodes().difference(root);
    const nearby = neighbors
      .neighborhood()
      .nodes()
      .difference(neighbors)
      .difference(root);
    bodies = neighbors
      .union(nearby)
      .nodes(":unlocked")
      .map((node) => ({
        node,
        ...node.position(),
        vx: 0,
        vy: 0,
        weight: neighbors.contains(node) ? 0.3 : 0.1,
      }));
    root.addClass("elastic-root");
    root.connectedEdges().addClass("elastic-link");
  };
  const drag = (event: { target: NodeSingular }) => {
    if (event.target !== root || motion.matches) return;
    offset = {
      x: root.position("x") - origin.x,
      y: root.position("y") - origin.y,
    };
    start();
  };
  const release = (event: { target: NodeSingular }) => {
    if (event.target !== root) return;
    drag(event);
    if (!bodies.length) stop();
  };
  const preferenceChanged = () => {
    if (!motion.matches) return;
    cy.batch(() => {
      for (const body of bodies) {
        if (!body.node.locked() && !body.node.grabbed())
          body.node.position({
            x: body.x + offset.x * body.weight,
            y: body.y + offset.y * body.weight,
          });
      }
    });
    stop();
  };
  cy.on("grab", "node", grab);
  cy.on("drag", "node", drag);
  cy.on("free", "node", release);
  cy.on("layoutstart", stop);
  motion.addEventListener("change", preferenceChanged);
  return () => {
    cy.off("grab", "node", grab);
    cy.off("drag", "node", drag);
    cy.off("free", "node", release);
    cy.off("layoutstart", stop);
    motion.removeEventListener("change", preferenceChanged);
    stop();
  };
}
