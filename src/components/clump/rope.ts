import Matter from "matter-js";
import type { Point, Rect, Size } from "./model";

const { Bodies, Body, Constraint, Sleeping } = Matter;

const ITEM = 0x0001;
const ROPE = 0x0002;
const LASSOED = 0x0004;
const SPACING = 12;
const MAX_LINKS = 200;
const RADIUS = 4;
const CINCH_RATE = 0.1;
/** The shortest the rope's rest length gets relative to its current length. */
const MAX_STRETCH = 0.8;
/** How close the rope's length must come to the group's hull to count as wrapped. */
const WRAPPED = 1.05;
/** A straight run of rope under tension has no reason to move inward; this draws it toward the group. */
const PULL = 5e-5;
/** Rectangles pack loosely; the rope aims a little inside their ideal circle. */
const PACKING = 0.6;
const SQUEEZE = 0.95;
const KNOT = 28;

export type Rope = {
  bodies: Matter.Body[];
  links: Matter.Constraint[];
  rest: number[];
  /** The rope's length when tied, the sum of `rest`. */
  length: number;
  captured: Matter.Body[];
  /** Where an empty lasso cinches to. */
  knot: Point;
  slack: number;
  /** The slack the rope is currently cinching toward. */
  target: number;
  goal: number;
  /** The length of rope that just wraps the captured bodies. */
  hull: number;
  /** The slack at which the rope just wraps the captured bodies; it goes no tighter while they are pinned. */
  taut: number;
  /**
   * Matter separates overlaps without regard to mass, so the first side of the
   * rope to arrive would shove the whole group. Like friction on a floor, the
   * captured bodies stay put until the rope reaches all the way around.
   */
  pinned: boolean;
  quietFrames: number;
  asleep: boolean;
};

function outline(rect: Rect, spacing: number): Point[] {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return corners.flatMap((from, index) => {
    const to = corners[(index + 1) % corners.length];
    const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / spacing));
    return Array.from({ length: steps }, (_, step) => ({
      x: from.x + (to.x - from.x) * step / steps,
      y: from.y + (to.y - from.y) * step / steps,
    }));
  });
}

