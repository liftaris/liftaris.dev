import { createSceneEngine } from "../../components/clump/matter-engine";
import { initialPoses, OBJECTS, type Pose } from "../../components/clump/model";
import { giftObjects, worldSize } from "./emoji";
import type { Gift } from "./types";

export function initialSnapshotPoses(gifts: readonly Gift[]) {
  const size = worldSize(gifts.length);
  const poses = initialPoses("clump", size);
  gifts.forEach((gift, index) => {
    const radius = 80 + Math.sqrt(index) * 18;
    poses.push({ id: gift.id, x: size.width / 2 + Math.cos(index * 2.39996) * radius,
      y: size.height / 2 + Math.sin(index * 2.39996) * radius, angle: (index % 5 - 2) * .12 });
  });
  return { poses, size };
}

/** One authoritative settle per command, never a continuously running server loop. */
export function settleHouse(gifts: readonly Gift[], poses: readonly Pose[], changedPose?: Pose) {
  const initial = initialSnapshotPoses(gifts);
  const supplied = new Map(poses.map((pose) => [pose.id, pose]));
  if (changedPose) supplied.set(changedPose.id, changedPose);
  const engine = createSceneEngine({ scene: "clump", collision: "outline", size: initial.size,
    objects: [...OBJECTS, ...giftObjects(gifts)],
    poses: initial.poses.map((pose) => supplied.get(pose.id) ?? pose),
  });
  try {
    // Bounded work per placement. Clients present this canonical settled result.
    for (let frame = 0; frame < 240; frame++) {
      if (!engine.step(1000 / 60)) break;
    }
    return { size: initial.size, poses: engine.getPoses() };
  } finally {
    engine.dispose();
  }
}
