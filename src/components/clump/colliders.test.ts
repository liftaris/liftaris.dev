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

  test("things have infinite inertia and zero angle, while gifts retain rotation", () => {
    const unrotated = createCollider(computer, origin, "outline", false);
    expect(unrotated.angle).toBe(0);
    expect(unrotated.inverseInertia).toBe(0);

    const pose = { ...origin, x: 70, y: 120, angle: Math.PI / 2 };
    const thingCollider = createCollider(computer, pose, "outline", false);
    expect(thingCollider.position).toEqual({ x: pose.x, y: pose.y });
    expect(thingCollider.angle).toBe(0);
    expect(thingCollider.inverseInertia).toBe(0);

    const giftSpec = { ...computer, isGift: true };
    const giftCollider = createCollider(giftSpec, pose, "outline", false);
    expect(giftCollider.angle).toBe(pose.angle);
    expect(giftCollider.velocity).toEqual({ x: 0, y: 0 });
    expect(giftCollider.angularVelocity).toBe(0);
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
      expect(body.angle).toBe(0);
      expect(body.inverseMass).toBe(0);
      expect(body.inverseInertia).toBe(0);
      Matter.Engine.clear(engine);
    }
  });

  test("things do not turn from off-center force while gifts can turn", () => {
    const thingPoster = createCollider(computer, origin, "peg", false);
    const grab = { x: origin.x + computer.width / 2, y: origin.y };
    const engine1 = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    Matter.Composite.add(engine1.world, thingPoster);
    Matter.Body.applyForce(thingPoster, grab, { x: 0, y: 0.001 });
    Matter.Engine.update(engine1, 1000 / 60);
    expect(thingPoster.angularVelocity).toBe(0);
    expect(thingPoster.angle).toBe(0);
    Matter.Engine.clear(engine1);

    const giftPoster = createCollider({ ...computer, isGift: true }, origin, "peg", false);
    const barePeg = Matter.Bodies.circle(origin.x, origin.y, getPegRadius(computer), {
      density: giftPoster.density,
      frictionAir: giftPoster.frictionAir,
    });
    const engine2 = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    Matter.Composite.add(engine2.world, [giftPoster, barePeg]);
    Matter.Body.applyForce(giftPoster, grab, { x: 0, y: 0.001 });
    Matter.Body.applyForce(barePeg, grab, { x: 0, y: 0.001 });
    Matter.Engine.update(engine2, 1000 / 60);
    expect(giftPoster.angularVelocity).toBeGreaterThan(0);
    expect(giftPoster.angularVelocity).toBeLessThan(barePeg.angularVelocity / 2);
    Matter.Engine.clear(engine2);
  });
});
