import Matter from "matter-js";
import { createCollider } from "./colliders";
import {
  initialPoses,
  isFixed,
  OBJECTS,
  type EngineOptions,
  type ObjectSpec,
  type Point,
  type Pose,
  type SceneEngine,
  type Size,
} from "./model";

const { Body, Composite, Constraint, Engine, Sleeping } = Matter;
const EDGE_PADDING = 5;
const FIXED_STEP = 1000 / 60;

function bounded(value: number, low: number, high: number): number {
  return low > high ? (low + high) / 2 : Math.max(low, Math.min(high, value));
}

/** Constrain the artwork, including the overhang of a small peg collider. */
function contain(pose: Pose, object: ObjectSpec, size: Size): Pose {
  const cos = Math.abs(Math.cos(pose.angle));
  const sin = Math.abs(Math.sin(pose.angle));
  const halfWidth = (object.width * cos + object.height * sin) / 2 + EDGE_PADDING;
  const halfHeight = (object.width * sin + object.height * cos) / 2 + EDGE_PADDING;
  return {
    ...pose,
    x: bounded(pose.x, halfWidth, size.width - halfWidth),
    y: bounded(pose.y, halfHeight, size.height - halfHeight),
  };
}

function poseOf(id: string, body: Matter.Body): Pose {
  return { id, x: body.position.x, y: body.position.y, angle: body.angle };
}

type Item = {
  object: ObjectSpec;
  body: Matter.Body;
  quietFrames: number;
};

type Drag = {
  item: Item;
  before: Pose;
  offset: Point;
  target: Point;
  constraint: Matter.Constraint | null;
};

/**
 * A renderer-independent simulation. No DOM listeners, runner, timers, or global
 * events: the view owns input and the fixed-step animation clock.
 */
