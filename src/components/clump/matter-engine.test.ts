import { describe, expect, test } from "bun:test";
import { createSceneEngine } from "./matter-engine";
import { initialPoses, OBJECTS, type CollisionMode, type Pose, type SceneEngine } from "./model";

const STEP = 1000 / 60;
const SIZE = { width: 360, height: 320 };

function advance(engine: SceneEngine, frames: number): void {
  for (let frame = 0; frame < frames; frame++) engine.step(STEP);
}

function settle(engine: SceneEngine, limit = 1500): number {
  for (let frame = 0; frame < limit; frame++) {
    if (!engine.step(STEP)) return frame;
  }
  throw new Error(`Simulation did not settle within ${limit} frames`);
}

function pose(engine: SceneEngine, id: string): Pose {
  return engine.getPoses().find((item) => item.id === id)!;
}

describe("Matter scene interaction", () => {
  for (const collision of ["outline", "peg"] as const) {
    test(`${collision}: initial scenes stop requesting animation frames`, () => {
      for (const scene of ["clump", "structure"] as const) {
        const engine = createSceneEngine({ scene, collision, size: SIZE });
        try {
          settle(engine);
          const resting = engine.getPoses();
          expect(engine.step(STEP)).toBe(false);
          expect(engine.getPoses()).toEqual(resting);
        } finally {
          engine.dispose();
        }
      }
    });

    test(`${collision}: a released stray returns on its new side of the clump`, () => {
      const size = { width: 600, height: 400 };
      const engine = createSceneEngine({ scene: "clump", collision, size });
      try {
        settle(engine);
        const original = pose(engine, "octopus");
        expect(engine.beginDrag(original.id, original)).toBe(true);
        engine.moveDrag({ x: 550, y: 220 });
        advance(engine, 100);
        const released = pose(engine, "octopus");
        expect(released.x).toBeGreaterThan(520);
        engine.endDrag();
        settle(engine);
        const resting = pose(engine, "octopus");
        expect(resting.x).toBeLessThan(released.x - 70);
        expect(resting.x).toBeGreaterThan(size.width / 2);
        expect(Math.hypot(resting.x - original.x, resting.y - original.y)).toBeGreaterThan(50);
      } finally {
        engine.dispose();
      }
    });

    test(`${collision}: an off-center handle rotates the body`, () => {
      const engine = createSceneEngine({ scene: "clump", collision, size: SIZE });
      try {
        settle(engine);
        const original = pose(engine, "cloud");
        engine.beginDrag(original.id, { x: original.x + 22, y: original.y });
        engine.moveDrag({ x: original.x + 20, y: original.y + 110 });
        advance(engine, 50);
        expect(Math.abs(pose(engine, original.id).angle - original.angle)).toBeGreaterThan(0.2);
      } finally {
        engine.dispose();
      }
    });

    test(`${collision}: keyboard rotation during a center grab survives release`, () => {
      const engine = createSceneEngine({ scene: "clump", collision, size: SIZE });
      try {
        settle(engine);
        const original = pose(engine, "cloud");
        engine.beginDrag(original.id, original);
        for (let press = 0; press < 3; press++) {
          engine.nudge(original.id, 0, 0, Math.PI / 12);
          advance(engine, 10);
        }
        const heldAngle = pose(engine, original.id).angle;
        expect(heldAngle - original.angle).toBeGreaterThan(0.6);
        engine.endDrag();
        settle(engine);
        expect(pose(engine, original.id).angle).toBeCloseTo(heldAngle, 2);
      } finally {
        engine.dispose();
      }
    });

    test(`${collision}: rotated artwork stays inside the stage, including peg overhang`, () => {
      const engine = createSceneEngine({ scene: "clump", collision, size: SIZE });
      try {
        engine.nudge("bike", 800, 800, Math.PI / 4);
        const bicycle = pose(engine, "bike");
        engine.beginDrag("bike", bicycle);
        engine.moveDrag({ x: 800, y: -800 });
        for (let frame = 0; frame < 120; frame++) {
          engine.step(STEP);
          for (const current of engine.getPoses()) {
            const object = OBJECTS.find((item) => item.id === current.id)!;
            const cos = Math.abs(Math.cos(current.angle));
            const sin = Math.abs(Math.sin(current.angle));
            const halfWidth = (object.width * cos + object.height * sin) / 2;
            const halfHeight = (object.width * sin + object.height * cos) / 2;
            expect(current.x - halfWidth).toBeGreaterThanOrEqual(4.99);
            expect(current.y - halfHeight).toBeGreaterThanOrEqual(4.99);
            expect(current.x + halfWidth).toBeLessThanOrEqual(SIZE.width - 4.99);
            expect(current.y + halfHeight).toBeLessThanOrEqual(SIZE.height - 4.99);
          }
        }
      } finally {
        engine.dispose();
      }
    });
  }

  test("structure anchors cannot move or rotate and retain their relative position on resize", () => {
    const engine = createSceneEngine({ scene: "structure", collision: "outline", size: SIZE });
    try {
      const anchors = engine.getPoses().filter((item) => OBJECTS.find((object) => object.id === item.id)?.anchor);
      for (const anchor of anchors) {
        expect(engine.beginDrag(anchor.id, anchor)).toBe(false);
        engine.nudge(anchor.id, 50, 80, 1);
      }
      settle(engine);
      for (const anchor of anchors) expect(pose(engine, anchor.id)).toEqual(anchor);
      engine.resize({ width: 720, height: 640 });
      for (const anchor of anchors) {
        expect(pose(engine, anchor.id)).toEqual({ ...anchor, x: anchor.x * 2, y: anchor.y * 2 });
      }
    } finally {
      engine.dispose();
    }
  });

  test("cancel restores the picked pose and releases the drag constraint", () => {
    const engine = createSceneEngine({ scene: "clump", collision: "peg", size: SIZE });
    try {
      settle(engine);
      const before = pose(engine, "bike");
      engine.beginDrag(before.id, { x: before.x + 20, y: before.y });
      engine.moveDrag({ x: 60, y: 270 });
      advance(engine, 60);
      expect(pose(engine, before.id).x).not.toBeCloseTo(before.x);
      engine.endDrag(true);
      const restored = pose(engine, before.id);
      expect(restored.x).toBeCloseTo(before.x, 10);
      expect(restored.y).toBeCloseTo(before.y, 10);
      expect(restored.angle).toBeCloseTo(before.angle, 10);
      settle(engine);
    } finally {
      engine.dispose();
    }
  });

  test("a sleeping scene wakes when an item is nudged", () => {
    const engine = createSceneEngine({ scene: "clump", collision: "outline", size: SIZE });
    try {
      settle(engine);
      engine.nudge("cloud", 90, 0);
      expect(engine.step(STEP)).toBe(true);
      settle(engine);
    } finally {
      engine.dispose();
    }
  });

  test("debug shapes match the active collider instead of the graphic footprint", () => {
    const engines = (["outline", "peg"] as CollisionMode[]).map((collision) =>
      createSceneEngine({ scene: "apartment", collision, size: SIZE }),
    );
    try {
      const width = (engine: SceneEngine) => {
        const vertices = engine.getDebugShapes().find((shape) => shape.id.startsWith("computer"))!.vertices;
        return Math.max(...vertices.map(({ x }) => x)) - Math.min(...vertices.map(({ x }) => x));
      };
      expect(width(engines[1])).toBeLessThan(width(engines[0]) * 0.6);
    } finally {
      engines.forEach((engine) => engine.dispose());
    }
  });

  test("dispose is idempotent and stops the simulation", () => {
    const engine = createSceneEngine({ scene: "clump", collision: "outline", size: SIZE });
    engine.beginDrag("octopus", pose(engine, "octopus"));
    engine.dispose();
    engine.dispose();
    expect(engine.step(STEP)).toBe(false);
    expect(engine.beginDrag("octopus", { x: 0, y: 0 })).toBe(false);
  });
});

