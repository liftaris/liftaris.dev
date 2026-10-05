import { spawnPoint } from '../../lib/things/model';
import Matter from "matter-js";
import { createCollider } from "./colliders";
import {
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

/** Constrain the artwork, including the overhang beyond its collider. */
function contain(pose: Pose, object: ObjectSpec, size: Size): Pose {
  const halfWidth = object.width / 2 + EDGE_PADDING;
  const halfHeight = object.height / 2 + EDGE_PADDING;
  return {
    ...pose,
    angle: 0,
    x: bounded(pose.x, halfWidth, size.width - halfWidth),
    y: bounded(pose.y, halfHeight, size.height - halfHeight - 22),
  };
}

function poseOf(id: string, body: Matter.Body): Pose {
  return { id, x: body.position.x, y: body.position.y, angle: 0 };
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
  const layoutEditing = options.layoutEditing;
  const engine = Engine.create({
    enableSleeping: true,
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
  });
  function makeItem(object: ObjectSpec, index: number, poseOverride?: Pose): Item {
    const seed = {
      id: object.id,
      x: size.width / 2 + Math.cos(index * 2.39996) * 60,
      y: size.height / 2 + Math.sin(index * 2.39996) * 90,
      angle: 0,
    };
    const authored = object.spawn_x !== undefined && object.spawn_y !== undefined
      ? {id:object.id,angle:0,...spawnPoint({width:object.width,height:object.height,spawn_x:object.spawn_x,spawn_y:object.spawn_y},size)} : undefined;
    const pose = contain(poseOverride ?? authored ?? seed, object, size);
    const body = createCollider(object, pose);
    body.frictionAir = options.reducedMotion ? 0.25 : 0.12;
    body.sleepThreshold = options.reducedMotion ? 24 : 40;
    return { object, body, quietFrames: 0 };
  }
  let items: Item[] = options.objects.map((object, index) => makeItem(object, index));
  const byId = new Map(items.map((item) => [item.object.id, item]));
  Composite.add(engine.world, items.map((item) => item.body));

  function wake(item: Item): void {
    item.quietFrames = 0;
    Sleeping.set(item.body, false);
  }

  function setPose(item: Item, pose: Pose): void {
    const next = contain(pose, item.object, size);
    Body.setPosition(item.body, next);
    Body.setAngle(item.body, 0);
    Body.setVelocity(item.body, { x: 0, y: 0 });
    Body.setAngularVelocity(item.body, 0);
    wake(item);
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
    else if (layoutEditing || options.reducedMotion) {
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
        if (existing && existing.object.width === object.width && existing.object.height === object.height) {
          existing.object = object;
          const pose = poses.find(p=>p.id===object.id);
          if(pose && !drag) setPose(existing,pose);
          return existing;
        }
        const previous = existing ? poseOf(object.id,existing.body) : undefined;
        if(existing) { if(drag?.item===existing)endDrag(true); Composite.remove(engine.world,existing.body); }

        const item = makeItem(object, index, poses.find((pose) => pose.id === object.id) ?? previous);
        byId.set(object.id, item);
        Composite.add(engine.world, item.body);
        return item;
      });
    },

    step(deltaMs) {
      if (disposed || layoutEditing) return false;
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

      const before = items.map(({ body }) => ({ ...body.position }));
      Engine.update(engine, delta);
      items.forEach((item, index) => {
        const { body } = item;
        if (body.isStatic) return;
        Body.setAngle(body, 0);
        Body.setAngularVelocity(body, 0);
        keepArtworkInside(item);
        const old = before[index];
        const motion = Math.hypot(body.position.x - old.x, body.position.y - old.y);
        item.quietFrames = motion < 0.035 ? item.quietFrames + 1 : 0;
        // Contact can stop an outward object at the envelope. Sleeping here
        // prevents attraction into a packed neighbor from keeping RAF alive.
        if (item !== drag?.item && item.quietFrames >= 40) Sleeping.set(body, true);
      });
      return Boolean(drag) || items.some(({ body }) => !body.isStatic && !body.isSleeping);
    },

    beginDrag(id, point) {
      const item = byId.get(id);
      if (disposed || !item || item.body.isStatic) return false;
      endDrag();
      const before = poseOf(id, item.body);
      const offset = { x: point.x - before.x, y: point.y - before.y };
      const constraint = layoutEditing ? null : Constraint.create({
        pointA: { ...point },
        bodyB: item.body,
        pointB: { ...offset },
        length: 0,
        stiffness: options.reducedMotion ? 0.6 : 0.35,
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
      // pointer outside it. The artwork's extents get a second clamp.
      drag.target = {
        x: bounded(point.x, 0, size.width),
        y: bounded(point.y, 0, size.height),
      };
      if (layoutEditing) {
        setPose(drag.item, {
          ...poseOf(drag.item.object.id, drag.item.body),
          x: drag.target.x - drag.offset.x,
          y: drag.target.y - drag.offset.y,
        });
      }
    },

    endDrag,

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

    dispose() {
      if (disposed) return;
      endDrag();
      disposed = true;
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
}
