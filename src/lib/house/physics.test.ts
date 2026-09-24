import { describe, expect, test } from "bun:test";
import { createSceneEngine } from "../../components/clump/matter-engine";
import { OBJECTS } from "../../components/clump/model";
import { EMOJI_CATALOG, giftObjects, localSuggestions } from "./emoji";
import { initialSnapshotPoses, settleHouse } from "./physics";
import type { Gift } from "./types";

const gift: Gift = { id: "gift-1", emojiId: "popcorn", authorName: "Capybara", createdAt: "2026-09-24T00:00:00Z", visibility: "public", message: null };

describe("shared house physics", () => {
  test("adding and removing a gift preserves existing bodies and cleans a removed drag", () => {
    const { size, poses } = initialSnapshotPoses([]);
    const engine = createSceneEngine({ size, poses, scene: "clump", collision: "outline" });
    engine.applyPoses(poses);
    const before = engine.getPoses();
    engine.syncObjects([...OBJECTS, ...giftObjects([gift])]);
    expect(engine.getPoses().filter((pose) => pose.id !== gift.id)).toEqual(before);
    const item = engine.getPoses().find((pose) => pose.id === gift.id)!;
    expect(engine.beginDrag(item.id, item)).toBe(true);
    engine.syncObjects(OBJECTS);
    expect(engine.getPoses()).toHaveLength(OBJECTS.length);
    expect(engine.getDebugShapes().some((shape) => shape.id === gift.id)).toBe(false);
    engine.dispose();
  });

  test("settling preserves every gift and produces bounded finite canonical positions", () => {
    const gifts = Array.from({ length: 40 }, (_, i) => ({ ...gift, id: `gift-${i}` }));
    const { poses, size } = settleHouse(gifts, []);
    expect(poses).toHaveLength(gifts.length + OBJECTS.length);
    expect(new Set(poses.map((pose) => pose.id)).size).toBe(poses.length);
    for (const pose of poses) {
      expect(Number.isFinite(pose.angle)).toBe(true);
      expect(pose.x).toBeGreaterThan(0);
      expect(pose.x).toBeLessThan(size.width);
      expect(pose.y).toBeGreaterThan(0);
      expect(pose.y).toBeLessThan(size.height);
    }
  });

  test("authoritative poses remain stationary until another interaction", () => {
    const { size, poses } = settleHouse([gift], []);
    const engine = createSceneEngine({ scene: "clump", collision: "outline", size, objects: [...OBJECTS, ...giftObjects([gift])] });
    engine.applyPoses(poses);
    expect(engine.step(1000 / 60)).toBe(false);
    expect(engine.getPoses()).toEqual(poses);
    engine.dispose();
  });
});

test("catalog fits one Jev Choice and exact emoji names win local fallback", () => {
  expect(EMOJI_CATALOG.length).toBeLessThanOrEqual(255);
  expect(new Set(EMOJI_CATALOG.map((item) => item.id)).size).toBe(EMOJI_CATALOG.length);
  expect(localSuggestions("popcorn")[0].emoji).toBe("🍿");
  expect(localSuggestions("🐙")[0].id).toBe("octopus");
});
