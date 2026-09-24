import { describe, expect, test } from "bun:test";
import type { Gift } from "../../lib/house/types";
import { reconcileGifts, retiringGiftIds } from "./gift-presence";

const gift = (id: string): Gift => ({ id, emojiId: "flower", authorName: "Visitor", createdAt: "2026-01-01T00:00:00Z", visibility: "public", message: null });

describe("local gift presence", () => {
  test("collection changes retain existing display order and deleted objects until their exit finishes", () => {
    const a = gift("a"), b = gift("b"), c = gift("c");
    const displayed = reconcileGifts([a, b], [b, c]);
    expect(displayed).toEqual([a, b, c]);
    expect(retiringGiftIds(displayed, [b, c], [])).toEqual(new Set(["a"]));
  });

  test("inspection and dragging protect only the active objects, without blocking additions or other deletions", () => {
    const a = gift("a"), b = gift("b"), c = gift("c"), arriving = gift("new");
    const displayed = reconcileGifts([a, b, c], [arriving]);
    expect(displayed).toEqual([a, b, c, arriving]);
    expect(retiringGiftIds(displayed, [arriving], [a.id, b.id])).toEqual(new Set([c.id]));
    expect(retiringGiftIds(displayed, [arriving], [])).toEqual(new Set([a.id, b.id, c.id]));
  });

  test("updates replace collection metadata without mutating an already opened gift snapshot", () => {
    const opened = gift("a");
    const updated = { ...opened, authorName: "Updated visitor" };
    expect(reconcileGifts([opened], [updated])).toEqual([updated]);
    expect(opened.authorName).toBe("Visitor");
  });
});
