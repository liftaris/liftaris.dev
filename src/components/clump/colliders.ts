import Matter from "matter-js";
import { type ObjectSpec, type Pose } from "./model";

export function createCollider(
  spec: ObjectSpec,
  pose: Pose,
): Matter.Body {
  const options: Matter.IBodyDefinition = {
    label: spec.id,
    angle: 0,
    inertia: Infinity,
    inverseInertia: 0,
    density: 0.0015,
    friction: 0.22,
    frictionStatic: 0.5,
    frictionAir: 0.12,
    restitution: 0.05,
    sleepThreshold: 40,
  };

  // Footprints approximate the visible emoji rather than the whole text box.
  // They deliberately do not pretend to trace each glyph's alpha contour.
  const body = Matter.Bodies.rectangle(
    pose.x, pose.y, spec.width * 0.88, spec.height * 0.88,
    { ...options, chamfer: { radius: Math.min(spec.width, spec.height) * 0.13 } },
  );
  Matter.Body.setInertia(body, Infinity);
  return body;
}