describe("apartment direct manipulation", () => {
  test("drop preserves the exact position and rotation without moving neighbors", () => {
    const engine = createSceneEngine({ scene: "apartment", collision: "outline", size: SIZE });
    try {
      const original = engine.getPoses();
      engine.nudge("octopus", 0, 0, 0.7);
      const beforeDrag = pose(engine, "octopus");
      engine.beginDrag("octopus", { x: beforeDrag.x + 10, y: beforeDrag.y + 5 });
      engine.moveDrag({ x: 210, y: 195 });
      engine.endDrag();
      const dropped = pose(engine, "octopus");
      expect(dropped.x).toBe(200);
      expect(dropped.y).toBe(190);
      expect(dropped.angle).toBe(beforeDrag.angle);
      advance(engine, 1200);
      expect(pose(engine, "octopus")).toEqual(dropped);
      expect(engine.getPoses().slice(1)).toEqual(original.slice(1));
      expect(engine.step(STEP)).toBe(false);
    } finally {
      engine.dispose();
    }
  });

  test("cancel restores a directly positioned item", () => {
    const engine = createSceneEngine({ scene: "apartment", collision: "peg", size: SIZE });
    try {
      const original = pose(engine, "octopus");
      engine.beginDrag(original.id, original);
      engine.moveDrag({ x: 200, y: 170 });
      engine.endDrag(true);
      expect(pose(engine, original.id)).toEqual(original);
      advance(engine, 90);
      expect(pose(engine, original.id)).toEqual(original);
    } finally {
      engine.dispose();
    }
  });

  test("stored poses hydrate by id, independently of object ordering", () => {
    const stored = initialPoses("apartment", SIZE).reverse().map((item) => ({ ...item, x: item.x + 4 }));
    const engine = createSceneEngine({ scene: "apartment", collision: "peg", size: SIZE, poses: stored });
    try {
      for (const item of stored) expect(pose(engine, item.id)).toEqual(item);
    } finally {
      engine.dispose();
    }
  });
});

