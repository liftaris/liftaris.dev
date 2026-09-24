import { describe, expect, test } from "bun:test";
import Matter from "matter-js";
import { createCollider, getPegRadius } from "./colliders";
import { OBJECTS, type CollisionMode, type Pose } from "./model";

const computer = OBJECTS.find((object) => object.id === "computer")!;
const origin: Pose = { id: computer.id, x: 100, y: 100, angle: 0 };

describe("clump collision models", () => {
  test("overlapping artwork can pass in peg mode while footprints collide", () => {
    const nearby = { ...origin, x: origin.x + 35 };
    const footprintA = createCollider(computer, origin, "outline", false);
    const footprintB = createCollider(computer, nearby, "outline", false);
    const pegA = createCollider(computer, origin, "peg", false);
    const pegB = createCollider(computer, nearby, "peg", false);

    expect(Matter.Collision.collides(footprintA, footprintB)).not.toBeNull();
    expect(Matter.Collision.collides(pegA, pegB)).toBeNull();

    Matter.Body.setPosition(pegB, { x: origin.x + 15, y: origin.y });
    expect(Matter.Collision.collides(pegA, pegB)).not.toBeNull();
  });

  test("all attachment pegs are solid and substantially smaller than artwork", () => {
    for (const object of OBJECTS) {
      const body = createCollider(object, { ...origin, id: object.id }, "peg", false);
      const width = body.bounds.max.x - body.bounds.min.x;
      const height = body.bounds.max.y - body.bounds.min.y;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width).toBeLessThan(object.width / 2);
      expect(height).toBeLessThan(object.height / 2);
      expect(body.isSensor).toBe(false);
    }
  });

  test("a rotated footprint starts at its supplied pose without initial motion", () => {
    const unrotated = createCollider(computer, origin, "outline", false);
    const pose = { ...origin, x: 70, y: 120, angle: Math.PI / 2 };
    const rotated = createCollider(computer, pose, "outline", false);
    expect(rotated.position).toEqual({ x: pose.x, y: pose.y });
    expect(rotated.angle).toBe(pose.angle);
    expect(rotated.bounds.max.x - rotated.bounds.min.x).toBeCloseTo(
      unrotated.bounds.max.y - unrotated.bounds.min.y,
    );
    expect(rotated.bounds.max.y - rotated.bounds.min.y).toBeCloseTo(
      unrotated.bounds.max.x - unrotated.bounds.min.x,
    );
    expect(rotated.velocity).toEqual({ x: 0, y: 0 });
    expect(rotated.angularVelocity).toBe(0);
    expect(pose).toEqual({ id: computer.id, x: 70, y: 120, angle: Math.PI / 2 });
  });

  test("fixed structure objects retain position and rotation under force", () => {
    for (const mode of ["outline", "peg"] satisfies CollisionMode[]) {
      const pose = { ...origin, angle: 0.4 };
      const body = createCollider(computer, pose, mode, true);
      const engine = Matter.Engine.create();
      Matter.Composite.add(engine.world, body);
      Matter.Body.applyForce(body, { x: pose.x + 15, y: pose.y }, { x: 1, y: 1 });
      for (let step = 0; step < 10; step++) Matter.Engine.update(engine, 1000 / 60);
      expect(body.isStatic).toBe(true);
      expect(body.position).toEqual({ x: pose.x, y: pose.y });
      expect(body.angle).toBe(pose.angle);
      expect(body.inverseMass).toBe(0);
      expect(body.inverseInertia).toBe(0);
      Matter.Engine.clear(engine);
    }
  });

  test("grabbing a poster off-center can turn it without the bare peg's rapid spin", () => {
    const poster = createCollider(computer, origin, "peg", false);
    const barePeg = Matter.Bodies.circle(origin.x, origin.y, getPegRadius(computer), {
      density: poster.density,
      frictionAir: poster.frictionAir,
    });
    const grab = { x: origin.x + computer.width / 2, y: origin.y };
    for (const body of [poster, barePeg]) {
      const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
      Matter.Composite.add(engine.world, body);
      Matter.Body.applyForce(body, grab, { x: 0, y: 0.001 });
      Matter.Engine.update(engine, 1000 / 60);
      Matter.Engine.clear(engine);
    }
    expect(poster.angularVelocity).toBeGreaterThan(0);
    expect(poster.angularVelocity).toBeLessThan(barePeg.angularVelocity / 2);
  });
});