/** The length of rope that just wraps the bodies. */
function hullLength(bodies: readonly Matter.Body[]): number {
  if (bodies.length === 0) return 0;
  const hull = convexHull(bodies.flatMap((body) => body.vertices));
  const edges = hull.reduce((sum, point, index) => {
    const next = hull[(index + 1) % hull.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
  return edges + 2 * Math.PI * RADIUS;
}

/** Andrew's monotone chain. */
function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (list: readonly Point[]) => list.reduce<Point[]>((hull, point) => {
    while (hull.length >= 2 && turn(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
    return hull;
  }, []).slice(0, -1);
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

function pin(rope: Rope, pinned: boolean): void {
  if (rope.pinned === pinned) return;
  rope.pinned = pinned;
  for (const body of rope.captured) {
    Sleeping.set(body, false);
    Body.setStatic(body, pinned);
  }
}

export function tieRope(selection: Rect, captured: Matter.Body[]): Rope {
  // Things are captured by their centers, so a rope tied along the selection
  // could cut through one straddling its edge; it starts outside all of them.
  const rect = captured.reduce((box, { bounds }) => {
    const x = Math.min(box.x, bounds.min.x - RADIUS);
    const y = Math.min(box.y, bounds.min.y - RADIUS);
    return {
      x,
      y,
      width: Math.max(box.x + box.width, bounds.max.x + RADIUS) - x,
      height: Math.max(box.y + box.height, bounds.max.y + RADIUS) - y,
    };
  }, selection);
  const length = 2 * (rect.width + rect.height);
  const points = outline(rect, Math.max(SPACING, length / MAX_LINKS));
  const group = Body.nextGroup(true);
  const bodies = points.map((point) => Bodies.circle(point.x, point.y, RADIUS, {
    collisionFilter: { group, category: ROPE, mask: LASSOED },
    density: 0.02,
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0.18,
    restitution: 0,
    inertia: Infinity,
    sleepThreshold: Infinity,
  }));
  const rest = bodies.map((body, index) => {
    const next = bodies[(index + 1) % bodies.length];
    return Math.hypot(next.position.x - body.position.x, next.position.y - body.position.y);
  });
  const links = bodies.map((body, index) => Constraint.create({
    bodyA: body,
    bodyB: bodies[(index + 1) % bodies.length],
    length: rest[index],
    stiffness: 0.8,
    damping: 0.05,
  }));
  // Only captured bodies collide with the rope, so it slides past everything else.
  for (const body of captured) body.collisionFilter.category = ITEM | LASSOED;
  const area = captured.reduce((sum, body) => sum + body.area, 0);
  const target = area > 0 ? 2 * Math.sqrt(Math.PI * area / PACKING) * SQUEEZE : KNOT;
  const hull = hullLength(captured);
  const rope: Rope = {
    bodies,
    links,
    rest,
    length,
    captured,
    knot: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    slack: 1,
    target: 1,
    goal: Math.min(1, target / length),
    hull,
    taut: Math.min(1, hull / length),
    pinned: false,
    quietFrames: 0,
    asleep: false,
  };
  pin(rope, true);
  return rope;
}

export function untieRope(rope: Rope): void {
  pin(rope, false);
  for (const body of rope.captured) {
    body.collisionFilter.category = ITEM;
    Sleeping.set(body, false);
  }
}

export function isCinching(rope: Rope): boolean {
  return Math.abs(rope.slack - rope.target) > 0.002;
}

/** Shortens every link toward the goal before the engine solves constraints. */
export function cinch(rope: Rope): void {
  if (rope.asleep && rope.bodies.some((body) => !body.isSleeping)) {
    rope.asleep = false;
    rope.quietFrames = 0;
    for (const body of rope.bodies) Sleeping.set(body, false);
  }
  if (rope.asleep) return;
  const length = perimeter(rope.bodies);
  // Bounding the stretch bounds the tension, so the rope can't slice through a thing.
  const target = Math.max(rope.goal, rope.captured.length > 0 ? length * MAX_STRETCH / rope.length : 0, rope.pinned ? rope.taut : 0);
  rope.target = target;
  rope.slack += (target - rope.slack) * CINCH_RATE;
  rope.links.forEach((link, index) => { link.length = rope.rest[index] * rope.slack; });
  // Gather slack toward the group's outline; once touching, tension does the squeezing.
  const group = rope.captured.length > 0 ? convexHull(rope.captured.flatMap((body) => body.vertices)) : [rope.knot];
  for (const body of rope.bodies) {
    if (loopEncloses(group, body.position)) continue;
    const { at, distance } = nearestOnLoop(group, body.position);
    if (distance <= RADIUS * 2) continue;
    Body.applyForce(body, body.position, {
      x: (at.x - body.position.x) * body.mass * PULL,
      y: (at.y - body.position.y) * body.mass * PULL,
    });
  }
  if (rope.pinned && (length <= rope.hull * WRAPPED || Math.abs(rope.slack - target) < 0.002)) pin(rope, false);
}

function perimeter(bodies: readonly Matter.Body[]): number {
  return bodies.reduce((sum, { position }, index) => {
    const next = bodies[(index + 1) % bodies.length].position;
    return sum + Math.hypot(next.x - position.x, next.y - position.y);
  }, 0);
}

/** Keeps the rope on stage and sleeps it as one piece. Returns true while it moves. */
export function settle(rope: Rope, size: Size, before: readonly Point[]): boolean {
  if (rope.asleep) return false;
  let motion = 0;
  rope.bodies.forEach((body, index) => {
    const x = Math.max(RADIUS, Math.min(size.width - RADIUS, body.position.x));
    const y = Math.max(RADIUS, Math.min(size.height - RADIUS, body.position.y));
    if (x !== body.position.x || y !== body.position.y) Body.setPosition(body, { x, y });
    motion = Math.max(motion, Math.hypot(x - before[index].x, y - before[index].y));
  });
  rope.quietFrames = motion < 0.05 && !isCinching(rope) ? rope.quietFrames + 1 : 0;
  if (rope.quietFrames < 30) return true;
  rope.asleep = true;
  for (const body of rope.bodies) Sleeping.set(body, true);
  return false;
}

/** An empty lasso cinches into a knot and then lets go. */
export function isSpent(rope: Rope): boolean {
  return rope.asleep && rope.captured.length === 0;
}

function nearestOnLoop(loop: readonly Point[], point: Point): { at: Point; distance: number } {
  return loop.reduce((nearest, a, index) => {
    const b = loop[(index + 1) % loop.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const along = dx || dy ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
    const at = { x: a.x + dx * along, y: a.y + dy * along };
    const distance = Math.hypot(point.x - at.x, point.y - at.y);
    return distance < nearest.distance ? { at, distance } : nearest;
  }, { at: point, distance: Infinity });
}

function loopEncloses(loop: readonly Point[], point: Point): boolean {
  let inside = false;
  loop.forEach((a, index) => {
    const b = loop[(index + 1) % loop.length];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + (point.y - a.y) / (b.y - a.y) * (b.x - a.x)) inside = !inside;
  });
  return inside;
}

function outlineOf(rope: Rope): Point[] {
  return rope.bodies.map(({ position }) => position);
}

export function distanceToRope(rope: Rope, point: Point): number {
  return nearestOnLoop(outlineOf(rope), point).distance;
}

/** Limits a shift so the whole rope stays on stage. */
function onStage(rope: Rope, delta: Point, size: Size): Point {
  const xs = rope.bodies.map(({ position }) => position.x);
  const ys = rope.bodies.map(({ position }) => position.y);
  return {
    x: Math.max(RADIUS - Math.min(...xs), Math.min(size.width - RADIUS - Math.max(...xs), delta.x)),
    y: Math.max(RADIUS - Math.min(...ys), Math.min(size.height - RADIUS - Math.max(...ys), delta.y)),
  };
}

function shift(rope: Rope, bodies: readonly Matter.Body[], delta: Point): void {
  rope.asleep = false;
  rope.quietFrames = 0;
  for (const body of bodies) {
    Sleeping.set(body, false);
    Body.setPosition(body, { x: body.position.x + delta.x, y: body.position.y + delta.y });
  }
}

/** Carries the rope and everything in it, keeping the rope on stage. Returns the distance moved. */
export function haulRope(rope: Rope, delta: Point, size: Size): Point {
  const moved = onStage(rope, delta, size);
  pin(rope, false);
  shift(rope, [...rope.bodies, ...rope.captured], moved);
  return moved;
}

/**
 * A soft chain stretches around a body pushed into it and lets it slip out.
 * The loop holds instead: pressing against it from inside tows the rope and
 * the rest of the group along. Returns true while towing.
 */
export function holdInside(rope: Rope, body: Matter.Body, size: Size): boolean {
  if (!rope.captured.includes(body)) return false;
  const outline = outlineOf(rope);
  const { at, distance } = nearestOnLoop(outline, body.position);
  if (distance === 0) return false;
  const inset = Math.min(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2 + RADIUS;
  const inside = loopEncloses(outline, body.position);
  if (inside && distance >= inset) return false;
  const outward = inside
    ? { x: (at.x - body.position.x) / distance, y: (at.y - body.position.y) / distance }
    : { x: (body.position.x - at.x) / distance, y: (body.position.y - at.y) / distance };
  const amount = inside ? inset - distance : distance + inset;
  const towed = [...rope.bodies, ...rope.captured.filter((other) => other !== body)];
  shift(rope, towed, onStage(rope, { x: outward.x * amount, y: outward.y * amount }, size));
  return true;
}

export function flingRope(rope: Rope, velocity: Point): void {
  for (const body of [...rope.bodies, ...rope.captured]) Body.setVelocity(body, velocity);
}