test("local stage growth and membership changes preserve poses and an ongoing grab", () => {
  const size = { width: 500, height: 600 };
  const engine = createSceneEngine({ scene: "clump", collision: "outline", size });
  try {
    settle(engine);
    const before = engine.getPoses();
    const held = pose(engine, "octopus");
    engine.beginDrag(held.id, held);
    engine.resize({ width: 700, height: 800 }, true);
    const gift = { id: "gift-one", name: "Gift", emoji: "🎁", width: 48, height: 48, shape: "circle" as const };
    engine.syncObjects([...OBJECTS, gift], [{ id: gift.id, x: 600, y: 700, angle: 0 }]);
    expect(new Set(engine.getPoses().map((item) => item.id))).toEqual(new Set([...OBJECTS.map((item) => item.id), gift.id]));
    expect(engine.getPoses().filter((item) => item.id !== gift.id)).toEqual(before);
    engine.moveDrag({ x: held.x + 65, y: held.y - 80 });
    advance(engine, 25);
    expect(Math.hypot(pose(engine, held.id).x - held.x, pose(engine, held.id).y - held.y)).toBeGreaterThan(30);
    const beforeRemoval = engine.getPoses().filter((item) => item.id !== gift.id);
    engine.syncObjects(OBJECTS);
    expect(new Set(engine.getPoses().map((item) => item.id))).toEqual(new Set(OBJECTS.map((item) => item.id)));
    expect(engine.getPoses()).toEqual(beforeRemoval);
    const beforeContinuing = pose(engine, held.id);
    engine.moveDrag({ x: held.x - 65, y: held.y + 60 });
    advance(engine, 25);
    expect(pose(engine, held.id).x).toBeLessThan(beforeContinuing.x - 30);
    engine.endDrag();
  } finally { engine.dispose(); }
});

test("fresh poster clumps are denser, but a saved poster arrangement is not recompressed", () => {
  const engine = createSceneEngine({ scene: "clump", collision: "peg", size: SIZE });
  try {
    const poses = engine.getPoses();
    const originals = initialPoses("clump", SIZE);
    const span = (items: Pose[]) => Math.max(...items.map((item) => item.x)) - Math.min(...items.map((item) => item.x));
    expect(span(poses)).toBeLessThan(span(originals) * 0.8);
    const hydrated = createSceneEngine({ scene: "clump", collision: "peg", size: SIZE, poses });
    try {
      expect(hydrated.getPoses()).toEqual(poses);
    } finally {
      hydrated.dispose();
    }
  } finally {
    engine.dispose();
  }
});
