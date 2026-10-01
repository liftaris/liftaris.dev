import Matter from "matter-js";
import { isGift, type CollisionMode, type ObjectSpec, type Pose } from "./model";

/** Artwork overhangs this small, solid attachment point in peg mode. */
export function getPegRadius(spec: ObjectSpec): number {
  return Math.min(spec.width, spec.height) * 0.2;
}

export function createCollider(
  spec: ObjectSpec,
  pose: Pose,
  mode: CollisionMode,
  fixed: boolean,
): Matter.Body {
  const isGiftItem = isGift(spec);
  const options: Matter.IBodyDefinition = {
    label: spec.id,
    angle: isGiftItem ? pose.angle : 0,
    inertia: isGiftItem ? undefined : Infinity,
    inverseInertia: isGiftItem ? undefined : 0,
    density: 0.0015,
    friction: 0.22,
    frictionStatic: 0.5,
    frictionAir: isGiftItem ? 0.012 : 0.12,
    restitution: isGiftItem ? 0.45 : 0.05,
    sleepThreshold: 40,
  };

  // Footprints approximate the visible emoji rather than the whole text box.
  // They deliberately do not pretend to trace each glyph's alpha contour.
  const body = mode === "peg"
    ? Matter.Bodies.circle(pose.x, pose.y, getPegRadius(spec), options)
    : Matter.Bodies.rectangle(
        pose.x, pose.y, spec.width * 0.88, spec.height * 0.88,
        { ...options, chamfer: { radius: Math.min(spec.width, spec.height) * 0.13 } },
      );

  if (mode === "peg" && isGiftItem) {
    // Keep a small contact patch without the tiny disc's frantic spin when the
    // full-size artwork is grabbed off-center. Matter scales polygon inertia
    // by four; use the same convention for a virtual rectangular poster.
    Matter.Body.setInertia(
      body, body.mass * (spec.width ** 2 + spec.height ** 2) / 3,
    );
  } else if (!isGiftItem) {
    Matter.Body.setInertia(body, Infinity);
  }

  // Set static last so Matter retains the intended mass/inertia if unlocked.
  if (fixed) Matter.Body.setStatic(body, true);
  return body;
}