export function createSceneEngine(options: EngineOptions): SceneEngine {
  let size = { ...options.size };
  let disposed = false;
  let drag: Drag | null = null;
  const apartment = options.scene === "apartment";
  const engine = Engine.create({
    enableSleeping: true,
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
  });
  const seeds = initialPoses(options.scene, size);
  function makeItem(object: ObjectSpec, index: number, poseOverride?: Pose): Item {
    const supplied = options.poses?.find((pose) => pose.id === object.id);
    const seed = seeds.find((pose) => pose.id === object.id) ?? {
      id: object.id,
      x: size.width / 2 + Math.cos(index * 2.39996) * 60,
      y: size.height / 2 + Math.sin(index * 2.39996) * 90,
      angle: 0,
    };
    // Start the poster experiment with tighter artwork overlap. Only fresh
    // seeds are compressed; switching back to a saved arrangement preserves it.
    const initial = options.scene === "clump" && options.collision === "peg"
      ? { ...seed, x: size.width / 2 + (seed.x - size.width / 2) * 0.76,
        y: size.height / 2 + (seed.y - size.height / 2) * 0.82 }
      : seed;
    const pose = contain(poseOverride ?? supplied ?? initial, object, size);
    const body = createCollider(object, pose, options.collision, isFixed(object, options.scene));
    body.frictionAir = options.reducedMotion ? 0.2 : 0.085;
    body.sleepThreshold = options.reducedMotion ? 24 : 42;
    return { object, body, quietFrames: 0 };
  }
  let items: Item[] = (options.objects ?? OBJECTS).map((object, index) => makeItem(object, index));
  const byId = new Map(items.map((item) => [item.object.id, item]));
  Composite.add(engine.world, items.map((item) => item.body));

  function wake(item: Item): void {
    item.quietFrames = 0;
    Sleeping.set(item.body, false);
  }

  function setPose(item: Item, pose: Pose): void {
    const next = contain(pose, item.object, size);
    Body.setPosition(item.body, next);
    Body.setAngle(item.body, next.angle);
    Body.setVelocity(item.body, { x: 0, y: 0 });
    Body.setAngularVelocity(item.body, 0);
    wake(item);
  }

  // Force-free resting regions make arrangements durable. There is no assigned
  // home for an object, and nothing pushes it back into its original ordering.
  function returnOffset(item: Item): Point {
    const { position } = item.body;
    if (options.scene === "structure") {
      let closest: Point = { x: 0, y: 0 };
      let smallestDistance = Infinity;
      for (const anchor of items) {
        if (!anchor.body.isStatic) continue;
        const dx = anchor.body.position.x - position.x;
        const dy = anchor.body.position.y - position.y;
        const distance = Math.hypot(dx, dy);
        // An anchor's neighborhood includes room for both artworks and a little
        // rearranging; peg mode deliberately permits the posters to overlap.
        const radius = options.collision === "peg" ? 65 : 85;
        const outside = distance - radius;
        if (outside < smallestDistance) {
          smallestDistance = outside;
          closest = outside > 2 && distance > 0
            ? { x: dx / distance * (outside + 5), y: dy / distance * (outside + 5) }
            : { x: 0, y: 0 };
        }
      }
      return closest;
    }

    const dx = position.x - size.width / 2;
    const dy = position.y - size.height / 2;
    const growth = Math.max(1, Math.sqrt(items.length / OBJECTS.length));
    const radiusX = Math.min(size.width * 0.23, 105 * growth);
    const radiusY = Math.min(size.height * 0.35, 180 * growth);
    const distance = Math.hypot(dx / radiusX, dy / radiusY);
    if (distance <= 1.025) return { x: 0, y: 0 };
    // Aim just inside the envelope, so damped motion reaches the quiet region
    // rather than applying an infinitesimal force forever at its boundary.
    const scale = 0.96 / distance;
    return { x: dx * (scale - 1), y: dy * (scale - 1) };
  }

  function keepArtworkInside(item: Item): void {
    if (item.body.isStatic) return;
    const { body, object } = item;
    const before = poseOf(object.id, body);
    const next = contain(before, object, size);
    if (next.x === before.x && next.y === before.y) return;
    const velocity = { ...body.velocity };
    Body.setPosition(body, next);
    Body.setVelocity(body, {
      x: next.x === before.x ? velocity.x : 0,
      y: next.y === before.y ? velocity.y : 0,
    });
  }

  function endDrag(cancel = false): void {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (previous.constraint) Composite.remove(engine.world, previous.constraint);
    if (cancel) setPose(previous.item, previous.before);
    else if (apartment || options.reducedMotion) {
      Body.setVelocity(previous.item.body, { x: 0, y: 0 });
      Body.setAngularVelocity(previous.item.body, 0);
    }
    wake(previous.item);
  }

  return {
    getPoses() {
      return items.map(({ object, body }) => poseOf(object.id, body));
    },

    syncObjects(objects, poses = []) {
      if (disposed) return;
      const ids = new Set(objects.map((object) => object.id));
      if (drag && !ids.has(drag.item.object.id)) endDrag(true);
      for (const item of items) {
        if (!ids.has(item.object.id)) {
          Composite.remove(engine.world, item.body);
          byId.delete(item.object.id);
        }
      }
      items = objects.map((object, index) => {
        const existing = byId.get(object.id);
        if (existing) return existing;
        const item = makeItem(object, index, poses.find((pose) => pose.id === object.id));
        byId.set(object.id, item);
        Composite.add(engine.world, item.body);
        return item;
      });
    },

    applyPoses(poses) {
      if (disposed) return;
      endDrag();
      for (const pose of poses) {
        const item = byId.get(pose.id);
        if (!item) continue;
        setPose(item, pose);
        Sleeping.set(item.body, true);
      }
    },

    step(deltaMs) {
      if (disposed || apartment) return false;
      if (deltaMs <= 0 || !Number.isFinite(deltaMs)) {
        return Boolean(drag) || items.some(({ body }) => !body.isStatic && !body.isSleeping);
      }
      const delta = Math.min(deltaMs, FIXED_STEP);
      if (drag?.constraint) {
        const point = drag.constraint.pointA;
        const dx = drag.target.x - point.x;
        const dy = drag.target.y - point.y;
        // Do not teleport the body through a whole row of neighbors on a fast
        // pointer event; the physical handle catches up within a few frames.
        const scale = Math.min(1, 26 / (Math.hypot(dx, dy) || 1));
        point.x += dx * scale;
        point.y += dy * scale;
        wake(drag.item);
      }

      const before = items.map(({ body }) => ({ ...body.position, angle: body.angle }));
      for (const item of items) {
        const { body } = item;
        if (body.isStatic || body.isSleeping || item === drag?.item) continue;
        const offset = returnOffset(item);
        if (offset.x !== 0 || offset.y !== 0) {
          const strength = options.reducedMotion ? 0.000027 : 0.000018;
          Body.applyForce(body, body.position, {
            x: offset.x * body.mass * strength,
            y: offset.y * body.mass * strength,
          });
        }
      }

      Engine.update(engine, delta);
      items.forEach((item, index) => {
        const { body } = item;
        if (body.isStatic) return;
        keepArtworkInside(item);
        const old = before[index];
        const motion = Math.hypot(body.position.x - old.x, body.position.y - old.y)
          + Math.abs(body.angle - old.angle) * 20;
        item.quietFrames = motion < 0.035 ? item.quietFrames + 1 : 0;
        // Contact can stop an outward object at the envelope. Sleeping here
        // prevents attraction into a packed neighbor from keeping RAF alive.
        if (item !== drag?.item && item.quietFrames >= 50) Sleeping.set(body, true);
      });
      return Boolean(drag) || items.some(({ body }) => !body.isStatic && !body.isSleeping);
    },

    beginDrag(id, point) {
      const item = byId.get(id);
      if (disposed || !item || item.body.isStatic) return false;
      endDrag();
      const before = poseOf(id, item.body);
      const offset = { x: point.x - before.x, y: point.y - before.y };
      const constraint = apartment ? null : Constraint.create({
        pointA: { ...point },
        bodyB: item.body,
        pointB: { ...offset },
        length: 0,
        stiffness: options.reducedMotion ? 0.5 : 0.22,
        damping: 0.15,
      });
      if (constraint) Composite.add(engine.world, constraint);
      drag = { item, before, offset, target: { ...point }, constraint };
      wake(item);
      return true;
    },

    moveDrag(point) {
      if (disposed || !drag) return;
      // Keep the handle within the stage even when pointer capture takes the
      // pointer outside it. The artwork's rotated extents get a second clamp.
      drag.target = {
        x: bounded(point.x, 0, size.width),
        y: bounded(point.y, 0, size.height),
      };
      if (apartment) {
        setPose(drag.item, {
          ...poseOf(drag.item.object.id, drag.item.body),
          x: drag.target.x - drag.offset.x,
          y: drag.target.y - drag.offset.y,
        });
      }
    },

    endDrag,

    nudge(id, dx, dy, angle = 0) {
      const item = byId.get(id);
      if (disposed || !item || item.body.isStatic) return;
      const pose = poseOf(id, item.body);
      setPose(item, { ...pose, x: pose.x + dx, y: pose.y + dy, angle: pose.angle + angle });
    },

    resize(nextSize) {
      if (disposed || nextSize.width <= 0 || nextSize.height <= 0) return;
      endDrag();
      const previousSize = size;
      size = { ...nextSize };
      for (const item of items) {
        const pose = poseOf(item.object.id, item.body);
        setPose(item, {
          ...pose,
          x: pose.x / previousSize.width * size.width,
          y: pose.y / previousSize.height * size.height,
        });
      }
    },

    getDebugShapes() {
      return items.flatMap(({ object, body }) => {
        const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
        return parts.map((part, index) => ({
          id: index === 0 ? object.id : `${object.id}-${index}`,
          vertices: part.vertices.map(({ x, y }) => ({ x, y })),
        }));
      });
    },

    dispose() {
      if (disposed) return;
      endDrag();
      disposed = true;
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
}
